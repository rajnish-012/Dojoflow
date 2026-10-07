const { academyDateKey } = require("../utils/financeDates");

const RENEWAL_REMINDERS = [30, 15, 7, 1];

function dayNumber(value) {
  const [year, month, day] = academyDateKey(value).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function daysUntil(value, from = new Date()) {
  if (!value) return null;
  return dayNumber(value) - dayNumber(from);
}

function getMembershipStatus(enrollment, asOf = new Date()) {
  if (!enrollment) return "NEW";
  if (enrollment.renewedTo) return "RENEWED";
  if (enrollment.status === "CANCELLED") return "CANCELLED";
  if (enrollment.status === "COMPLETED" || enrollment.status === "ENDED")
    return "COMPLETED";
  if (enrollment.status === "PAUSED") return "PAUSED";
  if (enrollment.status === "EXPIRED") return "EXPIRED";
  if (enrollment.status !== "ACTIVE") return "NEW";
  if (enrollment.startDate && dayNumber(enrollment.startDate) > dayNumber(asOf))
    return "NEW";
  if (enrollment.endDate) {
    const remaining = daysUntil(enrollment.endDate, asOf);
    if (remaining < 0) return "EXPIRED";
    if (remaining <= 30) return "EXPIRING";
  }
  return "ACTIVE";
}

function isEnrollmentEligible(enrollment, start, end = start) {
  if (!enrollment || enrollment.status !== "ACTIVE") return false;
  const startsAt = new Date(enrollment.startDate);
  if (Number.isNaN(startsAt.getTime()) || startsAt > new Date(end))
    return false;
  if (enrollment.endDate && new Date(enrollment.endDate) <= new Date(start))
    return false;
  return true;
}

function findEnrollmentForDate(enrollments, start, end = start) {
  return (
    [...(enrollments || [])]
      .reverse()
      .find((item) => isEnrollmentEligible(item, start, end)) || null
  );
}

module.exports = {
  RENEWAL_REMINDERS,
  daysUntil,
  getMembershipStatus,
  isEnrollmentEligible,
  findEnrollmentForDate,
};
