const test = require("node:test");
const assert = require("node:assert/strict");
const { theoreticalMaximumSessions, countLearningSteps, capacityError } = require("../../src/services/curriculumCapacity.service");

test("theoretical Plan sessions use duration and frequency, rounding partial weeks up", () => {
  assert.equal(theoreticalMaximumSessions({ duration: 3, durationUnit: "MONTHS", classesPerWeek: 3 }), 39);
  assert.equal(theoreticalMaximumSessions({ duration: 15, durationUnit: "DAYS", classesPerWeek: 2 }), 6);
  assert.equal(theoreticalMaximumSessions({ duration: 12, durationUnit: "MONTHS", classesPerWeek: 4 }), 208);
  assert.equal(theoreticalMaximumSessions({ duration: 0, durationUnit: "DAYS", classesPerWeek: 3 }), 0);
});

test("Curriculum capacity counts learning steps once within each Curriculum", () => {
  const first = { toString: () => "same" };
  assert.equal(countLearningSteps([{ steps: [{ _id: first }, { _id: first }, {}] }]), 2);
  assert.equal(capacityError({ requiredSteps: 39, maximumSessions: 39 }), "");
  assert.match(capacityError({ requiredSteps: 40, maximumSessions: 39 }), /exceeding.*39 sessions by 1/);
});
