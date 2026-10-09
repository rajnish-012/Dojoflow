export function theoreticalMaximumSessions(duration: number, unit: "MONTHS" | "DAYS", classesPerWeek: number) {
  if (!Number.isInteger(duration) || duration < 1 || !Number.isInteger(classesPerWeek) || classesPerWeek < 1) return 0;
  const fullWeeks = unit === "DAYS" ? Math.ceil(duration / 7) : Math.ceil(duration * 52 / 12);
  return fullWeeks * classesPerWeek;
}
