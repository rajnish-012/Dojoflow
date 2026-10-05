const nodemailer = require("nodemailer");
const EmailSystemSettings = require("../models/EmailSystemSettings");
const AcademySettings = require("../models/AcademySettings");
const { decryptEmailPassword } = require("./emailCredentials.service");

const loadSettings = async () => EmailSystemSettings.findOne({ settingsKey: "primary" })
  .select("+smtpPasswordEncrypted")
  .lean();

const createTransporter = (settings) => {
  if (!settings) return null;
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: {
      user: settings.smtpUsername,
      pass: decryptEmailPassword(settings.smtpPasswordEncrypted),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const formatSchedule = (inquiry) => {
  const sessions = Array.isArray(inquiry.preferredWeeklySessions)
    ? inquiry.preferredWeeklySessions
    : [];
  if (sessions.length) {
    return sessions.map((session) =>
      `- ${session.dayName || "Day"}: ${session.sessionTypeName || "Program"}${session.sessionName ? ` - ${session.sessionName}` : ""} (${session.startTime || ""}${session.endTime ? `-${session.endTime}` : ""})`,
    ).join("\n");
  }
  if (inquiry.preferredSession) {
    const session = inquiry.preferredSession;
    return `- ${session.dayName || "Selected day"}: ${session.sessionTypeName || "Program"}${session.sessionName ? ` - ${session.sessionName}` : ""} (${session.startTime || ""}${session.endTime ? `-${session.endTime}` : ""})`;
  }
  return inquiry.preferredDate
    ? `Preferred date: ${inquiry.preferredDate}`
    : "No training schedule selected.";
};

const sendInquiryNotification = async (inquiry) => {
  const settings = await loadSettings();
  if (!settings) {
    console.warn("Inquiry email skipped: configure Email System in Settings first.");
    return { academySent: false, visitorConfirmationSent: false };
  }

  const academy = await AcademySettings.findOne({}).select("academyName").lean();
  const academyName = academy?.academyName || settings.fromName || "the academy";
  const from = { name: settings.fromName || academyName, address: settings.fromEmail };
  const schedule = formatSchedule(inquiry);
  const submittedAt = inquiry.createdAt
    ? new Date(inquiry.createdAt).toISOString()
    : new Date().toISOString();
  const detailLines = [
    `Name: ${inquiry.fullName}`,
    `Email: ${inquiry.email}`,
    `Phone: ${inquiry.phone}`,
    `Branch: ${inquiry.preferredBranch || "Not selected"}`,
    `Program(s): ${inquiry.programName || "Not selected"}`,
    `Plan: ${inquiry.planName || "Not selected"}`,
    "",
    "Selected training days and sessions:",
    schedule,
    `Message: ${inquiry.message || "No message provided."}`,
  ];

  const transporter = createTransporter(settings);
  const outcomes = await Promise.allSettled([
    transporter.sendMail({
      from,
      to: settings.notificationEmail,
      replyTo: inquiry.email,
      subject: `New inquiry${inquiry.planName ? `: ${inquiry.planName}` : ""} - ${inquiry.fullName}`,
      text: [
        `A new inquiry was submitted to ${academyName}.`,
        "",
        ...detailLines,
        "",
        `Submitted: ${submittedAt}`,
        `Inquiry ID: ${inquiry._id}`,
      ].join("\n"),
    }),
    transporter.sendMail({
      from,
      to: inquiry.email,
      replyTo: settings.notificationEmail,
      subject: `Thank you for contacting ${academyName}`,
      text: [
        `Hi ${inquiry.fullName},`,
        "",
        `Thank you for your inquiry to ${academyName}. We have received it and our team will contact you soon.`,
        "",
        "Here is a copy of the information you submitted:",
        ...detailLines,
        "",
        `Submitted: ${submittedAt}`,
        `Inquiry reference: ${inquiry._id}`,
        "",
        "Thank you,",
        academyName,
      ].join("\n"),
    }),
  ]);

  const [academyResult, visitorResult] = outcomes;
  if (academyResult.status === "rejected") {
    console.error("Academy inquiry notification email failed.");
  }
  if (visitorResult.status === "rejected") {
    console.error("Inquiry confirmation email failed.");
  }
  return {
    academySent: academyResult.status === "fulfilled",
    visitorConfirmationSent: visitorResult.status === "fulfilled",
  };
};

const sendEmailSystemTest = async () => {
  const settings = await loadSettings();
  if (!settings) throw new Error("Save Email System settings before sending a test email.");
  const transporter = createTransporter(settings);
  await transporter.sendMail({
    from: { name: settings.fromName || "Academy", address: settings.fromEmail },
    to: settings.notificationEmail,
    subject: "Email system test",
    text: "This test confirms that inquiry email notifications are configured correctly.",
  });
};

const sendPasswordResetEmail = async (to, resetUrl) => {
  const settings = await loadSettings();
  if (!settings) throw new Error("Password recovery email is not configured.");
  const transporter = createTransporter(settings);
  const academy = await AcademySettings.findOne({}).select("academyName").lean();
  const academyName = academy?.academyName || settings.fromName || "the academy";
  await transporter.sendMail({
    from: { name: settings.fromName || academyName, address: settings.fromEmail },
    to,
    subject: `Reset your ${academyName} password`,
    text: `A password reset was requested for your account. This link expires in 30 minutes and can be used once:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
};

module.exports = { sendInquiryNotification, sendEmailSystemTest, sendPasswordResetEmail };
