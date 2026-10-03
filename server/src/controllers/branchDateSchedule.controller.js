const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const BranchSchedule = require("../models/BranchSchedule");
const TrainingSessionType = require("../models/TrainingSessionType");

/* =========================================================
   CONSTANTS
========================================================= */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* =========================================================
   AUTHORIZATION / DATA SCOPE
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function isGlobalScopeUser(req) {
  return (
    String(req.user?.role || "").toUpperCase() === "SUPER_ADMIN" ||
    String(req.user?.dataScope || "").toUpperCase() === "ALL"
  );
}

function getUserBranchId(req) {
  if (!req.user?.branch) {
    return null;
  }

  return req.user.branch.toString();
}

function userCanAccessBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (isGlobalScopeUser(req)) {
    return true;
  }

  const userBranchId = getUserBranchId(req);

  if (!userBranchId) {
    return false;
  }

  return userBranchId === branchId.toString();
}

/*
 * Permission itself is enforced at the route:
 *
 * branch_schedule.view
 * branch_schedule.manage
 *
 * This helper only enforces data scope.
 */

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

function formatDisplayTime(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  const hour = Math.floor(minutes / 60);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

/* =========================================================
   DATE HELPERS
========================================================= */

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

/* =========================================================
   SLOT NORMALIZATION
========================================================= */

function normalizeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => ({
      _id: slot?._id,

      sessionName: String(slot?.sessionName || "Training Session").trim(),
      ...(slot?.sessionTypeId ? { sessionTypeId: slot.sessionTypeId } : {}),
      ...(slot?.sessionType ? { sessionType: String(slot.sessionType).trim() } : {}),

      startTime: String(slot?.startTime || "").trim(),

      endTime: String(slot?.endTime || "").trim(),

      isActive: slot?.isActive !== false,
    }))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/* =========================================================
   VALIDATE PAYLOAD
========================================================= */

async function validateDateSchedulePayload(branchId, date, body, existingSchedule) {
  if (!isValidCalendarDate(date)) {
    return {
      valid: false,
      message: "Date must be a valid YYYY-MM-DD calendar date.",
    };
  }

  const branchSchedule = await BranchSchedule.findOne({
    branch: branchId,
  }).lean();

  const openingTime = branchSchedule?.openingTime || "06:00";

  const closingTime = branchSchedule?.closingTime || "21:00";

  const openingMinutes = timeToMinutes(openingTime);

  const closingMinutes = timeToMinutes(closingTime);

  const isClosed = body?.isClosed === true;

  const slots = normalizeSlots(body?.slots);
  const existingSlots = new Map((existingSchedule?.slots || []).map((slot) => [String(slot._id), slot]));
  const ids = [];
  for (const slot of slots) {
    if (slot.sessionTypeId) {
      if (!isValidObjectId(slot.sessionTypeId)) return { valid: false, message: "Invalid training session type reference." };
      ids.push(String(slot.sessionTypeId));
    } else if (!existingSlots.has(String(slot._id || ""))) return { valid: false, message: "Select a training session type for every new session." };
  }
  const types = ids.length ? await TrainingSessionType.find({ _id: { $in: [...new Set(ids)] } }).select("_id isActive").lean() : [];
  const byId = new Map(types.map((type) => [String(type._id), type]));
  if (byId.size !== new Set(ids).size) return { valid: false, message: "One or more selected training session types no longer exist." };
  for (const slot of slots) if (slot.sessionTypeId && byId.get(String(slot.sessionTypeId))?.isActive === false && String(existingSlots.get(String(slot._id))?.sessionTypeId || "") !== String(slot.sessionTypeId)) return { valid: false, message: "Inactive training session types cannot be assigned to new sessions." };

  if (isClosed) {
    return {
      valid: true,
      isClosed: true,
      slots: [],
    };
  }

  if (slots.length === 0) {
    return {
      valid: true,
      isClosed: false,
      slots: [],
    };
  }

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
        message: "Start time must be in HH:mm format.",
      };
    }

    if (!TIME_PATTERN.test(slot.endTime)) {
      return {
        valid: false,
        message: "End time must be in HH:mm format.",
      };
    }

    const startMinutes = timeToMinutes(slot.startTime);

    const endMinutes = timeToMinutes(slot.endTime);

    if (startMinutes === null || endMinutes === null) {
      return {
        valid: false,
        message: "Invalid training session time.",
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

  const activeSlots = slots.filter((slot) => slot.isActive);
  for (let index = 0; index < activeSlots.length; index += 1) for (let otherIndex = index + 1; otherIndex < activeSlots.length; otherIndex += 1) {
    const a = activeSlots[index], b = activeSlots[otherIndex];
    const as = timeToMinutes(a.startTime), ae = timeToMinutes(a.endTime), bs = timeToMinutes(b.startTime), be = timeToMinutes(b.endTime);
    if (bs < ae && be > as) return { valid: false, message: `Date ${date} already has a session scheduled from ${formatDisplayTime(a.startTime)} to ${formatDisplayTime(a.endTime)}. The requested time ${formatDisplayTime(b.startTime)} to ${formatDisplayTime(b.endTime)} overlaps with it.` };
  }

  return {
    valid: true,
    isClosed: false,
    slots: slots.map((slot) => slot.sessionTypeId || !existingSlots.get(String(slot._id))?.sessionTypeId
      ? slot
      : { ...slot, sessionTypeId: existingSlots.get(String(slot._id)).sessionTypeId }),
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

    if (!userCanAccessBranch(req, branchId)) {
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

    const schedule = await BranchDateSchedule.findOne({
      branch: branchId,
      date,
    })
      .populate("updatedBy", "name email role")
      .lean();

    return res.status(200).json({
      success: true,
      branch,
      date,
      hasOverride: Boolean(schedule),
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

    if (!userCanAccessBranch(req, branchId)) {
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

    const existingSchedule = await BranchDateSchedule.findOne({ branch: branchId, date }).lean();
    const validation = await validateDateSchedulePayload(
      branchId,
      date,
      req.body,
      existingSchedule,
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

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

    if (!userCanAccessBranch(req, branchId)) {
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
