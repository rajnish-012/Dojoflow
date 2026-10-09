const EmailDelivery = require("../models/EmailDelivery");
const EmailSystemSettings = require("../models/EmailSystemSettings");
const AcademySettings = require("../models/AcademySettings");
const Student = require("../models/Student");
const { decryptEmailPassword } = require("./emailCredentials.service");
const nodemailer = require("nodemailer");
const { academyDateKey } = require("../utils/financeDates");

const loadSettings = () => EmailSystemSettings.findOne({ settingsKey: "primary" }).select("+smtpPasswordEncrypted").lean();

function createTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: { user: settings.smtpUsername, pass: decryptEmailPassword(settings.smtpPasswordEncrypted) },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function money(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

async function financeRecipients(studentId) {
  const student = await Student.findById(studentId).select("email guardians user").populate("user", "email").lean();
  if (!student) return [];
  // Prefer the student record's contact address, then their login address, then a guardian contact.
  const candidates = [student.email, student.user?.email, ...(student.guardians || []).map((guardian) => guardian.email)];
  const seen = new Set();
  return candidates
    .map((address) => String(address || "").trim().toLowerCase())
    .filter((address) => /^\S+@\S+\.\S+$/.test(address) && !seen.has(address) && seen.add(address));
}

async function sendOnce({ recipient, eventKey, category, subject, text, transporter, from }) {
  let reserved = false;
  try {
    await EmailDelivery.create({ recipient, eventKey, category, status: "PENDING", subject });
    reserved = true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const retry = await EmailDelivery.findOneAndUpdate(
      { recipient, eventKey, status: "FAILED" },
      { $set: { category, status: "PENDING", subject, lastError: "" } },
      { returnDocument: "after" },
    ).lean();
    reserved = Boolean(retry);
  }
  if (!reserved) return { sent: false, duplicate: true };

  try {
    await transporter.sendMail({ from, to: recipient, subject, text });
    await EmailDelivery.findOneAndUpdate(
      { recipient, eventKey },
      { $set: { category, status: "SENT", subject, lastError: "", sentAt: new Date() } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    return { sent: true, duplicate: false };
  } catch (error) {
    await EmailDelivery.findOneAndUpdate(
      { recipient, eventKey },
      { $set: { category, status: "FAILED", subject, lastError: String(error.message || "Email delivery failed").slice(0, 500), sentAt: null } },
      { upsert: true, setDefaultsOnInsert: true },
    ).catch(() => {});
    throw error;
  }
}

async function sendFinanceMessage({ studentId, eventKey, category, subject, text }) {
  const [settings, academy, recipients] = await Promise.all([loadSettings(), AcademySettings.findOne({}).select("academyName").lean(), financeRecipients(studentId)]);
  if (!settings || recipients.length === 0) return { sent: 0, skipped: recipients.length === 0 ? "no-recipient" : "email-not-configured" };
  const academyName = academy?.academyName || settings.fromName || "the academy";
  const transporter = createTransporter(settings);
  const from = { name: settings.fromName || academyName, address: settings.fromEmail };
  const results = await Promise.allSettled(recipients.map((recipient) => sendOnce({ recipient, eventKey, category, subject, text, transporter, from })));
  results.filter((result) => result.status === "rejected").forEach(() => console.error("Finance email delivery failed.", { category, eventKey }));
  return { sent: results.filter((result) => result.status === "fulfilled" && result.value.sent).length, failed: results.filter((result) => result.status === "rejected").length };
}

async function sendInvoiceIssuedEmail(invoice) {
  const subject = `Invoice ${invoice.invoiceNumber} from your academy`;
  return sendFinanceMessage({
    studentId: invoice.student,
    eventKey: `finance:invoice-issued:${invoice._id}`,
    category: "FINANCE_INVOICE_ISSUED",
    subject,
    text: [`Your invoice ${invoice.invoiceNumber} has been issued.`, "", `Amount due: ${money(invoice.balance, invoice.currency)}`, `Due date: ${academyDateKey(invoice.dueDate)}`, "", "Please contact the academy if you have any questions."].join("\n"),
  });
}

async function sendReceiptEmail({ payment, receipt, invoice, kind = "payment" }) {
  const isRefund = kind === "refund";
  const isCorrection = kind === "correction";
  const action = isRefund ? "refund" : isCorrection ? "payment correction" : "payment";
  const subject = `${isRefund ? "Refund" : isCorrection ? "Payment correction" : "Payment receipt"} ${receipt.receiptNumber}`;
  return sendFinanceMessage({
    studentId: invoice.student,
    eventKey: `finance:${action}:${payment._id}`,
    category: isRefund ? "FINANCE_REFUND_RECEIPT" : isCorrection ? "FINANCE_CORRECTION_RECEIPT" : "FINANCE_PAYMENT_RECEIPT",
    subject,
    text: [`Your ${action} has been recorded.`, "", `Receipt: ${receipt.receiptNumber}`, `Invoice: ${invoice.invoiceNumber}`, `Amount: ${money(payment.amount, invoice.currency)}`, `Invoice balance: ${money(invoice.balance, invoice.currency)}`, "", "Please keep this email for your records."].join("\n"),
  });
}

async function sendCorrectionEmail({ originalPaymentId, corrections, receipts, invoice }) {
  const replacement = corrections.find((payment) => payment.direction === "CREDIT");
  const reversal = corrections.find((payment) => payment.direction === "DEBIT");
  const receiptNumbers = receipts.map((receipt) => receipt.receiptNumber).filter(Boolean).join(", ");
  return sendFinanceMessage({
    studentId: invoice.student,
    eventKey: `finance:payment-correction:${originalPaymentId}`,
    category: "FINANCE_CORRECTION_RECEIPT",
    subject: `Payment correction for invoice ${invoice.invoiceNumber}`,
    text: ["A payment correction has been recorded.", "", `Invoice: ${invoice.invoiceNumber}`, reversal ? `Reversed amount: ${money(reversal.amount, invoice.currency)}` : "", replacement ? `Corrected amount: ${money(replacement.amount, invoice.currency)}` : "", receiptNumbers ? `Receipt reference${receiptNumbers.includes(",") ? "s" : ""}: ${receiptNumbers}` : "", `Invoice balance: ${money(invoice.balance, invoice.currency)}`, "", "Please keep this email for your records."].filter(Boolean).join("\n"),
  });
}

async function sendFinanceReminderEmail({ invoice, overdue, eventKey }) {
  const label = overdue ? "overdue" : "due within 24 hours";
  const subject = overdue ? `Invoice ${invoice.invoiceNumber} is overdue` : `Invoice ${invoice.invoiceNumber} is due soon`;
  return sendFinanceMessage({
    studentId: invoice.student,
    eventKey: `${eventKey}:email`,
    category: overdue ? "FINANCE_OVERDUE_REMINDER" : "FINANCE_DUE_REMINDER",
    subject,
    text: [`Invoice ${invoice.invoiceNumber} has an outstanding balance of ${money(invoice.balance, invoice.currency)} and is ${label}.`, "", `Due date: ${academyDateKey(invoice.dueDate)}`, "", "Please contact the academy if you need assistance."].join("\n"),
  });
}

module.exports = { sendInvoiceIssuedEmail, sendReceiptEmail, sendCorrectionEmail, sendFinanceReminderEmail };
