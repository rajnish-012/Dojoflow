const Batch = require("../models/Batch");
const Branch = require("../models/Branch");
const BranchSchedule = require("../models/BranchSchedule");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const Holiday = require("../models/Holiday");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const { generateSessionOccurrences, buildSessionFields } = require("./session.service");
const { findDatedSessionConflict } = require("./schedulingConflict.service");
const { formatDate } = require("./branchSchedule.service");
const { summarizePlanCurriculumCapacity } = require("./curriculumCapacity.service");

const SEARCH_DAYS = 3650;
const todayKey = () => formatDate(new Date());
const REACTIVATABLE_CANCELLATIONS = new Set(["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"]);

function buildCompletionSearchBatch(batch, startDate, searchEndDate) {
  return { ...batch, status: "ACTIVE", startDate, calculatedEndDate: searchEndDate, branch: batch.branch, plan: batch.plan };
}

function isOccurrenceUsable(session) {
  if (session?.status === "CLOSED") return false;
  if (session?.status === "CANCELLED" && !REACTIVATABLE_CANCELLATIONS.has(session.cancellationSource)) return false;
  return true;
}

function countDeliveredOccurrences(generated, existing, today, batchId = "") {
  const ownSessions = batchId ? existing.filter((session) => String(session.batch) === String(batchId)) : existing;
  const byKey = new Map(ownSessions.map((session) => [`${session.date}:${String(session.scheduleSlotId || session._id)}`, session]));
  const delivered = new Set(ownSessions.filter((session) => session.status === "COMPLETED").map((session) => `${session.date}:${String(session.scheduleSlotId || session._id)}`));
  for (const occurrence of generated) {
    if (occurrence.date >= today) continue;
    const key = `${occurrence.date}:${String(occurrence.slot._id)}`;
    if (isOccurrenceUsable(byKey.get(key))) delivered.add(key);
  }
  return delivered;
}

function countDeliveredByProgram(generated, existing, today, batchId = "", stepsByProgram = []) {
  const ownSessions = batchId ? existing.filter((session) => String(session.batch) === String(batchId)) : existing;
  const sessionByKey = new Map(ownSessions.map((session) => [`${session.date}:${String(session.scheduleSlotId || session._id)}`, session]));
  const counted = new Set();
  const counts = new Map();
  const requiredPrograms = new Set(stepsByProgram.map((item) => String(item.programId)));
  const add = (programId) => {
    const key = String(programId?._id || programId || "");
    if (key && (!requiredPrograms.size || requiredPrograms.has(key))) counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (const session of ownSessions) {
    const key = `${session.date}:${String(session.scheduleSlotId || session._id)}`;
    if (session.status === "COMPLETED") {
      counted.add(key);
      add(session.program);
    }
  }
  for (const occurrence of generated) {
    const key = `${occurrence.date}:${String(occurrence.slot._id)}`;
    if (counted.has(key) || occurrence.date >= today || !isOccurrenceUsable(sessionByKey.get(key))) continue;
    counted.add(key);
    add(occurrence.slot.sessionTypeId);
  }
  return counts;
}

function hasMetProgramCapacity(counts, stepsByProgram) {
  return stepsByProgram.every((item) => (counts.get(String(item.programId)) || 0) >= item.requiredSteps);
}

function allocateOccurrencesUntilProgramCapacity({ generated, initialCounts, stepsByProgram, completedKeys, today, canAccept }) {
  const counts = new Map(initialCounts);
  const accepted = [];
  let delivered = [...counts.values()].reduce((sum, value) => sum + value, 0);
  for (const occurrence of generated) {
    const key = `${occurrence.date}:${String(occurrence.slot._id)}`;
    if (completedKeys.has(key) || occurrence.date < today || !canAccept(occurrence, accepted)) continue;
    accepted.push(occurrence);
    const programId = String(occurrence.slot.sessionTypeId?._id || occurrence.slot.sessionTypeId || "");
    counts.set(programId, (counts.get(programId) || 0) + 1);
    delivered += 1;
    if (hasMetProgramCapacity(counts, stepsByProgram)) return { counts, accepted, delivered, completionDate: occurrence.date };
  }
  return { counts, accepted, delivered, completionDate: null };
}

async function calculateBatchCompletion(batchId, { startDate } = {}) {
  const batch = await Batch.findById(batchId).populate({ path: "plan", populate: { path: "programs.program", select: "name" } }).lean();
  if (!batch?.plan) throw new Error("Batch and Plan must exist before calculating completion.");
  const firstDate = startDate || batch.startDate || batch.effectiveFrom;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate || "")) throw new Error("Set a valid Batch start date before activation.");
  const capacity = await summarizePlanCurriculumCapacity(batch.plan, { publishedOnly: true });
  if (capacity.combinedSteps < 1) throw new Error("Publish at least one Curriculum learning step before activating this Batch.");
  if (!capacity.valid) throw new Error(`Published Curriculum requires ${capacity.combinedSteps} sessions, exceeding Plan capacity (${capacity.maximumSessions}).`);

  const dateEnd = new Date(`${firstDate}T12:00:00`);
  dateEnd.setDate(dateEnd.getDate() + SEARCH_DAYS);
  const lastDate = formatDate(dateEnd);
  const branch = await Branch.findById(batch.branch).select("_id isActive").lean();
  if (!branch?.isActive) throw new Error("An active Branch is required to calculate Batch completion.");
  const [schedules, overrides, holidays, existing] = await Promise.all([
    BranchSchedule.find({ branch: batch.branch }).lean(),
    BranchDateSchedule.find({ branch: batch.branch, date: { $gte: firstDate, $lte: lastDate } }).lean(),
    Holiday.find({ isActive: true, date: { $gte: new Date(`${firstDate}T00:00:00.000Z`), $lte: new Date(`${lastDate}T23:59:59.999Z`) }, $or: [{ branch: null }, { branch: batch.branch }] }).lean(),
    Session.find({ branch: batch.branch, $or: [{ date: { $gte: firstDate, $lte: lastDate } }, { batch: batch._id, status: "COMPLETED", date: { $lte: lastDate } }] }).lean(),
  ]);
  // Search only through the explicit calculation horizon. The normal
  // recurrence generator requires a finite Batch end date so calendar reads
  // cannot generate open-ended occurrences; using the search cap here keeps
  // that invariant while allowing recalculation to discover an extended end.
  const activeBatch = buildCompletionSearchBatch(batch, firstDate, lastDate);
  const generated = generateSessionOccurrences({ branches: [branch], schedules, overrides, holidays, batches: [activeBatch], start: firstDate, end: lastDate })
    .filter((occurrence) => String(occurrence.batch._id) === String(batch._id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.startTime.localeCompare(b.slot.startTime) || String(a.slot._id).localeCompare(String(b.slot._id)));
  const today = todayKey();
  const completedKeys = countDeliveredOccurrences(generated, existing, today, batch._id);
  const programCounts = countDeliveredByProgram(generated, existing, today, batch._id, capacity.stepsByProgram);
  const delivered = [...programCounts.values()].reduce((sum, value) => sum + value, 0);
  const requiredProgramIds = new Set(capacity.stepsByProgram.map((item) => String(item.programId)));
  const deliveredDates = existing.filter((session) => String(session.batch) === String(batch._id) && session.status === "COMPLETED" && requiredProgramIds.has(String(session.program?._id || session.program))).map((session) => session.date);
  for (const occurrence of generated) {
    const key = `${occurrence.date}:${String(occurrence.slot._id)}`;
    const programId = String(occurrence.slot.sessionTypeId?._id || occurrence.slot.sessionTypeId || "");
    if (completedKeys.has(key) && requiredProgramIds.has(programId)) deliveredDates.push(occurrence.date);
  }
  deliveredDates.sort();
  const alreadyComplete = hasMetProgramCapacity(programCounts, capacity.stepsByProgram);
  const allocation = alreadyComplete ? null : allocateOccurrencesUntilProgramCapacity({
    generated, initialCounts: programCounts, stepsByProgram: capacity.stepsByProgram, completedKeys, today,
    canAccept: (occurrence, accepted) => {
      const fields = buildSessionFields(occurrence);
      const current = existing.find((item) => String(item.batch) === String(batch._id) && item.date === occurrence.date && String(item.scheduleSlotId) === String(occurrence.slot._id));
      if (!isOccurrenceUsable(current)) return false;
      const competing = existing.filter((item) => String(item._id) !== String(current?._id) && item.date === occurrence.date)
        .concat(accepted.filter((item) => item.date === occurrence.date).map((item) => buildSessionFields(item)));
      return !findDatedSessionConflict({ branch: fields.branch, batch: fields.batch, roomId: fields.roomId, coach: fields.coach, startTime: fields.startTime, endTime: fields.endTime, date: fields.date }, competing);
    },
  });
  const completionDate = alreadyComplete ? (deliveredDates[deliveredDates.length - 1] || firstDate) : allocation?.completionDate;
  if (!completionDate) {
    const finalCounts = allocation?.counts || programCounts;
    const shortages = capacity.stepsByProgram.filter((item) => (finalCounts.get(String(item.programId)) || 0) < item.requiredSteps)
      .map((item) => `${item.programName}: ${finalCounts.get(String(item.programId)) || 0}/${item.requiredSteps}`);
    throw new Error(`The Batch schedule cannot satisfy the published Curriculum requirements within ${SEARCH_DAYS / 365} years (${shortages.join(", ")}); review the affected Program assignments, holidays, and conflicts.`);
  }
  return { startDate: firstDate, calculatedEndDate: completionDate, requiredSessions: capacity.combinedSteps, deliveredSessions: delivered, futureSessions: (allocation?.delivered || delivered) - delivered, searchedThrough: lastDate };
}

async function recalculateBatchCompletionsForBranch(branchId) {
  const activeBatches = await Batch.find({ branch: branchId, status: "ACTIVE" }).select("_id calculatedEndDate capacityIssue").lean();
  for (const batch of activeBatches) await recalculateSingleBatchCompletion(batch._id);
  return activeBatches.length;
}

async function recalculateSingleBatchCompletion(batchId) {
  try {
    const result = await calculateBatchCompletion(batchId);
    await Batch.updateOne({ _id: batchId, status: "ACTIVE" }, { $set: { startDate: result.startDate, calculatedEndDate: result.calculatedEndDate, capacityIssue: "" } });
    await cancelScheduledSessionsOutsideBatchDates(batchId, result.startDate, result.calculatedEndDate);
    return { success: true, ...result };
  } catch (error) {
    const message = String(error.message || "Unable to calculate completion.").slice(0, 500);
    await Batch.updateOne({ _id: batchId, status: "ACTIVE" }, { $set: { calculatedEndDate: null, capacityIssue: message } });
    return { success: false, message };
  }
}

async function cancelScheduledSessionsOutsideBatchDates(batchId, startDate, endDate) {
  const today = todayKey();
  const stale = await Session.find(buildOutsideBatchDateQuery(batchId, startDate, endDate, today)).select("_id").lean();
  for (const session of stale) {
    if (await Attendance.exists({ session: session._id })) continue;
    await Session.updateOne({ _id: session._id, status: "SCHEDULED" }, { $set: { status: "CANCELLED", cancellationSource: "BATCH_DATE_BOUNDARY" } });
  }
  return stale.length;
}

function buildOutsideBatchDateQuery(batchId, startDate, endDate, today = todayKey()) {
  return {
    batch: batchId,
    status: "SCHEDULED",
    $or: [
      { date: { $gte: today, $lt: startDate } },
      { date: { $gte: today, $gt: endDate } },
    ],
  };
}

async function recalculateBatchCompletionsForPlan(planId) {
  const batches = await Batch.find({ plan: planId, status: "ACTIVE" }).select("_id").lean();
  for (const batch of batches) await recalculateSingleBatchCompletion(batch._id);
  return batches.length;
}

async function recalculateAllBatchCompletions() {
  const branches = await Batch.find({ status: "ACTIVE" }).distinct("branch");
  for (const branchId of branches) await recalculateBatchCompletionsForBranch(branchId);
  return branches.length;
}

module.exports = { calculateBatchCompletion, buildCompletionSearchBatch, buildOutsideBatchDateQuery, isOccurrenceUsable, countDeliveredOccurrences, countDeliveredByProgram, hasMetProgramCapacity, allocateOccurrencesUntilProgramCapacity, recalculateBatchCompletionsForBranch, recalculateBatchCompletionsForPlan, recalculateAllBatchCompletions };
