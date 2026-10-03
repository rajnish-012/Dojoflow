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
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },

    sessionTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSessionType",
      default: null,
      index: true,
    },
    sessionSlotId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    sessionName: { type: String, trim: true, default: "" },

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
    sessionSlotId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("Attendance", attendanceSchema);
