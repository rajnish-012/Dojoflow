const FINANCE_TIME_ZONE = "Asia/Kolkata";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FINANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat("en", {
  timeZone: FINANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

function academyDateKey(value) {
  return dateFormatter.format(new Date(value));
}

function isPastDue(dueDate, reference = new Date()) {
  return academyDateKey(dueDate) < academyDateKey(reference);
}

function academyDayStart(value) {
  const [year, month, day] = academyDateKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - (5 * 60 + 30) * 60 * 1000);
}

function academyMonthStart(value, monthsBack = 0) {
  const parts = Object.fromEntries(monthFormatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  const monthStart = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1 - monthsBack, 1));
  return new Date(monthStart.getTime() - (5 * 60 + 30) * 60 * 1000);
}

function academyYearMonth(value, monthsBack = 0) {
  const monthStart = academyMonthStart(value, monthsBack);
  const parts = Object.fromEntries(monthFormatter.formatToParts(monthStart).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}`;
}

module.exports = { FINANCE_TIME_ZONE, academyDateKey, academyDayStart, academyMonthStart, academyYearMonth, isPastDue };
