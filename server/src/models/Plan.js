const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },

    belt: {
      type: String,
      required: true,
      trim: true,
    },

    skill: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const curriculumSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    skill: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const programPlanSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  weeklyLimit: { type: Number, min: 1, default: null },
  curriculum: { type: [curriculumSchema], default: [] },
}, { _id: false });

const branchFeeOverrideSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
  feeName: { type: String, required: true, trim: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0 },
  billingFrequency: { type: String, enum: ["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"], default: "ONE_TIME", required: true },
  registrationFee: { type: Number, min: 0, default: 0 },
  taxRate: { type: Number, min: 0, max: 100, default: 0 },
  active: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: null },
  effectiveUntil: { type: Date, default: null },
  discountRules: [{
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["FIXED", "PERCENT"], required: true },
    amount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
  }],
}, { _id: false });

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    durationUnit: {
      type: String,
      enum: ["MONTHS", "DAYS"],
      default: "MONTHS",
    },

    classesPerWeek: {
      type: Number,
      default: 4,
      min: 1,
    },
    feeName: { type: String, trim: true, maxlength: 100, default: "" },
    feeActive: { type: Boolean, default: true },

    // Billing terms extend the existing training plan so fee amounts have a
    // single source of truth. Existing plans remain one-time plans by default.
    billingFrequency: { type: String, enum: ["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"], default: "ONE_TIME", required: true },
    registrationFee: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    feeBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
    discountRules: [{
      name: { type: String, required: true, trim: true, maxlength: 80 },
      type: { type: String, enum: ["FIXED", "PERCENT"], required: true },
      amount: { type: Number, required: true, min: 0 },
      active: { type: Boolean, default: true },
      effectiveFrom: { type: Date, default: null },
      effectiveUntil: { type: Date, default: null },
    }],
    branchFeeOverrides: { type: [branchFeeOverrideSchema], default: [] },

    // Programs included in this plan. Legacy plans may have an empty list
    // until an administrator assigns their existing students' programs.
    programs: { type: [programPlanSchema], default: [] },

    startingBelt: {
      type: String,
      default: "White",
      trim: true,
    },

    progressReports: {
      type: String,
      default: "Monthly",
      trim: true,
    },

    milestones: {
      type: [milestoneSchema],
      default: [],
    },

    curriculum: {
      type: [curriculumSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },  
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Plan", planSchema);
