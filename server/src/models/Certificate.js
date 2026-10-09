const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true, trim: true, index: true },
  kind: { type: String, enum: ["BELT_PROMOTION", "PROGRAM_COMPLETION", "ACHIEVEMENT"], required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: "BeltHistory", default: null },
  gradingEvent: { type: mongoose.Schema.Types.ObjectId, ref: "GradingEvent", default: null },
  enrollment: { type: mongoose.Schema.Types.ObjectId, default: null },
  evaluation: { type: mongoose.Schema.Types.ObjectId, ref: "GradingEvaluation", default: null },
  achievement: { type: String, trim: true, maxlength: 160, default: "" },
  issuedAt: { type: Date, required: true, default: Date.now },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  academy: { name: { type: String, default: "DojoFlow Academy" }, logoUrl: { type: String, default: "" }, address: { type: String, default: "" }, contactEmail: { type: String, default: "" }, contactPhone: { type: String, default: "" }, primaryColor: { type: String, default: "#D7A84B" }, secondaryColor: { type: String, default: "#101A33" } },
  studentName: { type: String, required: true },
  programName: { type: String, default: "" },
  belt: { type: String, default: "" },
  examinerName: { type: String, default: "" },
}, { timestamps: true });

certificateSchema.index({ kind: 1, promotion: 1 }, { unique: true, partialFilterExpression: { promotion: { $type: "objectId" } }, name: "uniq_promotion_certificate" });
certificateSchema.index({ kind: 1, enrollment: 1, program: 1, student: 1 }, { unique: true, partialFilterExpression: { kind: "PROGRAM_COMPLETION" }, name: "uniq_program_completion_certificate" });
certificateSchema.index({ kind: 1, student: 1, achievement: 1 }, { unique: true, partialFilterExpression: { kind: "ACHIEVEMENT" }, name: "uniq_student_achievement_certificate" });

module.exports = mongoose.model("Certificate", certificateSchema);
