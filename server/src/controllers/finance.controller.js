const mongoose = require("mongoose");
const AcademySettings = require("../models/AcademySettings");
const Branch = require("../models/Branch");
const FinanceAudit = require("../models/FinanceAudit");
const FinanceSequence = require("../models/FinanceSequence");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const TrainingSessionType = require("../models/TrainingSessionType");
const Receipt = require("../models/Receipt");
const Student = require("../models/Student");
const { isBranchScoped } = require("../utils/access");
const { FINANCE_TIME_ZONE, academyDateKey, academyDayStart, academyMonthStart, academyYearMonth, isPastDue } = require("../utils/financeDates");
const { safelyNotify, createNotification } = require("../services/notification.service");

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

async function audit(session, values) { await FinanceAudit.create([values], { session }); }

async function getInvoiceAccess(req, invoiceId, session) {
  if (!isId(invoiceId)) return { error: { status: 400, message: "Invalid invoice ID" } };
  const invoice = await Invoice.findById(invoiceId).session(session || null);
  if (!invoice) return { error: { status: 404, message: "Invoice not found" } };
  if (!queryInScope(req.user, invoice.branch)) return { error: { status: 404, message: "Invoice not found" } };
  return { invoice };
}

const getFeePlans = async (req, res) => {
  try {
    const query = {};
    if (isBranchScoped(req.user)) {
      const branch = getBranchId(req.user);
      query.$or = [{ feeBranch: branch }, { feeBranch: null, "branchFeeOverrides.branch": branch }, { feeBranch: null }];
    }
    const branchId = getBranchId(req.user);
    const plans = await Plan.find(query).select("name feeName feeActive price duration durationUnit billingFrequency registrationFee taxRate discountRules feeBranch branchFeeOverrides effectiveFrom effectiveUntil programs isActive").populate("feeBranch", "name").populate("branchFeeOverrides.branch", "name").populate("programs.program", "name").sort({ name: 1 }).lean();
    const plansWithEffectiveTerms = plans.filter((plan) => !isBranchScoped(req.user) || !plan.feeBranch || String(plan.feeBranch._id || plan.feeBranch) === String(branchId)).map((plan) => {
      const override = branchId ? (plan.branchFeeOverrides || []).find((item) => String(item.branch?._id || item.branch) === String(branchId)) : null;
      return { ...plan, effectiveFee: override || { feeName: plan.feeName || plan.name, amount: plan.price, billingFrequency: plan.billingFrequency, registrationFee: plan.registrationFee, taxRate: plan.taxRate, active: plan.feeActive !== false, discountRules: plan.discountRules, effectiveFrom: plan.effectiveFrom, effectiveUntil: plan.effectiveUntil } };
    });
    res.json({ success: true, plans: plansWithEffectiveTerms });
  } catch (error) { console.error("Finance plans read failed", { name: error.name }); res.status(500).json({ success: false, message: "Failed to load fee plans" }); }
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

const updateBranchFeePlan = async (req, res) => {
  const { branchId, ...values } = req.body || {};
  if (!isId(req.params.planId) || !isId(branchId)) return res.status(400).json({ success: false, message: "Valid plan and branch IDs are required" });
  if (isBranchScoped(req.user) && String(branchId) !== String(getBranchId(req.user))) return res.status(403).json({ success: false, message: "You can only update fee terms for your assigned branch" });
  const allowed = new Set(["feeName", "amount", "billingFrequency", "registrationFee", "taxRate", "active", "effectiveFrom", "effectiveUntil", "discountRules", "reason"]);
  if (Object.keys(values).some((key) => !allowed.has(key))) return res.status(400).json({ success: false, message: "Only branch fee terms can be changed here" });
  if (values.billingFrequency !== undefined && !FREQUENCIES.has(values.billingFrequency)) return res.status(400).json({ success: false, message: "Invalid billing frequency" });
  if (values.amount !== undefined && (asAmount(values.amount) === null || Number(values.amount) <= 0)) return res.status(400).json({ success: false, message: "Fee amount must be greater than zero" });
  if (values.registrationFee !== undefined && asAmount(values.registrationFee) === null) return res.status(400).json({ success: false, message: "Registration fee must be zero or greater" });
  if (values.taxRate !== undefined && (!Number.isFinite(Number(values.taxRate)) || Number(values.taxRate) < 0 || Number(values.taxRate) > 100)) return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 100" });
  if (values.active !== undefined && typeof values.active !== "boolean") return res.status(400).json({ success: false, message: "Fee plan active status is invalid" });
  if (values.discountRules !== undefined && (!Array.isArray(values.discountRules) || values.discountRules.some((rule) => !rule.name?.trim() || !["FIXED", "PERCENT"].includes(rule.type) || asAmount(rule.amount) === null || (rule.type === "PERCENT" && Number(rule.amount) > 100)))) return res.status(400).json({ success: false, message: "Discount rules are invalid" });
  try {
    const result = await createSession(async (session) => {
      const plan = await Plan.findById(req.params.planId).session(session);
      const branch = await Branch.findById(branchId).select("_id").session(session);
      if (!plan || !branch) { const error = new Error("Plan or branch not found"); error.status = 404; throw error; }
      const overrides = [...(plan.branchFeeOverrides || [])];
      const index = overrides.findIndex((item) => String(item.branch) === String(branchId));
      const existing = index >= 0 ? overrides[index].toObject() : null;
      const before = existing ? { ...existing } : null;
      const override = {
        branch: branchId,
        feeName: values.feeName !== undefined ? String(values.feeName).trim() : existing?.feeName || plan.feeName || plan.name,
        amount: values.amount !== undefined ? round(values.amount) : Number(existing?.amount ?? plan.price),
        billingFrequency: values.billingFrequency || existing?.billingFrequency || plan.billingFrequency || "ONE_TIME",
        registrationFee: values.registrationFee !== undefined ? round(values.registrationFee) : Number(existing?.registrationFee ?? plan.registrationFee ?? 0),
        taxRate: values.taxRate !== undefined ? Number(values.taxRate) : Number(existing?.taxRate ?? plan.taxRate ?? 0),
        active: values.active !== undefined ? values.active : existing?.active !== false && plan.feeActive !== false,
        effectiveFrom: values.effectiveFrom !== undefined ? values.effectiveFrom || null : existing?.effectiveFrom || null,
        effectiveUntil: values.effectiveUntil !== undefined ? values.effectiveUntil || null : existing?.effectiveUntil || null,
        discountRules: values.discountRules !== undefined ? values.discountRules : (existing?.discountRules || plan.discountRules || []),
      };
      if (!override.feeName || !override.amount) { const error = new Error("Fee name and amount are required"); error.status = 400; throw error; }
      if (override.effectiveFrom && override.effectiveUntil && new Date(override.effectiveUntil) < new Date(override.effectiveFrom)) { const error = new Error("Effective end date must follow the start date"); error.status = 400; throw error; }
      if (index >= 0) overrides[index] = override; else overrides.push(override);
      plan.branchFeeOverrides = overrides;
      await plan.save({ session });
      await FinanceAudit.create([{ action: "FEE_PLAN_UPDATED", actor: req.user._id, branch: branchId, reason: String(values.reason || "Branch fee terms updated").slice(0, 500), before, after: override }], { session });
      return { plan, branchFee: override };
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Branch fee terms update failed", { name: error.name, code: error.code }); res.status(500).json({ success: false, message: "Failed to update branch fee terms" });
  }
};

const updateFeePlan = async (req, res) => {
  const allowed = ["feeName", "price", "billingFrequency", "registrationFee", "taxRate", "feeBranch", "feeActive", "effectiveFrom", "effectiveUntil", "discountRules"];
  if (!isId(req.params.planId)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
  const invalid = Object.keys(req.body || {}).filter((key) => ![...allowed, "reason"].includes(key));
  if (invalid.length) return res.status(400).json({ success: false, message: "Only fee terms can be changed here" });
  const frequency = req.body.billingFrequency;
  if (frequency !== undefined && !FREQUENCIES.has(frequency)) return res.status(400).json({ success: false, message: "Invalid billing frequency" });
  if (req.body.registrationFee !== undefined && asAmount(req.body.registrationFee) === null) return res.status(400).json({ success: false, message: "Registration fee must be zero or greater" });
  if (req.body.price !== undefined && (asAmount(req.body.price) === null || Number(req.body.price) <= 0)) return res.status(400).json({ success: false, message: "Fee amount must be greater than zero" });
  if (req.body.feeName !== undefined && !String(req.body.feeName).trim()) return res.status(400).json({ success: false, message: "Fee name is required" });
  if (req.body.feeBranch != null && !isId(req.body.feeBranch)) return res.status(400).json({ success: false, message: "Invalid fee branch" });
  if (req.body.taxRate !== undefined && (!Number.isFinite(Number(req.body.taxRate)) || Number(req.body.taxRate) < 0 || Number(req.body.taxRate) > 100)) return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 100" });
  if (req.body.feeActive !== undefined && typeof req.body.feeActive !== "boolean") return res.status(400).json({ success: false, message: "Fee plan active status is invalid" });
  if (req.body.discountRules !== undefined && (!Array.isArray(req.body.discountRules) || req.body.discountRules.some((rule) => !rule.name?.trim() || !["FIXED", "PERCENT"].includes(rule.type) || asAmount(rule.amount) === null || (rule.type === "PERCENT" && Number(rule.amount) > 100)))) return res.status(400).json({ success: false, message: "Discount rules are invalid" });
  try {
    const plan = await createSession(async (session) => {
      const record = await Plan.findById(req.params.planId).session(session);
      if (!record) { const error = new Error("Plan not found"); error.status = 404; throw error; }
      const assignedBranch = String(getBranchId(req.user) || "");
      const planBranch = String(record.feeBranch || "");
      const feeBranchChange = req.body.feeBranch === undefined ? planBranch : String(req.body.feeBranch || "");
      if (isBranchScoped(req.user) && (!planBranch || planBranch !== assignedBranch || feeBranchChange !== assignedBranch)) { const error = new Error("Branch users can only change fee terms assigned to their branch"); error.status = 403; throw error; }
      const before = { feeName: record.feeName, billingFrequency: record.billingFrequency, price: record.price, registrationFee: record.registrationFee, taxRate: record.taxRate, feeActive: record.feeActive, feeBranch: record.feeBranch, effectiveFrom: record.effectiveFrom, effectiveUntil: record.effectiveUntil, discountRules: record.discountRules };
      for (const key of allowed) if (req.body[key] !== undefined) record[key] = req.body[key];
      if (record.effectiveFrom && record.effectiveUntil && record.effectiveUntil < record.effectiveFrom) { const error = new Error("Effective end date must follow the start date"); error.status = 400; throw error; }
      await record.save({ session });
      const branch = record.feeBranch || getBranchId(req.user);
      await FinanceAudit.create([{ action: "FEE_PLAN_UPDATED", actor: req.user._id, branch, reason: String(req.body.reason || "Fee terms updated").slice(0, 500), before, after: { feeName: record.feeName, billingFrequency: record.billingFrequency, price: record.price, registrationFee: record.registrationFee, taxRate: record.taxRate, feeActive: record.feeActive, feeBranch: record.feeBranch, effectiveFrom: record.effectiveFrom, effectiveUntil: record.effectiveUntil, discountRules: record.discountRules } }], { session });
      return record;
    });
    res.json({ success: true, plan });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Finance fee plan update failed", { name: error.name, code: error.code }); res.status(500).json({ success: false, message: "Failed to update fee plan" });
  }
};

const createInvoice = async (req, res) => {
  const { studentId, enrollmentId, dueDate: dueDateInput, discountRuleId, notes = "", status = "ISSUED", periodStart: periodStartInput } = req.body || {};
  if (!isId(studentId) || !isId(enrollmentId)) return res.status(400).json({ success: false, message: "Valid student and enrollment IDs are required" });
  if (!dueDateInput || Number.isNaN(new Date(dueDateInput).getTime()) || !["DRAFT", "ISSUED"].includes(status)) return res.status(400).json({ success: false, message: "A valid due date and invoice status are required" });
  try {
    const invoice = await createSession(async (session) => {
      const student = await Student.findById(studentId).session(session);
      if (!student) { const error = new Error("Student not found"); error.status = 404; throw error; }
      if (!queryInScope(req.user, student.branch)) { const error = new Error("Student not found"); error.status = 404; throw error; }
      const enrollment = student.planEnrollments.id(enrollmentId);
      if (!enrollment) { const error = new Error("Enrollment not found for this student"); error.status = 404; throw error; }
      const plan = await Plan.findById(enrollment.plan).session(session);
      if (!plan) { const error = new Error("Training plan not found"); error.status = 400; throw error; }
      if (plan.feeBranch && String(plan.feeBranch) !== String(student.branch)) { const error = new Error("Fee plan is not available to this student's branch"); error.status = 400; throw error; }
      const branchOverride = (plan.branchFeeOverrides || []).find((item) => String(item.branch) === String(student.branch));
      const terms = enrollment.billingSnapshot?.amount !== undefined && enrollment.billingSnapshot?.feeName
        ? enrollment.billingSnapshot
        : { feeName: branchOverride?.feeName || plan.feeName || plan.name, amount: branchOverride?.amount ?? plan.price, billingFrequency: branchOverride?.billingFrequency || plan.billingFrequency || "ONE_TIME", registrationFee: branchOverride?.registrationFee ?? plan.registrationFee ?? 0, taxRate: branchOverride?.taxRate ?? plan.taxRate ?? 0, discountRules: branchOverride?.discountRules || plan.discountRules || [], effectiveFrom: branchOverride?.effectiveFrom || plan.effectiveFrom, effectiveUntil: branchOverride?.effectiveUntil || plan.effectiveUntil };
      if (!FREQUENCIES.has(terms.billingFrequency)) { const error = new Error("Enrollment billing frequency is invalid"); error.status = 400; throw error; }
      if (terms.active === false || plan.feeActive === false || branchOverride?.active === false) { const error = new Error("This fee structure is inactive"); error.status = 409; throw error; }
      const period = periodFor(terms.billingFrequency, periodStartInput || enrollment.startDate);
      if (terms.billingFrequency !== "ONE_TIME" && periodStartInput && new Date(periodStartInput) < new Date(enrollment.startDate)) { const error = new Error("Billing period cannot begin before enrollment"); error.status = 400; throw error; }
      if (enrollment.endDate && period.periodStart >= new Date(enrollment.endDate)) { const error = new Error("Billing period falls after this enrollment ended"); error.status = 400; throw error; }
      if (terms.effectiveFrom && period.periodStart < new Date(terms.effectiveFrom)) { const error = new Error("Fee plan is not effective for this enrollment date"); error.status = 400; throw error; }
      if (terms.effectiveUntil && period.periodStart > new Date(terms.effectiveUntil)) { const error = new Error("Fee plan is no longer effective for this enrollment date"); error.status = 400; throw error; }
      if (new Date(dueDateInput) < period.periodStart) { const error = new Error("Invoice due date cannot be before its billing period starts"); error.status = 400; throw error; }
      const duplicate = await Invoice.findOne({ enrollment: enrollment._id, cycleKey: period.cycleKey, status: { $ne: "CANCELLED" } }).session(session);
      if (duplicate) { const error = new Error("An invoice already exists for this billing period"); error.status = 409; throw error; }
      const programIds = (enrollment.programs || []).map((item) => item.program).filter(Boolean);
      const programs = programIds.length ? await TrainingSessionType.find({ _id: { $in: programIds } }).select("name").session(session).lean() : [];
      const programName = programs.map((item) => item.name).join(", ");
      const items = [{ description: terms.feeName || plan.name, quantity: 1, unitAmount: round(terms.amount), amount: round(terms.amount), kind: "TUITION", program: programIds[0] || null, programName }];
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
      const invoiceNumber = await nextNumber("INV", session);
      const [created] = await Invoice.create([{
        invoiceNumber, student: student._id, enrollment: enrollment._id, plan: plan._id, branch: student.branch, items, subtotal, discount, discountName, taxRate, tax, total, balance: total,
        currency: settings?.currency || "INR", dueDate: new Date(dueDateInput), periodStart: period.periodStart,
        periodEnd: enrollment.endDate && period.periodEnd > enrollment.endDate ? enrollment.endDate : period.periodEnd,
        cycleKey: period.cycleKey, status: invoiceStatus, notes: String(notes).slice(0, 1000), createdBy: req.user._id, issuedAt: status !== "DRAFT" ? new Date() : null,
      }], { session });
      await audit(session, { action: "INVOICE_CREATED", actor: req.user._id, branch: student.branch, student: student._id, invoice: created._id, after: { invoiceNumber, total, status: invoiceStatus, discount, tax } });
      return created;
    });
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
      await audit(session, { action: "INVOICE_CANCELLED", actor: req.user._id, branch: record.branch, student: record.student, invoice: record._id, reason, before, after: { status: "CANCELLED" } });
      return record;
    });
    res.json({ success: true, invoice });
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
      await audit(session, { action: "INVOICE_CREATED", actor: req.user._id, branch: record.branch, student: record.student, invoice: record._id, reason: "Draft invoice issued", before: { status: "DRAFT" }, after: { status: "ISSUED" } });
      return record;
    });
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
      await audit(session, { action: "PAYMENT_CREATED", actor: req.user._id, branch: invoice.branch, student: invoice.student, invoice: invoice._id, payment: payment._id, after: { amount, method, status: invoice.status, balance } });
      return { payment, receipt, invoice };
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
  const partial = output.invoice.balance > 0;
  await safelyNotify({ type: partial ? "FINANCE_PARTIAL_PAYMENT_RECEIVED" : "FINANCE_PAYMENT_RECEIVED", title: partial ? "Partial payment received" : "Payment received", message: `${output.payment.amount.toFixed(2)} ${output.invoice.currency} received for invoice ${output.invoice.invoiceNumber}.`, severity: "SUCCESS", branch: output.invoice.branch, student: output.invoice.student, entityType: "FINANCE", entityId: output.payment._id, actionUrl: "/fees", eventKey: `finance:payment:${output.payment._id}:staff` });
  const linkedStudent = await Student.findById(output.invoice.student).select("user name").lean();
  if (linkedStudent?.user) await createNotification({ type: partial ? "FINANCE_STUDENT_PARTIAL_PAYMENT_RECEIVED" : "FINANCE_STUDENT_PAYMENT_RECEIVED", recipient: linkedStudent.user, title: partial ? "Partial payment received" : "Payment received", message: `Your payment of ${output.payment.amount.toFixed(2)} ${output.invoice.currency} was recorded for invoice ${output.invoice.invoiceNumber}.`, severity: "SUCCESS", branch: output.invoice.branch, student: output.invoice.student, entityType: "FINANCE", entityId: output.payment._id, actionUrl: "/student-dashboard", eventKey: `finance:payment:${output.payment._id}:student` }).catch(() => {});
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
      await audit(session, { action: "PAYMENT_REFUNDED", actor: req.user._id, branch: payment.branch, student: payment.student, invoice: invoice._id, payment: refund._id, reason, before: { paidAmount: round(invoice.paidAmount + amount) }, after: { paidAmount: invoice.paidAmount, balance: invoice.balance, refundAmount: amount } });
      return { refund, invoice, receipt };
    });
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
      await audit(session, { action: "PAYMENT_CORRECTED", actor: req.user._id, branch: original.branch, student: original.student, invoice: invoice._id, payment: original._id, reason, before: { amount: original.amount }, after: { correctedAmount, invoicePaidAmount: invoice.paidAmount, balance: invoice.balance, correctionIds: corrections.map((item) => item._id) } });
      return { corrections, receipts, invoice };
    });
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
  return { summary: { totalBilled, totalPaid, outstanding: round(invoices.reduce((sum, invoice) => sum + invoice.balance, 0)), overdue }, invoices, payments, receipts };
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
    const scope = branchFilter(req.user);
    const since = new Date(Date.now() - 365 * 86400000);
    const [invoices, payments, audits, counts] = await Promise.all([
      Invoice.find({ ...scope, createdAt: { $gte: since } }).populate("student", "name").populate("branch", "name").sort({ createdAt: -1 }).limit(5000).lean(),
      Payment.find({ ...scope, paymentDate: { $gte: since } }).populate("student", "name").populate("branch", "name").sort({ paymentDate: -1 }).limit(5000).lean(),
      FinanceAudit.find({ ...scope, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(5000).lean(),
      Promise.all([
        Invoice.countDocuments({ ...scope, createdAt: { $gte: since } }),
        Payment.countDocuments({ ...scope, paymentDate: { $gte: since } }),
        FinanceAudit.countDocuments({ ...scope, createdAt: { $gte: since } }),
      ]),
    ]);
    res.json({ success: true, invoices, payments, audits, truncated: { invoices: counts[0] > invoices.length, payments: counts[1] > payments.length, audits: counts[2] > audits.length } });
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

module.exports = { getFeePlans, getFeeBranches, updateFeePlan, updateBranchFeePlan, getInvoiceCandidates, createInvoice, listInvoices, listPayments, cancelInvoice, issueInvoice, addPayment, refundPayment, correctPayment, getReceipt, getStudentFinancialProfile, getMyFinancialProfile, getFinanceDashboard, getFinanceReport, listStudentInvoices };
