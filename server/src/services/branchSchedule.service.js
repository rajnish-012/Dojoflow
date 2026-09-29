const mongoose = require("mongoose");

const BranchSchedule = require("../models/BranchSchedule");
const Holiday = require("../models/Holiday");
const BranchDateSchedule = require("../models/BranchDateSchedule");

/* =========================================================
   DATE HELPERS
========================================================= */

/**
 * Convert YYYY-MM-DD into a local calendar date.
 *
 * IMPORTANT:
 * Do not use:
 *
 * new Date("2026-09-28")
 *
 * because JavaScript treats that format as UTC.
 *
 * This application uses local academy calendar dates.
 */
const parseCalendarDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const year = Number(match[1]);

      const month = Number(match[2]);

      const day = Number(match[3]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }

      return null;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getDateRange = (value) => {
  const start = parseCalendarDate(value);

  if (!start) {
    return {
      start: null,
      end: null,
    };
  }

  const end = new Date(start);

  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
};

const formatDate = (value) => {
  const date = parseCalendarDate(value);

  if (!date) {
    return null;
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const validateDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return Boolean(parseCalendarDate(value));
};

/* =========================================================
   DAY HELPERS
========================================================= */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const getDayOfWeek = (value) => {
  const date = parseCalendarDate(value);

  if (!date) {
    return null;
  }

  return date.getDay();
};

const getDayName = (dayOfWeek) => {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return null;
  }

  return DAY_NAMES[dayOfWeek];
};

/* =========================================================
   BRANCH VALIDATION
========================================================= */

const validateBranchId = (branchId) => {
  if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
    return false;
  }

  return true;
};

/* =========================================================
   HOLIDAY
========================================================= */

/**
 * Find a holiday affecting a particular branch/date.
 *
 * A holiday can be:
 *
 * 1. Global:
 *    branch = null
 *
 * 2. Branch-specific:
 *    branch = selected branch
 *
 * Priority:
 *
 * Branch-specific holiday
 *        ↓
 * Global holiday
 *
 * Branch-specific holidays must be checked
 * separately from global holidays because a
 * single $or query does not guarantee which
 * matching document MongoDB will return first.
 */
const getHolidayForBranchDate = async (branchId, date) => {
  if (!validateBranchId(branchId)) {
    return null;
  }

  const { start, end } = getDateRange(date);

  if (!start || !end) {
    return null;
  }

  /*
   * =====================================================
   * 1. BRANCH-SPECIFIC HOLIDAY
   * =====================================================
   *
   * This always wins over a global holiday
   * for the same date.
   */
  const branchHoliday = await Holiday.findOne({
    date: {
      $gte: start,
      $lte: end,
    },

    branch: branchId,

    isActive: true,
  })
    .populate("branch", "name address")
    .lean();

  if (branchHoliday) {
    return branchHoliday;
  }

  /*
   * =====================================================
   * 2. GLOBAL HOLIDAY
   * =====================================================
   *
   * branch: null applies to every branch.
   */
  const globalHoliday = await Holiday.findOne({
    date: {
      $gte: start,
      $lte: end,
    },

    branch: null,

    isActive: true,
  })
    .populate("branch", "name address")
    .lean();

  return globalHoliday || null;
};

/* =========================================================
   BRANCH SCHEDULE
========================================================= */

/**
 * Get the recurring weekly schedule for a branch.
 */
const getBranchSchedule = async (branchId) => {
  if (!validateBranchId(branchId)) {
    return null;
  }

  const schedule = await BranchSchedule.findOne({
    branch: branchId,
  }).lean();

  return schedule || null;
};

/**
 * Find one day inside weeklySchedule.
 */
const getDaySchedule = (schedule, dayOfWeek) => {
  if (!schedule || !Array.isArray(schedule.weeklySchedule)) {
    return null;
  }

  return (
    schedule.weeklySchedule.find(
      (day) => Number(day.dayOfWeek) === Number(dayOfWeek),
    ) || null
  );
};

/* =========================================================
   DATE AVAILABILITY
========================================================= */

/**
 * Main scheduling function.
 *
 * Resolution order:
 *
 * actual calendar date
 *       ↓
 * holiday
 *       ↓
 * date-specific override
 *       ↓
 * weekly branch schedule
 *
 * Holiday always wins.
 */
const getBranchDateAvailability = async (branchId, date) => {
  if (!validateBranchId(branchId)) {
    throw new Error("Invalid branch ID");
  }

  if (!validateDate(date)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  const normalizedDate = parseCalendarDate(date);

  const dayOfWeek = normalizedDate.getDay();

  const dayName = getDayName(dayOfWeek);

  const schedule = await getBranchSchedule(branchId);

  /*
   * =====================================================
   * HOLIDAY
   * =====================================================
   *
   * Holiday is resolved before date override
   * and before weekly schedule.
   */
  const holiday = await getHolidayForBranchDate(branchId, normalizedDate);

  if (holiday) {
    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: true,

      holiday: {
        _id: holiday._id,

        name: holiday.name,

        description: holiday.description || "",

        branch: holiday.branch || null,
      },

      scheduleConfigured: Boolean(schedule),

      isDateOverride: false,

      dateOverrideId: null,

      isClosed: true,

      isTrainingDay: false,

      slots: [],

      openingTime: schedule?.openingTime || null,

      closingTime: schedule?.closingTime || null,

      reason: "HOLIDAY",
    };
  }

  /*
   * =====================================================
   * DATE-SPECIFIC OVERRIDE
   * =====================================================
   */

  const dateOverride = await BranchDateSchedule.findOne({
    branch: branchId,

    date: formatDate(normalizedDate),
  }).lean();

  if (dateOverride) {
    const overrideSlots = Array.isArray(dateOverride.slots)
      ? dateOverride.slots
          .filter(
            (slot) =>
              slot && slot.isActive !== false && slot.startTime && slot.endTime,
          )
          .sort((a, b) =>
            String(a.startTime).localeCompare(String(b.startTime)),
          )
      : [];

    /*
     * Explicit date closure.
     */

    if (dateOverride.isClosed) {
      return {
        date: formatDate(normalizedDate),

        dayOfWeek,

        dayName,

        isHoliday: false,

        holiday: null,

        scheduleConfigured: Boolean(schedule),

        isDateOverride: true,

        dateOverrideId: dateOverride._id,

        isClosed: true,

        isTrainingDay: false,

        slots: [],

        openingTime: schedule?.openingTime || null,

        closingTime: schedule?.closingTime || null,

        reason: "DATE_OVERRIDE_CLOSED",
      };
    }

    /*
     * Date override exists but contains
     * no active sessions.
     */

    if (overrideSlots.length === 0) {
      return {
        date: formatDate(normalizedDate),

        dayOfWeek,

        dayName,

        isHoliday: false,

        holiday: null,

        scheduleConfigured: Boolean(schedule),

        isDateOverride: true,

        dateOverrideId: dateOverride._id,

        isClosed: false,

        isTrainingDay: false,

        slots: [],

        openingTime: schedule?.openingTime || null,

        closingTime: schedule?.closingTime || null,

        reason: "DATE_OVERRIDE_NO_ACTIVE_SLOTS",
      };
    }

    /*
     * Date-specific training is available.
     */

    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: false,

      holiday: null,

      scheduleConfigured: Boolean(schedule),

      isDateOverride: true,

      dateOverrideId: dateOverride._id,

      isClosed: false,

      isTrainingDay: true,

      slots: overrideSlots,

      openingTime: schedule?.openingTime || null,

      closingTime: schedule?.closingTime || null,

      reason: "DATE_OVERRIDE_TRAINING",
    };
  }

  /*
   * =====================================================
   * NO WEEKLY SCHEDULE
   * =====================================================
   */

  if (!schedule) {
    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: false,

      holiday: null,

      scheduleConfigured: false,

      isDateOverride: false,

      dateOverrideId: null,

      isClosed: false,

      isTrainingDay: true,

      slots: [],

      openingTime: null,

      closingTime: null,

      reason: "NO_SCHEDULE_CONFIGURED",
    };
  }

  /*
   * =====================================================
   * WEEKLY DAY
   * =====================================================
   */

  const daySchedule = getDaySchedule(schedule, dayOfWeek);

  if (!daySchedule) {
    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: false,

      holiday: null,

      scheduleConfigured: true,

      isDateOverride: false,

      dateOverrideId: null,

      isClosed: true,

      isTrainingDay: false,

      slots: [],

      openingTime: schedule.openingTime,

      closingTime: schedule.closingTime,

      reason: "NO_DAY_SCHEDULE",
    };
  }

  /*
   * =====================================================
   * WEEKLY CLOSED
   * =====================================================
   */

  if (daySchedule.isClosed) {
    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: false,

      holiday: null,

      scheduleConfigured: true,

      isDateOverride: false,

      dateOverrideId: null,

      isClosed: true,

      isTrainingDay: false,

      slots: [],

      openingTime: schedule.openingTime,

      closingTime: schedule.closingTime,

      reason: "BRANCH_CLOSED",
    };
  }

  /*
   * =====================================================
   * WEEKLY ACTIVE SLOTS
   * =====================================================
   */

  const slots = Array.isArray(daySchedule.slots)
    ? daySchedule.slots
        .filter(
          (slot) =>
            slot && slot.isActive !== false && slot.startTime && slot.endTime,
        )
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
    : [];

  /*
   * Day exists but no active sessions.
   */

  if (slots.length === 0) {
    return {
      date: formatDate(normalizedDate),

      dayOfWeek,

      dayName,

      isHoliday: false,

      holiday: null,

      scheduleConfigured: true,

      isDateOverride: false,

      dateOverrideId: null,

      isClosed: false,

      isTrainingDay: false,

      slots: [],

      openingTime: schedule.openingTime,

      closingTime: schedule.closingTime,

      reason: "NO_ACTIVE_SLOTS",
    };
  }

  /*
   * =====================================================
   * WEEKLY TRAINING AVAILABLE
   * =====================================================
   */

  return {
    date: formatDate(normalizedDate),

    dayOfWeek,

    dayName,

    isHoliday: false,

    holiday: null,

    scheduleConfigured: true,

    isDateOverride: false,

    dateOverrideId: null,

    isClosed: false,

    isTrainingDay: true,

    slots,

    openingTime: schedule.openingTime,

    closingTime: schedule.closingTime,

    reason: "TRAINING_AVAILABLE",
  };
};

/* =========================================================
   ATTENDANCE VALIDATION
========================================================= */

/**
 * Validate whether normal attendance can be marked
 * on a particular branch/date.
 *
 * IMPORTANT:
 *
 * If a branch has NO schedule configured yet,
 * we allow the operation for backward compatibility.
 *
 * Once a schedule exists, the weekly schedule becomes
 * authoritative.
 */
const validateAttendanceDate = async (branchId, date) => {
  const availability = await getBranchDateAvailability(branchId, date);

  /*
   * Existing branches that have not yet been
   * configured should continue working.
   */
  if (!availability.scheduleConfigured) {
    return {
      allowed: true,

      availability,
    };
  }

  if (availability.isHoliday) {
    return {
      allowed: false,

      availability,

      message: availability.holiday?.name
        ? `${availability.holiday.name} is a holiday for this branch. Attendance cannot be marked.`
        : "This date is a holiday for this branch. Attendance cannot be marked.",
    };
  }

  if (availability.isClosed) {
    return {
      allowed: false,

      availability,

      message:
        availability.reason === "NO_ACTIVE_SLOTS"
          ? `${availability.dayName} has no active training sessions configured for this branch.`
          : `${availability.dayName} is marked as closed for this branch.`,
    };
  }

  if (!availability.isTrainingDay) {
    return {
      allowed: false,

      availability,

      message: "No training is scheduled for this branch on the selected date.",
    };
  }

  return {
    allowed: true,

    availability,
  };
};

/* =========================================================
   MAKEUP VALIDATION
========================================================= */

/**
 * Validate whether a date can be used as a makeup date.
 *
 * Makeup date must:
 *
 * - not be before original date
 * - not be a holiday
 * - not be a closed branch day
 * - have at least one active training slot
 */
const validateMakeupDate = async (
  branchId,
  makeupDate,
  originalDate,
  { allowPast = false } = {},
) => {
  if (!validateDate(String(makeupDate))) {
    return {
      allowed: false,

      message: "makeupDate must be in YYYY-MM-DD format",

      availability: null,
    };
  }

  const selectedDate = parseCalendarDate(makeupDate);

  const original = parseCalendarDate(originalDate);

  if (!selectedDate) {
    return {
      allowed: false,

      message: "Invalid makeup date",

      availability: null,
    };
  }

  if (!original) {
    return {
      allowed: false,

      message: "Invalid original attendance date",

      availability: null,
    };
  }

  if (selectedDate.getTime() < original.getTime()) {
    return {
      allowed: false,

      message: "Makeup date cannot be before the original missed date.",

      availability: null,
    };
  }

  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate.getTime() < today.getTime()) {
      return {
        allowed: false,
        message: "Makeup date cannot be in the past.",
        availability: null,
      };
    }
  }

  const availability = await getBranchDateAvailability(branchId, makeupDate);

  if (availability.isHoliday) {
    return {
      allowed: false,

      availability,

      message: availability.holiday?.name
        ? `${availability.holiday.name} is a holiday. A makeup class cannot be scheduled on a holiday.`
        : "A makeup class cannot be scheduled on a holiday.",
    };
  }

  if (availability.isClosed) {
    return {
      allowed: false,

      availability,

      message:
        availability.reason === "NO_ACTIVE_SLOTS"
          ? `${availability.dayName} has no active training sessions. A makeup class cannot be scheduled on this date.`
          : `${availability.dayName} is closed for this branch. A makeup class cannot be scheduled on this date.`,
    };
  }

  const hasActiveSlot = Array.isArray(availability.slots)
    ? availability.slots.some((slot) => slot && slot.isActive !== false)
    : false;

  if (!hasActiveSlot) {
    return {
      allowed: false,
      availability,
      message: `${availability.dayName} has no active training sessions. A makeup class cannot be scheduled on this date.`,
    };
  }

  if (!availability.isTrainingDay) {
    return {
      allowed: false,

      availability,

      message: "No training session is available for the selected makeup date.",
    };
  }

  return {
    allowed: true,

    availability,
  };
};

/* =========================================================
   CALENDAR MONTH
========================================================= */

/**
 * Build the availability calendar for an entire month.
 *
 * This is useful later for:
 *
 * - Attendance calendar
 * - Makeup date picker
 * - Public branch page
 * - Reports
 *
 * Each actual date is resolved through the same
 * weekly schedule + holiday system.
 */
const getBranchMonthAvailability = async (branchId, year, month) => {
  const numericYear = Number(year);

  const numericMonth = Number(month);

  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericMonth) ||
    numericYear < 2000 ||
    numericYear > 2100 ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    throw new Error("Year and month are invalid");
  }

  const daysInMonth = new Date(numericYear, numericMonth, 0).getDate();

  const results = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(numericYear, numericMonth - 1, day);

    const dateString = formatDate(date);

    const availability = await getBranchDateAvailability(branchId, dateString);

    results.push(availability);
  }

  return results;
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  DAY_NAMES,

  parseCalendarDate,

  getDateRange,

  formatDate,

  validateDate,

  getDayOfWeek,

  getDayName,

  getHolidayForBranchDate,

  getBranchSchedule,

  getDaySchedule,

  getBranchDateAvailability,

  validateAttendanceDate,

  validateMakeupDate,

  getBranchMonthAvailability,
};
