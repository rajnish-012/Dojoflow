const mongoose = require("mongoose");

/* =========================================================
   TIME SLOT
========================================================= */

const dateTimeSlotSchema = new mongoose.Schema(
  {
    sessionName: {
      type: String,
      trim: true,
      default: "Training Session",
    },

    sessionTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSessionType",
    },

    sessionType: { type: String, trim: true },

    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  },
);

/* =========================================================
   BRANCH DATE SCHEDULE
========================================================= */

/**
 * Date-specific schedule override.
 *
 * Example:
 *
 * branch: Sector 21 Dojo
 * date: 2026-09-21
 *
 * sessions:
 * 06:00 - 07:00
 * 08:00 - 09:00
 * 10:00 - 11:00
 *
 * This does NOT modify the recurring weekly schedule.
 */

const branchDateScheduleSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    /**
     * Calendar date stored as YYYY-MM-DD.
     *
     * String is intentional here so that timezone
     * conversion cannot move the date backward/forward.
     */
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    /**
     * If true, this particular date is completely closed.
     */
    isClosed: {
      type: Boolean,
      default: false,
    },

    /**
     * Date-specific training sessions.
     */
    slots: {
      type: [dateTimeSlotSchema],
      default: [],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================================================
   INDEX
========================================================= */

/**
 * Only one override is allowed for a branch/date.
 */
branchDateScheduleSchema.index(
  {
    branch: 1,
    date: 1,
  },
  {
    unique: true,
  },
);
branchDateScheduleSchema.index({ "slots.sessionTypeId": 1 });

module.exports = mongoose.model("BranchDateSchedule", branchDateScheduleSchema);
