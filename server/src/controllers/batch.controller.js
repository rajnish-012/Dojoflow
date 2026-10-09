const mongoose = require("mongoose");
const Batch = require("../models/Batch");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const Student = require("../models/Student");
const BranchSchedule = require("../models/BranchSchedule");
const User = require("../models/User");
const TrainingSessionType = require("../models/TrainingSessionType");
const Room = require("../models/Room");
const { inspectBatchOccurrences } = require("../services/batchSchedule.service");
const { reconcileFutureSessionsForBranch } = require("../services/session.service");
const { formatDate } = require("../services/branchSchedule.service");
const { acquireScheduleResourceLocks } = require("../services/scheduleResourceLock.service");
const { roomAssignmentError } = require("../services/schedulingConflict.service");
const { calculateBatchCompletion } = require("../services/batchCompletion.service");

const validId = mongoose.Types.ObjectId.isValid;
const branchIdOf = (user) => String(user?.branch?._id || user?.branch || "");
const canSeeBranch = (user, branchId) => user?.role === "SUPER_ADMIN" || user?.dataScope === "ALL" || branchIdOf(user) === String(branchId);
const canManage = (user) => user?.role === "SUPER_ADMIN" || user?.permissions?.includes("plan.manage");
async function validateCoach(coachId, branchId) {
  if (!coachId) return null;
  if (!validId(coachId)) return false;
  const coach = await User.findOne({ _id: coachId, role: "COACH", branch: branchId, isActive: true }).select("_id").lean();
  return coach?._id || false;
}
async function occupiedSeats(batchId, asOf = new Date()) {
  const students = await Student.find({ "planEnrollments.batch": batchId }).select("planEnrollments").lean();
  const day = new Date(asOf); day.setHours(23, 59, 59, 999);
  return students.reduce((count, student) => count + (student.planEnrollments || []).filter((enrollment) =>
    String(enrollment.batch || "") === String(batchId) && enrollment.status === "ACTIVE" &&
    new Date(enrollment.startDate) <= day && (!enrollment.endDate || new Date(enrollment.endDate) >= new Date(asOf).setHours(0, 0, 0, 0)),
  ).length, 0);
}

async function listBatches(req, res) {
  const readable = req.user?.role === "SUPER_ADMIN" || (req.user?.permissions || []).some((permission) => ["plan.view", "branch_schedule.view", "membership.view", "membership.manage"].includes(permission));
  if (!readable) return res.status(403).json({ success: false, message: "You do not have permission to view Batches." });
  try {
    const branch = req.query.branch || branchIdOf(req.user);
    if (branch && !canSeeBranch(req.user, branch)) return res.status(403).json({ success: false, message: "You do not have access to this branch." });
    const filter = branch ? { branch } : (req.user?.dataScope === "ALL" || req.user?.role === "SUPER_ADMIN" ? {} : { branch: branchIdOf(req.user) });
    const batches = await Batch.find(filter).populate({ path: "plan", select: "name classesPerWeek programs isActive", populate: { path: "programs.program", select: "name isActive" } }).populate("branch", "name isActive").populate("coach", "name isActive branch").populate("roomId", "name isActive").sort({ branch: 1, name: 1 }).lean();
    const branchIds = [...new Set(batches.map((batch) => String(batch.branch?._id || batch.branch)))];
    const [schedules, programs, rooms] = await Promise.all([
      BranchSchedule.find({ branch: { $in: branchIds } }).select("branch openingTime closingTime weeklySchedule").lean(),
      TrainingSessionType.find({}).select("_id name isActive").lean(),
      Room.find({ branch: { $in: branchIds } }).select("_id name branch isActive").lean(),
    ]);
    const scheduleByBranch = new Map(schedules.map((schedule) => [String(schedule.branch), schedule]));
    const programById = new Map(programs.map((program) => [String(program._id), program]));
    const roomsById = new Map(rooms.map((room) => [String(room._id), room]));
    const coachIds = [...new Set(schedules.flatMap((schedule) => (schedule.weeklySchedule || []).flatMap((day) => (day.slots || []).map((slot) => slot.coach).filter(Boolean).map(String))))];
    const slotCoaches = coachIds.length ? await User.find({ _id: { $in: coachIds } }).select("_id name").lean() : [];
    const coachById = new Map(slotCoaches.map((coach) => [String(coach._id), coach.name]));
    const output = await Promise.all(batches.map(async (batch) => {
      const occupied = await occupiedSeats(batch._id);
      const schedule = scheduleByBranch.get(String(batch.branch?._id || batch.branch));
      const planPrograms = batch.plan?.programs || [];
      const activeProgramIds = planPrograms.map((entry) => entry.program?._id || entry.program).filter((id) => id && programById.get(String(id))?.isActive !== false);
      const inspected = inspectBatchOccurrences({ weeklySchedule: schedule?.weeklySchedule || [], batchId: batch._id, allowedProgramIds: activeProgramIds, openingTime: schedule?.openingTime, closingTime: schedule?.closingTime, requireRoom: true, defaultRoomId: batch.roomId });
      const weeklySessions = (schedule?.weeklySchedule || []).flatMap((day) => (day.slots || [])
        .filter((slot) => String(slot.batchId || "") === String(batch._id))
        .map((slot) => ({ dayOfWeek: day.dayOfWeek, dayClosed: Boolean(day.isClosed), _id: slot._id, name: slot.sessionName || "Training Session", startTime: slot.startTime, endTime: slot.endTime, active: slot.isActive !== false, program: programById.get(String(slot.sessionTypeId || ""))?.name || "Program unavailable", room: slot.roomId ? roomsById.get(String(slot.roomId))?.name || "Room unavailable" : batch.roomId?.name || batch.room || "Room not assigned", coach: slot.coach ? coachById.get(String(slot.coach)) || "Unavailable" : batch.coach?.name || null })));
      return { ...batch, occupiedSeats: occupied, availableSeats: Math.max(0, batch.capacity - occupied), weeklySessions, configuredSessions: inspected.count, requiredSessions: Number(batch.plan?.classesPerWeek) || 0 };
    }));
    return res.json({ success: true, batches: output });
  } catch (error) {
    console.error("List Batches failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to load Batches." });
  }
}

async function listBatchCoaches(req, res) {
  if (!canManage(req.user)) return res.status(403).json({ success: false, message: "Plan management permission is required." });
  const branchId = req.query.branch;
  if (!validId(branchId)) return res.status(400).json({ success: false, message: "A valid Branch is required to list coaches." });
  if (!canSeeBranch(req.user, branchId)) return res.status(403).json({ success: false, message: "You do not have access to this branch." });
  try {
    const coaches = await User.find({ branch: branchId, role: "COACH", isActive: true }).select("_id name").sort({ name: 1 }).lean();
    return res.json({ success: true, coaches });
  } catch (error) {
    console.error("List Batch coaches failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to load Branch coaches." });
  }
}

async function createBatch(req, res) {
  if (!canManage(req.user)) return res.status(403).json({ success: false, message: "Plan management permission is required." });
  const { name, code, plan: planId, branch: branchId, capacity, coach = null, roomId = null, room = "", startDate, effectiveFrom = null, effectiveUntil = null } = req.body || {};
  if (!name?.trim() || !code?.trim() || !validId(planId) || !validId(branchId) || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 1000) return res.status(400).json({ success: false, message: "Batch name, code, Plan, Branch, and a capacity from 1 to 1000 are required." });
  if (!canSeeBranch(req.user, branchId)) return res.status(403).json({ success: false, message: "You do not have access to this branch." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) return res.status(400).json({ success: false, message: "A valid Batch start date is required." });
  if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) return res.status(400).json({ success: false, message: "Batch end date must be on or after its start date." });
  try {
    const [plan, branch, validCoach] = await Promise.all([Plan.findById(planId).select("isActive classesPerWeek programs"), Branch.findById(branchId).select("isActive"), validateCoach(coach, branchId)]);
    if (!plan || plan.isActive === false) return res.status(400).json({ success: false, message: "Choose an active Plan." });
    if (!branch || branch.isActive === false) return res.status(400).json({ success: false, message: "Choose an active Branch." });
    if (coach && !validCoach) return res.status(400).json({ success: false, message: "Choose an active Coach assigned to this Branch." });
    const validRoom = roomId ? await Room.findById(roomId).select("_id branch name isActive").lean() : null;
    const roomError = roomId ? roomAssignmentError(validRoom, branchId) : "";
    if (roomError) return res.status(400).json({ success: false, message: roomError });
    const batch = await Batch.create({ name: name.trim(), code: code.trim().toUpperCase(), plan: planId, branch: branchId, capacity: Number(capacity), coach: validCoach || null, roomId: validRoom?._id || null, room: String(room).trim(), startDate, effectiveFrom, effectiveUntil, createdBy: req.user._id, updatedBy: req.user._id, status: "DRAFT" });
    return res.status(201).json({ success: true, batch, message: "Batch created. Assign its recurring slots in the Branch schedule before activating it." });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That Batch code is already used at this Branch." });
    console.error("Create Batch failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to create Batch." });
  }
}

async function updateBatch(req, res) {
  if (!canManage(req.user)) return res.status(403).json({ success: false, message: "Plan management permission is required." });
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid Batch ID." });
  let releaseResourceLocks = null;
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });
    if (!canSeeBranch(req.user, batch.branch)) return res.status(403).json({ success: false, message: "You do not have access to this branch." });
    const { name, code, capacity, coach, roomId, room, effectiveFrom, effectiveUntil, startDate, status } = req.body || {};
    const scheduleForLocks = await BranchSchedule.findOne({ branch: batch.branch }).select("weeklySchedule").lean();
    const previousDays = [];
    const nextDays = [];
    for (const day of scheduleForLocks?.weeklySchedule || []) {
      const slots = (day.slots || []).filter((slot) => String(slot.batchId || "") === String(batch._id));
      if (!slots.length) continue;
      previousDays.push({ dayOfWeek: day.dayOfWeek, isClosed: day.isClosed, slots });
      nextDays.push({ dayOfWeek: day.dayOfWeek, isClosed: day.isClosed, slots: slots.map((slot) => ({ ...slot, roomId: slot.roomId || (roomId === undefined ? batch.roomId : roomId), coach: slot.coach || (coach === undefined ? batch.coach : coach) })) });
    }
    releaseResourceLocks = await acquireScheduleResourceLocks({ branchId: batch.branch, scheduleDays: nextDays, existingDays: previousDays });
    const validCoach = coach === undefined ? batch.coach : await validateCoach(coach, batch.branch);
    if (coach !== undefined && coach && !validCoach) return res.status(400).json({ success: false, message: "Choose an active Coach assigned to this Branch, or clear the selection." });
    const validRoom = roomId === undefined || !roomId ? null : await Room.findById(roomId).select("_id branch name isActive").lean();
    const roomError = roomId ? roomAssignmentError(validRoom, batch.branch) : "";
    if (roomError) return res.status(400).json({ success: false, message: roomError });
    if (capacity !== undefined && (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 1000)) return res.status(400).json({ success: false, message: "Capacity must be a whole number from 1 to 1000." });
    const occupied = await occupiedSeats(batch._id);
    const nextCapacity = capacity === undefined ? batch.capacity : Number(capacity);
    const nextFrom = effectiveFrom === undefined ? batch.effectiveFrom : effectiveFrom || null;
    const nextUntil = effectiveUntil === undefined ? batch.effectiveUntil : effectiveUntil || null;
    const nextStartDate = startDate === undefined ? batch.startDate : startDate || null;
    if (nextStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextStartDate)) return res.status(400).json({ success: false, message: "Batch start date must be a valid calendar date." });
    if (!nextStartDate) return res.status(400).json({ success: false, message: "A Batch start date is required." });
    if (nextFrom && nextUntil && nextUntil < nextFrom) return res.status(400).json({ success: false, message: "Batch end date must be on or after its start date." });
    if (nextCapacity < occupied) return res.status(409).json({ success: false, message: `Capacity cannot be below the ${occupied} active enrollments assigned to this Batch.` });
    const nextStatus = status === undefined ? batch.status : status;
    if (!["DRAFT", "ACTIVE", "PAUSED", "INACTIVE"].includes(nextStatus)) return res.status(400).json({ success: false, message: "Invalid Batch status." });
    if (nextStatus === "ACTIVE") {
      const [plan, schedule, branch] = await Promise.all([Plan.findById(batch.plan).select("isActive classesPerWeek programs"), BranchSchedule.findOne({ branch: batch.branch }).lean(), Branch.findById(batch.branch).select("isActive openingTime closingTime")]);
      if (!plan || plan.isActive === false) return res.status(409).json({ success: false, message: "An active Plan is required to activate a Batch." });
      if (!branch || branch.isActive === false) return res.status(409).json({ success: false, message: "An active Branch is required to activate a Batch." });
      if (batch.coach && !(await validateCoach(batch.coach, batch.branch))) return res.status(409).json({ success: false, message: "The assigned Coach is no longer active at this Branch. Assign a valid Coach or clear the assignment." });
      if (!Number.isInteger(Number(batch.capacity)) || batch.capacity < 1) return res.status(409).json({ success: false, message: "Batch capacity must be a positive whole number." });
      if (batch.effectiveFrom && batch.effectiveUntil && batch.effectiveUntil < batch.effectiveFrom) return res.status(409).json({ success: false, message: "Batch effective dates are invalid." });
      if (batch.effectiveUntil && batch.effectiveUntil < formatDate(new Date())) return res.status(409).json({ success: false, message: "The Batch effective period has ended; update its dates before activation." });
      if (!Number.isInteger(Number(plan.classesPerWeek)) || Number(plan.classesPerWeek) < 1) return res.status(409).json({ success: false, message: "Set a valid weekly session count on the Plan before activating this Batch." });
      const planProgramIds = (plan.programs || []).map((item) => item.program);
      const activePrograms = await TrainingSessionType.find({ _id: { $in: planProgramIds }, isActive: true }).select("_id").lean();
      const inspected = inspectBatchOccurrences({ weeklySchedule: schedule?.weeklySchedule || [], batchId: batch._id, allowedProgramIds: activePrograms.map((item) => item._id), openingTime: schedule?.openingTime, closingTime: schedule?.closingTime, requireRoom: true, defaultRoomId: batch.roomId });
      if (inspected.errors.length) return res.status(409).json({ success: false, message: inspected.errors[0] });
      const roomIds = [...new Set(inspected.occurrences.map((slot) => String(slot.roomId || batch.roomId || "")).filter(Boolean))];
      const validRooms = await Room.find({ _id: { $in: roomIds }, branch: batch.branch, isActive: true }).select("_id").lean();
      if (validRooms.length !== roomIds.length) return res.status(409).json({ success: false, message: "Every Batch session must use an active room assigned to this Branch." });
      if (inspected.count !== Number(plan.classesPerWeek)) return res.status(409).json({ success: false, message: `Assign exactly ${plan.classesPerWeek} valid weekly sessions to this Batch; ${inspected.count} are configured.` });
      try {
        const completion = await calculateBatchCompletion(batch._id, { startDate: nextStartDate });
        batch.calculatedEndDate = completion.calculatedEndDate;
        batch.capacityIssue = "";
      } catch (completionError) {
        return res.status(409).json({ success: false, message: completionError.message });
      }
    }
    if (name !== undefined) batch.name = String(name).trim();
    if (code !== undefined) batch.code = String(code).trim().toUpperCase();
    batch.capacity = nextCapacity;
    if (coach !== undefined) batch.coach = validCoach || null;
    if (roomId !== undefined) batch.roomId = validRoom?._id || null;
    if (room !== undefined) batch.room = String(room).trim();
    if (effectiveFrom !== undefined) batch.effectiveFrom = nextFrom;
    if (effectiveUntil !== undefined) batch.effectiveUntil = nextUntil;
    batch.startDate = nextStartDate;
    if (nextStatus !== "ACTIVE") batch.calculatedEndDate = null;
    batch.status = nextStatus;
    batch.updatedBy = req.user._id;
    await batch.save();
    try { await reconcileFutureSessionsForBranch(batch.branch); }
    catch (syncError) { console.error("Future Batch Sessions could not be reconciled after Batch update", { name: syncError?.name || "Error" }); }
    return res.json({ success: true, batch, occupiedSeats: occupied, availableSeats: Math.max(0, batch.capacity - occupied) });
  } catch (error) {
    if (error?.status === 409) return res.status(409).json({ success: false, message: error.message });
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That Batch code is already used at this Branch." });
    console.error("Update Batch failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to update Batch." });
  } finally {
    if (releaseResourceLocks) {
      try { await releaseResourceLocks(); }
      catch (error) { console.error("Unable to release Batch schedule resource locks", { name: error?.name || "Error" }); }
    }
  }
}

module.exports = { listBatches, listBatchCoaches, createBatch, updateBatch, occupiedSeats };
