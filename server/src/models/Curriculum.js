const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
  title: { type: String, trim: true, maxlength: 160, default: "" },
  description: { type: String, trim: true, maxlength: 4000, default: "" },
  objectives: [{ type: String, trim: true, maxlength: 500 }],
  activities: [{ type: String, trim: true, maxlength: 1000 }],
  estimatedMinutes: { type: Number, min: 0, max: 1440, default: null },
  materials: [{ type: String, trim: true, maxlength: 200 }],
  completionCriteria: { type: String, trim: true, maxlength: 2000, default: "" },
  coachApprovalRequired: { type: Boolean, default: true },
  attendanceRequired: { type: Boolean, default: false },
  assessmentRequired: { type: Boolean, default: false },
  assessmentPassRequired: { type: Boolean, default: false },
  assessmentPassingValue: { type: String, trim: true, maxlength: 100, default: "PASS" },
  // milestoneDay is retained for historical Curriculum versions only. It is
  // not linked to Plan grading thresholds or used for new eligibility.
  milestoneDay: { type: Number, min: 1, default: null },
  isMilestone: { type: Boolean, default: false },
  milestoneName: { type: String, trim: true, maxlength: 160, default: "" },
  milestoneDescription: { type: String, trim: true, maxlength: 2000, default: "" },
  milestoneCriteria: { type: String, trim: true, maxlength: 2000, default: "" },
  milestoneRequiredStepIds: [{ type: String, trim: true }],
  requiresCoachApproval: { type: Boolean, default: true },
  rewards: [{
    rewardId: { type: String, trim: true, required: true },
    type: { type: String, enum: ["CERTIFICATE", "MERCHANDISE", "POINTS", "RECOGNITION", "CUSTOM", "BELT_PROGRESSION"], required: true },
    name: { type: String, trim: true, maxlength: 160, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    quantity: { type: Number, min: 1, default: 1 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    targetBelt: { type: String, trim: true, default: "" },
    targetMilestoneDay: { type: Number, min: 1, default: null },
    requiresFormalGrading: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  }],
  legacyTrainingDay: { type: Number, min: 1, default: null },
  prerequisites: [{ type: String, trim: true }],
}, { timestamps: true });

const moduleSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 160, default: "" },
  description: { type: String, trim: true, maxlength: 4000, default: "" },
  order: { type: Number, min: 1, required: true },
  objectives: [{ type: String, trim: true, maxlength: 500 }],
  expectedSessions: { type: Number, min: 0, max: 1000, default: null },
  prerequisites: [{ type: String, trim: true }],
  steps: { type: [stepSchema], default: [] },
}, { timestamps: true });

const curriculumSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true, index: true },
  version: { type: Number, min: 1, required: true },
  name: { type: String, trim: true, maxlength: 160, required: true },
  description: { type: String, trim: true, maxlength: 4000, default: "" },
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "DRAFT", required: true },
  modules: { type: [moduleSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  publishedAt: { type: Date, default: null },
  legacyFingerprint: { type: String, trim: true, default: null },
}, { timestamps: true });

curriculumSchema.index({ plan: 1, program: 1, version: 1 }, { unique: true });
curriculumSchema.index({ plan: 1, program: 1, status: 1 });
curriculumSchema.index({ plan: 1, program: 1 }, { unique: true, partialFilterExpression: { status: "DRAFT" } });
curriculumSchema.index({ plan: 1, program: 1, legacyFingerprint: 1 }, { unique: true, partialFilterExpression: { legacyFingerprint: { $type: "string" } } });

module.exports = mongoose.model("Curriculum", curriculumSchema);
