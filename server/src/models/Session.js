const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: "BranchSchedule", required: true },
  scheduleSlotId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  sessionName: { type: String, trim: true, default: "Training Session" },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  room: { type: String, trim: true, default: "" },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  curriculum: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum", default: null, index: true },
  plannedModuleIds: [{ type: String, trim: true }],
  plannedStepIds: [{ type: String, trim: true }],
  capacity: { type: Number, default: null },
  status: { type: String, enum: ["SCHEDULED", "COMPLETED", "CANCELLED", "CLOSED"], default: "SCHEDULED", index: true },
  closureReason: { type: String, trim: true, maxlength: 500, default: "" },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  cancellationSource: { type: String, enum: ["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY", "MANUAL", null], default: null },
}, { timestamps: true });

sessionSchema.index({ batch: 1, date: 1, scheduleSlotId: 1 }, { unique: true });
sessionSchema.index({ branch: 1, date: 1, status: 1 });

module.exports = mongoose.model("Session", sessionSchema);
