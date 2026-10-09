const nodemailer = require("nodemailer");
const EmailDelivery = require("../models/EmailDelivery");
const EmailSystemSettings = require("../models/EmailSystemSettings");
const AcademySettings = require("../models/AcademySettings");
const Student = require("../models/Student");
const { decryptEmailPassword } = require("./emailCredentials.service");

const loadSettings = () => EmailSystemSettings.findOne({ settingsKey: "primary" }).select("+smtpPasswordEncrypted").lean();

function transporter(settings) {
  return nodemailer.createTransport({
    host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecure,
    auth: { user: settings.smtpUsername, pass: decryptEmailPassword(settings.smtpPasswordEncrypted) },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
}

async function studentRecipients(studentId) {
  const student = await Student.findById(studentId).select("email guardians user").populate("user", "email").lean();
  if (!student) return [];
  const seen = new Set();
  return [student.user?.email, student.email, ...(student.guardians || []).map((guardian) => guardian.email)]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((email) => /^\S+@\S+\.\S+$/.test(email) && !seen.has(email) && seen.add(email));
}

async function reserveDelivery(recipient, eventKey, category, subject) {
  try {
    await EmailDelivery.create({ recipient, eventKey, category, status: "PENDING", subject });
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const retry = await EmailDelivery.findOneAndUpdate(
      { recipient, eventKey, status: "FAILED" },
      { $set: { category, status: "PENDING", subject, lastError: "" } },
      { returnDocument: "after" },
    ).lean();
    return Boolean(retry);
  }
}

async function sendEmailToRecipients({ recipients, eventKey, category, subject, text }) {
  const addresses = Array.from(new Set((recipients || []).map((value) => String(value || "").trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email))));
  const [settings, academy] = await Promise.all([loadSettings(), AcademySettings.findOne({}).select("academyName").lean()]);
  if (!settings || addresses.length === 0) return { sent: 0, skipped: true };
  const mailer = transporter(settings);
  const from = { name: settings.fromName || academy?.academyName || "Academy", address: settings.fromEmail };
  const results = await Promise.allSettled(addresses.map(async (recipient) => {
    if (!await reserveDelivery(recipient, eventKey, category, subject)) return false;
    try {
      await mailer.sendMail({ from, to: recipient, subject, text });
      await EmailDelivery.updateOne({ recipient, eventKey }, { $set: { status: "SENT", subject, lastError: "", sentAt: new Date() } });
      return true;
    } catch (error) {
      await EmailDelivery.updateOne({ recipient, eventKey }, { $set: { status: "FAILED", subject, lastError: String(error.message || "Email delivery failed").slice(0, 500), sentAt: null } }).catch(() => {});
      throw error;
    }
  }));
  results.filter((item) => item.status === "rejected").forEach(() => console.error("Communication email failed.", { category, eventKey }));
  return { sent: results.filter((item) => item.status === "fulfilled" && item.value).length };
}

async function sendStudentEmail({ studentId, eventKey, category, subject, text }) {
  return sendEmailToRecipients({ recipients: await studentRecipients(studentId), eventKey, category, subject, text });
}

module.exports = { sendStudentEmail, sendEmailToRecipients };
