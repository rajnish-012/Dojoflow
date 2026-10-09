const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    enrollment: { type: mongoose.Schema.Types.ObjectId, default: null },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", default: null, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },

    sessionTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSessionType",
      default: null,
      index: true,
    },
    sessionSlotId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    sessionName: { type: String, trim: true, default: "" },
    sessionStartTime: { type: String, trim: true, default: "" },
    sessionEndTime: { type: String, trim: true, default: "" },

    date: {
      type: Date,
      required: true,
    },

    planDay: {
      type: Number,
      required: true,
    },

    curriculumTitle: {
      type: String,
      required: true,
      trim: true,
    },
    curriculumSkill: { type: String, trim: true, default: "" },
    curriculumDescription: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["PRESENT", "ABSENT"],
      required: true,
    },

    // Makeup visits are persisted for history, but do not consume a regular day.
    attendanceType: {
      type: String,
      enum: ["REGULAR", "MAKEUP"],
      default: "REGULAR",
      required: true,
      index: true,
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    makeupRequired: {
      type: Boolean,
      default: false,
    },

    makeupCompleted: {
      type: Boolean,
      default: false,
    },
    makeupAttendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", default: null },
  },
  {
    timestamps: true,
  },
);

attendanceSchema.index(
  {
    student: 1,
    date: 1,
  },
  {
    unique: true,
    // Missing legacy type is treated as regular until the migration labels it.
    partialFilterExpression: { $or: [{ attendanceType: "REGULAR" }, { attendanceType: null }] },
    name: "uniq_regular_attendance_student_date",
  },
);

// Supports branch attendance lists and date-range reports without scanning
// every branch's attendance records.
attendanceSchema.index({ branch: 1, date: -1 });

// Supports per-program learning-progress queries across a student's history.
attendanceSchema.index({ student: 1, sessionTypeId: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
