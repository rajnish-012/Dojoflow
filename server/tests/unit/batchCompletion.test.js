const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCompletionSearchBatch, buildOutsideBatchDateQuery, countDeliveredOccurrences, hasMetProgramCapacity, allocateOccurrencesUntilProgramCapacity } = require("../../src/services/batchCompletion.service");
const { generateSessionOccurrences } = require("../../src/services/session.service");
const { theoreticalMaximumSessions, countLearningSteps } = require("../../src/services/curriculumCapacity.service");

test("Batch boundary cleanup places date alternatives at the query root", () => {
  const query = buildOutsideBatchDateQuery("batch-1", "2026-10-12", "2026-10-26", "2026-10-10");
  assert.deepEqual(query, {
    batch: "batch-1",
    status: "SCHEDULED",
    $or: [
      { date: { $gte: "2026-10-10", $lt: "2026-10-12" } },
      { date: { $gte: "2026-10-10", $gt: "2026-10-26" } },
    ],
  });
  assert.equal(Object.hasOwn(query.date || {}, "$or"), false);
});

test("three-month Plan completion search uses its finite horizon and keeps Batch dates independent", () => {
  const plan = { _id: "plan-1", duration: 3, durationUnit: "MONTHS", classesPerWeek: 2 };
  const curriculum = { modules: [{ steps: Array.from({ length: 8 }, (_, index) => ({ _id: `step-${index + 1}` })) }] };
  assert.equal(countLearningSteps(curriculum.modules), 8);
  assert.equal(theoreticalMaximumSessions(plan), 26);

  const branches = [{ _id: "branch-1" }];
  const schedules = [{ _id: "schedule-1", branch: "branch-1", weeklySchedule: [
    { dayOfWeek: 1, isClosed: false, slots: [
      { _id: "a-mon", batchId: "batch-a", sessionTypeId: "program-1", startTime: "07:00", endTime: "08:00" },
      { _id: "b-mon", batchId: "batch-b", sessionTypeId: "program-1", startTime: "08:00", endTime: "09:00" },
    ] },
    { dayOfWeek: 3, isClosed: false, slots: [
      { _id: "a-wed", batchId: "batch-a", sessionTypeId: "program-1", startTime: "07:00", endTime: "08:00" },
      { _id: "b-wed", batchId: "batch-b", sessionTypeId: "program-1", startTime: "08:00", endTime: "09:00" },
    ] },
  ] }];
  const batches = [
    { _id: "batch-a", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-05", calculatedEndDate: "2026-10-26", plan: { programs: [{ program: "program-1" }] } },
    { _id: "batch-b", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-11-02", plan: { programs: [{ program: "program-1" }] } },
  ];
  const batchA = buildCompletionSearchBatch(batches[0], "2026-10-05", "2026-11-30");
  const batchB = buildCompletionSearchBatch(batches[1], "2026-10-12", "2026-12-07");
  assert.notEqual(batchA.calculatedEndDate, batchB.calculatedEndDate);

  const rows = generateSessionOccurrences({ branches, schedules, batches: [batchA, batchB], start: "2026-10-05", end: "2026-12-07" });
  const nthSessionDate = (batchId, count) => rows.filter((row) => row.batch._id === batchId)[count - 1]?.date;
  assert.equal(nthSessionDate("batch-a", 8), "2026-10-28");
  assert.equal(nthSessionDate("batch-b", 8), "2026-11-04");
  assert.ok(rows.filter((row) => row.batch._id === "batch-a").every((row) => row.date >= batchA.startDate && row.date <= batchA.calculatedEndDate));
  assert.ok(rows.filter((row) => row.batch._id === "batch-b").every((row) => row.date >= batchB.startDate && row.date <= batchB.calculatedEndDate));
});

test("each closed future occurrence is omitted from delivered history and a reopened schedule occurrence remains eligible", () => {
  const generated = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"].map((date, index) => ({ date, slot: { _id: `slot-${index + 1}` } }));
  const closedSessions = [
    { _id: "session-2", batch: "batch-a", date: "2026-10-12", scheduleSlotId: "slot-2", status: "CLOSED" },
    { _id: "session-3", batch: "batch-a", date: "2026-10-19", scheduleSlotId: "slot-3", status: "CLOSED" },
  ];
  const delivered = countDeliveredOccurrences(generated, closedSessions, "2026-10-30", "batch-a");
  assert.equal(delivered.size, 2);
  assert.equal(closedSessions.every((session) => session.status === "CLOSED"), true);
  const reopened = { ...closedSessions[0], status: "SCHEDULED" };
  assert.equal(reopened.status, "SCHEDULED");
  assert.equal(countDeliveredOccurrences(generated, [reopened, closedSessions[1]], "2026-10-30", "batch-a").size, 3);
});

test("Batch completion requires the published occurrence count for each Program, not just the combined total", () => {
  const requirements = [
    { programId: "karate", requiredSteps: 3 },
    { programId: "yoga", requiredSteps: 1 },
  ];
  // Four total delivered Sessions used to complete a four-step Plan, even when
  // three of those Sessions belonged to Yoga and only one to Karate.
  assert.equal(hasMetProgramCapacity(new Map([["karate", 1], ["yoga", 3]]), requirements), false);
  assert.equal(hasMetProgramCapacity(new Map([["karate", 3], ["yoga", 1]]), requirements), true);
});

test("Batch completion horizon extends until each Program has enough matching recurring occurrences", () => {
  const requirements = [{ programId: "karate", requiredSteps: 3 }, { programId: "yoga", requiredSteps: 1 }];
  const schedule = [];
  for (const [date, programId] of [
    ["2026-10-12", "yoga"], ["2026-10-13", "karate"], ["2026-10-14", "yoga"],
    ["2026-10-19", "yoga"], ["2026-10-20", "karate"], ["2026-10-21", "yoga"],
    ["2026-10-26", "yoga"], ["2026-10-27", "karate"],
  ]) {
    schedule.push({ date, slot: { _id: `slot-${date}`, sessionTypeId: programId } });
  }
  const result = allocateOccurrencesUntilProgramCapacity({
    generated: schedule, initialCounts: new Map(), stepsByProgram: requirements,
    completedKeys: new Set(), today: "2026-10-12", canAccept: () => true,
  });
  assert.equal(result.completionDate, "2026-10-27");
  assert.equal(result.counts.get("karate"), 3);
  assert.equal(result.counts.get("yoga"), 5);
});
