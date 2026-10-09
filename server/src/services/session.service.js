const Batch = require("../models/Batch");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const BranchSchedule = require("../models/BranchSchedule");
const { formatDate, parseCalendarDate, getHolidayForBranchDate } = require("./branchSchedule.service");
const { findDatedSessionConflict } = require("./schedulingConflict.service");
const refId = (value) => String(value?._id || value || "");

function dateList(start, end) {
  const first = parseCalendarDate(start);
  const last = parseCalendarDate(end);
  if (!first || !last || first > last) return [];
  const dates = [];
  for (const current = new Date(first); current <= last; current.setDate(current.getDate() + 1)) dates.push(formatDate(new Date(current)));
  return dates;
}

function buildSessionFields({ branch, branchId, schedule, batch, slot, date, dayOfWeek }) {
  return {
    batch: batch._id,
    branch: branch?._id || branchId,
    plan: batch.plan._id || batch.plan,
    program: slot.sessionTypeId,
    schedule: schedule._id,
    scheduleSlotId: slot._id,
    date,
    dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    sessionName: slot.sessionName || batch.name,
    coach: slot.coach || batch.coach || null,
    roomId: slot.roomId || batch.roomId || null,
    room: slot.room || batch.room || "",
    capacity: batch.capacity,
  };
}

function generateSessionOccurrences({ branches, schedules, overrides = [], holidays = [], batches, start, end }) {
  const scheduleByBranch = new Map(schedules.map((item) => [String(item.branch?._id || item.branch), item]));
  const overrideByDate = new Map(overrides.map((item) => [`${String(item.branch?._id || item.branch)}:${item.date}`, item]));
  const holidayKeys = new Set(holidays.map((item) => `${String(item.branch?._id || item.branch || "*")}:${formatDate(item.date)}`));
  const batchById = new Map(batches.map((item) => [String(item._id), item]));
  const occurrences = [];
  for (const branch of branches) {
    const branchId = String(branch._id);
    const schedule = scheduleByBranch.get(branchId);
    for (const date of dateList(start, end)) {
      if (holidayKeys.has(`*:${date}`) || holidayKeys.has(`${branchId}:${date}`)) continue;
      const override = overrideByDate.get(`${branchId}:${date}`);
      if (override?.isClosed) continue;
      const dayOfWeek = parseCalendarDate(date).getDay();
      const weeklyDay = schedule?.weeklySchedule?.find((item) => Number(item.dayOfWeek) === dayOfWeek);
      if (!override && weeklyDay?.isClosed) continue;
      const slots = override ? (override.slots || []) : (weeklyDay?.slots || []);
      for (const slot of slots) {
        if (!slot || slot.isActive === false || !slot.batchId || !slot.sessionTypeId || !slot.startTime || !slot.endTime) continue;
        const batch = batchById.get(String(slot.batchId));
        if (!batch || String(batch.branch) !== branchId || batch.status !== "ACTIVE") continue;
        if (!batch.startDate || !batch.calculatedEndDate || date < batch.startDate || date > batch.calculatedEndDate) continue;
        if (!(batch.plan?.programs || []).some((entry) => refId(entry.program) === refId(slot.sessionTypeId))) continue;
        occurrences.push({ branch, schedule, batch, slot, date, dayOfWeek });
      }
    }
  }
  return occurrences;
}

async function resolveBatchSessions({ branches, schedules, overrides, holidays, start, end }) {
  const branchIds = branches.map((item) => item._id);
  const batches = await Batch.find({ branch: { $in: branchIds }, status: "ACTIVE" })
    .populate("plan", "isActive programs")
    .lean();
  const validBatches = batches.filter((item) => item.plan && item.plan.isActive !== false);
  const occurrences = generateSessionOccurrences({ branches, schedules, overrides, holidays, batches: validBatches, start, end });
  const today = formatDate(new Date());
  for (const { branch, schedule, batch, slot, date, dayOfWeek } of occurrences) {
    const fields = buildSessionFields({ branch, schedule, batch, slot, date, dayOfWeek });
    const existing = await Session.findOne({ batch: batch._id, date, scheduleSlotId: slot._id });
    const canWrite = !existing || (date >= today && (existing.status === "SCHEDULED" || (existing.status === "CANCELLED" && ["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"].includes(existing.cancellationSource))));
    if (!canWrite) continue;
    const resourceFilters = [];
    if (fields.roomId) resourceFilters.push({ branch: branch._id, roomId: fields.roomId });
    if (fields.coach) resourceFilters.push({ coach: fields.coach });
    if (fields.batch) resourceFilters.push({ batch: fields.batch });
    const existingResources = resourceFilters.length ? await Session.find({ date, status: { $in: ["SCHEDULED", "COMPLETED"] }, _id: existing?._id ? { $ne: existing._id } : { $exists: true }, $or: resourceFilters }).lean() : [];
    if (findDatedSessionConflict({ branch: fields.branch, batch: fields.batch, roomId: fields.roomId, coach: fields.coach, startTime: fields.startTime, endTime: fields.endTime, date }, existingResources)) continue;
    if (!existing) {
      try { await Session.create({ ...fields, status: "SCHEDULED" }); }
      catch (error) { if (error?.code !== 11000) throw error; }
    } else if (date >= today && (existing.status === "SCHEDULED" || (existing.status === "CANCELLED" && ["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"].includes(existing.cancellationSource)))) {
      existing.set({ ...fields, status: "SCHEDULED", cancellationSource: null });
      await existing.save();
    }
  }
  const dates = dateList(start, end);
  if (!dates.length) return [];
  const sessions = await Session.find({ branch: { $in: branchIds }, date: { $gte: dates[0], $lte: dates[dates.length - 1] } })
    .populate("branch", "name")
    .populate("program", "name")
    .populate("coach", "name")
    .populate("roomId", "name")
    .populate("curriculum", "name version modules")
    .populate("batch", "name code")
    .lean();
  return sessions;
}

async function resolveSessionForSlot({ branchId, date, slot }) {
  if (!slot?.batchId || slot.isActive === false || !date) return null;
  if (await getHolidayForBranchDate(branchId, date)) return null;
  const [batch, schedule] = await Promise.all([
    Batch.findOne({ _id: slot.batchId, branch: branchId, status: "ACTIVE" }).populate("plan", "isActive programs").lean(),
    BranchSchedule.findOne({ branch: branchId }).select("_id").lean(),
  ]);
  if (!batch || !schedule || !batch.plan || batch.plan.isActive === false ||
    (!batch.startDate || !batch.calculatedEndDate || date < batch.startDate || date > batch.calculatedEndDate) ||
    (batch.effectiveFrom && date < batch.effectiveFrom) || (batch.effectiveUntil && date > batch.effectiveUntil) ||
    !(batch.plan.programs || []).some((item) => refId(item.program) === refId(slot.sessionTypeId))) return null;
  const fields = buildSessionFields({ branchId, schedule, batch, slot, date, dayOfWeek: parseCalendarDate(date).getDay() });
  const existing = await Session.findOne({ batch: batch._id, date, scheduleSlotId: slot._id });
  if (existing?.status === "CLOSED") return null;
  if (existing?.status === "CANCELLED" && !["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"].includes(existing.cancellationSource)) return null;
  const resourceFilters = [];
  if (fields.roomId) resourceFilters.push({ branch: branchId, roomId: fields.roomId });
  if (fields.coach) resourceFilters.push({ coach: fields.coach });
  if (fields.batch) resourceFilters.push({ batch: fields.batch });
  const existingResources = resourceFilters.length ? await Session.find({ date, status: { $in: ["SCHEDULED", "COMPLETED"] }, _id: existing?._id ? { $ne: existing._id } : { $exists: true }, $or: resourceFilters }).lean() : [];
  if (findDatedSessionConflict({ branch: fields.branch, batch: fields.batch, roomId: fields.roomId, coach: fields.coach, startTime: fields.startTime, endTime: fields.endTime, date }, existingResources)) return null;
  if (existing) {
    if (existing.status === "CANCELLED" && ["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"].includes(existing.cancellationSource)) { existing.set({ ...fields, status: "SCHEDULED", cancellationSource: null }); await existing.save(); }
    return existing;
  }
  try { return await Session.create({ ...fields, status: "SCHEDULED" }); }
  catch (error) { if (error?.code !== 11000) throw error; return Session.findOne({ batch: batch._id, date, scheduleSlotId: slot._id }); }
}

async function reconcileFutureSessionsForBranch(branchId, schedule = null) {
  const today = formatDate(new Date());
  const target = schedule || await BranchSchedule.findOne({ branch: branchId }).lean();
  const slots = (target?.weeklySchedule || []).flatMap((day) => day.isClosed ? [] : (day.slots || []).filter((slot) => slot.isActive !== false).map((slot) => ({ dayOfWeek: day.dayOfWeek, slot })));
  const batches = await Batch.find({ branch: branchId }).select("_id plan status capacity coach room startDate calculatedEndDate effectiveFrom effectiveUntil").lean();
  const batchById = new Map(batches.map((batch) => [refId(batch._id), batch]));
  const sessions = await Session.find({ branch: branchId, date: { $gte: today }, status: "SCHEDULED" }).lean();
  for (const session of sessions) {
    const match = slots.find(({ dayOfWeek, slot }) => Number(dayOfWeek) === Number(session.dayOfWeek) && refId(slot._id) === refId(session.scheduleSlotId) && refId(slot.batchId) === refId(session.batch));
    if (await Attendance.exists({ session: session._id })) continue;
    const owningBatch = match ? batchById.get(refId(match.slot.batchId)) : null;
    if (!match || owningBatch?.status !== "ACTIVE" || (owningBatch.startDate && (!owningBatch.calculatedEndDate || session.date < owningBatch.startDate || session.date > owningBatch.calculatedEndDate)) || (owningBatch.effectiveFrom && session.date < owningBatch.effectiveFrom) || (owningBatch.effectiveUntil && session.date > owningBatch.effectiveUntil)) {
      await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: { status: "CANCELLED", cancellationSource: "SCHEDULE_CHANGE" } });
      continue;
    }
    const batch = batchById.get(refId(match.slot.batchId));
    await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: {
      plan: batch.plan, program: match.slot.sessionTypeId, startTime: match.slot.startTime, endTime: match.slot.endTime,
      sessionName: match.slot.sessionName || "Training Session", coach: match.slot.coach || batch.coach || null,
      roomId: match.slot.roomId || batch.roomId || null, room: match.slot.room || batch.room || "", capacity: batch.capacity,
    } });
  }
  try { await require("./batchCompletion.service").recalculateBatchCompletionsForBranch(branchId); }
  catch (error) { console.error("Batch completion dates could not be recalculated after schedule change", { name: error?.name || "Error" }); }
  return sessions.length;
}

async function reconcileDateOverrideSessions(branchId, date, override) {
  if (date < formatDate(new Date())) return 0;
  const existing = await Session.find({ branch: branchId, date, status: "SCHEDULED" }).lean();
  const slots = override?.isClosed ? [] : (override?.slots || []);
  const batchIds = [...new Set(slots.map((slot) => refId(slot.batchId)).filter(Boolean))];
  const batches = batchIds.length ? await Batch.find({ _id: { $in: batchIds }, branch: branchId }).select("_id coach roomId room").lean() : [];
  const batchById = new Map(batches.map((batch) => [refId(batch._id), batch]));
  for (const session of existing) {
    const slot = slots.find((item) => refId(item._id) === refId(session.scheduleSlotId) && refId(item.batchId) === refId(session.batch));
    if (await Attendance.exists({ session: session._id })) continue;
    if (!slot) await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: { status: "CANCELLED", cancellationSource: "SCHEDULE_OVERRIDE" } });
    else {
      const batch = batchById.get(refId(slot.batchId));
      await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: { program: slot.sessionTypeId, startTime: slot.startTime, endTime: slot.endTime, sessionName: slot.sessionName || "Training Session", roomId: slot.roomId || batch?.roomId || null, room: slot.room || batch?.room || "", coach: slot.coach || batch?.coach || null } });
    }
  }
  try { await require("./batchCompletion.service").recalculateBatchCompletionsForBranch(branchId); }
  catch (error) { console.error("Batch completion dates could not be recalculated after date override", { name: error?.name || "Error" }); }
  return existing.length;
}

async function reconcileSessionsForHoliday({ date, branchId = null }) {
  if (!parseCalendarDate(date)) throw new Error("Holiday reconciliation requires a valid calendar date.");
  const branches = branchId ? [branchId] : await Session.distinct("branch", { date, status: "SCHEDULED" });
  let cancelled = 0;
  for (const currentBranchId of branches) {
    if (!(await getHolidayForBranchDate(currentBranchId, date))) continue;
    const sessions = await Session.find({ branch: currentBranchId, date, status: "SCHEDULED" }).select("_id").lean();
    for (const session of sessions) {
      if (await Attendance.exists({ session: session._id })) continue;
      const result = await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: { status: "CANCELLED", cancellationSource: "HOLIDAY" } });
      cancelled += result.modifiedCount || 0;
    }
  }
  return cancelled;
}

module.exports = { dateList, buildSessionFields, generateSessionOccurrences, resolveBatchSessions, resolveSessionForSlot, reconcileFutureSessionsForBranch, reconcileDateOverrideSessions, reconcileSessionsForHoliday };
