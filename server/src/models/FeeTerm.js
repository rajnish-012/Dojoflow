const mongoose = require("mongoose");
const { SUPPORTED_CURRENCIES } = require("../utils/currency");

const FREQUENCIES = ["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"];
const STATUSES = ["DRAFT", "ACTIVE", "RETIRED"];

const discountRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  type: { type: String, enum: ["FIXED", "PERCENT"], required: true },
  amount: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: null },
  effectiveUntil: { type: Date, default: null },
}, { _id: true });

const feeTermSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
  // A null branch is an explicit academy-wide fallback. New branch-scoped
  // terms always store their Branch reference.
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
  // Currency is snapshotted when a new FeeTerm is created. Legacy records may omit it.
  currency: { type: String, trim: true, uppercase: true, enum: SUPPORTED_CURRENCIES, default: undefined },
  billingFrequency: { type: String, enum: FREQUENCIES, required: true },
  amount: { type: Number, required: true, min: 0 },
  registrationFee: { type: Number, default: 0, min: 0 },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  discountRules: { type: [discountRuleSchema], default: [] },
  effectiveFrom: { type: Date, required: true, index: true },
  effectiveUntil: { type: Date, default: null, index: true },
  status: { type: String, enum: STATUSES, default: "ACTIVE", required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  supersedes: { type: mongoose.Schema.Types.ObjectId, ref: "FeeTerm", default: null, index: true },
}, { timestamps: true });

feeTermSchema.pre("validate", function validateDateRange() {
  if (this.effectiveFrom && this.effectiveUntil && this.effectiveUntil < this.effectiveFrom) {
    throw new Error("Effective end date must follow the start date.");
  }
});

feeTermSchema.index(
  { plan: 1, branch: 1, billingFrequency: 1, effectiveFrom: 1 },
  { unique: true, name: "uniq_fee_term_scope_start" },
);
feeTermSchema.index(
  { branch: 1, status: 1, effectiveFrom: 1, effectiveUntil: 1 },
  { name: "fee_term_branch_status_dates" },
);
feeTermSchema.index(
  { plan: 1, status: 1, effectiveFrom: 1, effectiveUntil: 1 },
  { name: "fee_term_plan_status_dates" },
);

feeTermSchema.statics.FREQUENCIES = FREQUENCIES;
feeTermSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("FeeTerm", feeTermSchema);
