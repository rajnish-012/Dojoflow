const mongoose = require("mongoose");
const Holiday = require("../models/Holiday");

/* =========================================================
   DATE HELPERS
========================================================= */

/**
 * Parse YYYY-MM-DD as a LOCAL calendar date.
 *
 * Never use:
 *
 * new Date("2026-09-25")
 *
 * because YYYY-MM-DD is interpreted as UTC by JavaScript.
 */
const parseCalendarDate = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }

      date.setHours(0, 0, 0, 0);

      return date;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const normalized = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  normalized.setHours(0, 0, 0, 0);

  return normalized;
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

const getToday = () => {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
};

const isPastDate = (value) => {
  const date = parseCalendarDate(value);

  if (!date) {
    return false;
  }

  return date.getTime() < getToday().getTime();
};

/* =========================================================
   DATA-SCOPE HELPERS
========================================================= */

/**
 * SUPER_ADMIN is resolved by the authentication/permission
 * layer and remains globally scoped.
 *
 * Other users use the Role.dataScope resolved by auth.middleware.
 */
const isSuperAdmin = (req) => {
  return String(req.user?.role || "").toUpperCase() === "SUPER_ADMIN";
};

const getUserBranchId = (req) => {
  if (!req.user?.branch) {
    return null;
  }

  return req.user.branch.toString();
};

const hasGlobalDataScope = (req) => {
  return (
    String(req.user?.role || "").toUpperCase() === "SUPER_ADMIN" ||
    String(req.user?.dataScope || "").toUpperCase() === "ALL"
  );
};

/**
 * Check whether the current user may access
 * a specific holiday.
 *
 * Global-scope users:
 *   - all branches
 *   - global holidays
 *
 * Branch-scope users:
 *   - global holidays
 *   - own branch holidays
 */
const canAccessHoliday = (req, holiday) => {
  if (hasGlobalDataScope(req)) {
    return true;
  }

  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  /*
   * Global holiday.
   */
  if (!holiday.branch) {
    return true;
  }

  return holiday.branch.toString() === userBranch;
};

/**
 * Check whether the current user may modify
 * a specific holiday.
 *
 * Permission itself is enforced by:
 *
 * authorizePermission("holiday.manage")
 *
 * This helper only handles data scope and
 * global/branch holiday business rules.
 */
const canManageHoliday = (req, holiday) => {
  if (hasGlobalDataScope(req)) {
    return true;
  }

  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  /*
   * Branch-scoped users cannot manage
   * global holidays.
   */
  if (!holiday.branch) {
    return false;
  }

  return holiday.branch.toString() === userBranch;
};

/* =========================================================
   BRANCH VALIDATION
========================================================= */

const validateBranchId = (branch) => {
  if (branch === null || branch === undefined || branch === "") {
    return true;
  }

  return mongoose.Types.ObjectId.isValid(branch);
};

/* =========================================================
   HOLIDAY POPULATION
========================================================= */

const populateHoliday = (query) => {
  return query
    .populate("branch", "name address phone isActive")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role");
};

/* =========================================================
   FIND HOLIDAY FOR BRANCH + DATE
========================================================= */

/**
 * Deterministic priority:
 *
 * 1. Branch-specific holiday
 * 2. Global holiday
 *
 * This MUST match branchSchedule.service.js.
 */
const findHolidayForBranchDate = async (branchId, date) => {
  const { start, end } = getDateRange(date);

  if (!start || !end) {
    return null;
  }

  const holidays = await Holiday.find({
    date: {
      $gte: start,
      $lte: end,
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
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .lean();

  /*
   * Branch-specific holiday always wins.
   */
  const branchHoliday = holidays.find(
    (holiday) =>
      holiday.branch &&
      holiday.branch._id &&
      holiday.branch._id.toString() === branchId.toString(),
  );

  if (branchHoliday) {
    return branchHoliday;
  }

  /*
   * Otherwise global holiday.
   */
  return holidays.find((holiday) => !holiday.branch) || null;
};

/* =========================================================
   GET HOLIDAYS
========================================================= */

const getHolidays = async (req, res) => {
  try {
    const { year, month, branch, includeInactive } = req.query;

    const filter = {};

    /*
     * Default:
     * only active holidays.
     */
    if (String(includeInactive) !== "true") {
      filter.isActive = true;
    }

    /*
     * YEAR FILTER
     */
    if (year !== undefined) {
      const numericYear = Number(year);

      if (
        !Number.isInteger(numericYear) ||
        numericYear < 2000 ||
        numericYear > 2100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid year",
        });
      }

      filter.date = {
        $gte: new Date(numericYear, 0, 1, 0, 0, 0, 0),
        $lt: new Date(numericYear + 1, 0, 1, 0, 0, 0, 0),
      };
    }

    /*
     * MONTH FILTER
     */
    if (month !== undefined) {
      const numericMonth = Number(month);

      if (
        !Number.isInteger(numericMonth) ||
        numericMonth < 1 ||
        numericMonth > 12
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid month. Month must be between 1 and 12.",
        });
      }

      const numericYear =
        year !== undefined ? Number(year) : getToday().getFullYear();

      const monthStart = new Date(numericYear, numericMonth - 1, 1, 0, 0, 0, 0);

      const monthEnd = new Date(numericYear, numericMonth, 1, 0, 0, 0, 0);

      filter.date = {
        $gte: monthStart,
        $lt: monthEnd,
      };
    }

    /*
     * BRANCH FILTER
     */
    if (branch !== undefined) {
      if (branch !== "global" && !mongoose.Types.ObjectId.isValid(branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      if (branch === "global") {
        /*
         * A branch-scoped user may view global
         * holidays because they are relevant to
         * their branch calendar.
         */
        filter.branch = null;
      } else {
        /*
         * Global-scope roles can request any branch.
         */
        if (
          !hasGlobalDataScope(req) &&
          (!req.user?.branch ||
            req.user.branch.toString() !== branch.toString())
        ) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this branch",
          });
        }

        filter.branch = branch;
      }
    } else if (!hasGlobalDataScope(req)) {
      /*
       * Branch-scoped users see:
       *
       * global holidays
       * +
       * their own branch holidays
       */
      if (!req.user?.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.$or = [
        {
          branch: null,
        },
        {
          branch: req.user.branch,
        },
      ];
    }

    const holidays = await populateHoliday(Holiday.find(filter))
      .sort({
        date: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: holidays.length,
      holidays,
    });
  } catch (error) {
    console.error("Get holidays error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch holidays",
    });
  }
};

/* =========================================================
   GET HOLIDAY BY DATE
========================================================= */

const getHolidayByDate = async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();

    if (!validateDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format",
      });
    }

    let branchId = req.query.branch || req.user?.branch || null;

    if (!hasGlobalDataScope(req) && !req.user?.branch) {
      return res.status(403).json({
        success: false,
        message: "No branch is assigned to this account",
      });
    }

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /*
     * Without a branch, return all holidays
     * for the requested date.
     *
     * This is only available to global-scope users.
     */
    if (!branchId) {
      if (!hasGlobalDataScope(req)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to global branch data",
        });
      }

      const { start, end } = getDateRange(date);

      const holidays = await populateHoliday(
        Holiday.find({
          date: {
            $gte: start,
            $lte: end,
          },
          isActive: true,
        }),
      )
        .sort({
          branch: 1,
          name: 1,
        })
        .lean();

      return res.status(200).json({
        success: true,
        date,
        isHoliday: holidays.length > 0,
        holidays,
        holiday: holidays[0] || null,
      });
    }

    /*
     * Branch-scoped users cannot query another branch.
     */
    if (
      !hasGlobalDataScope(req) &&
      req.user?.branch?.toString() !== branchId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this branch",
      });
    }

    /*
     * Deterministic branch-specific
     * > global priority.
     */
    const holiday = await findHolidayForBranchDate(branchId, date);

    return res.status(200).json({
      success: true,
      date,
      branch: branchId,
      isHoliday: Boolean(holiday),
      holiday: holiday || null,
    });
  } catch (error) {
    console.error("Get holiday by date error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check holiday",
    });
  }
};

/* =========================================================
   CREATE HOLIDAY
========================================================= */

const createHoliday = async (req, res) => {
  try {
    const { date, name, description, branch } = req.body;

    if (!date || !name) {
      return res.status(400).json({
        success: false,
        message: "Date and holiday name are required",
      });
    }

    if (!validateDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format",
      });
    }

    /*
     * HOLIDAYS ARE FUTURE-ONLY
     */
    if (isPastDate(date)) {
      return res.status(400).json({
        success: false,
        message:
          "A holiday can only be created for today or a future date. Past dates are not allowed because attendance may already be recorded.",
      });
    }

    const holidayName = String(name).trim();

    if (!holidayName) {
      return res.status(400).json({
        success: false,
        message: "Holiday name cannot be empty",
      });
    }

    if (!validateBranchId(branch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    let holidayBranch = branch || null;

    /*
     * Branch-scoped roles can ONLY create
     * branch-specific holidays for their
     * assigned branch.
     *
     * Global-scope roles may create global
     * or branch-specific holidays.
     */
    if (!hasGlobalDataScope(req)) {
      if (!req.user?.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      holidayBranch = req.user.branch;
    }

    const { start, end } = getDateRange(date);

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday date",
      });
    }

    const duplicate = await Holiday.findOne({
      date: {
        $gte: start,
        $lte: end,
      },
      branch: holidayBranch,
      isActive: true,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A holiday already exists for this date and branch",
        holiday: duplicate,
      });
    }

    const holiday = await Holiday.create({
      date: start,
      name: holidayName,
      description: String(description || "").trim(),
      branch: holidayBranch,
      isActive: true,
      createdBy: req.user._id,
    });

    const populatedHoliday = await populateHoliday(
      Holiday.findById(holiday._id),
    );

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      holiday: populatedHoliday,
    });
  } catch (error) {
    console.error("Create holiday error:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A holiday already exists for this date and branch",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create holiday",
    });
  }
};

/* =========================================================
   UPDATE HOLIDAY
========================================================= */

const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday ID",
      });
    }

    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    if (!canManageHoliday(req, holiday)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to modify this holiday",
      });
    }

    const { date, name, description, branch, isActive } = req.body;

    let nextDate = formatDate(holiday.date);

    if (date !== undefined) {
      if (!validateDate(date)) {
        return res.status(400).json({
          success: false,
          message: "Date must be in YYYY-MM-DD format",
        });
      }

      if (isPastDate(date)) {
        return res.status(400).json({
          success: false,
          message: "A holiday date cannot be changed to a past date.",
        });
      }

      nextDate = date;
    }

    let nextName = holiday.name;

    if (name !== undefined) {
      nextName = String(name).trim();

      if (!nextName) {
        return res.status(400).json({
          success: false,
          message: "Holiday name cannot be empty",
        });
      }
    }

    let nextBranch = holiday.branch ? holiday.branch.toString() : null;

    /*
     * Branch-scoped roles cannot change
     * ownership or make a holiday global.
     */
    if (!hasGlobalDataScope(req)) {
      if (!req.user?.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (!holiday.branch) {
        return res.status(403).json({
          success: false,
          message: "Branch-scoped users cannot modify a global holiday",
        });
      }

      if (holiday.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this holiday",
        });
      }

      nextBranch = req.user.branch.toString();
    } else if (branch !== undefined) {
      if (!validateBranchId(branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      nextBranch = branch || null;
    }

    const { start, end } = getDateRange(nextDate);

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday date",
      });
    }

    const nextActive =
      isActive === undefined ? holiday.isActive : Boolean(isActive);

    if (nextActive) {
      const duplicate = await Holiday.findOne({
        _id: {
          $ne: holiday._id,
        },
        date: {
          $gte: start,
          $lte: end,
        },
        branch: nextBranch,
        isActive: true,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "Another active holiday already exists for this date and branch",
          holiday: duplicate,
        });
      }
    }

    holiday.date = start;
    holiday.name = nextName;

    if (description !== undefined) {
      holiday.description = String(description || "").trim();
    }

    holiday.branch = nextBranch || null;

    holiday.isActive = nextActive;

    holiday.updatedBy = req.user._id;

    await holiday.save();

    const updatedHoliday = await populateHoliday(Holiday.findById(holiday._id));

    return res.status(200).json({
      success: true,
      message: "Holiday updated successfully",
      holiday: updatedHoliday,
    });
  } catch (error) {
    console.error("Update holiday error:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Another holiday already exists for this date and branch",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update holiday",
    });
  }
};

/* =========================================================
   DELETE HOLIDAY
========================================================= */

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday ID",
      });
    }

    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    if (!canManageHoliday(req, holiday)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this holiday",
      });
    }

    /*
     * Soft delete.
     *
     * Historical records are preserved.
     */
    holiday.isActive = false;

    holiday.updatedBy = req.user._id;

    await holiday.save();

    return res.status(200).json({
      success: true,
      message: "Holiday deleted successfully",
    });
  } catch (error) {
    console.error("Delete holiday error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete holiday",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getHolidays,
  getHolidayByDate,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
