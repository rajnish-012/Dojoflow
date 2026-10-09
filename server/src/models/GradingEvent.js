const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  eligibility: { type: mongoose.Schema.Types.Mixed, default: () => ({ eligible: true }) },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { _id: false });

const gradingEventSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true, index: true },
  examiner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  students: { type: [participantSchema], default: [] },
  status: { type: String, enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], default: "SCHEDULED", required: true, index: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

gradingEventSchema.index({ branch: 1, date: -1 });
gradingEventSchema.index({ "students.student": 1, date: -1 });

module.exports = mongoose.model("GradingEvent", gradingEventSchema);
