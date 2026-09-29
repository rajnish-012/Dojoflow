const mongoose = require("mongoose");

// =========================================================
// TIME SLOT
// =========================================================

const timeSlotSchema = new mongoose.Schema(
  {
    /**
     * Name shown to the admin and used to identify
     * the training/session.
     *
     * Examples:
     * - Kids Beginners
     * - Kids Advanced
     * - Adults Karate
     * - Morning Batch
     * - Evening Batch
     */
    sessionName: {
      type: String,
      trim: true,
      default: "Training Session",
    },

    /**
     * Session start time in 24-hour HH:mm format.
     *
     * Examples:
     * 06:00
     * 17:30
     */
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    /**
     * Session end time in 24-hour HH:mm format.
     *
     * Examples:
     * 07:00
     * 18:30
     */
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    /**
     * Allows an individual training session to be
     * temporarily disabled without deleting it.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  },
);

// =========================================================
// DAY SCHEDULE
// =========================================================

const dayScheduleSchema = new mongoose.Schema(
  {
    /**
     * JavaScript day numbering:
     *
     * 0 = Sunday
     * 1 = Monday
     * 2 = Tuesday
     * 3 = Wednesday
     * 4 = Thursday
     * 5 = Friday
     * 6 = Saturday
     */
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },

    /**
     * If true, the branch has no regular training
     * on this day.
     *
     * This is different from the Holiday system:
     *
     * Holiday:
     *     Specific calendar date.
     *
     * isClosed:
     *     Recurring weekly closure.
     */
    isClosed: {
      type: Boolean,
      default: false,
    },

    /**
     * Training sessions available on this day.
     *
     * Example:
     *
     * Monday
     *   - Kids Beginners     06:00 - 07:00
     *   - Kids Advanced       07:00 - 08:00
     *   - Adults Karate       18:00 - 19:00
     */
    slots: {
      type: [timeSlotSchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

// =========================================================
// BRANCH SCHEDULE
// =========================================================

const branchScheduleSchema = new mongoose.Schema(
  {
    /**
     * One schedule belongs to exactly one branch.
     *
     * There can only be one BranchSchedule document
     * for each branch.
     */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      unique: true,
    },

    /**
     * Overall academy operating window.
     *
     * These represent the branch's general opening
     * and closing hours, not individual training sessions.
     *
     * Example:
     * openingTime = 06:00
     * closingTime = 21:00
     */
    openingTime: {
      type: String,
      required: true,
      default: "06:00",
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    closingTime: {
      type: String,
      required: true,
      default: "21:00",
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    /**
     * Complete Sunday-Saturday recurring schedule.
     *
     * Each day can:
     *
     * - Be open with one or more training slots
     * - Be closed
     * - Have individual sessions enabled/disabled
     */
    weeklySchedule: {
      type: [dayScheduleSchema],
      required: true,
      default: [],
    },

    /**
     * User who last modified the schedule.
     */
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

// =========================================================
// INDEX
// =========================================================

/**
 * One schedule document per branch.
 *
 * IMPORTANT:
 * The branch field already has `unique: true`, so we do NOT
 * create another branch index here.
 *
 * This avoids the duplicate schema index warning:
 *
 * Duplicate schema index on {"branch":1}
 */

// =========================================================
// EXPORT
// =========================================================

module.exports = mongoose.model("BranchSchedule", branchScheduleSchema);
