const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectBatchOccurrences } = require("../../src/services/batchSchedule.service");

const slot = (id, startTime, endTime, overrides = {}) => ({
  _id: id, batchId: "batch-a", sessionName: `Session ${id}`, sessionTypeId: "program-a",
  startTime, endTime, isActive: true, ...overrides,
});

test("a Plan requiring three occurrences accepts two separate same-day sessions plus another day", () => {
  const result = inspectBatchOccurrences({ weeklySchedule: [
    { dayOfWeek: 1, slots: [slot("a", "07:00", "08:00"), slot("b", "08:00", "09:00")] },
    { dayOfWeek: 3, slots: [slot("c", "07:00", "08:00")] },
  ], batchId: "batch-a", allowedProgramIds: ["program-a"] });
  assert.equal(result.count, 3);
  assert.deepEqual(result.errors, []);
});

test("frequency comparison distinguishes two, exactly three, and four occurrences", () => {
  const weeklySchedule = [{ dayOfWeek: 1, slots: [
    slot("a", "07:00", "08:00"), slot("b", "08:00", "09:00"),
    slot("c", "09:00", "10:00"), slot("d", "10:00", "11:00"),
  ] }];
  const inspect = (limit) => inspectBatchOccurrences({ weeklySchedule: [{ ...weeklySchedule[0], slots: weeklySchedule[0].slots.slice(0, limit) }], batchId: "batch-a", allowedProgramIds: ["program-a"] });
  assert.equal(inspect(2).count, 2);
  assert.equal(inspect(3).count, 3);
  assert.equal(inspect(4).count, 4);
});

test("two Batches each receive their own three weekly occurrences", () => {
  const weeklySchedule = [1, 2, 3].map((dayOfWeek, index) => ({ dayOfWeek, slots: [
    slot(`a-${index}`, "07:00", "08:00"),
    slot(`b-${index}`, "09:00", "10:00", { batchId: "batch-b" }),
  ] }));
  const inspect = (batchId) => inspectBatchOccurrences({ weeklySchedule, batchId, allowedProgramIds: ["program-a"] });
  assert.equal(inspect("batch-a").count, 3);
  assert.equal(inspect("batch-b").count, 3);
  assert.equal(inspect("batch-a").count + inspect("batch-b").count, 6);
});

test("disabled, invalid, duplicate, and overlapping slots do not satisfy the weekly count", () => {
  const result = inspectBatchOccurrences({ weeklySchedule: [{ dayOfWeek: 2, slots: [
    slot("disabled", "07:00", "08:00", { isActive: false }),
    slot("bad-time", "11:00", "10:00"),
    slot("first", "07:00", "09:00"),
    slot("overlap", "08:00", "10:00"),
  ] }], batchId: "batch-a", allowedProgramIds: ["program-a"] });
  assert.equal(result.count, 0);
  assert.ok(result.errors.some((error) => error.includes("valid start and end times")));
  assert.ok(result.errors.some((error) => error.includes("overlapping")));
});

test("duplicate times and programs outside the Plan are rejected", () => {
  const result = inspectBatchOccurrences({ weeklySchedule: [{ dayOfWeek: 4, slots: [
    slot("a", "07:00", "08:00"), slot("b", "07:00", "08:00", { sessionTypeId: "other-program" }),
  ] }], batchId: "batch-a", allowedProgramIds: ["program-a"] });
  assert.equal(result.count, 0);
  assert.ok(result.errors.some((error) => error.includes("Duplicate weekly times")));
  assert.ok(result.errors.some((error) => error.includes("valid active Program")));
});
