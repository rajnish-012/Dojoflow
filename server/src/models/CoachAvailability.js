const mongoose = require("mongoose");

const hoursSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  startTime: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/, required: true },
  endTime: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/, required: true },
}, { _id: false });

const leaveSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, trim: true, maxlength: 250, default: "" },
}, { _id: true });

const unavailableSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, default: null },
  date: { type: Date, default: null },
  startTime: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/, required: true },
  endTime: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/, required: true },
  reason: { type: String, trim: true, maxlength: 250, default: "" },
}, { _id: true });

const coachAvailabilitySchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  workingHours: { type: [hoursSchema], default: [] },
  leave: { type: [leaveSchema], default: [] },
  unavailableSlots: { type: [unavailableSchema], default: [] },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model("CoachAvailability", coachAvailabilitySchema);
