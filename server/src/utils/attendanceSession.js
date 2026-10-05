const BranchSchedule = require("../models/BranchSchedule");

async function withAttendanceSessionDetails(records, branchId) {
  if (!Array.isArray(records) || !records.length) return records || [];

  const needsFallback = records.some(
    (record) => record.sessionSlotId && (!record.sessionStartTime || !record.sessionEndTime),
  );
  if (!needsFallback || !branchId) return records;

  const schedule = await BranchSchedule.findOne({ branch: branchId })
    .select("weeklySchedule")
    .lean();
  const slotsById = new Map();
  for (const day of schedule?.weeklySchedule || []) {
    for (const slot of day.slots || []) {
      slotsById.set(String(slot._id), slot);
    }
  }

  return records.map((record) => {
    const slot = slotsById.get(String(record.sessionSlotId || ""));
    if (!slot) return record;
    return {
      ...record,
      sessionName: record.sessionName || slot.sessionName || "",
      sessionStartTime: record.sessionStartTime || slot.startTime || "",
      sessionEndTime: record.sessionEndTime || slot.endTime || "",
    };
  });
}

module.exports = { withAttendanceSessionDetails };
