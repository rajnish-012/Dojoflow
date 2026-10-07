const mongoose = require("mongoose");

const trialSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: "Inquiry", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  trialDate: { type: Date, required: true },
  startTime: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  status: { type: String, enum: ["SCHEDULED", "COMPLETED", "MISSED", "CANCELLED", "CONVERTED"], default: "SCHEDULED", index: true },
  statusHistory: [{
    from: { type: String, default: null },
    to: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500, default: "" },
  }],
  attendance: { type: String, enum: ["PRESENT", "ABSENT", null], default: null },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

// A lead may be rebooked after cancellation, while all live/completed bookings stay unique.
trialSchema.index({ lead:  1, trialDate: 1, startTime: 1 }, {
  unique: true,
  name: "uniq_trial_lead_datetime",
  partialFilterExpression: { status: { $in: ["SCHEDULED", "COMPLETED", "MISSED", "CONVERTED"] } },
});
trialSchema.index({ branch: 1, trialDate: 1, status: 1 });
trialSchema.index({ coach: 1, trialDate: 1, startTime: 1, status: 1 });

module.exports = mongoose.model("Trial", trialSchema);
