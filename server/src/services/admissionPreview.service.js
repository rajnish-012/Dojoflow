const { findDatedSessionConflict } = require("./schedulingConflict.service");

const id = (value) => String(value?._id || value || "");
const reopenableCancellation = new Set([
  "SCHEDULE_CHANGE",
  "SCHEDULE_OVERRIDE",
  "BATCH_INACTIVE",
  "BATCH_DATE_BOUNDARY",
  "HOLIDAY",
]);

function buildAdmissionTimeline({
  modules = [],
  curricula = [],
  occurrences = [],
  existingSessions = [],
  batchId,
}) {
  const sourceCurricula = curricula.length ? curricula : [{ modules }];
  const programSteps = sourceCurricula.map((curriculum) => ({
    programId: id(
      curriculum.programId || curriculum.program?._id || curriculum.program,
    ),
    programName:
      curriculum.programName || curriculum.program?.name || "Program",
    steps: (curriculum.modules || [])
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .flatMap((module) =>
        (module.steps || []).map((step) => ({
          stepId: id(step._id),
          moduleName: module.name || "Module",
          title: step.title || "Learning step",
          description: step.description || "",
          programId: id(
            curriculum.programId ||
              curriculum.program?._id ||
              curriculum.program,
          ),
          programName:
            curriculum.programName || curriculum.program?.name || "Program",
        })),
      ),
  }));
  const sorted = occurrences
    .filter((item) => id(item.batch?._id || item.batch) === id(batchId))
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        String(a.slot.startTime).localeCompare(String(b.slot.startTime)) ||
        id(a.slot._id).localeCompare(id(b.slot._id)),
    );
  const mapped = [];
  const accepted = [];
  for (const occurrence of sorted) {
    const current = existingSessions.find(
      (session) =>
        id(session.batch) === id(batchId) &&
        session.date === occurrence.date &&
        id(session.scheduleSlotId) === id(occurrence.slot._id),
    );
    if (
      current?.status === "CLOSED" ||
      (current?.status === "CANCELLED" &&
        !reopenableCancellation.has(current.cancellationSource))
    )
      continue;
    const conflicting = existingSessions.filter(
      (session) =>
        session.date === occurrence.date &&
        id(session._id) !== id(current?._id),
    );
    if (
      findDatedSessionConflict(
        {
          branch: occurrence.branch?._id || occurrence.branch,
          batch: batchId,
          roomId: occurrence.slot.roomId || occurrence.batch.roomId,
          coach: occurrence.slot.coach || occurrence.batch.coach,
          startTime: occurrence.slot.startTime,
          endTime: occurrence.slot.endTime,
          date: occurrence.date,
        },
        [
          ...conflicting,
          ...accepted.filter((item) => item.date === occurrence.date),
        ],
      )
    )
      continue;
    accepted.push({
      branch: occurrence.branch?._id || occurrence.branch,
      batch: batchId,
      roomId: occurrence.slot.roomId || occurrence.batch.roomId,
      coach: occurrence.slot.coach || occurrence.batch.coach,
      startTime: occurrence.slot.startTime,
      endTime: occurrence.slot.endTime,
      date: occurrence.date,
      status: "SCHEDULED",
    });
    mapped.push({
      programId: id(occurrence.slot.sessionTypeId),
      date: occurrence.date,
      startTime: occurrence.slot.startTime,
      endTime: occurrence.slot.endTime,
    });
  }
  const programCapacity = programSteps.map(
    ({ programId, programName, steps }) => {
      const eligibleOccurrences = mapped.filter(
        (item) => item.programId === programId,
      ).length;
      return {
        programId,
        programName,
        requiredSteps: steps.length,
        eligibleOccurrences,
        assignedSteps: Math.min(steps.length, eligibleOccurrences),
        shortage: Math.max(0, steps.length - eligibleOccurrences),
      };
    },
  );
  const shortageMessage = (item) =>
    item.eligibleOccurrences === 0
      ? `No eligible upcoming ${item.programName} occurrence is available for ${item.requiredSteps} required learning step${item.requiredSteps === 1 ? "" : "s"} in this Batch.`
      : `This Batch has ${item.eligibleOccurrences} eligible upcoming ${item.programName} occurrence${item.eligibleOccurrences === 1 ? "" : "s"} for ${item.requiredSteps} required learning steps; ${item.shortage} ${item.shortage === 1 ? "step has" : "steps have"} no eligible date before the Batch completion date.`;
  const capacityMessages = programCapacity
    .filter((item) => item.shortage > 0)
    .map(shortageMessage);
  let order = 0;
  const timeline = programSteps.flatMap(({ programId, programName, steps }) => {
    const available = mapped.filter(
      (item) => !item.used && (!programId || item.programId === programId),
    );
    const capacity = programCapacity.find(
      (item) => item.programId === programId,
    );
    return steps.map((step) => {
      order += 1;
      const occurrence = available.shift();
      if (occurrence) occurrence.used = true;
      return {
        ...step,
        order,
        ...(occurrence || {
          date: null,
          startTime: "",
          endTime: "",
          unavailableReason:
            (capacity?.shortage ? shortageMessage(capacity) : "") ||
            `No eligible upcoming ${programName} occurrence is available before the Batch completion date.`,
        }),
      };
    });
  });
  const unplanned = timeline.filter((step) => !step.date).length;
  const steps = timeline.length;
  const plannedCount = steps - unplanned;
  const noUpcomingOccurrences = sorted.length === 0;
  const noEligibleOccurrences = !noUpcomingOccurrences && mapped.length === 0;
  return {
    steps: timeline,
    programCapacity,
    eligibilityError: capacityMessages.length
      ? capacityMessages.join(" ")
      : noUpcomingOccurrences
        ? "No upcoming eligible Sessions were found for this Batch. Check its active schedule, completion date, holidays, closures, and cancellations."
        : noEligibleOccurrences
          ? "Upcoming Batch Sessions exist, but none are currently eligible after applying closures, cancellations, and scheduling conflicts. Review the Batch schedule and affected Sessions."
          : unplanned
            ? `The selected Batch has capacity for only ${plannedCount} of ${steps} Curriculum learning steps after applying its schedule and conflicts.`
            : "",
    timelineMessage: unplanned
      ? "The preview shows upcoming Batch dates only. Any earlier learning steps remain outstanding until the student meets their completion requirements."
      : steps
        ? "Dates are based on upcoming eligible Batch Sessions; scheduled dates do not mark learning steps complete."
        : "The published Curricula have no learning steps.",
  };
}

module.exports = { buildAdmissionTimeline };
