const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveFirstAttendedClassDate, assignedBatchOnDate } = require("../../src/services/enrollmentAttendance.service");

const enrollment = {
  _id: "enrollment-1",
  plan: "plan-1",
  branch: "branch-1",
  batch: "batch-1",
  startDate: new Date(2026, 9, 1),
  programs: [{ program: "program-1" }, { program: "program-2" }],
  batchTransfers: [],
};

function attendance(overrides = {}) {
  const date = "2026-10-12";
  return {
    status: "PRESENT",
    attendanceType: "REGULAR",
    date: new Date(2026, 9, 12, 12),
    batch: "batch-1",
    branch: "branch-1",
    sessionTypeId: "program-1",
    sessionSlotId: "slot-1",
    session: { batch: "batch-1", branch: "branch-1", plan: "plan-1", program: "program-1", status: "COMPLETED", date, scheduleSlotId: "slot-1" },
    ...overrides,
  };
}

test("first attended class uses the earliest verified regular PRESENT Session for its enrollment", () => {
  const result = deriveFirstAttendedClassDate([
    attendance({ date: new Date(2026, 9, 19, 12), session: { ...attendance().session, date: "2026-10-19" } }),
    attendance(),
    attendance({ status: "ABSENT", date: new Date(2026, 9, 5, 12) }),
    attendance({ attendanceType: "MAKEUP", date: new Date(2026, 9, 3, 12) }),
    attendance({ session: null }),
    attendance({ session: { ...attendance().session, status: "CLOSED" } }),
  ], enrollment);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 9);
  assert.equal(result.getDate(), 12);
});

test("attendance must match the enrollment Batch, Branch, Plan, Program, and Session date", () => {
  const invalid = [
    attendance({ batch: "batch-2" }),
    attendance({ session: { ...attendance().session, batch: "batch-2" } }),
    attendance({ session: { ...attendance().session, branch: "branch-2" } }),
    attendance({ session: { ...attendance().session, plan: "plan-2" } }),
    attendance({ session: { ...attendance().session, program: "program-3" } }),
    attendance({ session: { ...attendance().session, date: "2026-10-13" } }),
    attendance({ session: { ...attendance().session, status: "CANCELLED" } }),
  ];
  assert.equal(deriveFirstAttendedClassDate(invalid, enrollment), null);
});

test("Batch transfer history assigns attendance to the Batch effective on that date", () => {
  const transferredEnrollment = {
    ...enrollment,
    batch: "batch-2",
    batchTransfers: [{ from: "batch-1", to: "batch-2", effectiveDate: new Date(2026, 9, 15) }],
  };
  assert.equal(assignedBatchOnDate(transferredEnrollment, "2026-10-14"), "batch-1");
  assert.equal(assignedBatchOnDate(transferredEnrollment, "2026-10-15"), "batch-2");
  assert.ok(deriveFirstAttendedClassDate([attendance()], transferredEnrollment));
  assert.equal(deriveFirstAttendedClassDate([attendance({ date: new Date(2026, 9, 16, 12), session: { ...attendance().session, date: "2026-10-16" } })], transferredEnrollment), null);
});

test("attendance before enrollment start or after its end does not establish the date", () => {
  assert.equal(deriveFirstAttendedClassDate([attendance({ date: new Date(2026, 8, 30, 12), session: { ...attendance().session, date: "2026-09-30" } })], enrollment), null);
  assert.equal(deriveFirstAttendedClassDate([attendance()], { ...enrollment, endDate: new Date(2026, 9, 11) }), null);
});
