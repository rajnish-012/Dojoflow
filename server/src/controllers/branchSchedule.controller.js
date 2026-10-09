const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchSchedule = require("../models/BranchSchedule");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const Room = require("../models/Room");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const TrainingSessionType = require("../models/TrainingSessionType");
const Batch = require("../models/Batch");
const Student = require("../models/Student");
const User = require("../models/User");
const CoachAvailability = require("../models/CoachAvailability");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { reconcileFutureSessionsForBranch, resolveSessionForSlot } = require("../services/session.service");
const { findRecurringConflict } = require("../services/schedulingConflict.service");
const { acquireScheduleResourceLocks } = require("../services/scheduleResourceLock.service");

const {
  getBranchMonthAvailability,
  formatDate,
  parseCalendarDate,
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

async function listRooms(req, res) {
  const { branchId } = req.query;
  if (!isValidObjectId(branchId)) return res.status(400).json({ success: false, message: "A valid Branch is required." });
  if (!userCanReadBranch(req, new mongoose.Types.ObjectId(branchId))) return res.status(403).json({ success: false, message: "You do not have access to this Branch's rooms." });
  const rooms = await Room.find({ branch: branchId }).sort({ isActive: -1, name: 1 }).lean();
  return res.json({ success: true, rooms });
}

async function createRoom(req, res) {
  const { branchId, name } = req.body || {};
  if (!isValidObjectId(branchId) || !String(name || "").trim() || String(name).trim().length > 80) return res.status(400).json({ success: false, message: "Choose a Branch and provide a room name up to 80 characters." });
  if (!userCanWriteBranch(req, new mongoose.Types.ObjectId(branchId))) return res.status(403).json({ success: false, message: "You do not have permission to manage rooms for this Branch." });
  try {
    const branch = await Branch.findById(branchId).select("isActive").lean();
    if (!branch || branch.isActive === false) return res.status(400).json({ success: false, message: "Rooms can only be added to an active Branch." });
    const room = await Room.create({ branch: branchId, name: String(name).trim(), createdBy: req.user._id, updatedBy: req.user._id });
    return res.status(201).json({ success: true, room });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A room with this name already exists at this Branch." });
    return res.status(500).json({ success: false, message: "Unable to create room." });
  }
}

async function setRoomStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body || {};
  if (!isValidObjectId(id) || typeof isActive !== "boolean") return res.status(400).json({ success: false, message: "A valid room and active status are required." });
  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ success: false, message: "Room not found." });
  if (!userCanWriteBranch(req, room.branch)) return res.status(403).json({ success: false, message: "You do not have permission to manage this Branch's rooms." });
  if (isActive && !(await Branch.exists({ _id: room.branch, isActive: true }))) return res.status(409).json({ success: false, message: "Activate this Branch before activating its rooms." });
  const lockDays = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, slots: [{ roomId: room._id, isActive: true }] }));
  let release;
  try {
    release = await acquireScheduleResourceLocks({ branchId: room.branch, scheduleDays: lockDays });
    if (!isActive) {
      const schedule = await BranchSchedule.findOne({ branch: room.branch }).select("weeklySchedule").lean();
      const assigned = (schedule?.weeklySchedule || []).some((day) => !day.isClosed && (day.slots || []).some((slot) => slot.isActive !== false && String(slot.roomId || "") === String(room._id)));
      if (assigned) return res.status(409).json({ success: false, message: "This room is assigned to an active recurring slot. Reassign those slots before deactivating it." });
      const datedSchedules = await BranchDateSchedule.find({ branch: room.branch, date: { $gte: formatDate(new Date()) }, isClosed: false }).select("slots").lean();
      const datedAssigned = datedSchedules.some((item) => (item.slots || []).some((slot) => slot.isActive !== false && String(slot.roomId || "") === String(room._id)));
      if (datedAssigned) return res.status(409).json({ success: false, message: "This room is assigned to a future dated session. Reassign that session before deactivating the room." });
    }
    room.isActive = isActive;
    room.updatedBy = req.user._id;
    await room.save();
    return res.json({ success: true, room });
  } catch (error) {
    return res.status(error?.status || 500).json({ success: false, message: error.message || "Unable to update room status." });
  } finally {
    if (release) await release();
  }
}

function resolvedBatchId(slot, existingSlot) {
  return slot && Object.prototype.hasOwnProperty.call(slot, "batchId")
    ? slot.batchId || null
    : existingSlot?.batchId || null;
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
  const submittedBatchIds = [];
  const submittedRoomIds = [];
  const assignedCoachIds = [];
  for (const day of weeklySchedule) for (const slot of (day.isClosed ? [] : day.slots || [])) {
    const existingSlot = existingSlots.get(String(slot?._id || ""));
    const batchId = resolvedBatchId(slot, existingSlot);
    if (slot?.sessionTypeId != null) submittedIds.push(String(slot.sessionTypeId));
    else if (!batchId && !existingSlot?.sessionTypeId) return { valid: false, message: "Select a training session type for every new session." };
    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) return { valid: false, message: "Invalid Batch reference." };
      submittedBatchIds.push(String(batchId));
    }
    const roomId = slot?.roomId !== undefined ? slot.roomId : existingSlot?.roomId;
    if (roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) return { valid: false, message: "Invalid room reference." };
      submittedRoomIds.push(String(roomId));
    }
    const coachId = slot?.coach || existingSlots.get(String(slot?._id || ""))?.coach;
    if (coachId) {
      if (!mongoose.Types.ObjectId.isValid(coachId)) return { valid: false, message: "Invalid coach assignment." };
      assignedCoachIds.push(String(coachId));
    }
  }
  const uniqueBatchIds = [...new Set(submittedBatchIds)];
  const batchDocs = await Batch.find({ branch: branchId, $or: [{ _id: { $in: uniqueBatchIds } }, { status: "ACTIVE" }] }).populate("plan", "classesPerWeek programs isActive").lean();
  const batchesById = new Map(batchDocs.map((batch) => [String(batch._id), batch]));
  if (uniqueBatchIds.some((id) => !batchesById.has(id))) return { valid: false, message: "A selected Batch does not belong to this branch." };
  const batchDefaultRoomIds = [];
  for (const day of weeklySchedule) {
    if (day.isClosed) continue;
    for (const slot of day.slots || []) {
      if (slot.roomId || !slot.batchId) continue;
      const roomId = String(batchesById.get(String(slot.batchId))?.roomId || "");
      if (roomId) batchDefaultRoomIds.push(roomId);
    }
  }
  const roomIdsToValidate = [...new Set([...submittedRoomIds, ...batchDefaultRoomIds])];
  const activeRooms = roomIdsToValidate.length ? await Room.find({ _id: { $in: roomIdsToValidate }, branch: branchId, isActive: true }).select("_id name").lean() : [];
  const activeRoomIds = new Set(activeRooms.map((room) => String(room._id)));
  if (activeRoomIds.size !== roomIdsToValidate.length) return { valid: false, message: "Choose active rooms belonging to this Branch." };
  for (const day of weeklySchedule) for (const slot of (day.isClosed ? [] : day.slots || [])) {
    const existingSlot = existingSlots.get(String(slot?._id || ""));
    const batchId = resolvedBatchId(slot, existingSlot);
    if (!slot.sessionTypeId && !existingSlot?.sessionTypeId && batchId) {
      const programs = batchesById.get(String(batchId))?.plan?.programs || [];
      if (programs.length === 1) slot.sessionTypeId = String(programs[0].program?._id || programs[0].program);
      else return { valid: false, message: `Choose a Program in the schedule row for this Batch; its Plan contains ${programs.length} Programs and the curriculum cannot be inferred safely.` };
    }
    const programId = slot.sessionTypeId || existingSlot?.sessionTypeId;
    if (programId) {
      if (!mongoose.Types.ObjectId.isValid(programId)) return { valid: false, message: "Invalid training session type reference." };
      submittedIds.push(String(programId));
    }
  }
  const typeDocs = submittedIds.length ? await TrainingSessionType.find({ _id: { $in: [...new Set(submittedIds)] } }).select("_id isActive").lean() : [];
  const typesById = new Map(typeDocs.map((type) => [String(type._id), type]));
  if (typesById.size !== new Set(submittedIds).size) return { valid: false, message: "One or more selected training session types no longer exist." };
  const batchOccurrences = new Map();

  for (const day of weeklySchedule) {
    const daySlots = Array.isArray(day.slots) ? day.slots : [];
    for (const slot of daySlots) {
      const id = slot?.sessionTypeId == null ? "" : String(slot.sessionTypeId);
      const batchId = resolvedBatchId(slot, existingSlots.get(String(slot?._id || "")));
      if (id && typesById.get(id)?.isActive === false && (batchId || String(existingSlots.get(String(slot?._id))?.sessionTypeId || "") !== id)) return { valid: false, message: "Inactive training session types cannot be assigned to Batch sessions." };
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
      const batchId = resolvedBatchId(slot, existingSlot);
      const selectedRoomId = slot?.roomId !== undefined ? slot.roomId || (batchId ? batchesById.get(String(batchId))?.roomId : null) : existingSlot?.roomId || (batchId ? batchesById.get(String(batchId))?.roomId : null);
      if (batchId) {
        const batch = batchesById.get(String(batchId));
        if (!batch || !batch.plan || batch.plan.isActive === false || batch.status === "INACTIVE") return { valid: false, message: "The selected Batch or its Plan is inactive." };
        const programId = String(slot?.sessionTypeId || existingSlot?.sessionTypeId || "");
        if (!programId || !(batch.plan.programs || []).some((item) => String(item.program?._id || item.program) === programId)) return { valid: false, message: "Every Batch occurrence must use a Program included in its Plan." };
        if (!selectedRoomId) return { valid: false, message: `Assign an active Branch room to ${batch.name} before saving its recurring session.` };
        if (!activeRoomIds.has(String(selectedRoomId))) return { valid: false, message: `The room assigned to ${batch.name} is inactive or belongs to another Branch.` };
        if (!batchOccurrences.has(String(batchId))) batchOccurrences.set(String(batchId), []);
        if (slot?.isActive !== false && !day.isClosed) batchOccurrences.get(String(batchId)).push(String(slot?._id || ""));
      }
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
        batchId,
        room: String(slot?.room ?? existingSlot?.room ?? "").trim(),
        roomId: selectedRoomId || null,
        startTime,
        endTime,
        isActive: slot?.isActive !== false,
        capacity,
        coach: slot?.coach || existingSlot?.coach || null,
      });
    }

    day.slots = normalizedSlots;
  }

  for (const [batchId, slots] of batchOccurrences) {
    const batch = batchesById.get(batchId);
    const required = Number(batch.plan.classesPerWeek);
    if (batch.status === "ACTIVE" && (!Number.isInteger(required) || slots.length !== required)) return { valid: false, message: `${batch.name} must have exactly ${required} active weekly occurrences before its schedule can be saved.` };
    const persistedSlotIds = slots.filter(Boolean);
    if (new Set(persistedSlotIds).size !== persistedSlotIds.length) return { valid: false, message: `${batch.name} cannot use the same schedule slot more than once.` };
  }
  for (const batch of batchDocs.filter((item) => item.status === "ACTIVE")) {
    const required = Number(batch.plan?.classesPerWeek);
    const configured = batchOccurrences.get(String(batch._id)) || [];
    if (!Number.isInteger(required) || configured.length !== required) return { valid: false, message: `${batch.name} must retain exactly ${required} active weekly occurrences. Pause the Batch before removing its schedule.` };
  }

  const batchCoachById = new Map(batchDocs.map((item) => [String(item._id), String(item.coach || "")]));
  const proposedResources = weeklySchedule.flatMap((day) => (day.isClosed ? [] : (day.slots || [])
    .filter((slot) => slot.isActive !== false)
    .map((slot) => ({ branchId: String(branchId), slotId: String(slot._id || ""), dayOfWeek: day.dayOfWeek, dayName: DAY_NAMES[day.dayOfWeek], startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId, roomName: activeRooms.find((room) => String(room._id) === String(slot.roomId))?.name, coachId: String(slot.coach || batchCoachById.get(String(slot.batchId || "")) || "") }))));
  const currentCoachIds = [...new Set(proposedResources.map((item) => item.coachId).filter(Boolean))];
  if (currentCoachIds.length) {
    const coaches = await User.find({ _id: { $in: currentCoachIds }, role: "COACH", branch: branchId, isActive: true }).select("_id name").lean();
    if (coaches.length !== currentCoachIds.length) return { valid: false, message: "Every assigned coach must be active and belong to this Branch." };
    const foreignSchedules = await BranchSchedule.find({ branch: { $ne: branchId } }).select("branch weeklySchedule").lean();
    const foreignOverrides = await BranchDateSchedule.find({ branch: { $ne: branchId }, date: { $gte: formatDate(new Date()) }, isClosed: false }).select("branch date slots").lean();
    const foreignBatchIds = [...new Set([
      ...foreignSchedules.flatMap((schedule) => (schedule.weeklySchedule || []).flatMap((day) => (day.slots || []).map((slot) => String(slot.batchId || "")).filter(Boolean))),
      ...foreignOverrides.flatMap((override) => (override.slots || []).map((slot) => String(slot.batchId || "")).filter(Boolean)),
    ])];
    const foreignBatches = foreignBatchIds.length ? await Batch.find({ _id: { $in: foreignBatchIds } }).select("_id coach").lean() : [];
    const foreignCoachByBatch = new Map(foreignBatches.map((batch) => [String(batch._id), String(batch.coach || "")]));
    const foreignResources = [];
    for (const schedule of foreignSchedules) {
      for (const day of schedule.weeklySchedule || []) {
        if (day.isClosed) continue;
        for (const slot of day.slots || []) {
          if (slot.isActive === false) continue;
          foreignResources.push({ branchId: String(schedule.branch), slotId: String(slot._id || ""), dayOfWeek: day.dayOfWeek, dayName: DAY_NAMES[day.dayOfWeek], startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId, coachId: String(slot.coach || foreignCoachByBatch.get(String(slot.batchId || "")) || "") });
        }
      }
    }
    for (const override of foreignOverrides) {
      const overrideDay = new Date(`${override.date}T12:00:00`).getDay();
      for (const slot of override.slots || []) {
        if (slot.isActive === false) continue;
        foreignResources.push({ branchId: String(override.branch), slotId: String(slot._id || ""), dayOfWeek: overrideDay, dayName: DAY_NAMES[overrideDay], startTime: slot.startTime, endTime: slot.endTime, active: true, batchId: slot.batchId, roomId: slot.roomId, coachId: String(slot.coach || foreignCoachByBatch.get(String(slot.batchId || "")) || "") });
      }
    }
    const conflict = findRecurringConflict({ proposed: proposedResources, existing: [...proposedResources, ...foreignResources] });
    if (conflict) return { valid: false, message: conflict };
  } else {
    const conflict = findRecurringConflict({ proposed: proposedResources, existing: proposedResources });
    if (conflict) return { valid: false, message: conflict };
  }

  if (currentCoachIds.length) {
    const coachIds = currentCoachIds;
    const coaches = await User.find({ _id: { $in: coachIds }, role: "COACH", branch: branchId, isActive: true }).select("_id name").lean();
    const coachById = new Map(coaches.map((coach) => [String(coach._id), coach]));
    if (coachById.size !== coachIds.length) return { valid: false, message: "Choose active coaches assigned to this branch." };
    const availabilityRecords = await CoachAvailability.find({ coach: { $in: coachIds }, branch: branchId }).lean();
    const availabilityByCoach = new Map(availabilityRecords.map((item) => [String(item.coach), item]));
    for (const day of weeklySchedule) for (const slot of day.slots || []) {
      const coachId = String(slot.coach || batchCoachById.get(String(slot.batchId || "")) || "");
      if (!coachId || slot.isActive === false || day.isClosed) continue;
      const coachName = coachById.get(coachId)?.name || "The coach";
      const availability = availabilityByCoach.get(coachId);
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

      noTrainingDays: days.filter((day) => ["NO_ACTIVE_SLOTS", "BATCH_OUTSIDE_DATE_RANGE", "BATCH_NOT_ACTIVE"].includes(day.reason))
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

      noTrainingDays: days.filter((day) => ["NO_ACTIVE_SLOTS", "BATCH_OUTSIDE_DATE_RANGE"].includes(day.reason))
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
      .populate("weeklySchedule.slots.roomId", "_id name isActive")
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
  let releaseResourceLocks = null;
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
    releaseResourceLocks = await acquireScheduleResourceLocks({ branchId, scheduleDays: req.body?.weeklySchedule || [], existingDays: existingSchedule?.weeklySchedule || [] });
    const allowCapacityOverride = req.user.role === "SUPER_ADMIN" || (req.user.permissions || []).includes("branch_schedule.capacity.override");
    const validation = await validateSchedulePayload(req.body, existingSchedule, branchId, allowCapacityOverride);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const { openingTime, closingTime, weeklySchedule } = validation;

    if (existingSchedule) {
      const oldSlots = new Map();
      const newSlots = new Map();
      for (const day of existingSchedule.weeklySchedule || []) for (const slot of day.slots || []) oldSlots.set(String(slot._id), { slot, dayOfWeek: day.dayOfWeek });
      for (const day of weeklySchedule || []) for (const slot of day.slots || []) newSlots.set(String(slot._id), { slot, dayOfWeek: day.dayOfWeek });
      for (const [slotId, previous] of oldSlots) {
        const next = newSlots.get(slotId);
        const lifecycleChanged = !next || String(previous.slot.batchId || "") !== String(next.slot.batchId || "") || Number(previous.dayOfWeek) !== Number(next.dayOfWeek);
        if (!lifecycleChanged) continue;
        const hasSessionHistory = await Session.exists({ branch: branchId, scheduleSlotId: slotId });
        const hasAttendanceHistory = await Attendance.exists({ branch: branchId, sessionSlotId: slotId });
        if (hasSessionHistory || hasAttendanceHistory) {
          return res.status(409).json({ success: false, message: `This recurring slot has dated Session or attendance history and cannot be removed, moved, or reassigned. Keep the slot for its history and create a separate recurring slot for the new assignment.` });
        }
      }
    }

    const scheduleQuery = existingSchedule
      ? { branch: branchId, updatedAt: existingSchedule.updatedAt }
      : { branch: branchId };
    const schedule = await BranchSchedule.findOneAndUpdate(
      scheduleQuery,
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
        upsert: !existingSchedule,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).populate("updatedBy", "name email role");
    if (!schedule) return res.status(409).json({ success: false, message: "The Branch schedule changed while you were editing it. Refresh and review the latest room and coach availability." });
    try { await reconcileFutureSessionsForBranch(branch._id, schedule.toObject()); }
    catch (syncError) { console.error("Future Batch Sessions could not be reconciled after schedule save", { name: syncError?.name || "Error" }); }

    return res.status(200).json({
      success: true,
      message: "Branch training schedule saved successfully.",
      schedule: serializeSchedule(schedule.toObject()),
    });
  } catch (error) {
    console.error("Save branch schedule error:", error);

    if (error?.status === 409) return res.status(409).json({ success: false, message: error.message });
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "The Branch schedule changed during this save. Refresh and try again." });

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
  } finally {
    if (releaseResourceLocks) {
      try { await releaseResourceLocks(); }
      catch (error) { console.error("Unable to release schedule resource locks", { name: error?.name || "Error" }); }
    }
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

    if (await Session.exists({ branch: branchId }) || await Attendance.exists({ branch: branchId, sessionSlotId: { $ne: null } })) return res.status(409).json({ success: false, message: "This Branch has dated Session or attendance history. Disable or update individual recurring slots instead of deleting the schedule." });
    if (await Batch.exists({ branch: branchId, status: "ACTIVE" })) return res.status(409).json({ success: false, message: "Pause active Batches before resetting the Branch schedule." });

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

const setTrainingSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, reason = "", occurrence } = req.body || {};
    if ((!isValidObjectId(sessionId) && !occurrence) || !["CLOSED", "SCHEDULED"].includes(status)) return res.status(400).json({ success: false, message: "Choose a valid Session occurrence and status (CLOSED or SCHEDULED)." });
    if (status === "CLOSED" && !String(reason).trim()) return res.status(400).json({ success: false, message: "A reason is required when closing a Session." });
    let current = isValidObjectId(sessionId) ? await Session.findById(sessionId).lean() : null;
    if (!current && occurrence) {
      const { branchId, date, slotId, batchId } = occurrence;
      if (!isValidObjectId(branchId) || !isValidObjectId(slotId) || !isValidObjectId(batchId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !parseCalendarDate(date)) return res.status(400).json({ success: false, message: "The scheduled occurrence details are invalid." });
      if (!userCanWriteBranch(req, branchId)) return res.status(403).json({ success: false, message: "You do not have permission to manage this Branch Session." });
      const datedOverride = await BranchDateSchedule.findOne({ branch: branchId, date }).lean();
      let slot = datedOverride ? (!datedOverride.isClosed ? (datedOverride.slots || []).find((item) => String(item._id) === String(slotId)) : null) : null;
      if (!datedOverride) {
        const schedule = await BranchSchedule.findOne({ branch: branchId }).lean();
        const weekday = parseCalendarDate(date).getDay();
        slot = (schedule?.weeklySchedule || []).find((item) => Number(item.dayOfWeek) === weekday && !item.isClosed)?.slots?.find((item) => String(item._id) === String(slotId));
      }
      if (!slot || String(slot.batchId || "") !== String(batchId)) return res.status(404).json({ success: false, message: "This scheduled Batch occurrence is no longer available. Refresh the calendar." });
      current = await Session.findOne({ batch: batchId, date, scheduleSlotId: slotId }).lean();
      if (!current) current = await resolveSessionForSlot({ branchId, date, slot });
      if (!current) return res.status(409).json({ success: false, message: "This occurrence is unavailable because its Batch dates, schedule, or resources are no longer valid." });
      current = current.toObject ? current.toObject() : current;
    }
    if (!current) return res.status(404).json({ success: false, message: "Session not found." });
    if (!userCanWriteBranch(req, current.branch)) return res.status(403).json({ success: false, message: "You do not have permission to manage this Branch Session." });
    if (current.status === status) {
      await require("../services/batchCompletion.service").recalculateBatchCompletionsForBranch(current.branch);
      const batch = await Batch.findById(current.batch).select("calculatedEndDate capacityIssue").lean();
      return res.json({ success: true, session: current, batch, message: "Session status was already current; Batch completion was reconciled." });
    }
    if (status === "CLOSED" && current.date < formatDate(new Date())) return res.status(409).json({ success: false, message: "Historical Sessions cannot be closed; preserve their Session and attendance history." });
    if (status === "CLOSED" && await Attendance.exists({ session: current._id })) return res.status(409).json({ success: false, message: "This Session has attendance history and cannot be closed. Correct its attendance through the attendance workflow." });
    if (["COMPLETED", "CANCELLED"].includes(current.status)) return res.status(409).json({ success: false, message: "Completed or cancelled Sessions cannot be closed or reopened." });
    if ((status === "CLOSED" && current.status !== "SCHEDULED") || (status === "SCHEDULED" && current.status !== "CLOSED")) return res.status(409).json({ success: false, message: "The Session status changed. Refresh and try again." });
    const next = await Session.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: status === "CLOSED" ? { status, closureReason: String(reason).trim().slice(0, 500), closedAt: new Date(), closedBy: req.user._id } : { status, closureReason: "", closedAt: null, closedBy: null } },
      { new: true, runValidators: true },
    ).lean();
    if (!next) return res.status(409).json({ success: false, message: "The Session status changed. Refresh and try again." });
    const action = status === "CLOSED" ? AUDIT_ACTIONS.SESSION_CLOSED : AUDIT_ACTIONS.SESSION_REOPENED;
    await auditService.record({ req, action, entityType: "SESSION", entityId: current._id, branchId: current.branch, before: { status: current.status, closureReason: current.closureReason || "" }, after: { status: next.status, closureReason: next.closureReason || "" } });
    await require("../services/batchCompletion.service").recalculateBatchCompletionsForBranch(current.branch);
    const batch = await Batch.findById(current.batch).select("calculatedEndDate capacityIssue").lean();
    return res.json({ success: true, session: next, batch, message: batch?.capacityIssue || (status === "CLOSED" ? "Session closed. Batch completion was recalculated." : "Session reopened. Batch completion was recalculated.") });
  } catch (error) {
    console.error("Update training Session status failed", { name: error?.name || "Error" });
    return res.status(500).json({ success: false, message: "Session status was not fully processed. Refresh the Batch schedule and retry recalculation." });
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
  listRooms,
  createRoom,
  setRoomStatus,
  setTrainingSessionStatus,
  upsertBranchSchedule,
  deleteBranchSchedule,
  formatTimeForDisplay,
  validateSchedulePayload,
};
