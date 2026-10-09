const mongoose = require("mongoose");

const REGISTRATION_STATUSES = Object.freeze([
  "REGISTERED",
  "WAITLISTED",
  "CANCELLED",
  "ATTENDED",
  "NO_SHOW",
]);

const academyEventRegistrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "AcademyEvent", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    status: { type: String, enum: REGISTRATION_STATUSES, default: "REGISTERED", required: true, index: true },
    result: { type: String, trim: true, maxlength: 1000, default: "" },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    attendedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

academyEventRegistrationSchema.index({ event: 1, student: 1 }, { unique: true });
academyEventRegistrationSchema.index({ student: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AcademyEventRegistration", academyEventRegistrationSchema);
module.exports.REGISTRATION_STATUSES = REGISTRATION_STATUSES;
