const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (value) => {
  if (!TIME_PATTERN.test(String(value || ""))) return null;
  const [hours, mins] = String(value).split(":").map(Number);
  return hours * 60 + mins;
};

function inspectBatchOccurrences({ weeklySchedule = [], batchId, allowedProgramIds = [], openingTime, closingTime, requireRoom = false, defaultRoomId = null }) {
  const allowed = new Set(allowedProgramIds.map(String));
  const opening = minutes(openingTime), closing = minutes(closingTime);
  const occurrences = [];
  const errors = [];
  const slotIds = new Set();
  const occurrenceKeys = new Set();
  for (const day of weeklySchedule) {
    if (day.isClosed) continue;
    const activeSlots = (day.slots || []).filter((slot) => slot?.isActive !== false);
    for (const slot of activeSlots) {
      if (String(slot?.batchId || "") !== String(batchId)) continue;
      const id = String(slot?._id || "");
      if (!id || slotIds.has(id)) errors.push("A Batch schedule entry is duplicated. Keep each weekly occurrence as a distinct slot.");
      slotIds.add(id);
      const start = minutes(slot.startTime);
      const end = minutes(slot.endTime);
      if (!String(slot.sessionName || "").trim() || start === null || end === null || start >= end) {
        errors.push("Every Batch occurrence needs a name and valid start and end times.");
        continue;
      }
      if ((opening !== null && start < opening) || (closing !== null && end > closing)) {
        errors.push("A Batch occurrence falls outside the Branch opening hours.");
        continue;
      }
      const signature = `${day.dayOfWeek}:${slot.startTime}:${slot.endTime}`;
      if (occurrenceKeys.has(signature)) errors.push("Duplicate weekly times were found for this Batch.");
      occurrenceKeys.add(signature);
      if (!slot.sessionTypeId || !allowed.has(String(slot.sessionTypeId))) {
        errors.push("Every Batch occurrence must use a valid active Program included in its Plan.");
        continue;
      }
      if (requireRoom && !(slot.roomId || defaultRoomId)) {
        errors.push("Every Batch occurrence must be assigned to an active Branch room.");
        continue;
      }
      const overlaps = activeSlots.some((other) => {
        if (other === slot) return false;
        if (String(other?.batchId || "") !== String(batchId)) return false;
        const otherStart = minutes(other.startTime), otherEnd = minutes(other.endTime);
        return otherStart !== null && otherEnd !== null && start < otherEnd && end > otherStart;
      });
      if (overlaps) {
        errors.push(`The ${day.dayOfWeek} schedule contains an overlapping session for ${slot.sessionName}.`);
        continue;
      }
      occurrences.push(slot);
    }
  }
  return { count: occurrences.length, occurrences, errors: [...new Set(errors)] };
}

module.exports = { inspectBatchOccurrences };
