const test = require("node:test");
const assert = require("node:assert/strict");
const { filterBatchAvailability } = require("../../src/services/branchSchedule.service");
const { isOccurrenceUsable, countDeliveredOccurrences } = require("../../src/services/batchCompletion.service");

test("branch availability applies each Batch date range independently", () => {
  const batches = [
    { _id: "batch-a", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-10-19" },
    { _id: "batch-b", status: "ACTIVE", startDate: "2026-10-26", calculatedEndDate: "2026-11-02" },
  ];
  const days = [
    { date: "2026-10-12", isHoliday: false, isClosed: false, isTrainingDay: true, reason: "TRAINING_AVAILABLE", slots: [{ _id: "slot-a", batchId: "batch-a" }, { _id: "slot-b", batchId: "batch-b" }] },
    { date: "2026-10-26", isHoliday: false, isClosed: false, isTrainingDay: true, reason: "TRAINING_AVAILABLE", slots: [{ _id: "slot-a", batchId: "batch-a" }, { _id: "slot-b", batchId: "batch-b" }] },
    { date: "2026-11-09", isHoliday: false, isClosed: false, isTrainingDay: true, reason: "TRAINING_AVAILABLE", slots: [{ _id: "slot-b", batchId: "batch-b" }] },
  ];
  const result = filterBatchAvailability(days, batches, []);
  assert.deepEqual(result[0].slots.map((slot) => slot.batchId), ["batch-a"]);
  assert.deepEqual(result[1].slots.map((slot) => slot.batchId), ["batch-b"]);
  assert.equal(result[2].isTrainingDay, false);
  assert.equal(result[2].reason, "BATCH_OUTSIDE_DATE_RANGE");
});

test("draft and paused Batch slots stay hidden from availability with an explicit inactive reason", () => {
  const day = { date: "2026-10-12", isHoliday: false, isClosed: false, isTrainingDay: true, reason: "TRAINING_AVAILABLE", slots: [{ _id: "slot-a", batchId: "batch-a" }] };
  const base = { _id: "batch-a", startDate: "2026-10-12", calculatedEndDate: "2026-10-31" };
  for (const status of ["DRAFT", "PAUSED", "INACTIVE"]) {
    const result = filterBatchAvailability([day], [{ ...base, status }], [])[0];
    assert.equal(result.isTrainingDay, false, `${status} Batch must not appear as available`);
    assert.equal(result.reason, "BATCH_NOT_ACTIVE");
  }
  const active = filterBatchAvailability([day], [{ ...base, status: "ACTIVE" }], [])[0];
  assert.equal(active.isTrainingDay, true);
  assert.deepEqual(active.slots.map((slot) => slot._id), ["slot-a"]);
});

test("a closed dated Session is distinct from a no-session date", () => {
  const day = { date: "2026-10-12", isHoliday: false, isClosed: false, isTrainingDay: true, reason: "TRAINING_AVAILABLE", slots: [{ _id: "slot-a", batchId: "batch-a" }] };
  const result = filterBatchAvailability([day], [{ _id: "batch-a", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-10-19" }], [{ date: day.date, scheduleSlotId: "slot-a", status: "CLOSED", closureReason: "Coach unavailable" }])[0];
  assert.equal(result.isTrainingDay, false);
  assert.equal(result.isClosed, true);
  assert.equal(result.reason, "SESSION_CLOSED");
  assert.equal(result.closureReason, "Coach unavailable");
});

test("closed and manually cancelled occurrences do not count, while system cancellations can be restored", () => {
  assert.equal(isOccurrenceUsable({ status: "CLOSED" }), false);
  assert.equal(isOccurrenceUsable({ status: "CANCELLED", cancellationSource: "MANUAL" }), false);
  assert.equal(isOccurrenceUsable({ status: "CANCELLED", cancellationSource: "BATCH_DATE_BOUNDARY" }), true);
  assert.equal(isOccurrenceUsable({ status: "SCHEDULED" }), true);
});

test("past scheduled occurrences count once, explicit closures do not, and absences are not used as a Batch extension signal", () => {
  const generated = [
    { date: "2026-10-05", slot: { _id: "slot-present" } },
    { date: "2026-10-12", slot: { _id: "slot-absent" } },
    { date: "2026-10-19", slot: { _id: "slot-closed" } },
  ];
  const existing = [
    { _id: "session-1", batch: "batch-a", date: "2026-10-05", scheduleSlotId: "slot-present", status: "SCHEDULED" },
    { _id: "session-2", batch: "batch-a", date: "2026-10-19", scheduleSlotId: "slot-closed", status: "CLOSED" },
    { _id: "session-other", batch: "batch-b", date: "2026-10-05", scheduleSlotId: "slot-other", status: "COMPLETED" },
  ];
  const delivered = countDeliveredOccurrences(generated, existing, "2026-10-20", "batch-a");
  assert.equal(delivered.size, 2);
  assert.equal(delivered.has("2026-10-19:slot-closed"), false);
  assert.equal(delivered.has("2026-10-12:slot-absent"), true);
});
