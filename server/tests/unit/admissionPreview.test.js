const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAdmissionTimeline } = require("../../src/services/admissionPreview.service");
const { generateSessionOccurrences } = require("../../src/services/session.service");
const { allocateOccurrencesUntilProgramCapacity } = require("../../src/services/batchCompletion.service");

test("admission preview maps nested published learning steps to eligible Batch occurrences in curriculum order", () => {
  const batchId = "batch-1";
  const modules = [
    { name: "Foundations", order: 1, expectedSessions: 1, steps: [{ _id: "step-1", title: "Stance" }, { _id: "step-2", title: "Guard" }] },
    { name: "Practice", order: 2, expectedSessions: 20, steps: [{ _id: "step-3", title: "Movement" }] },
  ];
  const occurrences = ["2026-10-12", "2026-10-13", "2026-10-14"].map((date, index) => ({
    date,
    branch: { _id: "branch-1" },
    batch: { _id: batchId, coach: null, roomId: "room-1" },
    slot: { _id: `slot-${index + 1}`, startTime: "06:00", endTime: "07:00", roomId: "room-1", coach: null },
  }));

  const result = buildAdmissionTimeline({ modules, occurrences, existingSessions: [], batchId });

  assert.deepEqual(result.steps.map(({ stepId, moduleName, date }) => ({ stepId, moduleName, date })), [
    { stepId: "step-1", moduleName: "Foundations", date: "2026-10-12" },
    { stepId: "step-2", moduleName: "Foundations", date: "2026-10-13" },
    { stepId: "step-3", moduleName: "Practice", date: "2026-10-14" },
  ]);
  assert.equal(result.eligibilityError, "");
});

test("admission preview skips manually closed and genuinely conflicting occurrences", () => {
  const batchId = "batch-1";
  const module = [{ name: "Basics", order: 1, steps: [{ _id: "step-1", title: "Basics" }, { _id: "step-2", title: "Practice" }] }];
  const occurrences = ["2026-10-12", "2026-10-13", "2026-10-14"].map((date, index) => ({
    date,
    branch: { _id: "branch-1" },
    batch: { _id: batchId, coach: null, roomId: "room-1" },
    slot: { _id: `slot-${index + 1}`, startTime: "06:00", endTime: "07:00", roomId: "room-1", coach: null },
  }));
  const existingSessions = [
    { _id: "closed", batch: batchId, scheduleSlotId: "slot-1", date: "2026-10-12", status: "CLOSED" },
    { _id: "room-conflict", batch: "other-batch", branch: "branch-1", roomId: "room-1", date: "2026-10-13", startTime: "06:30", endTime: "07:30", status: "SCHEDULED" },
  ];

  const result = buildAdmissionTimeline({ modules: module, occurrences, existingSessions, batchId });

  assert.deepEqual(result.steps.map((step) => step.date), ["2026-10-14", null]);
  assert.match(result.eligibilityError, /1 eligible upcoming Program occurrence for 2 required learning steps/);
});

test("admission preview totals every Program Curriculum and assigns only that Program's Batch occurrences", () => {
  const curricula = [
    { programId: "karate", programName: "Karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "k1", title: "Stance" }, { _id: "k2", title: "Guard" }] }] },
    { programId: "yoga", programName: "Yoga", modules: [{ name: "Basics", order: 1, steps: [{ _id: "y1", title: "Balance" }] }] },
  ];
  const occurrences = [
    { date: "2026-10-12", branch: "branch", batch: { _id: "batch" }, slot: { _id: "slot-k1", sessionTypeId: "karate", startTime: "06:00", endTime: "07:00" } },
    { date: "2026-10-13", branch: "branch", batch: { _id: "batch" }, slot: { _id: "slot-y1", sessionTypeId: "yoga", startTime: "07:00", endTime: "08:00" } },
    { date: "2026-10-14", branch: "branch", batch: { _id: "batch" }, slot: { _id: "slot-k2", sessionTypeId: "karate", startTime: "06:00", endTime: "07:00" } },
  ];
  const result = buildAdmissionTimeline({ curricula, occurrences, batchId: "batch" });
  assert.deepEqual(result.steps.map(({ programName, stepId, date }) => ({ programName, stepId, date })), [
    { programName: "Karate", stepId: "k1", date: "2026-10-12" },
    { programName: "Karate", stepId: "k2", date: "2026-10-14" },
    { programName: "Yoga", stepId: "y1", date: "2026-10-13" },
  ]);
  assert.equal(result.eligibilityError, "");
});

test("admission preview assigns every learning step when eligible occurrences meet each Program's requirement", () => {
  const curricula = [
    { programId: "karate", programName: "Karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "k1" }, { _id: "k2" }, { _id: "k3" }] }] },
    { programId: "yoga", programName: "Yoga", modules: [{ name: "Balance", order: 1, steps: [{ _id: "y1" }] }] },
  ];
  const assignments = [["2026-10-12", "yoga"], ["2026-10-13", "karate"], ["2026-10-14", "yoga"], ["2026-10-19", "karate"], ["2026-10-20", "karate"]];
  const occurrences = assignments.map(([date, programId]) => ({ date, branch: "branch", batch: { _id: "batch" }, slot: { _id: `${programId}-${date}`, sessionTypeId: programId, startTime: "06:00", endTime: "07:00" } }));
  const result = buildAdmissionTimeline({ curricula, occurrences, batchId: "batch" });
  assert.deepEqual(result.programCapacity.map(({ programName, requiredSteps, eligibleOccurrences, assignedSteps }) => ({ programName, requiredSteps, eligibleOccurrences, assignedSteps })), [
    { programName: "Karate", requiredSteps: 3, eligibleOccurrences: 3, assignedSteps: 3 },
    { programName: "Yoga", requiredSteps: 1, eligibleOccurrences: 2, assignedSteps: 1 },
  ]);
  assert.ok(result.steps.every((step) => step.date));
  assert.equal(result.eligibilityError, "");
});

test("calendar occurrences and admission preview agree through the per-Program Batch completion date", () => {
  const branch = { _id: "branch-1" };
  const batch = { _id: "batch-1", branch: branch._id, status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-10-27", plan: { programs: [{ program: "karate" }, { program: "yoga" }] } };
  const schedule = { _id: "schedule-1", branch: branch._id, weeklySchedule: [
    { dayOfWeek: 1, isClosed: false, slots: [{ _id: "mon-yoga", batchId: batch._id, sessionTypeId: "yoga", startTime: "06:00", endTime: "07:00" }] },
    { dayOfWeek: 2, isClosed: false, slots: [{ _id: "tue-karate", batchId: batch._id, sessionTypeId: "karate", startTime: "06:00", endTime: "07:00" }] },
    { dayOfWeek: 3, isClosed: false, slots: [{ _id: "wed-yoga", batchId: batch._id, sessionTypeId: "yoga", startTime: "06:00", endTime: "07:00" }] },
  ] };
  const curricula = [
    { programId: "karate", programName: "Karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "k1" }, { _id: "k2" }] }, { name: "Advanced", order: 2, steps: [{ _id: "k3" }] }] },
    { programId: "yoga", programName: "Yoga", modules: [{ name: "Balance", order: 1, steps: [{ _id: "y1" }] }] },
  ];
  const allCalendarOccurrences = generateSessionOccurrences({ branches: [branch], schedules: [schedule], batches: [batch], start: "2026-10-12", end: "2026-11-30" });
  const completion = allocateOccurrencesUntilProgramCapacity({
    generated: allCalendarOccurrences, initialCounts: new Map(),
    stepsByProgram: [{ programId: "karate", requiredSteps: 3 }, { programId: "yoga", requiredSteps: 1 }],
    completedKeys: new Set(), today: "2026-10-12", canAccept: () => true,
  });
  assert.equal(completion.completionDate, "2026-10-27");
  const boundedBatch = { ...batch, calculatedEndDate: completion.completionDate };
  const calendarOccurrences = generateSessionOccurrences({ branches: [branch], schedules: [schedule], batches: [boundedBatch], start: "2026-10-12", end: "2026-11-30" });
  const preview = buildAdmissionTimeline({ curricula, occurrences: calendarOccurrences, batchId: batch._id });
  assert.deepEqual(calendarOccurrences.filter((item) => item.date <= completion.completionDate).map((item) => `${item.date}:${item.slot.sessionTypeId}`), [
    "2026-10-12:yoga", "2026-10-13:karate", "2026-10-14:yoga", "2026-10-19:yoga", "2026-10-20:karate", "2026-10-21:yoga", "2026-10-26:yoga", "2026-10-27:karate",
  ]);
  assert.deepEqual(preview.steps.map(({ programId, date }) => `${programId}:${date}`), ["karate:2026-10-13", "karate:2026-10-20", "karate:2026-10-27", "yoga:2026-10-12"]);
  assert.equal(preview.eligibilityError, "");
});

test("admission preview explains a genuine Program-specific schedule shortage without borrowing other Program occurrences", () => {
  const curricula = [
    { programId: "karate", programName: "Karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "k1" }, { _id: "k2" }, { _id: "k3" }] }] },
    { programId: "yoga", programName: "Yoga", modules: [{ name: "Balance", order: 1, steps: [{ _id: "y1" }] }] },
  ];
  const assignments = [["2026-10-12", "yoga"], ["2026-10-13", "karate"], ["2026-10-14", "yoga"], ["2026-10-19", "yoga"]];
  const occurrences = assignments.map(([date, programId]) => ({ date, branch: "branch", batch: { _id: "batch" }, slot: { _id: `${programId}-${date}`, sessionTypeId: programId, startTime: "06:00", endTime: "07:00" } }));
  const result = buildAdmissionTimeline({ curricula, occurrences, batchId: "batch" });
  assert.deepEqual(result.programCapacity.map(({ programName, requiredSteps, eligibleOccurrences, shortage }) => ({ programName, requiredSteps, eligibleOccurrences, shortage })), [
    { programName: "Karate", requiredSteps: 3, eligibleOccurrences: 1, shortage: 2 },
    { programName: "Yoga", requiredSteps: 1, eligibleOccurrences: 3, shortage: 0 },
  ]);
  assert.equal(result.steps.filter((step) => step.programId === "karate" && step.date).length, 1);
  assert.match(result.steps.find((step) => step.programId === "karate" && !step.date).unavailableReason, /1 eligible upcoming Karate occurrence.*3 required learning steps/);
  assert.match(result.eligibilityError, /Karate.*2 steps have no eligible date/);
  assert.equal(result.steps.find((step) => step.programId === "yoga").date, "2026-10-12");
});

test("admission preview is driven by upcoming Batch dates rather than an individual join date", () => {
  const curricula = [{ programId: "karate", programName: "Karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "step-1", title: "Stance" }] }] }];
  const occurrence = (date) => ({ date, branch: "branch", batch: { _id: "batch" }, slot: { _id: `slot-${date}`, sessionTypeId: "karate", startTime: "06:00", endTime: "07:00" } });
  const batchOccurrences = [occurrence("2026-10-12"), occurrence("2026-10-19")];
  const beforeStartJoinPreview = buildAdmissionTimeline({ curricula, occurrences: batchOccurrences, batchId: "batch" });
  const afterStartJoinPreview = buildAdmissionTimeline({ curricula, occurrences: batchOccurrences, batchId: "batch" });
  assert.deepEqual(afterStartJoinPreview.steps, beforeStartJoinPreview.steps);
  assert.equal(afterStartJoinPreview.steps[0].date, "2026-10-12");
  assert.match(afterStartJoinPreview.timelineMessage, /do not mark learning steps complete/i);
});

test("admission preview explains when no future Batch Sessions are eligible", () => {
  const result = buildAdmissionTimeline({ curricula: [{ programId: "karate", modules: [{ name: "Basics", order: 1, steps: [{ _id: "step-1" }] }] }], occurrences: [], batchId: "batch" });
  assert.match(result.eligibilityError, /No eligible upcoming Program occurrence/);
  assert.equal(result.steps[0].date, null);
});
