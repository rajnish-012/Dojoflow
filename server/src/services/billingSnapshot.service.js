const mongoose = require("mongoose");
const { normalizeCurrency } = require("../utils/currency");

const BILLING_FREQUENCIES = new Set(["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"]);

function validateBillingSnapshot(enrollment) {
  const snapshot = enrollment?.billingSnapshot;
  const missing = [];
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, missing: ["billingSnapshot"] };
  }

  const enrollmentFeeTerm = enrollment.feeTerm?._id || enrollment.feeTerm;
  const snapshotFeeTerm = snapshot.feeTerm?._id || snapshot.feeTerm;
  if (!mongoose.isValidObjectId(enrollmentFeeTerm) || String(enrollmentFeeTerm) !== String(snapshotFeeTerm)) {
    missing.push("matching FeeTerm reference");
  }
  if (!Number.isInteger(snapshot.feeTermVersion) || snapshot.feeTermVersion < 1) missing.push("FeeTerm version");
  if (typeof snapshot.planName !== "string" || !snapshot.planName.trim()) missing.push("Plan name");
  if (!mongoose.isValidObjectId(snapshot.branch?._id || snapshot.branch)) missing.push("branch");
  if (enrollment.branch && String(snapshot.branch?._id || snapshot.branch) !== String(enrollment.branch?._id || enrollment.branch)) missing.push("matching enrollment branch");
  if (!snapshot.effectiveFrom || !Number.isFinite(new Date(snapshot.effectiveFrom).getTime())) missing.push("effective start date");
  if (snapshot.effectiveUntil != null && !Number.isFinite(new Date(snapshot.effectiveUntil).getTime())) missing.push("effective end date");
  if (!Object.prototype.hasOwnProperty.call(snapshot, "effectiveUntil")) missing.push("effective end date");
  if (typeof snapshot.amount !== "number" || !Number.isFinite(snapshot.amount) || snapshot.amount < 0) missing.push("amount");
  if (!BILLING_FREQUENCIES.has(snapshot.billingFrequency)) missing.push("billing frequency");
  if (typeof snapshot.registrationFee !== "number" || !Number.isFinite(snapshot.registrationFee) || snapshot.registrationFee < 0) missing.push("registration fee");
  if (typeof snapshot.taxRate !== "number" || !Number.isFinite(snapshot.taxRate) || snapshot.taxRate < 0 || snapshot.taxRate > 100) missing.push("tax rate");
  if (snapshot.currency != null && !normalizeCurrency(snapshot.currency)) missing.push("supported currency");
  if (!Array.isArray(snapshot.discountRules) || snapshot.discountRules.some((rule) => (
    !rule || typeof rule.name !== "string" || !rule.name.trim() ||
    !["FIXED", "PERCENT"].includes(rule.type) ||
    typeof rule.amount !== "number" || !Number.isFinite(rule.amount) || rule.amount < 0
  ))) missing.push("discount rules");

  return { valid: missing.length === 0, missing };
}

module.exports = { validateBillingSnapshot };
