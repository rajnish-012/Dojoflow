const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchSchedule = require("../models/BranchSchedule");

const {
  getBranchMonthAvailability,
} = require("../services/branchSchedule.service");

/* =========================================================
   CONSTANTS
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

const READ_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"];

const WRITE_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN"];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* =========================================================
   HELPERS
   ========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(String(value || ""))) {
    return null;
  }

  const [hours, minutes] = String(value).split(":").map(Number);

  return hours * 60 + minutes;
}

function formatTimeForDisplay(value) {
  if (!TIME_PATTERN.test(String(value || ""))) {
    return value || "";
  }

  const [hours, minutes] = String(value).split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${String(displayHours).padStart(
    2,
    "0",
  )}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getDefaultWeeklySchedule() {
  return DAY_NAMES.map((_, index) => ({
    dayOfWeek: index,
    isClosed: index === 0,
    slots: [],
  }));
}

function normalizeWeeklySchedule(weeklySchedule) {
  const source = Array.isArray(weeklySchedule) ? weeklySchedule : [];

  const byDay = new Map();

  source.forEach((day) => {
    const dayOfWeek = Number(day?.dayOfWeek);

    if (Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
      byDay.set(dayOfWeek, day);
    }
  });

  return DAY_NAMES.map((_, index) => {
    const existing = byDay.get(index);

    if (!existing) {
      return {
        dayOfWeek: index,
        isClosed: index === 0,
        slots: [],
      };
    }

    return {
      dayOfWeek: index,
      isClosed: Boolean(existing.isClosed),
      slots: Array.isArray(existing.slots) ? existing.slots : [],
    };
  });
}

/* =========================================================
   SCHEDULE VALIDATION
   ========================================================= */

function validateSchedulePayload(body) {
  const openingTime = String(body?.openingTime || "").trim();

  const closingTime = String(body?.closingTime || "").trim();

  if (!TIME_PATTERN.test(openingTime)) {
    return {
      valid: false,
      message: "Opening time must be in HH:mm format.",
    };
  }

  if (!TIME_PATTERN.test(closingTime)) {
    return {
      valid: false,
      message: "Closing time must be in HH:mm format.",
    };
  }

  const openingMinutes = timeToMinutes(openingTime);

  const closingMinutes = timeToMinutes(closingTime);

  if (openingMinutes === null || closingMinutes === null) {
    return {
      valid: false,
      message: "Invalid operating time.",
    };
  }

  if (openingMinutes >= closingMinutes) {
    return {
      valid: false,
      message: "Opening time must be earlier than closing time.",
    };
  }

  const weeklySchedule = normalizeWeeklySchedule(body?.weeklySchedule);

  for (const day of weeklySchedule) {
    if (day.isClosed) {
      /*
       * A closed recurring day should not contain
       * active training sessions.
       *
       * Inactive sessions are retained so an admin
       * can enable them later.
       */
      continue;
    }

    const slots = Array.isArray(day.slots) ? day.slots : [];

    const normalizedSlots = [];

    for (const slot of slots) {
      const sessionName = String(
        slot?.sessionName || "Training Session",
      ).trim();

      const startTime = String(slot?.startTime || "").trim();

      const endTime = String(slot?.endTime || "").trim();

      if (!TIME_PATTERN.test(startTime)) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]} has an invalid start time.`,
        };
      }

      if (!TIME_PATTERN.test(endTime)) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]} has an invalid end time.`,
        };
      }

      if (!sessionName) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]} has a training session without a name.`,
        };
      }

      const startMinutes = timeToMinutes(startTime);

      const endMinutes = timeToMinutes(endTime);

      if (startMinutes === null || endMinutes === null) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]} contains an invalid time.`,
        };
      }

      if (startMinutes >= endMinutes) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]}: ${sessionName} must end after it starts.`,
        };
      }

      if (startMinutes < openingMinutes) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]}: ${sessionName} starts before the branch opening time.`,
        };
      }

      if (endMinutes > closingMinutes) {
        return {
          valid: false,
          message: `${DAY_NAMES[day.dayOfWeek]}: ${sessionName} ends after the branch closing time.`,
        };
      }

      normalizedSlots.push({
        _id: slot?._id,
        sessionName,
        startTime,
        endTime,
        isActive: slot?.isActive !== false,
      });
    }

    /*
     * Sort before checking overlaps.
     */
    normalizedSlots.sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (let index = 1; index < normalizedSlots.length; index += 1) {
      const previous = normalizedSlots[index - 1];

      const current = normalizedSlots[index];

      const previousEnd = timeToMinutes(previous.endTime);

      const currentStart = timeToMinutes(current.startTime);

      if (
        previousEnd !== null &&
        currentStart !== null &&
        currentStart < previousEnd
      ) {
        return {
          valid: false,
          message:
            `${DAY_NAMES[day.dayOfWeek]} has overlapping sessions: ` +
            `"${previous.sessionName}" and "${current.sessionName}".`,
        };
      }
    }
  }

  return {
    valid: true,
    openingTime,
    closingTime,
    weeklySchedule,
  };
}

/* =========================================================
   AUTHORIZATION HELPERS
   ========================================================= */

function userHasGlobalAccess(req) {
  return req.user?.role === "SUPER_ADMIN";
}

function userCanReadBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (userHasGlobalAccess(req)) {
    return true;
  }

  if (!READ_ROLES.includes(String(req.user.role || ""))) {
    return false;
  }

  if (!req.user.branch) {
    return false;
  }

  return req.user.branch.toString() === branchId.toString();
}

function userCanWriteBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (userHasGlobalAccess(req)) {
    return true;
  }

  if (!WRITE_ROLES.includes(String(req.user.role || ""))) {
    return false;
  }

  if (!req.user.branch) {
    return false;
  }

  return req.user.branch.toString() === branchId.toString();
}

/* =========================================================
   SERIALIZATION
   ========================================================= */

function serializeSchedule(schedule) {
  if (!schedule) {
    return null;
  }

  return {
    _id: schedule._id,
    branch: schedule.branch,
    openingTime: schedule.openingTime,
    closingTime: schedule.closingTime,
    weeklySchedule: normalizeWeeklySchedule(schedule.weeklySchedule),
    updatedBy: schedule.updatedBy,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

/* =========================================================
   PUBLIC BRANCH SCHEDULES
   ========================================================= */

/**
 * GET /api/branch-schedules/public
 *
 * Public endpoint used by the academy website.
 *
 * Returns only active branches and their public-safe
 * training schedule information.
 *
 * No authentication required.
 */
const getPublicBranchSchedules = async (req, res) => {
  try {
    const branches = await Branch.find({
      isActive: true,
    })
      .select("_id name address phone isActive")
      .sort({
        name: 1,
      })
      .lean();

    if (branches.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        branches: [],
      });
    }

    const branchIds = branches.map((branch) => branch._id);

    const schedules = await BranchSchedule.find({
      branch: {
        $in: branchIds,
      },
    })
      .select("_id branch openingTime closingTime weeklySchedule")
      .lean();

    const scheduleMap = new Map(
      schedules.map((schedule) => [schedule.branch.toString(), schedule]),
    );

    const result = branches.map((branch) => {
      const schedule = scheduleMap.get(branch._id.toString());

      return {
        branch: {
          _id: branch._id,
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          isActive: branch.isActive,
        },

        schedule: schedule
          ? {
              _id: schedule._id,
              openingTime: schedule.openingTime,
              closingTime: schedule.closingTime,
              weeklySchedule: normalizeWeeklySchedule(schedule.weeklySchedule),
            }
          : null,

        hasSchedule: Boolean(schedule),
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      branches: result,
    });
  } catch (error) {
    console.error("Get public branch schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public branch schedules.",
    });
  }
};

/**
 * GET /api/branch-schedules/public/:branchId/calendar
 *
 * Public monthly availability.
 *
 * Query:
 *
 * ?year=2026&month=9
 *
 * Uses the SAME scheduling engine as the admin calendar.
 */
const getPublicBranchMonthCalendar = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    const branch = await Branch.findOne({
      _id: branchId,
      isActive: true,
    })
      .select("_id name address phone isActive")
      .lean();

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Active branch not found.",
      });
    }

    const currentDate = new Date();

    const requestedYear =
      req.query.year !== undefined
        ? Number(req.query.year)
        : currentDate.getFullYear();

    const requestedMonth =
      req.query.month !== undefined
        ? Number(req.query.month)
        : currentDate.getMonth() + 1;

    if (
      !Number.isInteger(requestedYear) ||
      requestedYear < 2000 ||
      requestedYear > 2100
    ) {
      return res.status(400).json({
        success: false,
        message: "Year must be a valid integer between 2000 and 2100.",
      });
    }

    if (
      !Number.isInteger(requestedMonth) ||
      requestedMonth < 1 ||
      requestedMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Month must be an integer between 1 and 12.",
      });
    }

    const days = await getBranchMonthAvailability(
      branchId,
      requestedYear,
      requestedMonth,
    );

    const summary = {
      totalDays: days.length,

      availableDays: days.filter(
        (day) => day.isTrainingDay === true && day.isHoliday === false,
      ).length,

      holidayDays: days.filter((day) => day.isHoliday === true).length,

      closedDays: days.filter(
        (day) => day.isClosed === true && day.isHoliday === false,
      ).length,

      noTrainingDays: days.filter((day) => day.reason === "NO_ACTIVE_SLOTS")
        .length,

      noScheduleDays: days.filter(
        (day) => day.reason === "NO_SCHEDULE_CONFIGURED",
      ).length,
    };

    const monthName = new Date(
      requestedYear,
      requestedMonth - 1,
      1,
    ).toLocaleString("en-US", {
      month: "long",
    });

    return res.status(200).json({
      success: true,

      branch,

      calendar: {
        year: requestedYear,
        month: requestedMonth,
        monthName,
        daysInMonth: days.length,
      },

      summary,

      days,
    });
  } catch (error) {
    console.error("Get public branch month calendar error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public branch monthly availability.",
    });
  }
};

/* =========================================================
   GET ALL BRANCH SCHEDULES
   GET /api/branch-schedules
   ========================================================= */

const getBranchSchedules = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /*
     * SUPER_ADMIN can see every branch.
     *
     * BRANCH_ADMIN / COACH can only see
     * their assigned branch.
     */
    const branchFilter = {};

    if (!userHasGlobalAccess(req)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account.",
        });
      }

      branchFilter._id = req.user.branch;
    }

    const branches = await Branch.find(branchFilter)
      .select("_id name address phone isActive")
      .sort({
        name: 1,
      })
      .lean();

    const branchIds = branches.map((branch) => branch._id);

    const schedules = await BranchSchedule.find({
      branch: {
        $in: branchIds,
      },
    })
      .populate("updatedBy", "name email role")
      .lean();

    const scheduleMap = new Map(
      schedules.map((schedule) => [schedule.branch.toString(), schedule]),
    );

    const result = branches.map((branch) => {
      const schedule = scheduleMap.get(branch._id.toString());

      return {
        branch,
        schedule: serializeSchedule(schedule),
        hasSchedule: Boolean(schedule),
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      branches: result,
    });
  } catch (error) {
    console.error("Get branch schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branch schedules.",
    });
  }
};

/* =========================================================
   GET MONTHLY AVAILABILITY
   GET /api/branch-schedules/:branchId/calendar
   ========================================================= */

/**
 * Returns every actual calendar date for the
 * requested month.
 *
 * Query:
 *
 * ?year=2026&month=9
 *
 * Each date is resolved from:
 *
 * actual date
 *      ↓
 * weekday
 *      ↓
 * weekly branch schedule
 *      ↓
 * holiday override
 *      ↓
 * training sessions
 *
 * This endpoint is intentionally separate from
 * GET /:branchId because the frontend calendar
 * needs a complete month rather than only the
 * recurring weekly configuration.
 */
const getBranchMonthCalendar = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (!userCanReadBranch(req, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this branch calendar.",
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

    const currentDate = new Date();

    const requestedYear =
      req.query.year !== undefined
        ? Number(req.query.year)
        : currentDate.getFullYear();

    const requestedMonth =
      req.query.month !== undefined
        ? Number(req.query.month)
        : currentDate.getMonth() + 1;

    if (
      !Number.isInteger(requestedYear) ||
      requestedYear < 2000 ||
      requestedYear > 2100
    ) {
      return res.status(400).json({
        success: false,
        message: "Year must be a valid integer between 2000 and 2100.",
      });
    }

    if (
      !Number.isInteger(requestedMonth) ||
      requestedMonth < 1 ||
      requestedMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Month must be an integer between 1 and 12.",
      });
    }

    const days = await getBranchMonthAvailability(
      branchId,
      requestedYear,
      requestedMonth,
    );

    const summary = {
      totalDays: days.length,
      availableDays: days.filter(
        (day) => day.isTrainingDay === true && day.isHoliday === false,
      ).length,
      holidayDays: days.filter((day) => day.isHoliday === true).length,
      closedDays: days.filter(
        (day) => day.isClosed === true && day.isHoliday === false,
      ).length,
      noTrainingDays: days.filter((day) => day.reason === "NO_ACTIVE_SLOTS")
        .length,
      noScheduleDays: days.filter(
        (day) => day.reason === "NO_SCHEDULE_CONFIGURED",
      ).length,
    };

    const monthName = new Date(
      requestedYear,
      requestedMonth - 1,
      1,
    ).toLocaleString("en-US", {
      month: "long",
    });

    return res.status(200).json({
      success: true,

      branch,

      calendar: {
        year: requestedYear,
        month: requestedMonth,
        monthName,
        daysInMonth: days.length,
      },

      summary,

      days,
    });
  } catch (error) {
    console.error("Get branch month calendar error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branch monthly availability.",
    });
  }
};

/* =========================================================
   GET ONE BRANCH SCHEDULE
   GET /api/branch-schedules/:branchId
   ========================================================= */

const getBranchSchedule = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
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

    let schedule = await BranchSchedule.findOne({
      branch: branchId,
    })
      .populate("updatedBy", "name email role")
      .lean();

    /*
     * If a branch has never had a schedule
     * configured, return a useful default
     * without creating it yet.
     */
    if (!schedule) {
      schedule = {
        branch: branchId,
        openingTime: "06:00",
        closingTime: "21:00",
        weeklySchedule: getDefaultWeeklySchedule(),
        updatedBy: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    return res.status(200).json({
      success: true,
      branch,
      schedule: serializeSchedule(schedule),
    });
  } catch (error) {
    console.error("Get branch schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branch schedule.",
    });
  }
};

/* =========================================================
   CREATE / UPDATE BRANCH SCHEDULE
   PUT /api/branch-schedules/:branchId
   ========================================================= */

const upsertBranchSchedule = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (!userCanWriteBranch(req, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage this branch schedule.",
      });
    }

    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    const validation = validateSchedulePayload(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const { openingTime, closingTime, weeklySchedule } = validation;

    const schedule = await BranchSchedule.findOneAndUpdate(
      {
        branch: branchId,
      },
      {
        $set: {
          openingTime,
          closingTime,
          weeklySchedule,
          updatedBy: req.user._id,
        },

        $setOnInsert: {
          branch: branchId,
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
      message: "Branch training schedule saved successfully.",
      schedule: serializeSchedule(schedule.toObject()),
    });
  } catch (error) {
    console.error("Save branch schedule error:", error);

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message:
          Object.values(error.errors)
            .map((item) => item.message)
            .join(", ") || "Invalid schedule data.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save branch training schedule.",
    });
  }
};

/* =========================================================
   DELETE / RESET BRANCH SCHEDULE
   DELETE /api/branch-schedules/:branchId
   ========================================================= */

const deleteBranchSchedule = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!isValidObjectId(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    /*
     * Only SUPER_ADMIN can completely remove
     * the configured schedule.
     */
    if (!userHasGlobalAccess(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can reset a branch schedule.",
      });
    }

    const deleted = await BranchSchedule.findOneAndDelete({
      branch: branchId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "No configured schedule found for this branch.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Branch schedule reset successfully.",
    });
  } catch (error) {
    console.error("Delete branch schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset branch schedule.",
    });
  }
};

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  getPublicBranchSchedules,
  getPublicBranchMonthCalendar,
  getBranchSchedules,
  getBranchMonthCalendar,
  getBranchSchedule,
  upsertBranchSchedule,
  deleteBranchSchedule,
  formatTimeForDisplay,
};
