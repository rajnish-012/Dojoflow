const AcademySettings = require("../models/AcademySettings");
const FinanceSequence = require("../models/FinanceSequence");
const Invoice = require("../models/Invoice");
const FeeTerm = require("../models/FeeTerm");
const auditService = require("./audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { academyDateKey, isPastDue } = require("../utils/financeDates");
const { validateBillingSnapshot } = require("./billingSnapshot.service");
const { normalizeCurrency } = require("../utils/currency");

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function createEnrollmentInvoice({ req, student, enrollment, plan, terms, branch, dueDate, session, notes = "Admission invoice" }) {
  const agreement = validateBillingSnapshot(enrollment);
  if (!agreement.valid) {
    const error = new Error(`This enrollment has no valid FeeTerm billing agreement. Missing: ${agreement.missing.join(", ")}.`);
    error.status = 409;
    throw error;
  }
  terms = enrollment.billingSnapshot;
  const frequency = terms.billingFrequency || "ONE_TIME";
  const amount = round(terms.amount || 0);
  const registration = round(terms.registrationFee || 0);
  const subtotal = round(amount + registration);
  if (subtotal <= 0) {
    const error = new Error("The selected Fee Term has no billable amount.");
    error.status = 400;
    throw error;
  }
  if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) {
    const error = new Error("A valid invoice due date is required.");
    error.status = 400;
    throw error;
  }

  const cycleKey = frequency === "ONE_TIME" ? "ONE_TIME" : `${frequency}:${academyDateKey(enrollment.startDate)}`;
  const existing = await Invoice.findOne({ enrollment: enrollment._id, cycleKey, status: { $ne: "CANCELLED" } }).session(session);
  if (existing) {
    const error = new Error("An invoice already exists for this enrollment billing period.");
    error.status = 409;
    throw error;
  }

  const taxRate = Number(terms.taxRate || 0);
  const tax = round(subtotal * taxRate / 100);
  const total = round(subtotal + tax);
  const year = new Date().getFullYear();
  const sequence = await FinanceSequence.findOneAndUpdate(
    { key: `INV:${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  const settings = await AcademySettings.findOne().session(session).lean();
  const feeTerm = terms.currency ? null : await FeeTerm.findById(enrollment.feeTerm || terms.feeTerm).select("currency").session(session).lean();
  const currency = terms.currency || normalizeCurrency(feeTerm?.currency) || normalizeCurrency(settings?.currency) || "INR";
  const periodStart = new Date(enrollment.startDate);
  const periodEnd = new Date(periodStart);
  const months = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : frequency === "YEARLY" ? 12 : 0;
  if (months) {
    const day = periodEnd.getUTCDate();
    periodEnd.setUTCDate(1);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 0)).getUTCDate();
    periodEnd.setUTCDate(Math.min(day, lastDay));
  }
  const items = [{ description: terms.planName, quantity: 1, unitAmount: amount, amount, kind: "TUITION" }];
  if (registration > 0) items.push({ description: "Registration fee", quantity: 1, unitAmount: registration, amount: registration, kind: "REGISTRATION" });
  const invoiceNumber = `INV-${year}-${String(sequence.value).padStart(6, "0")}`;
  const [invoice] = await Invoice.create([{
    invoiceNumber,
    student: student._id,
    enrollment: enrollment._id,
    plan: plan._id,
    feeTerm: enrollment.feeTerm || terms.feeTerm || null,
    branch: branch._id,
    items,
    subtotal,
    discount: 0,
    taxRate,
    tax,
    total,
    balance: total,
    currency,
    dueDate: new Date(dueDate),
    periodStart,
    periodEnd: months ? periodEnd : periodStart,
    cycleKey,
    status: isPastDue(dueDate) ? "OVERDUE" : "ISSUED",
    notes: String(notes).slice(0, 1000),
    createdBy: req.user._id,
    issuedAt: new Date(),
  }], { session });

  await auditService.record({
    req,
    session,
    action: AUDIT_ACTIONS.INVOICE_CREATED,
    entityType: "INVOICE",
    entityId: invoice._id,
    branchId: branch._id,
    after: { invoiceNumber, total, status: invoice.status },
    metadata: { source: "ENROLLMENT" },
    legacy: { student: student._id, invoice: invoice._id },
  });
  return invoice;
}

module.exports = { createEnrollmentInvoice };
