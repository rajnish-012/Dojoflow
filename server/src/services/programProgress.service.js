const Attendance = require("../models/Attendance");
const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function deriveProgramProgress(records = [], curriculum = []) {
  const attendedDates = new Set();
  const completed = new Set();
  for (const record of records) {
    // Only a Present regular Session records actual participation. Absence,
    // scheduled time, and makeup history do not advance regular progression.
    const sessionStatus = record.session && typeof record.session === "object" ? record.session.status : null;
    if (record.attendanceType === "MAKEUP" || record.status !== "PRESENT" || ["CLOSED", "CANCELLED"].includes(sessionStatus)) continue;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) continue;
    const dateKey = indiaDateFormatter.format(date);
    if (attendedDates.has(dateKey)) continue;
    attendedDates.add(dateKey);
    const day = Number(record.planDay);
    if (Number.isInteger(day) && day > 0) completed.add(day);
  }
  const days = [...new Set((curriculum || []).map((item) => Number(item.day)).filter((day) => Number.isInteger(day) && day > 0))].sort((a, b) => a - b);
  let currentTrainingDay = 0;
  for (const day of days) {
    if (!completed.has(day)) break;
    currentTrainingDay = day;
  }
  return {
    currentTrainingDay,
    completedDays: days.filter((day) => completed.has(day)),
    nextDay: days.find((day) => !completed.has(day)) || null,
  };
}

async function getProgramLearningProgress({
  studentId,
  programId,
  enrollmentId,
  enrollmentStartDate,
  enrollmentEndDate,
  curriculum = [],
  asOfDate,
}) {
  const filter = { student: studentId, sessionTypeId: programId };
  if (enrollmentId) {
    const enrollmentRange = {};
    if (enrollmentStartDate)
      enrollmentRange.$gte = new Date(enrollmentStartDate);
    if (enrollmentEndDate) enrollmentRange.$lt = new Date(enrollmentEndDate);
    if (asOfDate)
      enrollmentRange.$lte = new Date(
        new Date(asOfDate).setHours(23, 59, 59, 999),
      );
    const legacyRange = { ...enrollmentRange };
    filter.$or = [
      {
        enrollment: enrollmentId,
        ...(Object.keys(enrollmentRange).length
          ? { date: enrollmentRange }
          : {}),
      },
      {
        enrollment: null,
        ...(Object.keys(legacyRange).length ? { date: legacyRange } : {}),
      },
    ];
  } else if (asOfDate) {
    filter.date = {
      $lte: new Date(new Date(asOfDate).setHours(23, 59, 59, 999)),
    };
  }
  const records = await Attendance.find(filter)
    .select("planDay status date createdAt attendanceType session")
    .populate("session", "status")
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();
  const progress = deriveProgramProgress(records, curriculum);
  return {
    ...progress,
    attendance: records,
  };
}

module.exports = { getProgramLearningProgress, deriveProgramProgress };
