const mongoose = require("mongoose");
const AcademySettings = require("../models/AcademySettings");
const Branch = require("../models/Branch");
const FinanceAudit = require("../models/FinanceAudit");
const auditService = require("../services/audit.service");
const FinanceSequence = require("../models/FinanceSequence");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const FeeTerm = require("../models/FeeTerm");
const TrainingSessionType = require("../models/TrainingSessionType");
const Receipt = require("../models/Receipt");
const Student = require("../models/Student");
const { isBranchScoped } = require("../utils/access");
const { FINANCE_TIME_ZONE, academyDateKey, academyDayStart, academyMonthStart, academyYearMonth, isPastDue } = require("../utils/financeDates");
const { safelyNotify, createNotification } = require("../services/notification.service");
const { sendInvoiceIssuedEmail, sendReceiptEmail, sendCorrectionEmail } = require("../services/financeEmail.service");
const { completeOrderForInvoice, releaseOrderReservation, publishStockTransitions } = require("../services/inventory.service");
const InventoryOrder = require("../models/InventoryOrder");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { validateBillingSnapshot } = require("../services/billingSnapshot.service");
const { normalizeCurrency } = require("../utils/currency");

const FREQUENCIES = new Set(["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"]);
const METHODS = new Set(["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"]);
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const getBranchId = (user) => user?.branch?._id || user?.branch || null;
const branchFilter = (user) => isBranchScoped(user) ? { branch: getBranchId(user) || null } : {};
const queryInScope = (user, branch) => !isBranchScoped(user) || String(getBranchId(user) || "") === String(branch || "");
const createSession = async (work) => {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
  catch (error) {
    if (error.code === 20 || /transaction numbers are only allowed on a replica set member or mongos/i.test(error.message || "")) {
      error.status = 503;
      error.message = "Financial writes require MongoDB running as a replica set or mongos (MongoDB Atlas supports this).";
    }
    throw error;
  }
  finally { await session.endSession(); }
};

async function nextNumber(prefix, session) {
  const year = new Date().getFullYear();
  const key = `${prefix}:${year}`;
  const row = await FinanceSequence.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after", session });
  return `${prefix}-${year}-${String(row.value).padStart(6, "0")}`;
}

async function writeReceipt(payment, invoice, session) {
  const student = await Student.findById(payment.student).select("name").session(session).lean();
  const settings = await AcademySettings.findOne().session(session).lean();
  const branch = await Branch.findById(payment.branch).select("name address phone").session(session).lean();
  const receiptNumber = await nextNumber("RCT", session);
  const [receipt] = await Receipt.create([{
    receiptNumber, payment: payment._id, invoice: invoice._id, student: payment.student, branch: payment.branch,
    amount: payment.amount, direction: payment.direction, kind: payment.kind, method: payment.method,
    date: payment.paymentDate, currency: invoice.currency,
    academy: { name: settings?.academyName || "ForceStrike Academy", logoUrl: settings?.logoUrl || "", address: settings?.address || branch?.address || "", contactEmail: settings?.contactEmail || "", contactPhone: settings?.contactPhone || branch?.phone || "", primaryColor: settings?.primaryColor || "#D7A84B" },
    studentName: student?.name || "Student", invoiceNumber: invoice.invoiceNumber, issuedBy: payment.receivedBy,
  }], { session });
  return receipt;
}

function currentStatus(total, paidAmount, dueDate, currentStatus = "ISSUED") {
  const balance = round(Math.max(0, total - paidAmount));
  if (balance === 0 && total > 0) return "PAID";
  if (paidAmount === 0 && currentStatus === "REFUNDED") return "REFUNDED";
  if (paidAmount > 0) return isPastDue(dueDate) ? "OVERDUE" : "PARTIALLY_PAID";
  return isPastDue(dueDate) ? "OVERDUE" : "ISSUED";
}

function periodFor(frequency, start) {
  const from = new Date(start);
  const until = new Date(from);
  const months = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : frequency === "YEARLY" ? 12 : 0;
  if (months) {
    const day = until.getUTCDate();
    until.setUTCDate(1);
    until.setUTCMonth(until.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth() + 1, 0)).getUTCDate();
    until.setUTCDate(Math.min(day, lastDay));
  }
  return { periodStart: from, periodEnd: until, cycleKey: frequency === "ONE_TIME" ? "ONE_TIME" : `${frequency}:${academyDateKey(from)}` };
}

function asAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? round(number) : null;
}

async function audit(req, session, values) {
  const { action, branch, student, invoice, payment, feeTerm, reason, before, after } = values;
const entityType = payment ? "PAYMENT" : invoice ? "INVOICE" : student ? "STUDENT" : feeTerm ? "FEE_TERM" : "FINANCE";
  const entityId = payment || invoice || student || feeTerm || null;
  await auditService.record({ req, session, action, entityType, entityId, branchId: branch, before, after, metadata: reason ? { reason } : {}, legacy: { student: student || null, invoice: invoice || null, payment: payment || null, reason: reason || "" } });
}

async function getInvoiceAccess(req, invoiceId, session) {
  if (!isId(invoiceId)) return { error: { status: 400, message: "Invalid invoice ID" } };
  const invoice = await Invoice.findById(invoiceId).session(session || null);
  if (!invoice) return { error: { status: 404, message: "Invoice not found" } };
  if (!queryInScope(req.user, invoice.branch)) return { error: { status: 404, message: "Invoice not found" } };
  return { invoice };
}

const FEE_TERM_STATUSES = new Set(["DRAFT", "ACTIVE", "RETIRED"]);
async function configuredCurrency(session) {
  const query = AcademySettings.findOne().select("currency");
  if (session) query.session(session);
  const settings = await query.lean();
  const currency = normalizeCurrency(settings?.currency || "INR");
  if (!currency) {
    const error = new Error("Academy currency is unsupported. Choose a supported currency in Academy Branding before managing FeeTerms.");
    error.status = 409;
    throw error;
  }
  return currency;
}
const feeTermMutableFields = new Set([
  "branch", "billingFrequency", "amount", "registrationFee", "taxRate",
  "discountRules", "effectiveFrom", "effectiveUntil", "status", "reason",
]);

function dateInput(value, label, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) return { error: `${label} is required` };
    return { value: null };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${label} is invalid` };
  date.setUTCHours(0, 0, 0, 0);
  return { value: date };
}

function dayBefore(value) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() - 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function discountRulesAreValid(rules) {
  return Array.isArray(rules) && rules.every(
    (rule) => rule?.name?.trim()
      && ["FIXED", "PERCENT"].includes(rule.type)
      && asAmount(rule.amount) !== null
      && (rule.type !== "PERCENT" || Number(rule.amount) <= 100),
  );
}

function feeTermAuditSnapshot(term) {
  const current = term?.toObject ? term.toObject() : term;
  return {
    _id: current._id,
    plan: current.plan?._id || current.plan,
    branch: current.branch?._id || current.branch || null,
    billingFrequency: current.billingFrequency,
    currency: current.currency || null,
    amount: current.amount,
    registrationFee: current.registrationFee,
    taxRate: current.taxRate,
    discountRules: current.discountRules || [],
    effectiveFrom: current.effectiveFrom,
    effectiveUntil: current.effectiveUntil,
    status: current.status,
    version: current.version,
    supersedes: current.supersedes || null,
  };
}

async function feeTermBranch(req, input, session, { defaultToAssigned = false } = {}) {
  const assigned = getBranchId(req.user);
  const candidate = input === undefined && defaultToAssigned ? assigned : input;
  if (candidate === undefined || candidate === null || candidate === "") {
    if (isBranchScoped(req.user)) {
      const error = new Error("A branch-scoped user must use their assigned branch");
      error.status = 403;
      throw error;
    }
    return null;
  }
  if (!isId(candidate)) {
    const error = new Error("A valid branch ID is required");
    error.status = 400;
    throw error;
  }
  if (isBranchScoped(req.user) && String(candidate) !== String(assigned || "")) {
    const error = new Error("You can only manage FeeTerms for your assigned branch");
    error.status = 403;
    throw error;
  }
  const branch = await Branch.findById(candidate).select("_id isActive").session(session);
  if (!branch || branch.isActive === false) {
    const error = new Error("Selected branch is unavailable");
    error.status = 400;
    throw error;
  }
  return branch._id;
}

async function ensureNoActiveFeeTermOverlap({ plan, branch, billingFrequency, effectiveFrom, effectiveUntil, excludeId = null, session }) {
  const candidateEnd = effectiveUntil || new Date("9999-12-31T00:00:00.000Z");
  const query = {
    plan,
    branch: branch || null,
    billingFrequency,
    status: "ACTIVE",
    effectiveFrom: { $lte: candidateEnd },
    $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: effectiveFrom } }],
  };
  if (excludeId) query._id = { $ne: excludeId };
  const overlap = await FeeTerm.findOne(query).select("_id effectiveFrom effectiveUntil").session(session);
  if (overlap) {
    const error = new Error("An active FeeTerm already overlaps this plan, branch, billing frequency, and effective period");
    error.status = 409;
    throw error;
  }
}

async function getFeeTermInScope(req, feeTermId, session) {
  if (!isId(feeTermId)) {
    const error = new Error("Invalid FeeTerm ID");
    error.status = 400;
    throw error;
  }
  const feeTerm = await FeeTerm.findById(feeTermId).session(session);
  if (!feeTerm || !queryInScope(req.user, feeTerm.branch)) {
    const error = new Error("FeeTerm not found");
    error.status = 404;
    throw error;
  }
  return feeTerm;
}

async function lockFeeTermSchedule(planId, session) {
  const result = await Plan.updateOne({ _id: planId }, { $inc: { feeTermsRevision: 1 } }, { session });
  if (!result.matchedCount) {
    const error = new Error("Training plan not found");
    error.status = 404;
    throw error;
  }
}

const listFeeTerms = async (req, res) => {
  if (!isId(req.params.planId)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
  try {
    const plan = await Plan.findById(req.params.planId).select("_id name").lean();
    if (!plan) return res.status(404).json({ success: false, message: "Training plan not found" });
    const query = { plan: plan._id };
    if (isBranchScoped(req.user)) query.$or = [{ branch: getBranchId(req.user) }, { branch: null }];
    const feeTerms = await FeeTerm.find(query)
      .populate("plan", "name")
      .populate("branch", "name")
      .sort({ billingFrequency: 1, effectiveFrom: -1, version: -1 })
      .lean();
    res.json({ success: true, feeTerms });
  } catch (error) {
    console.error("FeeTerm list failed", { name: error.name });
    res.status(500).json({ success: false, message: "Failed to load FeeTerms" });
  }
};

const listAllFeeTerms = async (req, res) => {
  try {
    const query = {};
    if (req.query.planId) {
      if (!isId(req.query.planId)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
      query.plan = req.query.planId;
    }
    if (isBranchScoped(req.user)) {
      const branchId = getBranchId(req.user);
      if (!branchId) return res.status(403).json({ success: false, message: "A branch is required" });
      if (req.query.branchId && String(req.query.branchId) !== String(branchId)) return res.status(403).json({ success: false, message: "You cannot view FeeTerms for another branch" });
      query.$or = [{ branch: branchId }, { branch: null }];
    } else if (req.query.branchId) {
      if (!isId(req.query.branchId)) return res.status(400).json({ success: false, message: "Invalid branch ID" });
      query.$or = [{ branch: req.query.branchId }, { branch: null }];
    }
    if (req.query.billingFrequency) {
      if (!FREQUENCIES.has(req.query.billingFrequency)) return res.status(400).json({ success: false, message: "Invalid billing frequency" });
      query.billingFrequency = req.query.billingFrequency;
    }
    if (req.query.status) {
      if (!FEE_TERM_STATUSES.has(req.query.status)) return res.status(400).json({ success: false, message: "Invalid FeeTerm status" });
      query.status = req.query.status;
    }
    if (req.query.asOf) {
      const asOf = dateInput(req.query.asOf, "Effective date", { required: true });
      if (asOf.error) return res.status(400).json({ success: false, message: asOf.error });
      query.effectiveFrom = { $lte: asOf.value };
      query.$and = [{ $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: asOf.value } }] }];
    }
    const feeTerms = await FeeTerm.find(query)
      .populate("plan", "name")
      .populate("branch", "name")
      .sort({ plan: 1, billingFrequency: 1, effectiveFrom: -1, version: -1 })
      .lean();
    res.json({ success: true, feeTerms });
  } catch (error) {
    console.error("FeeTerm list failed", { name: error.name });
    res.status(500).json({ success: false, message: "Failed to load FeeTerms" });
  }
};

const createFeeTerm = async (req, res) => {
  if (!isId(req.params.planId)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
  const values = req.body || {};
  if (Object.keys(values).some((key) => !feeTermMutableFields.has(key))) return res.status(400).json({ success: false, message: "Only FeeTerm fields can be changed here" });
  const from = dateInput(values.effectiveFrom, "Effective start date", { required: true });
  const until = dateInput(values.effectiveUntil, "Effective end date");
  if (from.error || until.error) return res.status(400).json({ success: false, message: from.error || until.error });
  if (until.value && until.value < from.value) return res.status(400).json({ success: false, message: "Effective end date must follow the start date" });
  if (!FREQUENCIES.has(values.billingFrequency)) return res.status(400).json({ success: false, message: "Invalid billing frequency" });
  if (asAmount(values.amount) === null || Number(values.amount) < 0) return res.status(400).json({ success: false, message: "Fee amount must be zero or greater" });
  if (asAmount(values.registrationFee ?? 0) === null) return res.status(400).json({ success: false, message: "Registration fee must be zero or greater" });
  if (!Number.isFinite(Number(values.taxRate ?? 0)) || Number(values.taxRate ?? 0) < 0 || Number(values.taxRate ?? 0) > 100) return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 100" });
  if (values.discountRules !== undefined && !discountRulesAreValid(values.discountRules)) return res.status(400).json({ success: false, message: "Discount rules are invalid" });
  const status = values.status || "ACTIVE";
  if (!FEE_TERM_STATUSES.has(status)) return res.status(400).json({ success: false, message: "FeeTerm status is invalid" });
  try {
    const feeTerm = await createSession(async (session) => {
      const plan = await Plan.findById(req.params.planId).select("_id name").session(session);
      if (!plan) { const error = new Error("Training plan not found"); error.status = 404; throw error; }
      const branch = await feeTermBranch(req, values.branch, session, { defaultToAssigned: true });
      const currency = await configuredCurrency(session);
      // A write to the parent Plan serializes range checks for this schedule.
      await lockFeeTermSchedule(plan._id, session);
      if (status === "ACTIVE") await ensureNoActiveFeeTermOverlap({ plan: plan._id, branch, billingFrequency: values.billingFrequency, effectiveFrom: from.value, effectiveUntil: until.value, session });
      const latest = await FeeTerm.findOne({ plan: plan._id, branch: branch || null, billingFrequency: values.billingFrequency }).sort({ version: -1 }).select("version").session(session);
      const [created] = await FeeTerm.create([{
        plan: plan._id,
        branch,
        currency,
        billingFrequency: values.billingFrequency,
        amount: round(values.amount),
        registrationFee: round(values.registrationFee ?? 0),
        taxRate: Number(values.taxRate ?? 0),
        discountRules: values.discountRules || [],
        effectiveFrom: from.value,
        effectiveUntil: until.value,
        status,
        version: Number(latest?.version || 0) + 1,
      }], { session });
      await audit(req, session, { action: AUDIT_ACTIONS.FEE_TERM_CREATED, feeTerm: created._id, branch, reason: String(values.reason || "FeeTerm created").slice(0, 500), before: null, after: feeTermAuditSnapshot(created) });
      return created;
    });
    await feeTerm.populate("plan", "name");
    await feeTerm.populate("branch", "name");
    res.status(201).json({ success: true, feeTerm });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A FeeTerm already exists for this plan, branch, billing frequency, and effective start date" });
    console.error("FeeTerm create failed", { name: error.name, code: error.code, message: error.message });
    res.status(500).json({ success: false, message: "Failed to create FeeTerm" });
  }
};

const updateFeeTerm = async (req, res) => {
  const values = req.body || {};
  if (Object.keys(values).some((key) => !feeTermMutableFields.has(key))) return res.status(400).json({ success: false, message: "Only FeeTerm fields can be changed here" });
  try {
    const feeTerm = await createSession(async (session) => {
      const record = await getFeeTermInScope(req, req.params.feeTermId, session);
      const before = feeTermAuditSnapshot(record);
      const nextBranch = values.branch === undefined ? record.branch : await feeTermBranch(req, values.branch, session);
      const nextFrequency = values.billingFrequency === undefined ? record.billingFrequency : values.billingFrequency;
      const from = values.effectiveFrom === undefined ? { value: record.effectiveFrom } : dateInput(values.effectiveFrom, "Effective start date", { required: true });
      const until = values.effectiveUntil === undefined ? { value: record.effectiveUntil } : dateInput(values.effectiveUntil, "Effective end date");
      const nextStatus = values.status === undefined ? record.status : values.status;
      if (from.error || until.error) { const error = new Error(from.error || until.error); error.status = 400; throw error; }
      if (until.value && until.value < from.value) { const error = new Error("Effective end date must follow the start date"); error.status = 400; throw error; }
      if (!FREQUENCIES.has(nextFrequency)) { const error = new Error("Invalid billing frequency"); error.status = 400; throw error; }
      if (!FEE_TERM_STATUSES.has(nextStatus)) { const error = new Error("FeeTerm status is invalid"); error.status = 400; throw error; }
      if (values.amount !== undefined && (asAmount(values.amount) === null || Number(values.amount) < 0)) { const error = new Error("Fee amount must be zero or greater"); error.status = 400; throw error; }
      if (values.registrationFee !== undefined && asAmount(values.registrationFee) === null) { const error = new Error("Registration fee must be zero or greater"); error.status = 400; throw error; }
      if (values.taxRate !== undefined && (!Number.isFinite(Number(values.taxRate)) || Number(values.taxRate) < 0 || Number(values.taxRate) > 100)) { const error = new Error("Tax rate must be between 0 and 100"); error.status = 400; throw error; }
      if (values.discountRules !== undefined && !discountRulesAreValid(values.discountRules)) { const error = new Error("Discount rules are invalid"); error.status = 400; throw error; }
      const used = await Student.exists({ "planEnrollments.feeTerm": record._id }).session(session);
      const historicalFields = ["branch", "billingFrequency", "amount", "registrationFee", "taxRate", "discountRules", "effectiveFrom", "effectiveUntil"];
      if (used && historicalFields.some((field) => values[field] !== undefined)) { const error = new Error("A used FeeTerm cannot change financial or effective-date fields; create a successor instead"); error.status = 409; throw error; }
      await lockFeeTermSchedule(record.plan, session);
      if (nextStatus === "ACTIVE") await ensureNoActiveFeeTermOverlap({ plan: record.plan, branch: nextBranch, billingFrequency: nextFrequency, effectiveFrom: from.value, effectiveUntil: until.value, excludeId: record._id, session });
      record.branch = nextBranch;
      record.billingFrequency = nextFrequency;
      if (values.amount !== undefined) record.amount = round(values.amount);
      if (values.registrationFee !== undefined) record.registrationFee = round(values.registrationFee);
      if (values.taxRate !== undefined) record.taxRate = Number(values.taxRate);
      if (values.discountRules !== undefined) record.discountRules = values.discountRules;
      record.effectiveFrom = from.value;
      record.effectiveUntil = until.value;
      record.status = nextStatus;
      await record.save({ session });
      const action = nextStatus === "RETIRED" && before.status !== "RETIRED" ? AUDIT_ACTIONS.FEE_TERM_RETIRED : AUDIT_ACTIONS.FEE_TERM_UPDATED;
      await audit(req, session, { action, feeTerm: record._id, branch: record.branch, reason: String(values.reason || "FeeTerm updated").slice(0, 500), before, after: feeTermAuditSnapshot(record) });
      return record;
    });
    await feeTerm.populate("plan", "name");
    await feeTerm.populate("branch", "name");
    res.json({ success: true, feeTerm });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A FeeTerm already exists for this plan, branch, billing frequency, and effective start date" });
    console.error("FeeTerm update failed", { name: error.name, code: error.code });
    res.status(500).json({ success: false, message: "Failed to update FeeTerm" });
  }
};

const supersedeFeeTerm = async (req, res) => {
  const values = req.body || {};
  const allowed = new Set(["amount", "registrationFee", "taxRate", "discountRules", "effectiveFrom", "effectiveUntil", "reason"]);
  if (Object.keys(values).some((key) => !allowed.has(key))) return res.status(400).json({ success: false, message: "Only successor FeeTerm fields can be changed here" });
  const from = dateInput(values.effectiveFrom, "Successor effective start date", { required: true });
  const until = dateInput(values.effectiveUntil, "Successor effective end date");
  if (from.error || until.error) return res.status(400).json({ success: false, message: from.error || until.error });
  if (until.value && until.value < from.value) return res.status(400).json({ success: false, message: "Effective end date must follow the start date" });
  if (asAmount(values.amount) === null || Number(values.amount) < 0) return res.status(400).json({ success: false, message: "Fee amount must be zero or greater" });
  if (asAmount(values.registrationFee ?? 0) === null) return res.status(400).json({ success: false, message: "Registration fee must be zero or greater" });
  if (!Number.isFinite(Number(values.taxRate ?? 0)) || Number(values.taxRate ?? 0) < 0 || Number(values.taxRate ?? 0) > 100) return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 100" });
  if (values.discountRules !== undefined && !discountRulesAreValid(values.discountRules)) return res.status(400).json({ success: false, message: "Discount rules are invalid" });
  try {
    const output = await createSession(async (session) => {
      const previous = await getFeeTermInScope(req, req.params.feeTermId, session);
      if (previous.status !== "ACTIVE") { const error = new Error("Only an active FeeTerm can be superseded"); error.status = 409; throw error; }
      if (from.value <= previous.effectiveFrom) { const error = new Error("A successor must start after the previous FeeTerm"); error.status = 400; throw error; }
      if (await FeeTerm.exists({ supersedes: previous._id }).session(session)) { const error = new Error("This FeeTerm already has a successor"); error.status = 409; throw error; }
      const before = feeTermAuditSnapshot(previous);
      const currency = await configuredCurrency(session);
      await lockFeeTermSchedule(previous.plan, session);
      await ensureNoActiveFeeTermOverlap({ plan: previous.plan, branch: previous.branch, billingFrequency: previous.billingFrequency, effectiveFrom: from.value, effectiveUntil: until.value, excludeId: previous._id, session });
      const closeDate = dayBefore(from.value);
      if (!previous.effectiveUntil || previous.effectiveUntil > closeDate) previous.effectiveUntil = closeDate;
      previous.status = "RETIRED";
      await previous.save({ session });
      const [successor] = await FeeTerm.create([{
        plan: previous.plan,
        branch: previous.branch,
        currency,
        billingFrequency: previous.billingFrequency,
        amount: round(values.amount),
        registrationFee: round(values.registrationFee ?? 0),
        taxRate: Number(values.taxRate ?? 0),
        discountRules: values.discountRules === undefined ? previous.discountRules : values.discountRules,
        effectiveFrom: from.value,
        effectiveUntil: until.value,
        status: "ACTIVE",
        version: previous.version + 1,
        supersedes: previous._id,
      }], { session });
      await audit(req, session, { action: AUDIT_ACTIONS.FEE_TERM_SUPERSEDED, feeTerm: previous._id, branch: previous.branch, reason: String(values.reason || "FeeTerm superseded").slice(0, 500), before, after: { retired: feeTermAuditSnapshot(previous), successor: feeTermAuditSnapshot(successor) } });
      return { previous, successor };
    });
    await output.previous.populate("plan", "name");
    await output.previous.populate("branch", "name");
    await output.successor.populate("plan", "name");
    await output.successor.populate("branch", "name");
    res.status(201).json({ success: true, previous: output.previous, feeTerm: output.successor });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A FeeTerm already exists for this plan, branch, billing frequency, and effective start date" });
    console.error("FeeTerm supersede failed", { name: error.name, code: error.code });
    res.status(500).json({ success: false, message: "Failed to supersede FeeTerm" });
  }
};

const getAvailableFeeTerms = async (req, res) => {
  const { planId, branchId, asOf } = req.query || {};
  if (!isId(planId) || !isId(branchId)) return res.status(400).json({ success: false, message: "Valid planId and branchId are required" });
  if (isBranchScoped(req.user) && String(branchId) !== String(getBranchId(req.user) || "")) return res.status(403).json({ success: false, message: "You can only view FeeTerms for your assigned branch" });
  const date = dateInput(asOf, "Start date", { required: true });
  if (date.error) return res.status(400).json({ success: false, message: date.error });
  try {
    const [plan, branch] = await Promise.all([
      Plan.findById(planId).select("_id name").lean(),
      Branch.findById(branchId).select("_id isActive").lean(),
    ]);
    if (!plan) return res.status(404).json({ success: false, message: "Training plan not found" });
    if (!branch || branch.isActive === false) return res.status(400).json({ success: false, message: "Selected branch is unavailable" });
    const scopedTerms = { plan: plan._id, branch: { $in: [branch._id, null] } };
    const [terms, existingTerms] = await Promise.all([FeeTerm.find({
      ...scopedTerms,
      status: "ACTIVE",
      effectiveFrom: { $lte: date.value },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: date.value } }],
    }).populate("plan", "name").populate("branch", "name").sort({ billingFrequency: 1, branch: -1, version: -1 }).lean(), FeeTerm.find(scopedTerms).select("status effectiveFrom effectiveUntil").lean()]);
    const exactFrequencies = new Set(terms.filter((term) => String(term.branch?._id || term.branch || "") === String(branch._id)).map((term) => term.billingFrequency));
    const feeTerms = terms.filter((term) => term.branch || !exactFrequencies.has(term.billingFrequency));
    const availability = {
      configuredCount: existingTerms.length,
      inactiveCount: existingTerms.filter((term) => term.status !== "ACTIVE").length,
      notYetEffectiveCount: existingTerms.filter((term) => term.status === "ACTIVE" && new Date(term.effectiveFrom) > date.value).length,
      expiredCount: existingTerms.filter((term) => term.status === "ACTIVE" && term.effectiveUntil && new Date(term.effectiveUntil) < date.value).length,
      applicableCount: feeTerms.length,
    };
    res.json({ success: true, feeTerms, availability });
  } catch (error) {
    console.error("Available FeeTerms read failed", { name: error.name });
    res.status(500).json({ success: false, message: "Failed to load available FeeTerms" });
  }
};

const getFeeTermPlanOptions = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: { $ne: false } })
      .select("name duration durationUnit programs isActive")
      .populate("programs.program", "name")
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, plans });
  } catch (error) {
    console.error("FeeTerm Plan options read failed", { name: error.name });
    res.status(500).json({ success: false, message: "Failed to load Training Plans" });
  }
};

const getInvoiceCandidates = async (req, res) => {
  try {
    const students = await Student.find({ status: { $ne: "INACTIVE" }, ...(isBranchScoped(req.user) ? { branch: getBranchId(req.user) || null } : {}) })
      .select("name branch planEnrollments")
      .populate("planEnrollments.plan", "name")
      .sort({ name: 1 }).lean();
    res.json({ success: true, students });
  } catch (error) { console.error("Invoice candidates read failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load students" }); }
};

const getFeeBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: { $ne: false }, ...(isBranchScoped(req.user) ? { _id: getBranchId(req.user) || null } : {}) }).select("name").sort({ name: 1 }).lean();
    res.json({ success: true, branches });
  } catch (error) { console.error("Fee branches read failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load branches" }); }
};

const createInvoice = async (req, res) => {
  const { studentId, enrollmentId, dueDate: dueDateInput, discountRuleId, notes = "", status = "ISSUED", periodStart: periodStartInput } = req.body || {};
  if (!isId(studentId) || !isId(enrollmentId)) return res.status(400).json({ success: false, message: "Valid student and enrollment IDs are required" });
  if (!dueDateInput || Number.isNaN(new Date(dueDateInput).getTime()) || !["DRAFT", "ISSUED"].includes(status)) return res.status(400).json({ success: false, message: "A valid due date and invoice status are required" });
  try {
    const invoice = await createSession(async (session) => {
      const student = await Student.findById(studentId).session(session);
      if (!student) { const error = new Error("Student not found"); error.status = 404; throw error; }
      const enrollment = student.planEnrollments.id(enrollmentId);
      if (!enrollment) { const error = new Error("Enrollment not found for this student"); error.status = 404; throw error; }
      const enrollmentBranch = enrollment.branch || enrollment.billingSnapshot?.branch || student.branch;
      if (!queryInScope(req.user, enrollmentBranch)) { const error = new Error("Enrollment not found for this student"); error.status = 404; throw error; }
      const snapshot = enrollment.billingSnapshot;
      const agreement = validateBillingSnapshot(enrollment);
      if (!agreement.valid) {
        const error = new Error(`This enrollment has no valid FeeTerm billing agreement. Missing: ${agreement.missing.join(", ")}.`);
        error.status = 409;
        throw error;
      }
      const terms = snapshot;
      if (String(enrollmentBranch) !== String(snapshot.branch)) { const error = new Error("The enrollment branch does not match its frozen billing agreement."); error.status = 409; throw error; }
      const period = periodFor(terms.billingFrequency, periodStartInput || enrollment.startDate);
      if (terms.billingFrequency !== "ONE_TIME" && periodStartInput && new Date(periodStartInput) < new Date(enrollment.startDate)) { const error = new Error("Billing period cannot begin before enrollment"); error.status = 400; throw error; }
      if (enrollment.endDate && period.periodStart >= new Date(enrollment.endDate)) { const error = new Error("Billing period falls after this enrollment ended"); error.status = 400; throw error; }
      if (new Date(dueDateInput) < period.periodStart) { const error = new Error("Invoice due date cannot be before its billing period starts"); error.status = 400; throw error; }
      const duplicate = await Invoice.findOne({ enrollment: enrollment._id, cycleKey: period.cycleKey, status: { $ne: "CANCELLED" } }).session(session);
      if (duplicate) { const error = new Error("An invoice already exists for this billing period"); error.status = 409; throw error; }
      const programIds = (enrollment.programs || []).map((item) => item.program).filter(Boolean);
      const programs = programIds.length ? await TrainingSessionType.find({ _id: { $in: programIds } }).select("name").session(session).lean() : [];
      const programName = programs.map((item) => item.name).join(", ");
      const items = [{ description: terms.planName, quantity: 1, unitAmount: round(terms.amount), amount: round(terms.amount), kind: "TUITION", program: programIds[0] || null, programName }];
      const hasExistingInvoice = await Invoice.exists({ enrollment: enrollment._id, status: { $ne: "CANCELLED" } }).session(session);
      const registration = !hasExistingInvoice ? round(terms.registrationFee || 0) : 0;
      if (registration > 0) items.push({ description: "Registration fee", quantity: 1, unitAmount: registration, amount: registration, kind: "REGISTRATION" });
      const subtotal = round(items.reduce((sum, item) => sum + item.amount, 0));
      let discount = 0; let discountName = "";
      if (discountRuleId) {
        const rule = (terms.discountRules || []).find((item) => String(item._id || "") === String(discountRuleId) && item.active !== false);
        if (!rule || (rule.effectiveFrom && period.periodStart < new Date(rule.effectiveFrom)) || (rule.effectiveUntil && period.periodStart > new Date(rule.effectiveUntil))) { const error = new Error("Selected discount is not active for this billing period"); error.status = 400; throw error; }
        discount = rule.type === "PERCENT" ? round(subtotal * Number(rule.amount) / 100) : round(Number(rule.amount));
        discount = Math.min(subtotal, discount); discountName = rule.name;
      }
      const taxable = round(subtotal - discount);
      const taxRate = Number(terms.taxRate || 0);
      const tax = round(taxable * taxRate / 100);
      const total = round(taxable + tax);
      if (total <= 0) { const error = new Error("The selected fee structure produces no billable amount"); error.status = 400; throw error; }
      const invoiceStatus = status === "ISSUED" && isPastDue(dueDateInput) ? "OVERDUE" : status;
      const settings = await AcademySettings.findOne().session(session).lean();
      const feeTermCurrency = snapshot.currency ? null : await FeeTerm.findById(enrollment.feeTerm || snapshot.feeTerm).select("currency").session(session).lean();
      const invoiceNumber = await nextNumber("INV", session);
      const [created] = await Invoice.create([{
        invoiceNumber, student: student._id, enrollment: enrollment._id, plan: enrollment.plan, feeTerm: enrollment.feeTerm, branch: enrollmentBranch, items, subtotal, discount, discountName, taxRate, tax, total, balance: total,
        currency: snapshot.currency || normalizeCurrency(feeTermCurrency?.currency) || normalizeCurrency(settings?.currency) || "INR", dueDate: new Date(dueDateInput), periodStart: period.periodStart,
        periodEnd: enrollment.endDate && period.periodEnd > enrollment.endDate ? enrollment.endDate : period.periodEnd,
        cycleKey: period.cycleKey, status: invoiceStatus, notes: String(notes).slice(0, 1000), createdBy: req.user._id, issuedAt: status !== "DRAFT" ? new Date() : null,
      }], { session });
      await audit(req, session, { action: "INVOICE_CREATED", branch: enrollmentBranch, student: student._id, invoice: created._id, after: { invoiceNumber, total, status: invoiceStatus, discount, tax } });
      return created;
    });
    if (invoice.status !== "DRAFT") await sendInvoiceIssuedEmail(invoice).catch(() => {});
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: "An invoice already exists for this billing period" });
    console.error("Invoice creation failed", { name: error.name, code: error.code }); res.status(500).json({ success: false, message: "Failed to create invoice" });
  }
};

const listInvoices = async (req, res) => {
  try {
    const query = { ...branchFilter(req.user) };
    if (req.query.status && ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.studentId && isId(req.query.studentId)) query.student = req.query.studentId;
    if (req.query.search) {
      const studentIds = await Student.find({ name: { $regex: String(req.query.search).slice(0, 80), $options: "i" }, ...(isBranchScoped(req.user) ? { branch: getBranchId(req.user) } : {}) }).distinct("_id");
      query.$or = [{ invoiceNumber: { $regex: String(req.query.search).slice(0, 80), $options: "i" } }, { student: { $in: studentIds } }];
    }
    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate("student", "name phone email").populate("branch", "name").sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 250)).lean(),
      Invoice.countDocuments(query),
    ]);
    res.json({ success: true, invoices, total });
  } catch (error) { console.error("Invoice list failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load invoices" }); }
};

const cancelInvoice = async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 4) return res.status(400).json({ success: false, message: "A cancellation reason is required" });
  try {
    const invoice = await createSession(async (session) => {
      const access = await getInvoiceAccess(req, req.params.invoiceId, session);
      if (access.error) { const error = new Error(access.error.message); error.status = access.error.status; throw error; }
      const record = access.invoice;
      if (!["DRAFT", "ISSUED"].includes(record.status) || record.paidAmount > 0) { const error = new Error("Only unpaid draft or issued invoices can be cancelled"); error.status = 409; throw error; }
      const before = { status: record.status, total: record.total };
      record.status = "CANCELLED"; await record.save({ session });
      let inventoryTransitions = [];
      if (record.kind === "MERCHANDISE") {
        const order = await InventoryOrder.findOne({ invoice: record._id }).session(session);
        inventoryTransitions = await releaseOrderReservation({ order, req, session, reason: `Invoice ${record.invoiceNumber} cancelled: ${reason}` });
      }
      await audit(req, session, { action: "INVOICE_CANCELLED", branch: record.branch, student: record.student, invoice: record._id, reason, before, after: { status: "CANCELLED" } });
      return { invoice: record, inventoryTransitions };
    });
    await publishStockTransitions(invoice.inventoryTransitions);
    res.json({ success: true, invoice: invoice.invoice });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); console.error("Invoice cancellation failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to cancel invoice" }); }
};

const issueInvoice = async (req, res) => {
  try {
    const invoice = await createSession(async (session) => {
      const access = await getInvoiceAccess(req, req.params.invoiceId, session);
      if (access.error) { const error = new Error(access.error.message); error.status = access.error.status; throw error; }
      const record = access.invoice;
      if (record.status !== "DRAFT") { const error = new Error("Only draft invoices can be issued"); error.status = 409; throw error; }
      record.status = isPastDue(record.dueDate) ? "OVERDUE" : "ISSUED"; record.issuedAt = new Date(); await record.save({ session });
      await audit(req, session, { action: "INVOICE_CREATED", branch: record.branch, student: record.student, invoice: record._id, reason: "Draft invoice issued", before: { status: "DRAFT" }, after: { status: "ISSUED" } });
      return record;
    });
    await sendInvoiceIssuedEmail(invoice).catch(() => {});
    res.json({ success: true, invoice });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); console.error("Invoice issue failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to issue invoice" }); }
};

const addPayment = async (req, res) => {
  const amount = asAmount(req.body?.amount);
  const method = String(req.body?.method || "").toUpperCase();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim();
  if (amount === null || amount <= 0 || !METHODS.has(method) || idempotencyKey.length < 8 || idempotencyKey.length > 120) return res.status(400).json({ success: false, message: "A positive amount, payment method, and unique idempotency key are required" });
  const existingPayment = await Payment.findOne({ idempotencyKey }).lean();
  if (existingPayment) {
    if (String(existingPayment.invoice) !== String(req.params.invoiceId) || existingPayment.kind !== "PAYMENT" || Number(existingPayment.amount) !== amount || existingPayment.method !== method) return res.status(409).json({ success: false, message: "This idempotency key was already used for a different payment" });
    const [receipt, invoice] = await Promise.all([Receipt.findOne({ payment: existingPayment._id }).lean(), Invoice.findById(existingPayment.invoice).lean()]);
    if (receipt && invoice && queryInScope(req.user, existingPayment.branch)) return res.status(200).json({ success: true, duplicate: true, payment: existingPayment, receipt, invoice });
    return res.status(404).json({ success: false, message: "Payment not found" });
  }
  let output;
  try {
    output = await createSession(async (session) => {
      const access = await getInvoiceAccess(req, req.params.invoiceId, session);
      if (access.error) { const error = new Error(access.error.message); error.status = access.error.status; throw error; }
      const invoice = access.invoice;
      if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE", "REFUNDED"].includes(invoice.status)) { const error = new Error("This invoice cannot accept a payment"); error.status = 409; throw error; }
      if (amount > Number(invoice.balance)) { const error = new Error("Payment cannot exceed the invoice balance"); error.status = 400; throw error; }
      const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
      if (Number.isNaN(paymentDate.getTime()) || paymentDate > new Date(Date.now() + 5 * 60 * 1000)) { const error = new Error("Payment date is invalid"); error.status = 400; throw error; }
      const [payment] = await Payment.create([{
        invoice: invoice._id, student: invoice.student, branch: invoice.branch, amount, direction: "CREDIT", kind: "PAYMENT", paymentDate, method,
        referenceId: String(req.body?.referenceId || "").trim(), receivedBy: req.user._id, notes: String(req.body?.notes || "").slice(0, 1000), idempotencyKey,
      }], { session });
      const paidAmount = round(invoice.paidAmount + amount);
      const balance = round(invoice.total - paidAmount);
      invoice.paidAmount = paidAmount; invoice.balance = balance; invoice.status = balance === 0 ? "PAID" : (isPastDue(invoice.dueDate) ? "OVERDUE" : "PARTIALLY_PAID");
      await invoice.save({ session });
      const receipt = await writeReceipt(payment, invoice, session);
      await audit(req, session, { action: "PAYMENT_CREATED", branch: invoice.branch, student: invoice.student, invoice: invoice._id, payment: payment._id, after: { amount, method, status: invoice.status, balance } });
      const inventoryResult = invoice.kind === "MERCHANDISE" && balance === 0
        ? await completeOrderForInvoice({ invoice, payment, req, session })
        : { order: null, transitions: [] };
      return { payment, receipt, invoice, inventoryOrder: inventoryResult.order, inventoryTransitions: inventoryResult.transitions };
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) {
      const replay = await Payment.findOne({ idempotencyKey }).lean();
      if (replay) {
        if (String(replay.invoice) !== String(req.params.invoiceId) || replay.kind !== "PAYMENT" || Number(replay.amount) !== amount || replay.method !== method) return res.status(409).json({ success: false, message: "This idempotency key was already used for a different payment" });
        const [receipt, invoice] = await Promise.all([Receipt.findOne({ payment: replay._id }).lean(), Invoice.findById(replay.invoice).lean()]);
        if (receipt && invoice && queryInScope(req.user, replay.branch)) return res.status(200).json({ success: true, duplicate: true, payment: replay, receipt, invoice });
      }
      return res.status(409).json({ success: false, message: "This payment reference was already recorded" });
    }
    console.error("Payment recording failed", { name: error.name, code: error.code }); return res.status(500).json({ success: false, message: "Failed to record payment" });
  }
  await publishStockTransitions(output.inventoryTransitions);
  const partial = output.invoice.balance > 0;
  await safelyNotify({ type: partial ? "FINANCE_PARTIAL_PAYMENT_RECEIVED" : "FINANCE_PAYMENT_RECEIVED", title: partial ? "Partial payment received" : "Payment received", message: `${output.payment.amount.toFixed(2)} ${output.invoice.currency} received for invoice ${output.invoice.invoiceNumber}.`, severity: "SUCCESS", branch: output.invoice.branch, student: output.invoice.student, entityType: "FINANCE", entityId: output.payment._id, actionUrl: "/fees", eventKey: `finance:payment:${output.payment._id}:staff` });
  const linkedStudent = await Student.findById(output.invoice.student).select("user name").lean();
  if (linkedStudent?.user) await createNotification({ type: partial ? "FINANCE_STUDENT_PARTIAL_PAYMENT_RECEIVED" : "FINANCE_STUDENT_PAYMENT_RECEIVED", recipient: linkedStudent.user, title: partial ? "Partial payment received" : "Payment received", message: `Your payment of ${output.payment.amount.toFixed(2)} ${output.invoice.currency} was recorded for invoice ${output.invoice.invoiceNumber}.`, severity: "SUCCESS", branch: output.invoice.branch, student: output.invoice.student, entityType: "FINANCE", entityId: output.payment._id, actionUrl: "/student-dashboard", eventKey: `finance:payment:${output.payment._id}:student` }).catch(() => {});
  await sendReceiptEmail({ payment: output.payment, receipt: output.receipt, invoice: output.invoice }).catch(() => {});
  res.status(201).json({ success: true, ...output });
};

const refundPayment = async (req, res) => {
  const amount = asAmount(req.body?.amount);
  const reason = String(req.body?.reason || "").trim();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim();
  if (amount === null || amount <= 0 || reason.length < 4 || idempotencyKey.length < 8 || idempotencyKey.length > 120) return res.status(400).json({ success: false, message: "A valid refund amount, reason, and unique idempotency key are required" });
  const existingRefund = await Payment.findOne({ idempotencyKey }).lean();
  if (existingRefund) {
    if (existingRefund.kind !== "REFUND" || String(existingRefund.relatedPayment) !== String(req.params.paymentId) || Number(existingRefund.amount) !== amount) return res.status(409).json({ success: false, message: "This idempotency key was already used for a different refund" });
    const [receipt, invoice] = await Promise.all([Receipt.findOne({ payment: existingRefund._id }).lean(), Invoice.findById(existingRefund.invoice).lean()]);
    if (receipt && invoice && queryInScope(req.user, existingRefund.branch)) return res.status(200).json({ success: true, duplicate: true, refund: existingRefund, receipt, invoice });
    return res.status(404).json({ success: false, message: "Refund not found" });
  }
  try {
    const result = await createSession(async (session) => {
      const payment = await Payment.findById(req.params.paymentId).session(session);
      if (!payment || !queryInScope(req.user, payment.branch)) { const error = new Error("Payment not found"); error.status = 404; throw error; }
      if (payment.kind !== "PAYMENT" || await Payment.exists({ relatedPayment: payment._id, kind: "CORRECTION" }).session(session)) { const error = new Error("Only uncorrected original payments can be refunded"); error.status = 409; throw error; }
      const refundDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
      if (Number.isNaN(refundDate.getTime()) || refundDate > new Date(Date.now() + 5 * 60 * 1000)) { const error = new Error("Refund date is invalid"); error.status = 400; throw error; }
      const alreadyRefunded = await Payment.aggregate([{ $match: { relatedPayment: payment._id, kind: "REFUND", direction: "DEBIT" } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]).session(session);
      const remainingRefundable = round(payment.amount - (alreadyRefunded[0]?.amount || 0));
      if (amount > remainingRefundable) { const error = new Error("Refund exceeds the unrefunded payment amount"); error.status = 400; throw error; }
      const invoice = await Invoice.findById(payment.invoice).session(session);
      if (!invoice || invoice.status === "CANCELLED") { const error = new Error("Invoice is unavailable for refund"); error.status = 409; throw error; }
      if (amount > invoice.paidAmount) { const error = new Error("Refund exceeds the amount currently credited to this invoice"); error.status = 400; throw error; }
      const [refund] = await Payment.create([{ invoice: invoice._id, student: payment.student, branch: payment.branch, amount, direction: "DEBIT", kind: "REFUND", paymentDate: refundDate, method: payment.method, referenceId: "", receivedBy: req.user._id, notes: String(req.body?.notes || "").slice(0, 1000), idempotencyKey, relatedPayment: payment._id, reason }], { session });
      invoice.paidAmount = round(Math.max(0, invoice.paidAmount - amount)); invoice.balance = round(invoice.total - invoice.paidAmount); invoice.status = invoice.paidAmount === 0 ? "REFUNDED" : currentStatus(invoice.total, invoice.paidAmount, invoice.dueDate, invoice.status); await invoice.save({ session });
      const receipt = await writeReceipt(refund, invoice, session);
      if (invoice.kind === "MERCHANDISE" && invoice.paidAmount === 0) {
        await InventoryOrder.updateOne({ invoice: invoice._id }, { $set: { status: "REFUNDED", paymentStatus: "REFUNDED" } }, { session });
      }
      await audit(req, session, { action: "PAYMENT_REFUNDED", branch: payment.branch, student: payment.student, invoice: invoice._id, payment: refund._id, reason, before: { paidAmount: round(invoice.paidAmount + amount) }, after: { paidAmount: invoice.paidAmount, balance: invoice.balance, refundAmount: amount } });
      return { refund, invoice, receipt };
    });
    await sendReceiptEmail({ payment: result.refund, receipt: result.receipt, invoice: result.invoice, kind: "refund" }).catch(() => {});
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) {
      const replay = await Payment.findOne({ idempotencyKey }).lean();
      if (replay?.kind === "REFUND" && String(replay.relatedPayment) === String(req.params.paymentId) && Number(replay.amount) === amount) {
        const [receipt, invoice] = await Promise.all([Receipt.findOne({ payment: replay._id }).lean(), Invoice.findById(replay.invoice).lean()]);
        if (receipt && invoice && queryInScope(req.user, replay.branch)) return res.status(200).json({ success: true, duplicate: true, refund: replay, receipt, invoice });
      }
      return res.status(409).json({ success: false, message: "This refund reference was already recorded" });
    }
    console.error("Payment refund failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to record refund" });
  }
};

const correctPayment = async (req, res) => {
  const correctedAmount = asAmount(req.body?.correctedAmount);
  const reason = String(req.body?.reason || "").trim();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim();
  if (correctedAmount === null || reason.length < 4 || idempotencyKey.length < 8 || idempotencyKey.length > 100) return res.status(400).json({ success: false, message: "A corrected amount, reason, and unique idempotency key are required" });
  const [existingReverse, existingReplacement] = await Promise.all([
    Payment.findOne({ idempotencyKey: `${idempotencyKey}:reverse` }).lean(),
    Payment.findOne({ idempotencyKey: `${idempotencyKey}:replacement` }).lean(),
  ]);
  if (existingReverse) {
    const original = await Payment.findById(req.params.paymentId).select("amount").lean();
    if (existingReverse.kind !== "CORRECTION" || String(existingReverse.relatedPayment) !== String(req.params.paymentId) || Number(existingReverse.amount) !== Number(original?.amount) || (existingReplacement && Number(existingReplacement.amount) !== correctedAmount)) return res.status(409).json({ success: false, message: "This idempotency key was already used for a different correction" });
    const corrections = [existingReverse, existingReplacement].filter(Boolean);
    const [receipts, invoice] = await Promise.all([Receipt.find({ payment: { $in: corrections.map((item) => item._id) } }).lean(), Invoice.findById(existingReverse.invoice).lean()]);
    if (invoice && queryInScope(req.user, existingReverse.branch)) return res.status(200).json({ success: true, duplicate: true, corrections, receipts, invoice });
    return res.status(404).json({ success: false, message: "Correction not found" });
  }
  try {
    const result = await createSession(async (session) => {
      const original = await Payment.findById(req.params.paymentId).session(session);
      if (!original || !queryInScope(req.user, original.branch)) { const error = new Error("Payment not found"); error.status = 404; throw error; }
      if (original.kind !== "PAYMENT" || await Payment.exists({ relatedPayment: original._id, kind: "CORRECTION" }).session(session)) { const error = new Error("Payment has already been corrected"); error.status = 409; throw error; }
      if (await Payment.exists({ relatedPayment: original._id, kind: "REFUND" }).session(session)) { const error = new Error("A refunded payment cannot be corrected"); error.status = 409; throw error; }
      const invoice = await Invoice.findById(original.invoice).session(session);
      const max = round(invoice.balance + original.amount);
      if (correctedAmount > max) { const error = new Error("Corrected payment would exceed the invoice total"); error.status = 400; throw error; }
      const rows = [];
      if (original.amount > 0) rows.push({ invoice: invoice._id, student: original.student, branch: original.branch, amount: original.amount, direction: "DEBIT", kind: "CORRECTION", method: original.method, receivedBy: req.user._id, idempotencyKey: `${idempotencyKey}:reverse`, relatedPayment: original._id, reason, notes: "Payment correction reversal" });
      if (correctedAmount > 0) rows.push({ invoice: invoice._id, student: original.student, branch: original.branch, amount: correctedAmount, direction: "CREDIT", kind: "CORRECTION", method: original.method, receivedBy: req.user._id, idempotencyKey: `${idempotencyKey}:replacement`, relatedPayment: original._id, reason, notes: "Corrected payment amount" });
      const corrections = rows.length ? await Payment.create(rows.map((row) => ({ ...row, paymentDate: new Date() })), { session, ordered: true }) : [];
      invoice.paidAmount = round(invoice.paidAmount - original.amount + correctedAmount); invoice.balance = round(invoice.total - invoice.paidAmount); invoice.status = invoice.paidAmount === 0 ? "REFUNDED" : currentStatus(invoice.total, invoice.paidAmount, invoice.dueDate, invoice.status); await invoice.save({ session });
      const receipts = [];
      for (const movement of corrections) receipts.push(await writeReceipt(movement, invoice, session));
      await audit(req, session, { action: "PAYMENT_CORRECTED", branch: original.branch, student: original.student, invoice: invoice._id, payment: original._id, reason, before: { amount: original.amount }, after: { correctedAmount, invoicePaidAmount: invoice.paidAmount, balance: invoice.balance, correctionIds: corrections.map((item) => item._id) } });
      return { original, corrections, receipts, invoice };
    });
    await sendCorrectionEmail({ originalPaymentId: result.original._id, corrections: result.corrections, receipts: result.receipts, invoice: result.invoice }).catch(() => {});
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) {
      const reverse = await Payment.findOne({ idempotencyKey: `${idempotencyKey}:reverse` }).lean();
      const replacement = await Payment.findOne({ idempotencyKey: `${idempotencyKey}:replacement` }).lean();
      const original = await Payment.findById(req.params.paymentId).select("amount").lean();
      if (reverse?.kind === "CORRECTION" && String(reverse.relatedPayment) === String(req.params.paymentId) && Number(reverse.amount) === Number(original?.amount) && (!replacement || Number(replacement.amount) === correctedAmount)) {
        const corrections = [reverse, replacement].filter(Boolean);
        const [receipts, invoice] = await Promise.all([Receipt.find({ payment: { $in: corrections.map((item) => item._id) } }).lean(), Invoice.findById(reverse.invoice).lean()]);
        if (invoice && queryInScope(req.user, reverse.branch)) return res.status(200).json({ success: true, duplicate: true, corrections, receipts, invoice });
      }
      return res.status(409).json({ success: false, message: "This correction reference was already recorded" });
    }
    console.error("Payment correction failed", { name: error.name, code: error.code }); res.status(500).json({ success: false, message: "Failed to correct payment" });
  }
};

const getReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.receiptId).populate("branch", "name").lean();
    if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
    const isOwner = String((await Student.findOne({ _id: receipt.student, user: req.user._id }).select("_id").lean())?._id || "") === String(receipt.student);
    if (req.user.role === "STUDENT" && !isOwner) return res.status(404).json({ success: false, message: "Receipt not found" });
    if (!isOwner && !queryInScope(req.user, receipt.branch?._id || receipt.branch)) return res.status(404).json({ success: false, message: "Receipt not found" });
    res.json({ success: true, receipt });
  } catch (error) { console.error("Receipt lookup failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load receipt" }); }
};

async function financialProfile(student, branch) {
  const invoices = await Invoice.find({ student: student._id, branch, status: { $ne: "CANCELLED" } }).sort({ createdAt: -1 }).lean();
  const invoiceIds = invoices.map((invoice) => invoice._id);
  const [payments, receipts] = await Promise.all([
    Payment.find({ invoice: { $in: invoiceIds } }).sort({ paymentDate: -1 }).limit(30).populate("receivedBy", "name").lean(),
    Receipt.find({ student: student._id, branch }).sort({ date: -1 }).limit(30).lean(),
  ]);
  const now = new Date();
  const totalBilled = round(invoices.reduce((sum, invoice) => sum + invoice.total, 0));
  const totalPaid = round(invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0));
  const overdue = round(invoices.filter((invoice) => invoice.balance > 0 && new Date(invoice.dueDate) < now).reduce((sum, invoice) => sum + invoice.balance, 0));
  const currencySummaries = new Map();
  for (const invoice of invoices) {
    const currency = String(invoice.currency || "INR").trim().toUpperCase() || "INR";
    const summary = currencySummaries.get(currency) || { currency, totalBilled: 0, totalPaid: 0, outstanding: 0, overdue: 0 };
    summary.totalBilled += Number(invoice.total || 0);
    summary.totalPaid += Number(invoice.paidAmount || 0);
    summary.outstanding += Number(invoice.balance || 0);
    if (invoice.balance > 0 && new Date(invoice.dueDate) < now) summary.overdue += Number(invoice.balance || 0);
    currencySummaries.set(currency, summary);
  }
  const summaryByCurrency = [...currencySummaries.values()].map((summary) => ({
    ...summary,
    totalBilled: round(summary.totalBilled),
    totalPaid: round(summary.totalPaid),
    outstanding: round(summary.outstanding),
    overdue: round(summary.overdue),
  }));
  return { summary: { totalBilled, totalPaid, outstanding: round(invoices.reduce((sum, invoice) => sum + invoice.balance, 0)), overdue }, summaryByCurrency, invoices, payments, receipts };
}

const getStudentFinancialProfile = async (req, res) => {
  if (!isId(req.params.studentId)) return res.status(400).json({ success: false, message: "Invalid student ID" });
  try {
    const student = await Student.findById(req.params.studentId).select("name branch user").lean();
    if (!student || !queryInScope(req.user, student.branch)) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, ...(await financialProfile(student, student.branch)) });
  } catch (error) { console.error("Student finance profile failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load student financial profile" }); }
};

const getMyFinancialProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).select("name branch user").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found" });
    res.json({ success: true, ...(await financialProfile(student, student.branch)) });
  } catch (error) { console.error("Own finance profile failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load financial profile" }); }
};

const getFinanceDashboard = async (req, res) => {
  try {
    const scope = branchFilter(req.user);
    const now = new Date();
    const startMonth = academyMonthStart(now);
    const startToday = academyDayStart(now);
    const todayKey = academyDateKey(now);
    const expectedUntil = new Date(now.getTime() + 30 * 86400000);
    const expectedEnd = new Date(academyDayStart(expectedUntil).getTime() + 86400000);
    const revenueFilter = { ...scope, direction: "CREDIT", kind: { $in: ["PAYMENT", "CORRECTION"] }, paymentDate: { $gte: startMonth } };
    const paymentAgg = await Payment.aggregate([
      { $match: revenueFilter },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate", timezone: FINANCE_TIME_ZONE } }, branch: "$branch" }, amount: { $sum: "$amount" } } },
    ]);
    const refundAgg = await Payment.aggregate([{ $match: { ...scope, direction: "DEBIT", kind: { $in: ["REFUND", "CORRECTION"] }, paymentDate: { $gte: startMonth } } }, { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate", timezone: FINANCE_TIME_ZONE } }, branch: "$branch" }, amount: { $sum: "$amount" } } }]);
    const invoiceFilter = { ...scope, status: { $nin: ["DRAFT", "CANCELLED", "PAID"] }, balance: { $gt: 0 } };
    const [invoiceMetrics] = await Invoice.aggregate([
      { $match: invoiceFilter },
      { $addFields: { pastDue: { $lt: ["$dueDate", startToday] }, daysPastDue: { $dateDiff: { startDate: "$dueDate", endDate: now, unit: "day", timezone: FINANCE_TIME_ZONE } } } },
      { $group: {
        _id: null,
        pending: { $sum: "$balance" },
        overdue: { $sum: { $cond: ["$pastDue", "$balance", 0] } },
        overdueCount: { $sum: { $cond: ["$pastDue", 1, 0] } },
        partiallyPaid: { $sum: { $cond: [{ $gt: ["$paidAmount", 0] }, "$balance", 0] } },
        partialCount: { $sum: { $cond: [{ $gt: ["$paidAmount", 0] }, 1, 0] } },
        expectedCollection: { $sum: { $cond: [{ $and: [{ $gte: ["$dueDate", startToday] }, { $lt: ["$dueDate", expectedEnd] }] }, "$balance", 0] } },
        current: { $sum: { $cond: [{ $eq: ["$pastDue", false] }, "$balance", 0] } },
        age1To30: { $sum: { $cond: [{ $and: ["$pastDue", { $lte: ["$daysPastDue", 30] }] }, "$balance", 0] } },
        age31To60: { $sum: { $cond: [{ $and: ["$pastDue", { $gt: ["$daysPastDue", 30] }, { $lte: ["$daysPastDue", 60] }] }, "$balance", 0] } },
        age61To90: { $sum: { $cond: [{ $and: ["$pastDue", { $gt: ["$daysPastDue", 60] }, { $lte: ["$daysPastDue", 90] }] }, "$balance", 0] } },
        age90Plus: { $sum: { $cond: [{ $and: ["$pastDue", { $gt: ["$daysPastDue", 90] }] }, "$balance", 0] } },
      } },
    ]);
    const collectionsToday = round(paymentAgg.filter((item) => item._id.day === todayKey).reduce((sum, item) => sum + item.amount, 0) - refundAgg.filter((item) => item._id.day === todayKey).reduce((sum, item) => sum + item.amount, 0));
    const collectionsMonth = round(paymentAgg.reduce((sum, item) => sum + item.amount, 0) - refundAgg.reduce((sum, item) => sum + item.amount, 0));
    const twelveMonthStart = academyMonthStart(now, 11);
    const monthly = Array.from({ length: 12 }, (_, index) => { const monthsBack = 11 - index; return { month: new Intl.DateTimeFormat("en", { month: "short", timeZone: FINANCE_TIME_ZONE }).format(academyMonthStart(now, monthsBack)), amount: 0 }; });
    const twelveMonthPayments = await Payment.aggregate([{ $match: { ...scope, direction: "CREDIT", kind: { $in: ["PAYMENT", "CORRECTION"] }, paymentDate: { $gte: twelveMonthStart } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate", timezone: FINANCE_TIME_ZONE } }, amount: { $sum: "$amount" } } }]);
    const twelveMonthRefunds = await Payment.aggregate([{ $match: { ...scope, direction: "DEBIT", kind: { $in: ["REFUND", "CORRECTION"] }, paymentDate: { $gte: twelveMonthStart } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate", timezone: FINANCE_TIME_ZONE } }, amount: { $sum: "$amount" } } }]);
    const byMonth = new Map();
    for (const row of twelveMonthPayments) byMonth.set(row._id, (byMonth.get(row._id) || 0) + row.amount);
    for (const row of twelveMonthRefunds) byMonth.set(row._id, (byMonth.get(row._id) || 0) - row.amount);
    monthly.forEach((item, index) => { item.amount = round(byMonth.get(academyYearMonth(now, 11 - index)) || 0); });
    const branchCollectionAgg = await Payment.aggregate([
      { $match: { ...scope, paymentDate: { $gte: startMonth } } },
      { $group: { _id: "$branch", amount: { $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] } } } },
      { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" } },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, branch: { $ifNull: ["$branch.name", "Unknown branch"] }, amount: 1 } },
    ]);
    const programRevenueAgg = await Payment.aggregate([
      { $match: { ...scope, paymentDate: { $gte: twelveMonthStart } } },
      { $lookup: { from: "invoices", localField: "invoice", foreignField: "_id", as: "invoice" } },
      { $unwind: "$invoice" },
      { $unwind: "$invoice.items" },
      { $match: { "invoice.items.kind": "TUITION" } },
      { $group: { _id: { $ifNull: ["$invoice.items.programName", "$invoice.items.description"] }, amount: { $sum: { $multiply: [{ $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] }, { $divide: ["$invoice.items.amount", "$invoice.total"] }] } } } },
      { $sort: { amount: -1 } }, { $limit: 8 }, { $project: { _id: 0, program: "$_id", amount: 1 } },
    ]);
    const metrics = invoiceMetrics || {};
    const aging = [
      { label: "Current", amount: metrics.current || 0 },
      { label: "1-30 days", amount: metrics.age1To30 || 0 },
      { label: "31-60 days", amount: metrics.age31To60 || 0 },
      { label: "61-90 days", amount: metrics.age61To90 || 0 },
      { label: "90+ days", amount: metrics.age90Plus || 0 },
    ];
    const settings = await AcademySettings.findOne().select("currency").lean();
    res.json({ success: true, currency: settings?.currency || "INR", metrics: { todayCollection: collectionsToday, monthCollection: collectionsMonth, pending: round(metrics.pending || 0), overdue: round(metrics.overdue || 0), overdueCount: metrics.overdueCount || 0, partiallyPaid: round(metrics.partiallyPaid || 0), partialCount: metrics.partialCount || 0, expectedCollection: round(metrics.expectedCollection || 0) }, charts: { monthlyCollection: monthly, outstandingFees: aging.map((item) => ({ ...item, amount: round(item.amount) })), branchCollection: branchCollectionAgg.map((item) => ({ ...item, amount: round(item.amount) })), programRevenue: programRevenueAgg.map((item) => ({ ...item, amount: round(item.amount) })) } });
  } catch (error) { console.error("Finance dashboard failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load finance dashboard" }); }
};

const getFinanceReport = async (req, res) => {
  try {
    const scope = { ...branchFilter(req.user) };
    if (isBranchScoped(req.user)) {
      if (req.query.branchId && String(req.query.branchId) !== String(getBranchId(req.user) || "")) return res.status(403).json({ success: false, message: "You cannot report on another branch" });
    } else if (req.query.branchId) {
      if (!isId(req.query.branchId)) return res.status(400).json({ success: false, message: "Invalid branch ID" });
      scope.branch = req.query.branchId;
    }
    if (req.query.planId && !isId(req.query.planId)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
    if (req.query.invoiceStatus && !["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(req.query.invoiceStatus)) return res.status(400).json({ success: false, message: "Invalid invoice status" });
    if (req.query.paymentKind && !["PAYMENT", "REFUND", "CORRECTION"].includes(req.query.paymentKind)) return res.status(400).json({ success: false, message: "Invalid payment movement" });
    const from = dateInput(req.query.from, "Start date");
    const to = dateInput(req.query.to, "End date");
    if (from.error || to.error) return res.status(400).json({ success: false, message: from.error || to.error });
    if (from.value && to.value && from.value > to.value) return res.status(400).json({ success: false, message: "Start date must be on or before end date" });
    const now = new Date();
    const start = from.value ? academyDayStart(from.value) : new Date(now.getTime() - 365 * 86400000);
    const end = to.value ? academyDayStart(new Date(to.value.getTime() + 86400000)) : now;
    const dateRange = { $gte: start, $lt: end };
    const invoiceQuery = { ...scope, createdAt: dateRange };
    if (req.query.planId) invoiceQuery.plan = req.query.planId;
    if (req.query.invoiceStatus) invoiceQuery.status = req.query.invoiceStatus;
    const relatedInvoiceQuery = { ...scope };
    if (req.query.planId) relatedInvoiceQuery.plan = req.query.planId;
    if (req.query.invoiceStatus) relatedInvoiceQuery.status = req.query.invoiceStatus;
    const matchingInvoiceIds = req.query.planId || req.query.invoiceStatus
      ? await Invoice.find(relatedInvoiceQuery).distinct("_id")
      : null;
    const paymentQuery = { ...scope, paymentDate: dateRange };
    const receiptQuery = { ...scope, date: dateRange };
    if (matchingInvoiceIds) {
      paymentQuery.invoice = { $in: matchingInvoiceIds };
      receiptQuery.invoice = { $in: matchingInvoiceIds };
    }
    if (req.query.paymentKind) {
      paymentQuery.kind = req.query.paymentKind;
      receiptQuery.kind = req.query.paymentKind;
    }
    const auditQuery = { ...scope, createdAt: dateRange };
    const [invoices, payments, receipts, audits, counts] = await Promise.all([
      Invoice.find(invoiceQuery).populate("student", "name").populate("branch", "name").sort({ createdAt: -1 }).limit(5000).lean(),
      Payment.find(paymentQuery).populate("student", "name").populate("branch", "name").sort({ paymentDate: -1 }).limit(5000).lean(),
      Receipt.find(receiptQuery).sort({ date: -1 }).limit(5000).lean(),
      FinanceAudit.find(auditQuery).sort({ createdAt: -1 }).limit(5000).lean(),
      Promise.all([
        Invoice.countDocuments(invoiceQuery),
        Payment.countDocuments(paymentQuery),
        Receipt.countDocuments(receiptQuery),
        FinanceAudit.countDocuments(auditQuery),
      ]),
    ]);
    res.json({ success: true, filters: { branchId: scope.branch || null, planId: req.query.planId || null, invoiceStatus: req.query.invoiceStatus || null, paymentKind: req.query.paymentKind || null, from: from.value || null, to: to.value || null }, invoices, payments, receipts, audits, truncated: { invoices: counts[0] > invoices.length, payments: counts[1] > payments.length, receipts: counts[2] > receipts.length, audits: counts[3] > audits.length } });
  } catch (error) { console.error("Finance report failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load finance report" }); }
};

const listPayments = async (req, res) => {
  try {
    const query = { ...branchFilter(req.user) };
    if (req.query.studentId && isId(req.query.studentId)) query.student = req.query.studentId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const payments = await Payment.find(query).populate("student", "name").populate("branch", "name").populate("invoice", "invoiceNumber status total balance").populate("receivedBy", "name").sort({ paymentDate: -1, _id: -1 }).limit(limit).lean();
    const originalIds = payments.filter((payment) => payment.kind === "PAYMENT").map((payment) => payment._id);
    const adjustments = originalIds.length ? await Payment.find({ relatedPayment: { $in: originalIds }, kind: { $in: ["REFUND", "CORRECTION"] } }).select("relatedPayment amount kind direction").lean() : [];
    const byOriginal = new Map();
    for (const adjustment of adjustments) {
      const key = String(adjustment.relatedPayment);
      const value = byOriginal.get(key) || { refunded: 0, corrected: false };
      if (adjustment.kind === "REFUND" && adjustment.direction === "DEBIT") value.refunded += adjustment.amount;
      if (adjustment.kind === "CORRECTION") value.corrected = true;
      byOriginal.set(key, value);
    }
    const rows = payments.map((payment) => {
      const adjustment = byOriginal.get(String(payment._id)) || { refunded: 0, corrected: false };
      return { ...payment, remainingRefundable: payment.kind === "PAYMENT" && !adjustment.corrected ? round(Math.max(0, payment.amount - adjustment.refunded)) : 0, corrected: adjustment.corrected };
    });
    const receipts = await Receipt.find({ payment: { $in: payments.map((payment) => payment._id) } }).select("_id payment receiptNumber").lean();
    const receiptByPayment = new Map(receipts.map((receipt) => [String(receipt.payment), receipt]));
    rows.forEach((payment) => { payment.receipt = receiptByPayment.get(String(payment._id)) || null; });
    res.json({ success: true, payments: rows });
  } catch (error) { console.error("Finance payment list failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load payments" }); }
};

const listStudentInvoices = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).select("_id branch").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found" });
    const invoices = await Invoice.find({ student: student._id, branch: student.branch, status: { $ne: "CANCELLED" } }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, invoices });
  } catch (error) { console.error("Student invoice list failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load invoices" }); }
};

module.exports = { getFeeTermPlanOptions, getFeeBranches, listFeeTerms, listAllFeeTerms, createFeeTerm, updateFeeTerm, supersedeFeeTerm, getAvailableFeeTerms, getInvoiceCandidates, createInvoice, listInvoices, listPayments, cancelInvoice, issueInvoice, addPayment, refundPayment, correctPayment, getReceipt, getStudentFinancialProfile, getMyFinancialProfile, getFinanceDashboard, getFinanceReport, listStudentInvoices };
