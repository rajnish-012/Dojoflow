const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
  value: { type: Number, min: 0, max: 100, required: true },
  remarks: { type: String, trim: true, maxlength: 500, default: "" },
}, { _id: false });

const gradingEvaluationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "GradingEvent", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  criteria: {
    technique: { type: scoreSchema, required: true },
    discipline: { type: scoreSchema, required: true },
    attendance: { type: scoreSchema, required: true },
    performance: { type: scoreSchema, required: true },
  },
  overallScore: { type: Number, min: 0, max: 100, required: true },
  remarks: { type: String, trim: true, maxlength: 2000, default: "" },
  result: { type: String, enum: ["PASS", "FAIL", "PENDING"], default: "PENDING", required: true },
  status: { type: String, enum: ["DRAFT", "FINALIZED", "PUBLISHED"], default: "DRAFT", required: true, index: true },
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  finalizedAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: "BeltHistory", default: null },
}, { timestamps: true });

gradingEvaluationSchema.index({ event: 1, student: 1 }, { unique: true, name: "uniq_grading_event_student_evaluation" });

module.exports = mongoose.model("GradingEvaluation", gradingEvaluationSchema);
