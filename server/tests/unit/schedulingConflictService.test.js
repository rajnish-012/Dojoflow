const test = require("node:test");
const assert = require("node:assert/strict");
const { findRecurringConflict, findDatedSessionConflict, roomAssignmentError } = require("../../src/services/schedulingConflict.service");

const slot = (id, { roomId = null, coachId = null, batchId = id, startTime = "17:00", endTime = "18:00", branchId = "branch-1" } = {}) => ({ slotId: id, dayOfWeek: 1, branchId, roomId, coachId, batchId, startTime, endTime, active: true });

test("three Batches can overlap in three different rooms with distinct coaches", () => {
  const slots = [slot("a", { roomId: "r1", coachId: "c1" }), slot("b", { roomId: "r2", coachId: "c2" }), slot("c", { roomId: "r3", coachId: "c3" })];
  assert.equal(findRecurringConflict({ proposed: slots, existing: slots }), "");
});

test("same-room conflicts include exact and partial time overlaps", () => {
  for (const range of [{ startTime: "17:00", endTime: "18:00" }, { startTime: "17:30", endTime: "18:30" }]) {
    const slots = [slot("a", { roomId: "r1" }), slot("b", { roomId: "r1", ...range })];
    assert.match(findRecurringConflict({ proposed: [slots[1]], existing: slots }), /Room/);
  }
});

test("same-coach and same-Batch overlaps are rejected, while different resources are allowed", () => {
  assert.match(findRecurringConflict({ proposed: [slot("b", { roomId: "r2", coachId: "c1" })], existing: [slot("a", { roomId: "r1", coachId: "c1" })] }), /coach/);
  assert.match(findRecurringConflict({ proposed: [slot("b", { roomId: "r2", batchId: "same" })], existing: [slot("a", { roomId: "r1", batchId: "same" })] }), /same Batch/);
  assert.equal(findRecurringConflict({ proposed: [slot("b", { roomId: "r2", coachId: "c2" })], existing: [slot("a", { roomId: "r1", coachId: "c1" })] }), "");
});

test("a closed Session does not reserve its Room, Coach, or Batch time", () => {
  const conflict = findDatedSessionConflict({ branch: "branch-1", batch: "batch-new", roomId: "room-1", coach: "coach-1", startTime: "07:00", endTime: "08:00", date: "2026-10-12" }, [
    { _id: "session-closed", branch: "branch-1", batch: "batch-old", roomId: "room-1", coach: "coach-1", startTime: "07:00", endTime: "08:00", status: "CLOSED" },
  ]);
  assert.equal(conflict, "");
});

test("room IDs are Branch-scoped while coaches are shared across Branches", () => {
  assert.equal(findRecurringConflict({ proposed: [slot("a", { roomId: "room", branchId: "branch-2" })], existing: [slot("b", { roomId: "room", branchId: "branch-1" })] }), "");
  assert.match(findRecurringConflict({ proposed: [slot("a", { roomId: "r2", coachId: "coach", branchId: "branch-2" })], existing: [slot("b", { roomId: "r1", coachId: "coach", branchId: "branch-1" })] }), /coach/);
});

test("unassigned slots reserve resources only when the resource ID is explicitly stored", () => {
  assert.equal(findRecurringConflict({ proposed: [slot("new", { batchId: null })], existing: [slot("old", { batchId: null })] }), "");
  assert.match(findRecurringConflict({ proposed: [slot("new", { batchId: null, roomId: "r1" })], existing: [slot("old", { batchId: null, roomId: "r1" })] }), /Room/);
});

test("editing a slot excludes its own persisted schedule identity", () => {
  const current = slot("existing", { roomId: "r1", startTime: "18:00", endTime: "19:00" });
  const persisted = { ...current };
  assert.equal(findRecurringConflict({ proposed: [current], existing: [persisted], ignoreSlotId: "existing" }), "");
});

test("a new Monday occurrence without a persisted slot ID does not conflict with itself", () => {
  const newMondaySlot = slot("", { batchId: "batch-1", roomId: "r1", startTime: "06:00", endTime: "07:00" });
  assert.equal(findRecurringConflict({ proposed: [newMondaySlot], existing: [newMondaySlot] }), "");
});

test("saving an unchanged schedule excludes each persisted occurrence from itself", () => {
  const monday = slot("monday-slot", { batchId: "batch-1", roomId: "r1", startTime: "06:00", endTime: "07:00" });
  const wednesday = { ...slot("wednesday-slot", { batchId: "batch-1", roomId: "r1", startTime: "06:00", endTime: "07:00" }), dayOfWeek: 3 };
  const unchanged = [monday, wednesday];
  assert.equal(findRecurringConflict({ proposed: unchanged, existing: unchanged }), "");
});

test("same times on different weekdays do not conflict", () => {
  const monday = slot("monday-slot", { batchId: "batch-1", roomId: "r1" });
  const tuesday = { ...slot("tuesday-slot", { batchId: "batch-1", roomId: "r1" }), dayOfWeek: 2 };
  assert.equal(findRecurringConflict({ proposed: [tuesday], existing: [monday] }), "");
});

test("duplicate submitted rows without IDs remain subject to genuine overlap checks", () => {
  const first = slot("", { batchId: "batch-1", roomId: "r1", startTime: "06:00", endTime: "07:00" });
  const duplicate = { ...first };
  assert.match(findRecurringConflict({ proposed: [first, duplicate], existing: [first, duplicate] }), /same Batch/);
});

test("distinct submitted rows reusing one persisted slot ID are not treated as the same row", () => {
  const first = slot("reused-id", { batchId: "batch-1", roomId: "r1", startTime: "06:00", endTime: "07:00" });
  const duplicate = { ...first };
  assert.match(findRecurringConflict({ proposed: [first, duplicate], existing: [first, duplicate] }), /same Batch/);
});

test("room assignments reject inactive and foreign-Branch rooms", () => {
  assert.match(roomAssignmentError({ _id: "r1", branch: "branch-2", isActive: true }, "branch-1"), /different Branch/);
  assert.match(roomAssignmentError({ _id: "r1", branch: "branch-1", isActive: false }, "branch-1"), /inactive/);
  assert.match(roomAssignmentError(null, "branch-1", true), /must be assigned/);
  assert.equal(roomAssignmentError({ _id: "r1", branch: "branch-1", isActive: true }, "branch-1"), "");
});
