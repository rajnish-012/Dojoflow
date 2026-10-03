const mongoose = require("mongoose");

const makeupSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    enrollment: { type: mongoose.Schema.Types.ObjectId, default: null },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
    sessionSlotId: { type: mongoose.Schema.Types.ObjectId, default: null },
    makeupAttendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", default: null },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    originalAttendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
      index: true,
    },

    planDay: {
      type: Number,
      required: true,
      min: 1,
    },

    originalDate: {
      type: Date,
      required: true,
      index: true,
    },

    /*
     * A makeup is created automatically when a student is absent.
     * At that moment no makeup date has been selected yet.
     */
    makeupDate: {
      type: Date,
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
      required: true,
      index: true,
    },

    curriculumTitle: {
      type: String,
      trim: true,
      default: "",
    },
    curriculumSkill: { type: String, trim: true, default: "" },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * User who marked the original absence.
     */
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
     * User who completed the makeup class.
     */
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Branch + status + date
 *
 * Useful for:
 * - scheduled makeups
 * - overdue makeups
 * - branch filtering
 */
makeupSchema.index({
  branch: 1,
  status: 1,
  makeupDate: 1,
});

/*
 * Student's makeup history.
 */
makeupSchema.index({
  student: 1,
  status: 1,
  originalDate: -1,
});

/*
 * Finding upcoming/overdue makeup sessions.
 */
makeupSchema.index({
  makeupDate: 1,
  status: 1,
});

module.exports = mongoose.model("Makeup", makeupSchema);
