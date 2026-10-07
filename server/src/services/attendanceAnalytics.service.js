const REPORT_TIME_ZONE = "Asia/Kolkata";

/** Shared regular-attendance deduplication for attendance reports. */
function regularAttendanceStages(match) {
  return [
    {
      $match: {
        ...match,
        attendanceType: { $ne: "MAKEUP" },
        status: { $in: ["PRESENT", "ABSENT"] },
      },
    },
    { $sort: { date: 1, createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: {
          student: "$student",
          calendarDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$date",
              timezone: REPORT_TIME_ZONE,
            },
          },
        },
        attendance: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$attendance" } },
  ];
}

module.exports = { REPORT_TIME_ZONE, regularAttendanceStages };
