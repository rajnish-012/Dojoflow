const Attendance = require("../models/Attendance");

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
    .select("planDay status makeupRequired makeupCompleted")
    .lean();
  const completed = new Set(
    records
      .filter(
        (record) =>
          record.status === "PRESENT" ||
          (record.makeupRequired && record.makeupCompleted),
      )
      .map((record) => Number(record.planDay))
      .filter(Number.isInteger),
  );
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
