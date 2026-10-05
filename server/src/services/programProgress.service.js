const Attendance = require("../models/Attendance");
const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
    .select("planDay status date createdAt attendanceType")
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();
  // Historical duplicates on one calendar date count as one decision.
  // Makeup attendance is recovery history, never regular progression.
  const consumedDates = new Set();
  const completed = new Set();
  for (const record of records) {
    if (record.attendanceType === "MAKEUP" || !["PRESENT", "ABSENT"].includes(record.status)) continue;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) continue;
    const dateKey = indiaDateFormatter.format(date);
    if (consumedDates.has(dateKey)) continue;
    consumedDates.add(dateKey);
    const day = Number(record.planDay);
    if (Number.isInteger(day) && day > 0) completed.add(day);
  }
  const days = [
    ...new Set(
      (curriculum || [])
        .map((item) => Number(item.day))
        .filter((day) => Number.isInteger(day) && day > 0),
    ),
  ].sort((a, b) => a - b);
  let currentTrainingDay = 0;
  for (const day of days) {
    if (!completed.has(day)) break;
    currentTrainingDay = day;
  }
  return {
    currentTrainingDay,
    completedDays: days.filter((day) => completed.has(day)),
    nextDay: days.find((day) => !completed.has(day)) || null,
    attendance: records,
  };
}

module.exports = { getProgramLearningProgress };
