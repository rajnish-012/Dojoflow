const mongoose = require("mongoose");

const EVENT_CATEGORIES = Object.freeze([
  "TOURNAMENT",
  "SEMINAR",
  "WORKSHOP",
  "COMPETITION",
  "ACADEMY_EVENT",
]);

const EVENT_STATUSES = Object.freeze([
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "FULL",
  "CANCELLED",
  "COMPLETED",
]);

const academyEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 4000, default: "" },
    category: { type: String, enum: EVENT_CATEGORIES, required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    startTime: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null, index: true },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    capacity: { type: Number, min: 1, default: null },
    location: { type: String, trim: true, maxlength: 160, default: "" },
    registrationRequired: { type: Boolean, default: false },
    registrationDeadline: { type: Date, default: null },
    status: { type: String, enum: EVENT_STATUSES, default: "DRAFT", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

academyEventSchema.index({ branch: 1, startDate: 1, endDate: 1, status: 1 });
academyEventSchema.index({ coach: 1, startDate: 1, endDate: 1, status: 1 });
academyEventSchema.index({ branch: 1, location: 1, startDate: 1, endDate: 1, status: 1 });

module.exports = mongoose.model("AcademyEvent", academyEventSchema);
module.exports.EVENT_CATEGORIES = EVENT_CATEGORIES;
module.exports.EVENT_STATUSES = EVENT_STATUSES;
