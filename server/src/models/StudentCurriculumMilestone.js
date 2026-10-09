const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({
  rewardId: { type: String, required: true, trim: true },
  type: { type: String, enum: ["CERTIFICATE", "MERCHANDISE", "POINTS", "RECOGNITION", "CUSTOM", "BELT_PROGRESSION"], required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  quantity: { type: Number, min: 1, default: 1 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  targetBelt: { type: String, trim: true, default: "" },
  targetMilestoneDay: { type: Number, min: 1, default: null },
  requiresFormalGrading: { type: Boolean, default: true },
  beltHistory: { type: mongoose.Schema.Types.ObjectId, ref: "BeltHistory", default: null },
  status: { type: String, enum: ["PENDING_APPROVAL", "AWAITING_GRADING", "AWAITING_PROMOTION_APPROVAL", "EARNED", "ISSUED", "FULFILLED"], default: "PENDING_APPROVAL", required: true },
  issuedAt: { type: Date, default: null },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  fulfilledAt: { type: Date, default: null },
  fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  fulfillmentNote: { type: String, trim: true, maxlength: 500, default: "" },
  certificate: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", default: null },
  certificateAchievement: { type: String, trim: true, maxlength: 160, default: "" },
}, { _id: true });

const historySchema = new mongoose.Schema({
  action: { type: String, enum: ["CRITERIA_MET", "APPROVED", "REWARD_ISSUED", "REWARD_FULFILLED", "CORRECTED"], required: true },
  rewardId: { type: String, default: null },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  performedAt: { type: Date, default: Date.now },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
}, { _id: false });

const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  curriculum: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum", required: true },
  milestoneStepId: { type: String, required: true, trim: true },
  milestoneName: { type: String, required: true, trim: true, maxlength: 160 },
  milestoneDescription: { type: String, trim: true, maxlength: 2000, default: "" },
  milestoneCriteria: { type: String, trim: true, maxlength: 2000, default: "" },
  requiredStepIds: [{ type: String, trim: true }],
  status: { type: String, enum: ["PENDING_APPROVAL", "EARNED", "CORRECTED"], default: "PENDING_APPROVAL", required: true, index: true },
  criteriaMetAt: { type: Date, required: true },
  earnedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  rewards: { type: [rewardSchema], default: [] },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

schema.index({ student: 1, enrollment: 1, curriculum: 1, milestoneStepId: 1 }, { unique: true, name: "uniq_curriculum_milestone_per_enrollment" });
schema.index({ student: 1, status: 1, earnedAt: -1 });

module.exports = mongoose.model("StudentCurriculumMilestone", schema);
