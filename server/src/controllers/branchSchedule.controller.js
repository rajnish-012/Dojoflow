const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchSchedule = require("../models/BranchSchedule");
const TrainingSessionType = require("../models/TrainingSessionType");
const Student = require("../models/Student");
const User = require("../models/User");
const CoachAvailability = require("../models/CoachAvailability");

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

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/*
 * Database-driven authorization.
 *
 * These permissions already exist in the central
 * ForceStrike permission catalog:
 *
 * branch_schedule.view
 * branch_schedule.manage
 *
 * The backend auth middleware resolves the user's current
 * Role document and places its permissions on req.user.
 */
const PERMISSIONS = {
  BRANCH_SCHEDULE_VIEW: "branch_schedule.view",
  BRANCH_SCHEDULE_MANAGE: "branch_schedule.manage",
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function isSuperAdmin(req) {
  return normalizeRole(req.user?.role) === "SUPER_ADMIN";
}

/**
 * Check a database-backed permission.
 *
 * SUPER_ADMIN is intentionally handled as a permanent
 * system-level bypass.
 *
 * Normal/custom roles MUST have the permission in their
 * database Role.permissions array.
 */
function hasPermission(req, permission) {
  if (!req.user) {
    return false;
  }

  if (isSuperAdmin(req)) {
    return true;
  }

  const permissions = Array.isArray(req.user.permissions)
    ? req.user.permissions
    : [];

  return permissions.some(
    (value) => typeof value === "string" && value.trim() === permission,
  );
}

/**
 * Return the user's effective data scope.
 *
 * auth.middleware.js resolves this from the database Role:
 *
 * SUPER_ADMIN -> ALL
 * Role.dataScope === ALL -> ALL
 * otherwise -> BRANCH
 */
function getDataScope(req) {
  if (isSuperAdmin(req)) {
    return "ALL";
  }

  return String(req.user?.dataScope || "BRANCH").toUpperCase() === "ALL"
    ? "ALL"
    : "BRANCH";
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

/**
 * Determine whether the authenticated user may access
 * a specific branch for READ operations.
 *
 * Authorization:
 *
 * 1. Authentication is required.
 * 2. SUPER_ADMIN bypasses permission checks.
 * 3. Normal/custom roles require branch_schedule.view for this schedule module.
 * 4. ALL data scope allows global branch access.
 * 5. BRANCH data scope requires an assigned branch and
 *    restricts access to that branch.
 *
 * This preserves branch isolation while allowing custom
 * database roles to work.
 */
function userCanReadBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (!hasPermission(req, PERMISSIONS.BRANCH_SCHEDULE_VIEW)) {
    return false;
  }

  if (isSuperAdmin(req)) {
    return true;
  }

  const dataScope = getDataScope(req);

  if (dataScope === "ALL") {
    return true;
  }

  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  return userBranch === branchId.toString();
}

/**
 * Determine whether the authenticated user may modify
 * a specific branch schedule.
 *
 * Authorization:
 *
 * 1. Authentication is required.
 * 2. SUPER_ADMIN bypasses permission checks.
 * 3. Normal/custom roles require branch_schedule.manage.
 * 4. ALL data scope allows global management.
 * 5. BRANCH data scope restricts management to the
 *    user's assigned branch.
 */
function userCanWriteBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (!hasPermission(req, PERMISSIONS.BRANCH_SCHEDULE_MANAGE)) {
    return false;
  }

  if (isSuperAdmin(req)) {
    return true;
  }

  const dataScope = getDataScope(req);

  if (dataScope === "ALL") {
    return true;
  }

  const userBranch = getUserBranchId(req);

  if (!userBranch) {
    return false;
  }

  return userBranch === branchId.toString();
}

/**
 * Authorization for global branch-list access.
 *
 * A user with:
 *
 *   branch_schedule.view + dataScope ALL
 *
 * can see all branches.
 *
 * A branch-scoped user only receives their assigned
 * branch from getBranchSchedules().
 */
function userCanListBranches(req) {
  if (!req.user) {
    return false;
  }

  return hasPermission(req, PERMISSIONS.BRANCH_SCHEDULE_VIEW);
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

/* =========================================================
   DEFAULT WEEKLY SCHEDULE
========================================================= */

function getDefaultWeeklySchedule() {
  return DAY_NAMES.map((_, index) => ({
    dayOfWeek: index,
    isClosed: index === 0,
    slots: [],
  }));
}

/* =========================================================
   NORMALIZE WEEKLY SCHEDULE
========================================================= */

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

async function validateSchedulePayload(body, existingSchedule, branchId, allowCapacityOverride = false) {
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
  const existingSlots = new Map();
  for (const day of existingSchedule?.weeklySchedule || []) {
    for (const slot of day.slots || []) existingSlots.set(String(slot._id), slot);
  }
  const submittedIds = [];
  const assignedCoachIds = [];
  for (const day of weeklySchedule) for (const slot of (day.isClosed ? [] : day.slots || [])) {
    if (slot?.sessionTypeId != null) {
      if (!mongoose.Types.ObjectId.isValid(slot.sessionTypeId)) return { valid: false, message: "Invalid training session type reference." };
      submittedIds.push(String(slot.sessionTypeId));
    } else if (!existingSlots.has(String(slot?._id || ""))) {
      return { valid: false, message: "Select a training session type for every new session." };
  }
    const coachId = slot?.coach || existingSlots.get(String(slot?._id || ""))?.coach;
    if (coachId) {
      if (!mongoose.Types.ObjectId.isValid(coachId)) return { valid: false, message: "Invalid coach assignment." };
      assignedCoachIds.push(String(coachId));
    }
  }
  const typeDocs = submittedIds.length ? await TrainingSessionType.find({ _id: { $in: [...new Set(submittedIds)] } }).select("_id isActive").lean() : [];
  const typesById = new Map(typeDocs.map((type) => [String(type._id), type]));
  if (typesById.size !== new Set(submittedIds).size) return { valid: false, message: "One or more selected training session types no longer exist." };

  for (const day of weeklySchedule) {
    const daySlots = Array.isArray(day.slots) ? day.slots : [];
    for (const slot of daySlots) {
      const id = slot?.sessionTypeId == null ? "" : String(slot.sessionTypeId);
      if (id && typesById.get(id)?.isActive === false && String(existingSlots.get(String(slot?._id))?.sessionTypeId || "") !== id) return { valid: false, message: "Inactive training session types cannot be assigned to new sessions." };
    }

    // Closed days may retain slots for future reactivation, but active slots
    // must still never conflict with one another.
    const collisionSlots = daySlots.filter((slot) => slot?.isActive !== false && TIME_PATTERN.test(String(slot?.startTime || "")) && TIME_PATTERN.test(String(slot?.endTime || "")));
    for (let index = 0; index < collisionSlots.length; index += 1) for (let otherIndex = index + 1; otherIndex < collisionSlots.length; otherIndex += 1) {
      const first = collisionSlots[index], second = collisionSlots[otherIndex];
      const firstStart = timeToMinutes(first.startTime), firstEnd = timeToMinutes(first.endTime);
      const secondStart = timeToMinutes(second.startTime), secondEnd = timeToMinutes(second.endTime);
      if (secondStart < firstEnd && secondEnd > firstStart) {
        const existing = secondStart >= firstStart ? first : second;
        const requested = existing === first ? second : first;
        return { valid: false, message: `${DAY_NAMES[day.dayOfWeek]} already has a session scheduled from ${formatTimeForDisplay(existing.startTime)} to ${formatTimeForDisplay(existing.endTime)}. The requested time ${formatTimeForDisplay(requested.startTime)} to ${formatTimeForDisplay(requested.endTime)} overlaps with it.` };
      }
    }

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

    const slots = daySlots;

    const normalizedSlots = [];

    for (const slot of slots) {
      const sessionName = String(
        slot?.sessionName || "Training Session",
      ).trim();

      const startTime = String(slot?.startTime || "").trim();

      const endTime = String(slot?.endTime || "").trim();
      const existingSlot = existingSlots.get(String(slot?._id || ""));
      const rawCapacity = slot?.capacity === undefined ? existingSlot?.capacity : slot.capacity;
      const capacity = rawCapacity === "" || rawCapacity == null ? null : Number(rawCapacity);
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)) return { valid: false, message: "Session capacity must be a whole number between 1 and 1000." };

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
        ...(slot?.sessionTypeId
          ? { sessionTypeId: slot.sessionTypeId }
          : existingSlots.get(String(slot?._id))?.sessionTypeId
            ? { sessionTypeId: existingSlots.get(String(slot?._id)).sessionTypeId }
            : {}),
        ...(slot?.sessionType ? { sessionType: String(slot.sessionType).trim() } : {}),
        startTime,
        endTime,
        isActive: slot?.isActive !== false,
        capacity,
        coach: slot?.coach || existingSlot?.coach || null,
      });
    }

    /*
     * Sort before checking overlaps.
     */
    const activeSlots = normalizedSlots.filter((slot) => slot.isActive);
    for (let index = 0; index < activeSlots.length; index += 1) for (let otherIndex = index + 1; otherIndex < activeSlots.length; otherIndex += 1) {
      const first = activeSlots[index], second = activeSlots[otherIndex];
      const firstStart = timeToMinutes(first.startTime), firstEnd = timeToMinutes(first.endTime);
      const secondStart = timeToMinutes(second.startTime), secondEnd = timeToMinutes(second.endTime);
      if (secondStart < firstEnd && secondEnd > firstStart) {
        const existing = secondStart >= firstStart ? first : second;
        const requested = existing === first ? second : first;
        return { valid: false, message: `${DAY_NAMES[day.dayOfWeek]} already has a session scheduled from ${formatTimeForDisplay(existing.startTime)} to ${formatTimeForDisplay(existing.endTime)}. The requested time ${formatTimeForDisplay(requested.startTime)} to ${formatTimeForDisplay(requested.endTime)} overlaps with it.` };
      }
    }
    day.slots = normalizedSlots;
  }

  if (assignedCoachIds.length) {
    const coachIds = [...new Set(assignedCoachIds)];
    const coaches = await User.find({ _id: { $in: coachIds }, role: "COACH", branch: branchId, isActive: true }).select("_id name").lean();
    const coachById = new Map(coaches.map((coach) => [String(coach._id), coach]));
    if (coachById.size !== coachIds.length) return { valid: false, message: "Choose active coaches assigned to this branch." };
    const availabilityRecords = await CoachAvailability.find({ coach: { $in: coachIds }, branch: branchId }).lean();
    const availabilityByCoach = new Map(availabilityRecords.map((item) => [String(item.coach), item]));
    for (const day of weeklySchedule) for (const slot of day.slots || []) {
      if (!slot.coach || slot.isActive === false || day.isClosed) continue;
      const coachName = coachById.get(String(slot.coach))?.name || "The coach";
      const availability = availabilityByCoach.get(String(slot.coach));
      if (availability) {
        const hours = (availability.workingHours || []).filter((item) => item.dayOfWeek === day.dayOfWeek);
        if (hours.length && !hours.some((item) => item.startTime <= slot.startTime && item.endTime >= slot.endTime)) return { valid: false, message: `${coachName} is not available for ${DAY_NAMES[day.dayOfWeek]} ${slot.startTime}–${slot.endTime}.` };
        const unavailable = (availability.unavailableSlots || []).some((item) => item.dayOfWeek === day.dayOfWeek && item.startTime < slot.endTime && item.endTime > slot.startTime);
        if (unavailable) return { valid: false, message: `${coachName} has an unavailable time during this class.` };
        const onLeave = (availability.leave || []).some((item) => {
          const firstDate = new Date(item.startDate); const lastDate = new Date(item.endDate);
          firstDate.setHours(0, 0, 0, 0); lastDate.setHours(23, 59, 59, 999);
          firstDate.setDate(firstDate.getDate() + ((day.dayOfWeek - firstDate.getDay() + 7) % 7));
          return firstDate <= lastDate;
        });
        if (onLeave) return { valid: false, message: `${coachName} is on leave on a scheduled ${DAY_NAMES[day.dayOfWeek]}.` };
        const dateUnavailable = (availability.unavailableSlots || []).some((item) => item.date && new Date(item.date).getDay() === day.dayOfWeek && item.startTime < slot.endTime && item.endTime > slot.startTime);
        if (dateUnavailable) return { valid: false, message: `${coachName} has a dated unavailable time during this class.` };
      }
    }
    const otherSchedules = await BranchSchedule.find({ branch: { $ne: branchId }, "weeklySchedule.slots.coach": { $in: coachIds } }).select("weeklySchedule").lean();
    for (const day of weeklySchedule) for (const slot of day.slots || []) {
      if (!slot.coach || slot.isActive === false || day.isClosed) continue;
      const clash = otherSchedules.some((schedule) => (schedule.weeklySchedule || []).some((otherDay) => otherDay.dayOfWeek === day.dayOfWeek && !otherDay.isClosed && (otherDay.slots || []).some((other) => String(other.coach || "") === String(slot.coach) && other.isActive !== false && other.startTime < slot.endTime && other.endTime > slot.startTime)));
      if (clash) return { valid: false, message: `${coachById.get(String(slot.coach))?.name || "This coach"} already has a conflicting session at another branch on ${DAY_NAMES[day.dayOfWeek]}.` };
    }
  }

  const capacitiesByProgram = new Map();
  for (const day of weeklySchedule) for (const slot of day.slots || []) {
    const programId = String(slot.sessionTypeId || "");
    if (!programId || slot.isActive === false) continue;
    if (!capacitiesByProgram.has(programId)) capacitiesByProgram.set(programId, { total: 0, unlimited: false });
    const entry = capacitiesByProgram.get(programId);
    if (slot.capacity == null) entry.unlimited = true;
    else entry.total += slot.capacity;
  }
  const finiteCapacities = [...capacitiesByProgram.entries()].filter(([, value]) => !value.unlimited);
  if (branchId && finiteCapacities.length) {
    const students = await Student.find({ branch: branchId, status: "ACTIVE" }).select("plan planEnrollments").populate("plan", "programs").lean();
    for (const [programId, capacity] of finiteCapacities) {
      const enrollmentCount = students.filter((student) => {
        const current = [...(student.planEnrollments || [])].reverse().find((item) => item.status === "ACTIVE");
        const enrolledPrograms = current?.programs?.map((item) => String(item.program?._id || item.program)) || (current?.program ? [String(current.program)] : student.plan?.programs?.map((item) => String(item.program?._id || item.program)) || []);
        return enrolledPrograms.includes(programId);
      }).length;
      if (enrollmentCount > capacity.total && !allowCapacityOverride) return { valid: false, message: `This program has ${enrollmentCount} active enrollments but only ${capacity.total} seats. Increase capacity or use an account with branch_schedule.capacity.override.` };
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

    if (!userCanListBranches(req)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view branch schedules.",
      });
    }

    /*
     * SUPER_ADMIN or any database role with:
     *
     * branch_schedule.manage
     * dataScope = ALL
     *
     * can see every branch.
     *
     * Branch-scoped users only receive their assigned
     * branch.
     */
    const branchFilter = {};

    if (getDataScope(req) !== "ALL") {
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
      .populate("weeklySchedule.slots.coach", "_id name")
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

    const coaches = await User.find({ branch: branchId, role: "COACH", isActive: true }).select("_id name").sort({ name: 1 }).lean();

    return res.status(200).json({
      success: true,
      branch,
      coaches,
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

    if (branch.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify the schedule of an inactive branch.",
      });
    }

    const existingSchedule = await BranchSchedule.findOne({ branch: branchId }).lean();
    const allowCapacityOverride = req.user.role === "SUPER_ADMIN" || (req.user.permissions || []).includes("branch_schedule.capacity.override");
    const validation = await validateSchedulePayload(req.body, existingSchedule, branchId, allowCapacityOverride);

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
        returnDocument: "after",
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

/**
 * Resetting a branch schedule is treated as a branch
 * management operation.
 *
 * Therefore:
 *
 * SUPER_ADMIN -> allowed
 * custom role with branch_schedule.manage + ALL -> allowed
 * custom role with branch_schedule.manage + BRANCH -> only own branch
 * branch.view only -> denied
 *
 * This replaces the previous hardcoded SUPER_ADMIN-only
 * authorization with the database permission model.
 */
const deleteBranchSchedule = async (req, res) => {
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
        message: "You do not have permission to reset this branch schedule.",
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

    if (branch.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Cannot reset the schedule of an inactive branch.",
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
  validateSchedulePayload,
};
