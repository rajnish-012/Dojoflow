const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSessionFields, generateSessionOccurrences, dateList } = require("../../src/services/session.service");

test("local date ranges include both endpoints without UTC date shifts", () => {
  assert.deepEqual(dateList("2026-10-12", "2026-10-13"), ["2026-10-12", "2026-10-13"]);
});

test("Batch schedule resolution preserves multiple same-day sessions and holiday closures", () => {
  const branches = [{ _id: "branch-1", name: "North" }];
  const schedules = [{ _id: "schedule-1", branch: "branch-1", weeklySchedule: [{ dayOfWeek: 1, isClosed: false, slots: [
    { _id: "slot-1", batchId: "batch-1", sessionTypeId: "program-1", startTime: "07:00", endTime: "08:00", isActive: true },
    { _id: "slot-2", batchId: "batch-1", sessionTypeId: "program-2", startTime: "08:00", endTime: "09:00", isActive: true },
  ] }] }];
  const batches = [{ _id: "batch-1", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-10-31", plan: { programs: [{ program: "program-1" }, { program: "program-2" }] } }];
  const resolved = generateSessionOccurrences({ branches, schedules, batches, holidays: [{ branch: "branch-1", date: new Date(2026, 9, 12) }], start: "2026-10-12", end: "2026-10-13" });
  assert.equal(resolved.length, 0);
  const withoutHoliday = generateSessionOccurrences({ branches, schedules, batches, holidays: [], start: "2026-10-12", end: "2026-10-12" });
  assert.equal(withoutHoliday.length, 2);
  assert.deepEqual(withoutHoliday.map((item) => item.slot._id), ["slot-1", "slot-2"]);
});

test("an activated three-day Batch resolves only configured weekdays within its date boundaries", () => {
  const branches = [{ _id: "branch-1" }];
  const slots = [1, 2, 3].map((dayOfWeek) => ({
    _id: `slot-${dayOfWeek}`, batchId: "batch-1", sessionTypeId: "program-1",
    startTime: "06:00", endTime: "07:00", isActive: true,
  }));
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek, isClosed: ![1, 2, 3].includes(dayOfWeek),
    slots: slots.filter((slot) => Number(slot._id.slice(-1)) === dayOfWeek),
  }));
  const schedules = [{ _id: "schedule-1", branch: "branch-1", weeklySchedule }];
  const batches = [{ _id: "batch-1", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-10", calculatedEndDate: "2026-10-14", plan: { programs: [{ program: "program-1" }] } }];
  const dates = generateSessionOccurrences({ branches, schedules, batches, start: "2026-10-05", end: "2026-10-21" }).map((item) => `${item.date}:${item.dayOfWeek}`);
  assert.deepEqual(dates, ["2026-10-12:1", "2026-10-13:2", "2026-10-14:3"]);
  assert.deepEqual(generateSessionOccurrences({ branches, schedules, batches: [{ ...batches[0], status: "DRAFT" }], start: "2026-10-05", end: "2026-10-21" }), []);
});

test("Batch Session resolution skips inactive, wrong-Branch, wrong-Program and out-of-range slots", () => {
  const branches = [{ _id: "branch-1" }];
  const schedules = [{ branch: "branch-1", weeklySchedule: [{ dayOfWeek: 1, isClosed: false, slots: [
    { _id: "slot-1", batchId: "batch-1", sessionTypeId: "other", startTime: "07:00", endTime: "08:00", isActive: true },
    { _id: "slot-2", batchId: "batch-1", sessionTypeId: "program-1", startTime: "08:00", endTime: "09:00", isActive: false },
  ] }] }];
  const batches = [{ _id: "batch-1", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-20", calculatedEndDate: "2026-10-31", plan: { programs: [{ program: "program-1" }] } }];
  assert.equal(generateSessionOccurrences({ branches, schedules, batches, start: "2026-10-12", end: "2026-10-12" }).length, 0);
});

test("recurring occurrences respect independent Batch start and calculated completion dates", () => {
  const branches = [{ _id: "branch-1" }];
  const schedules = [{ branch: "branch-1", weeklySchedule: [{ dayOfWeek: 1, isClosed: false, slots: [
    { _id: "slot-a", batchId: "batch-a", sessionTypeId: "program-1", startTime: "07:00", endTime: "08:00" },
    { _id: "slot-b", batchId: "batch-b", sessionTypeId: "program-1", startTime: "08:00", endTime: "09:00" },
  ] }] }];
  const batches = [
    { _id: "batch-a", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: "2026-10-19", plan: { programs: [{ program: "program-1" }] } },
    { _id: "batch-b", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-26", calculatedEndDate: "2026-11-02", plan: { programs: [{ program: "program-1" }] } },
  ];
  const rows = generateSessionOccurrences({ branches, schedules, batches, start: "2026-10-12", end: "2026-11-02" });
  assert.deepEqual(rows.filter((row) => row.batch._id === "batch-a").map((row) => row.date), ["2026-10-12", "2026-10-19"]);
  assert.deepEqual(rows.filter((row) => row.batch._id === "batch-b").map((row) => row.date), ["2026-10-26", "2026-11-02"]);
});

test("a started Batch without a calculated end does not generate open-ended occurrences", () => {
  const branches = [{ _id: "branch-1" }];
  const schedules = [{ branch: "branch-1", weeklySchedule: [{ dayOfWeek: 1, slots: [{ _id: "slot-a", batchId: "batch-a", sessionTypeId: "program-1", startTime: "07:00", endTime: "08:00" }] }] }];
  const batches = [{ _id: "batch-a", branch: "branch-1", status: "ACTIVE", startDate: "2026-10-12", calculatedEndDate: null, plan: { programs: [{ program: "program-1" }] } }];
  assert.equal(generateSessionOccurrences({ branches, schedules, batches, start: "2026-10-12", end: "2026-10-19" }).length, 0);
});

test("materialized Session fields retain the assigned room and coach with slot overrides", () => {
  const fields = buildSessionFields({
    branchId: "branch-1", schedule: { _id: "schedule-1" },
    batch: { _id: "batch-1", plan: "plan-1", name: "Batch A", roomId: "batch-room", coach: "batch-coach", capacity: 18 },
    slot: { _id: "slot-1", sessionTypeId: "program-1", roomId: "slot-room", coach: "slot-coach", startTime: "17:00", endTime: "18:00" },
    date: "2026-10-12", dayOfWeek: 1,
  });
  assert.equal(fields.roomId, "slot-room");
  assert.equal(fields.coach, "slot-coach");
  assert.equal(fields.branch, "branch-1");
  assert.equal(fields.date, "2026-10-12");
});
