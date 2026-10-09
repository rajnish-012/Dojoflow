const test = require("node:test");
const assert = require("node:assert/strict");

process.env.TZ = "Asia/Kolkata";

const {
  dayKey,
  eventIntervals,
  eventsOverlap,
} = require("../../src/services/calendar.service");

test("calendar preserves local calendar dates at month and leap-year boundaries", () => {
  assert.equal(dayKey("2028-02-29"), "2028-02-29");
  assert.equal(dayKey("2028-03-01"), "2028-03-01");
  assert.equal(dayKey("2026-12-31"), "2026-12-31");
});

test("calendar overlap detection handles events crossing midnight", () => {
  const overnight = {
    startDate: "2026-12-31",
    endDate: "2026-12-31",
    startTime: "23:30",
    endTime: "00:30",
  };
  assert.deepEqual(eventIntervals(overnight), [
    { date: "2026-12-31", from: 1410, to: 1440 },
    { date: "2027-01-01", from: 0, to: 30 },
  ]);
  assert.equal(eventsOverlap(overnight, {
    startDate: "2027-01-01",
    endDate: "2027-01-01",
    startTime: "00:15",
    endTime: "00:45",
  }), true);
  assert.equal(eventsOverlap(overnight, {
    startDate: "2027-01-01",
    endDate: "2027-01-01",
    startTime: "00:30",
    endTime: "01:00",
  }), false);
});
