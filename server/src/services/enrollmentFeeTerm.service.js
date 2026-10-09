const mongoose = require("mongoose");
const FeeTerm = require("../models/FeeTerm");
const AcademySettings = require("../models/AcademySettings");
const { normalizeCurrency } = require("../utils/currency");

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function selectEnrollmentFeeTerm({ feeTermId, plan, branch, startDate, session }) {
  if (!mongoose.isValidObjectId(feeTermId)) {
    fail(400, "Select a valid Fee Term for this enrollment.");
  }
  const query = FeeTerm.findById(feeTermId);
  if (session) query.session(session);
  const term = await query;
  if (!term) fail(400, "The selected Fee Term does not exist.");
  const storedCurrency = String(term.currency || "").trim();
  let currency = normalizeCurrency(storedCurrency);
  if (storedCurrency && !currency) fail(409, "The selected Fee Term has an unsupported currency. Update that Fee Term before enrolling this student.");
  if (!storedCurrency) {
    const settingsQuery = AcademySettings.findOne().select("currency");
    if (session) settingsQuery.session(session);
    const settings = await settingsQuery.lean();
    currency = normalizeCurrency(settings?.currency || "INR");
  }
  if (!currency) fail(409, "The selected Fee Term has an unsupported currency. Update Academy Branding before enrolling this student.");
  if (String(term.plan) !== String(plan._id)) {
    fail(400, "The selected Fee Term does not belong to this Training Plan.");
  }
  if (term.branch && String(term.branch) !== String(branch._id)) {
    fail(400, "The selected Fee Term is for a different branch.");
  }
  if (term.status !== "ACTIVE") fail(400, "The selected Fee Term is not active.");
  const start = new Date(startDate);
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const from = new Date(term.effectiveFrom);
  const until = term.effectiveUntil ? new Date(term.effectiveUntil) : null;
  if (day < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    fail(400, "The selected Fee Term is not effective on the enrollment start date.");
  }
  if (until && day > new Date(until.getFullYear(), until.getMonth(), until.getDate())) {
    fail(400, "The selected Fee Term has expired for the enrollment start date.");
  }
  if (!term.branch) {
    const exactQuery = FeeTerm.findOne({
      plan: plan._id,
      branch: branch._id,
      billingFrequency: term.billingFrequency,
      status: "ACTIVE",
      effectiveFrom: { $lte: day },
      $or: [{ effectiveUntil: null }, { effectiveUntil: { $gte: day } }],
    });
    if (session) exactQuery.session(session);
    if (await exactQuery) fail(400, "Choose the branch-specific Fee Term for this billing frequency.");
  }
  return {
    term,
    billingSnapshot: {
      feeTerm: term._id,
      feeTermVersion: term.version,
      planName: plan.name,
      branch: branch._id,
      branchName: branch.name,
      currency,
      active: true,
      amount: Number(term.amount),
      billingFrequency: term.billingFrequency,
      registrationFee: Number(term.registrationFee || 0),
      taxRate: Number(term.taxRate || 0),
      discountRules: (term.discountRules || []).map((rule) => ({
        _id: rule._id,
        name: rule.name,
        type: rule.type,
        amount: Number(rule.amount || 0),
        active: rule.active !== false,
        effectiveFrom: rule.effectiveFrom || null,
        effectiveUntil: rule.effectiveUntil || null,
      })),
      effectiveFrom: term.effectiveFrom,
      effectiveUntil: term.effectiveUntil || null,
    },
  };
}

module.exports = { selectEnrollmentFeeTerm };
