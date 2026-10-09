const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  status: { type: String, enum: ["IN_PROGRESS", "COMPLETED"], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  recordedAt: { type: Date, default: Date.now },
  session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", default: null },
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", default: null },
  assessmentResult: { type: String, trim: true, maxlength: 1000, default: "" },
  assessmentPassed: { type: Boolean, default: false },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
}, { _id: false });

const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  curriculum: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum", required: true },
  stepId: { type: String, required: true, trim: true },
  status: { type: String, enum: ["IN_PROGRESS", "COMPLETED"], default: "IN_PROGRESS", index: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", default: null },
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", default: null },
  assessmentResult: { type: String, trim: true, maxlength: 1000, default: "" },
  assessmentPassed: { type: Boolean, default: false },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

schema.index({ student: 1, enrollment: 1, curriculum: 1, stepId: 1 }, { unique: true });
schema.index({ student: 1, curriculum: 1, status: 1 });

module.exports = mongoose.model("StudentCurriculumStepProgress", schema);
