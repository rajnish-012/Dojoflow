const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const { formatDate, parseCalendarDate } = require("./branchSchedule.service");

function sameId(left, right) {
  return Boolean(left && right && String(left._id || left) === String(right._id || right));
}

function assignedBatchOnDate(enrollment, dateKey) {
  const transfers = [...(enrollment.batchTransfers || [])]
    .filter((transfer) => transfer?.to && transfer?.effectiveDate)
    .sort((a, b) => formatDate(a.effectiveDate).localeCompare(formatDate(b.effectiveDate)));
  let batch = transfers.length ? (transfers[0].from || enrollment.batch) : enrollment.batch;
  for (const transfer of transfers) {
    const effectiveDate = formatDate(transfer.effectiveDate);
    if (effectiveDate && effectiveDate <= dateKey) batch = transfer.to;
  }
  return batch;
}

function isEligibleEnrollmentAttendance(record, enrollment) {
  if (!record || record.status !== "PRESENT" || record.attendanceType === "MAKEUP") return false;
  const session = record.session;
  if (!session || !["SCHEDULED", "COMPLETED"].includes(session.status)) return false;
  const dateKey = formatDate(record.date);
  if (!dateKey || formatDate(enrollment.startDate) > dateKey || (enrollment.endDate && formatDate(enrollment.endDate) < dateKey)) return false;
  if (session.date !== dateKey || !sameId(session.batch, record.batch) || !sameId(session.batch, assignedBatchOnDate(enrollment, dateKey))) return false;
  if (!sameId(session.branch, record.branch) || !sameId(session.branch, enrollment.branch)) return false;
  if (!sameId(session.plan, enrollment.plan) || !sameId(session.program, record.sessionTypeId)) return false;
  if (record.sessionSlotId && session.scheduleSlotId && !sameId(record.sessionSlotId, session.scheduleSlotId)) return false;
  const allowedPrograms = (enrollment.programs || []).map((item) => item.program).filter(Boolean);
  if (allowedPrograms.length && !allowedPrograms.some((program) => sameId(program, session.program))) return false;
  if (!allowedPrograms.length && enrollment.program && !sameId(enrollment.program, session.program)) return false;
  return true;
}

function deriveFirstAttendedClassDate(records, enrollment) {
  const eligibleDates = (records || [])
    .filter((record) => isEligibleEnrollmentAttendance(record, enrollment))
    .map((record) => parseCalendarDate(record.date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return eligibleDates[0] || null;
}

async function resolveEnrollmentFirstAttendedClassDate({ studentId, enrollment, session, preferStored = true } = {}) {
  if (preferStored && enrollment?.firstAttendedClassDate) return enrollment.firstAttendedClassDate;
  if (!studentId || !enrollment?._id) return null;
  let attendanceQuery = Attendance.find({
    student: studentId,
    enrollment: enrollment._id,
    status: "PRESENT",
    attendanceType: { $ne: "MAKEUP" },
    session: { $ne: null },
  }).populate("session", "batch branch plan program status date scheduleSlotId");
  if (session) attendanceQuery = attendanceQuery.session(session);
  return deriveFirstAttendedClassDate(await attendanceQuery.lean(), enrollment);
}

async function recalculateEnrollmentFirstAttendedClassDate({ studentId, enrollmentId, session: dbSession } = {}) {
  if (!studentId || !enrollmentId) return null;
  let studentQuery = Student.findById(studentId).select("planEnrollments");
  if (dbSession) studentQuery = studentQuery.session(dbSession);
  const student = await studentQuery;
  const enrollment = student?.planEnrollments?.id(enrollmentId);
  if (!enrollment) return null;

  const firstAttendedClassDate = await resolveEnrollmentFirstAttendedClassDate({ studentId, enrollment, session: dbSession, preferStored: false });

  let update = Student.updateOne(
    { _id: studentId, "planEnrollments._id": enrollmentId },
    { $set: { "planEnrollments.$.firstAttendedClassDate": firstAttendedClassDate } },
  );
  if (dbSession) update = update.session(dbSession);
  await update;
  return firstAttendedClassDate;
}

module.exports = {
  assignedBatchOnDate,
  deriveFirstAttendedClassDate,
  isEligibleEnrollmentAttendance,
  resolveEnrollmentFirstAttendedClassDate,
  recalculateEnrollmentFirstAttendedClassDate,
};
