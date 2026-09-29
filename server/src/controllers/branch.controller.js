const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const BranchSchedule = require("../models/BranchSchedule");
const Holiday = require("../models/Holiday");

/* =========================================================
   CONSTANTS
========================================================= */

const WRITE_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN"];

const READ_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* =========================================================
   BASIC HELPERS
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function userHasGlobalAccess(req) {
  return String(req.user?.role || "") === "SUPER_ADMIN";
}

function getUserRole(req) {
  return String(req.user?.role || "");
}

function getUserBranchId(req) {
  if (!req.user?.branch) {
    return null;
  }

  return req.user.branch.toString();
}

/* =========================================================
   ACCESS CONTROL
========================================================= */

function userCanReadBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  const role = getUserRole(req);

  if (!READ_ROLES.includes(role)) {
    return false;
  }

  /*
   * SUPER_ADMIN can read every branch.
   */
  if (role === "SUPER_ADMIN") {
    return true;
  }

  /*
   * Every other role must have
   * an assigned branch.
   */
  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  return userBranch === branchId.toString();
}

function userCanWriteBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  const role = getUserRole(req);

  if (!WRITE_ROLES.includes(role)) {
    return false;
  }

  /*
   * SUPER_ADMIN has global access.
   */
  if (role === "SUPER_ADMIN") {
    return true;
  }

  /*
   * BRANCH_ADMIN must have
   * a branch assigned.
   */
  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  return userBranch === branchId.toString();
}

/* =========================================================
   DATE HELPERS
========================================================= */

/**
 * Date is intentionally kept as YYYY-MM-DD.
 *
 * Never use:
 *
 * new Date("2026-09-25")
 *
 * for calendar comparison because that
 * can introduce UTC timezone shifts.
 */

function isValidCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function compareCalendarDates(first, second) {
  return first.localeCompare(second);
}

function getTodayString() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isPastDate(date) {
  return compareCalendarDates(date, getTodayString()) < 0;
}

/* =========================================================
   TIME HELPERS
========================================================= */

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(String(value || ""))) {
    return null;
  }

  const [hours, minutes] = String(value).split(":").map(Number);

  return hours * 60 + minutes;
}

/* =========================================================
   SLOT NORMALIZATION
========================================================= */

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) {
    return [];
  }

  return slots
    .map((slot) => ({
      _id: slot?._id,

      sessionName: String(slot?.sessionName || "Training Session").trim(),

      startTime: String(slot?.startTime || "").trim(),

      endTime: String(slot?.endTime || "").trim(),

      isActive: slot?.isActive !== false,
    }))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/* =========================================================
   HOLIDAY LOOKUP
========================================================= */

/**
 * Branch-specific holiday has priority
 * over a global holiday.
 *
 * Priority:
 *
 * branch holiday
 *      ↓
 * global holiday
 */

async function getHolidayForDate(branchId, date) {
  const holidays = await Holiday.find({
    date: {
      $gte: date,
      $lte: date,
    },
    isActive: true,
    $or: [
      {
        branch: branchId,
      },
      {
        branch: null,
      },
    ],
  })
    .populate("branch", "name address phone isActive")
    .lean();

  const branchHoliday = holidays.find(
    (holiday) =>
      holiday.branch &&
      holiday.branch._id &&
      holiday.branch._id.toString() === branchId.toString(),
  );

  if (branchHoliday) {
    return branchHoliday;
  }

  return holidays.find((holiday) => !holiday.branch) || null;
}

/* =========================================================
   VALIDATE PAYLOAD
========================================================= */

async function validateDateSchedulePayload(branchId, date, body) {
  if (!isValidCalendarDate(date)) {
    return {
      valid: false,
      message: "Date must be a valid YYYY-MM-DD calendar date.",
    };
  }

  /*
   * Date overrides are intended for
   * current/future operational scheduling.
   */
  if (isPastDate(date)) {
    return {
      valid: false,
      message:
        "A date-specific schedule can only be created for today or a future date.",
    };
  }

  /*
   * A holiday must remain authoritative.
   */
  const holiday = await getHolidayForDate(branchId, date);

  if (holiday) {
    return {
      valid: false,
      holiday,
      message: `This date is already marked as a holiday${
        holiday.name ? `: ${holiday.name}` : ""
      }. A date-specific training override cannot be created on a holiday.`,
    };
  }

  /*
   * Get weekly branch schedule.
   *
   * This is used only to validate that
   * special slots do not exceed the
   * branch operating hours.
   */
  const branchSchedule = await BranchSchedule.findOne({
    branch: branchId,
  }).lean();

  const openingTime = branchSchedule?.openingTime || "06:00";

  const closingTime = branchSchedule?.closingTime || "21:00";

  const openingMinutes = timeToMinutes(openingTime);

  const closingMinutes = timeToMinutes(closingTime);

  const isClosed = body?.isClosed === true;

  /*
   * Closed date means no slots.
   */
  if (isClosed) {
    return {
      valid: true,
      isClosed: true,
      slots: [],
      holiday: null,
    };
  }

  const slots = normalizeSlots(body?.slots);

  /*
   * An open override without slots
   * is valid.
   *
   * This allows the central service to
   * fall back to the branch's weekly
   * session structure where appropriate.
   */
  if (slots.length === 0) {
    return {
      valid: true,
      isClosed: false,
      slots: [],
      holiday: null,
    };
  }

  /*
   * Validate every slot.
   */
  for (const slot of slots) {
    if (!slot.sessionName) {
      return {
        valid: false,
        message: "Training session name is required.",
      };
    }

    if (!TIME_PATTERN.test(slot.startTime)) {
      return {
        valid: false,
        message: `"${slot.sessionName}" has an invalid start time. Use HH:mm format.`,
      };
    }

    if (!TIME_PATTERN.test(slot.endTime)) {
      return {
        valid: false,
        message: `"${slot.sessionName}" has an invalid end time. Use HH:mm format.`,
      };
    }

    const startMinutes = timeToMinutes(slot.startTime);

    const endMinutes = timeToMinutes(slot.endTime);

    if (startMinutes === null || endMinutes === null) {
      return {
        valid: false,
        message: `"${slot.sessionName}" contains an invalid time.`,
      };
    }

    if (startMinutes >= endMinutes) {
      return {
        valid: false,
        message: `"${slot.sessionName}" must end after it starts.`,
      };
    }

    if (openingMinutes !== null && startMinutes < openingMinutes) {
      return {
        valid: false,
        message: `"${slot.sessionName}" starts before branch opening time (${openingTime}).`,
      };
    }

    if (closingMinutes !== null && endMinutes > closingMinutes) {
      return {
        valid: false,
        message: `"${slot.sessionName}" ends after branch closing time (${closingTime}).`,
      };
    }
  }

  /*
   * Validate overlapping slots.
   */
  for (let index = 1; index < slots.length; index += 1) {
    const previous = slots[index - 1];

    const current = slots[index];

    const previousEnd = timeToMinutes(previous.endTime);

    const currentStart = timeToMinutes(current.startTime);

    if (
      previousEnd !== null &&
      currentStart !== null &&
      currentStart < previousEnd
    ) {
      return {
        valid: false,
        message: `Overlapping training sessions: "${previous.sessionName}" and "${current.sessionName}".`,
      };
    }
  }

  return {
    valid: true,
    isClosed: false,
    slots,
    holiday: null,
  };
}

/* =========================================================
   SERIALIZE
========================================================= */

function serializeDateSchedule(schedule) {
  if (!schedule) {
    return null;
  }

  return {
    _id: schedule._id,

    branch: schedule.branch,

    date: schedule.date,

    isClosed: Boolean(schedule.isClosed),

    slots: Array.isArray(schedule.slots) ? schedule.slots : [],

    updatedBy: schedule.updatedBy || null,

    createdAt: schedule.createdAt || null,

    updatedAt: schedule.updatedAt || null,
  };
}

/* =========================================================
   GET DATE OVERRIDE
========================================================= */

/*
 * GET
 * /api/branch-schedules/:branchId/date/:date
 */

const getBranchDateSchedule = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (!isValidCalendarDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be a valid YYYY-MM-DD date.",
      });
    }

    if (!userCanReadBranch(req, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this branch schedule.",
      });
    }

    const branch = await Branch.findById(branchId)
      .select("_id name address phone isActive")
      .lean();

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    const [schedule, holiday] = await Promise.all([
      BranchDateSchedule.findOne({
        branch: branchId,
        date,
      })
        .populate("updatedBy", "name email role")
        .lean(),

      getHolidayForDate(branchId, date),
    ]);

    return res.status(200).json({
      success: true,

      branch,

      date,

      hasOverride: Boolean(schedule),

      isHoliday: Boolean(holiday),

      holiday: holiday || null,

      schedule: serializeDateSchedule(schedule),
    });
  } catch (error) {
    console.error("Get branch date schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch date-specific training schedule.",
    });
  }
};

/* =========================================================
   SAVE DATE OVERRIDE
========================================================= */

/*
 * PUT
 * /api/branch-schedules/:branchId/date/:date
 */

const upsertBranchDateSchedule = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (!isValidCalendarDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be a valid YYYY-MM-DD date.",
      });
    }

    if (!userCanWriteBranch(req, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage this branch schedule.",
      });
    }

    const branch = await Branch.findById(branchId)
      .select("_id name address phone isActive")
      .lean();

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    if (branch.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify the schedule of an inactive branch.",
      });
    }

    const validation = await validateDateSchedulePayload(
      branchId,
      date,
      req.body,
    );

    if (!validation.valid) {
      return res.status(409).json({
        success: false,
        message: validation.message,

        holiday: validation.holiday || null,
      });
    }

    /*
     * Atomic upsert.
     *
     * The model has a unique index on:
     *
     * branch + date
     *
     * so only one override can exist
     * for a branch/date.
     */
    const schedule = await BranchDateSchedule.findOneAndUpdate(
      {
        branch: branchId,

        date,
      },
      {
        $set: {
          isClosed: validation.isClosed,

          slots: validation.slots,

          updatedBy: req.user._id,
        },

        $setOnInsert: {
          branch: branchId,

          date,
        },
      },
      {
        new: true,

        upsert: true,

        runValidators: true,

        setDefaultsOnInsert: true,
      },
    ).populate("updatedBy", "name email role");

    return res.status(200).json({
      success: true,

      message: "Date-specific training schedule saved successfully.",

      schedule: serializeDateSchedule(schedule.toObject()),
    });
  } catch (error) {
    console.error("Save branch date schedule error:", error);

    /*
     * Mongo duplicate-key protection.
     *
     * This can happen if two Admin requests
     * arrive simultaneously.
     */
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A date-specific schedule already exists for this branch and date. Refresh the page and try again.",
      });
    }

    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors || {})
        .map((item) => item.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message: message || "Invalid date schedule.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save date-specific training schedule.",
    });
  }
};

/* =========================================================
   DELETE DATE OVERRIDE
========================================================= */

/*
 * DELETE
 * /api/branch-schedules/:branchId/date/:date
 */

const deleteBranchDateSchedule = async (req, res) => {
  try {
    const { branchId, date } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (!isValidCalendarDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be a valid YYYY-MM-DD date.",
      });
    }

    if (!userCanWriteBranch(req, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage this branch schedule.",
      });
    }

    const branch = await Branch.findById(branchId)
      .select("_id name isActive")
      .lean();

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    const deleted = await BranchDateSchedule.findOneAndDelete({
      branch: branchId,

      date,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "No date-specific schedule exists for this date.",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Date-specific schedule removed. The weekly schedule will be used again.",

      deletedDate: date,

      branch: branchId,
    });
  } catch (error) {
    console.error("Delete branch date schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove date-specific training schedule.",
    });
  }
};

module.exports = {
  getBranchDateSchedule,
  upsertBranchDateSchedule,
  deleteBranchDateSchedule,
};
