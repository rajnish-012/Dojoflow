const test = require("node:test");
const assert = require("node:assert/strict");

const { deriveProgramProgress } = require("../../src/services/programProgress.service");

const curriculum = [{ day: 1 }, { day: 2 }, { day: 3 }];

test("only Present regular attendance in a live Session advances Program training progress", () => {
  const records = [
    { planDay: 1, status: "ABSENT", date: "2026-10-01T10:00:00.000Z", attendanceType: "REGULAR", session: { status: "COMPLETED" } },
    { planDay: 2, status: "PRESENT", date: "2026-10-02T10:00:00.000Z", attendanceType: "REGULAR", session: { status: "CANCELLED" } },
    { planDay: 2, status: "PRESENT", date: "2026-10-03T10:00:00.000Z", attendanceType: "REGULAR", session: { status: "CLOSED" } },
    { planDay: 1, status: "PRESENT", date: "2026-10-04T10:00:00.000Z", attendanceType: "REGULAR", session: { status: "COMPLETED" } },
    { planDay: 2, status: "PRESENT", date: "2026-10-05T10:00:00.000Z", attendanceType: "MAKEUP", session: { status: "COMPLETED" } },
  ];
  assert.deepEqual(deriveProgramProgress(records, curriculum), { currentTrainingDay: 1, completedDays: [1], nextDay: 2 });
});

test("learning progress stays at the first step until the first attended Session", () => {
  const records = [
    { planDay: 1, status: "ABSENT", date: "2026-10-01T10:00:00.000Z", attendanceType: "REGULAR", session: { status: "COMPLETED" } },
  ];
  assert.deepEqual(deriveProgramProgress(records, curriculum), { currentTrainingDay: 0, completedDays: [], nextDay: 1 });
});
