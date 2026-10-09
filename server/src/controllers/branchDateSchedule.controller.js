const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const BranchSchedule = require("../models/BranchSchedule");
const TrainingSessionType = require("../models/TrainingSessionType");
const Batch = require("../models/Batch");
const Room = require("../models/Room");
const User = require("../models/User");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const { reconcileDateOverrideSessions } = require("../services/session.service");
const { findRecurringConflict } = require("../services/schedulingConflict.service");
const { acquireScheduleResourceLocks } = require("../services/scheduleResourceLock.service");

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
      ...(slot?.batchId ? { batchId: slot.batchId } : {}),
      ...(slot?.roomId ? { roomId: slot.roomId } : {}),
      ...(slot?.coach ? { coach: slot.coach } : {}),
      room: String(slot?.room || "").trim(),
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
  for (const slot of slots) {
    const existing = existingSlots.get(String(slot._id || ""));
    if (existing) {
      if (!slot.batchId && existing.batchId) slot.batchId = existing.batchId;
      if (!slot.roomId && existing.roomId) slot.roomId = existing.roomId;
      if (!slot.coach && existing.coach) slot.coach = existing.coach;
      if (!slot.sessionTypeId && existing.sessionTypeId) slot.sessionTypeId = existing.sessionTypeId;
    }
  }
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
  const batchIds = [...new Set(slots.map((slot) => String(slot.batchId || "")).filter(Boolean))];
  let batchesById = new Map();
  if (batchIds.length) {
    const batches = await Batch.find({ _id: { $in: batchIds }, branch: branchId, status: "ACTIVE" }).populate("plan", "isActive programs").lean();
    batchesById = new Map(batches.map((batch) => [String(batch._id), batch]));
    if (batchesById.size !== batchIds.length) return { valid: false, message: "A selected Batch does not belong to this branch or is inactive." };
    for (const slot of slots) {
      if (!slot.batchId) continue;
      const batch = batchesById.get(String(slot.batchId));
      if ((batch.effectiveFrom && date < batch.effectiveFrom) || (batch.effectiveUntil && date > batch.effectiveUntil)) return { valid: false, message: "The selected Batch is not effective on this date." };
      if (!batch.plan || batch.plan.isActive === false || !(batch.plan.programs || []).some((entry) => String(entry.program?._id || entry.program) === String(slot.sessionTypeId || existingSlots.get(String(slot._id))?.sessionTypeId))) return { valid: false, message: "A Batch date override must use a Program included in its Plan." };
    }
  }

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
  const selectedRoomIds = [...new Set(activeSlots.map((slot) => String(slot.roomId || batchesById.get(String(slot.batchId || ""))?.roomId || "")).filter(Boolean))];
  const selectedRooms = selectedRoomIds.length ? await Room.find({ _id: { $in: selectedRoomIds }, branch: branchId, isActive: true }).select("_id name").lean() : [];
  const selectedRoomSet = new Set(selectedRooms.map((room) => String(room._id)));
  if (selectedRoomSet.size !== selectedRoomIds.length) return { valid: false, message: "Choose active rooms belonging to this Branch." };
  for (const slot of activeSlots) if (slot.batchId && !slot.roomId && !batchesById.get(String(slot.batchId))?.roomId) return { valid: false, message: `Assign a room to ${batchesById.get(String(slot.batchId))?.name || "the Batch"} for this date.` };
  const effectiveCoachIds = [...new Set(activeSlots.map((slot) => String(slot.coach || batchesById.get(String(slot.batchId || ""))?.coach || "")).filter(Boolean))];
  if (effectiveCoachIds.length) {
    const validCoaches = await User.find({ _id: { $in: effectiveCoachIds }, branch: branchId, role: "COACH", isActive: true }).select("_id").lean();
    if (validCoaches.length !== effectiveCoachIds.length) return { valid: false, message: "Assigned coaches must be active and belong to this Branch." };
  }
  const proposedResources = activeSlots.map((slot) => ({ branchId: String(branchId), slotId: String(slot._id || ""), dayOfWeek: 0, dayName: date, startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId || batchesById.get(String(slot.batchId || ""))?.roomId || null, roomName: selectedRooms.find((room) => String(room._id) === String(slot.roomId || batchesById.get(String(slot.batchId || ""))?.roomId || ""))?.name, coachId: String(slot.coach || batchesById.get(String(slot.batchId || ""))?.coach || "") }));
  const localConflict = findRecurringConflict({ proposed: proposedResources, existing: proposedResources });
  if (localConflict) return { valid: false, message: localConflict };
  const coachIds = [...new Set(proposedResources.map((item) => item.coachId).filter(Boolean))];
  if (coachIds.length) {
    const overrides = await BranchDateSchedule.find({ date, branch: { $ne: branchId } }).select("branch isClosed slots").lean();
    const overrideBranches = new Set(overrides.map((item) => String(item.branch)));
    const weekly = await BranchSchedule.find({ branch: { $ne: branchId, $nin: [...overrideBranches] } }).select("branch weeklySchedule").lean();
    const otherBranchIds = [...new Set([...overrides.map((item) => String(item.branch)), ...weekly.map((item) => String(item.branch))])];
    const otherBatches = otherBranchIds.length ? await Batch.find({ branch: { $in: otherBranchIds } }).select("_id coach").lean() : [];
    const otherCoachByBatch = new Map(otherBatches.map((item) => [String(item._id), String(item.coach || "")]));
    const external = [];
    for (const override of overrides) {
      if (override.isClosed) continue;
      for (const slot of override.slots || []) if (slot.isActive !== false) external.push({ branchId: String(override.branch), slotId: String(slot._id || ""), dayOfWeek: 0, dayName: date, startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId, coachId: String(slot.coach || otherCoachByBatch.get(String(slot.batchId || "")) || "") });
    }
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    for (const schedule of weekly) for (const day of schedule.weeklySchedule || []) {
      if (Number(day.dayOfWeek) !== dayOfWeek || day.isClosed) continue;
      for (const slot of day.slots || []) if (slot.isActive !== false) external.push({ branchId: String(schedule.branch), slotId: String(slot._id || ""), dayOfWeek: 0, dayName: date, startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId, coachId: String(slot.coach || otherCoachByBatch.get(String(slot.batchId || "")) || "") });
    }
    const coachConflict = findRecurringConflict({ proposed: proposedResources.filter((item) => item.coachId), existing: external });
    if (coachConflict) return { valid: false, message: coachConflict };
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
  let releaseResourceLocks = null;
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
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    releaseResourceLocks = await acquireScheduleResourceLocks({ branchId, scheduleDays: [{ dayOfWeek, isClosed: req.body?.isClosed === true, slots: req.body?.slots || [] }], existingDays: existingSchedule ? [{ dayOfWeek, isClosed: existingSchedule.isClosed, slots: existingSchedule.slots || [] }] : [] });
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

    if (existingSchedule) {
      const nextById = new Map((validation.slots || []).map((slot) => [String(slot._id), slot]));
      for (const previous of existingSchedule.slots || []) {
        const next = nextById.get(String(previous._id));
        const changed = !next || String(previous.batchId || "") !== String(next.batchId || "") || String(previous.roomId || "") !== String(next.roomId || "") || String(previous.coach || "") !== String(next.coach || "") || previous.startTime !== next.startTime || previous.endTime !== next.endTime;
        if (!changed) continue;
        const hasSession = await Session.exists({ branch: branchId, date, scheduleSlotId: previous._id });
        const hasAttendance = await Attendance.exists({ branch: branchId, date: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59.999`) }, sessionSlotId: previous._id });
        if (hasSession || hasAttendance) return res.status(409).json({ success: false, message: "This dated slot has Session or attendance history and cannot be moved, reassigned, or removed." });
      }
    }

    const scheduleQuery = existingSchedule ? { branch: branchId, date, updatedAt: existingSchedule.updatedAt } : { branch: branchId, date };
    const schedule = await BranchDateSchedule.findOneAndUpdate(
      scheduleQuery,
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
        upsert: !existingSchedule,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).populate("updatedBy", "name email role");
    if (!schedule) return res.status(409).json({ success: false, message: "This dated schedule changed while you were editing it. Refresh and review availability." });
    try { await reconcileDateOverrideSessions(branchId, date, schedule.toObject()); }
    catch (syncError) { console.error("Dated Batch Sessions could not be reconciled after override", { name: syncError?.name || "Error" }); }

    return res.status(200).json({
      success: true,
      message: "Date-specific training schedule saved successfully.",
      schedule: serializeDateSchedule(schedule.toObject()),
    });
  } catch (error) {
    console.error("Save branch date schedule error:", error);

    if (error?.status === 409) return res.status(409).json({ success: false, message: error.message });
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This dated schedule changed during the save. Refresh and try again." });

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
  } finally {
    if (releaseResourceLocks) {
      try { await releaseResourceLocks(); }
      catch (error) { console.error("Unable to release dated schedule resource locks", { name: error?.name || "Error" }); }
    }
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

    const existing = await BranchDateSchedule.findOne({ branch: branchId, date }).lean();
    for (const slot of existing?.slots || []) {
      const hasSession = await Session.exists({ branch: branchId, date, scheduleSlotId: slot._id });
      const hasAttendance = await Attendance.exists({ branch: branchId, sessionSlotId: slot._id, date: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59.999`) } });
      if (hasSession || hasAttendance) return res.status(409).json({ success: false, message: "This dated schedule has Session or attendance history and cannot be removed." });
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
