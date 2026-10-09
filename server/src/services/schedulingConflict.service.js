const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (value) => {
  if (!TIME.test(String(value || ""))) return null;
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
};
const ref = (value) => String(value?._id || value || "");

function roomAssignmentError(room, branchId, required = false) {
  if (!room) return required ? "An active room must be assigned before this session can be saved." : "";
  if (ref(room.branch) !== ref(branchId)) return "The selected room belongs to a different Branch.";
  if (room.isActive === false) return "The selected room is inactive and cannot be assigned to a new session.";
  return "";
}

function findRecurringConflict({ proposed, existing, ignoreSlotId = "" }) {
  for (const current of proposed) {
    if (current.active === false || !Number.isInteger(Number(current.dayOfWeek))) continue;
    const start = toMinutes(current.startTime), end = toMinutes(current.endTime);
    if (start === null || end === null || start >= end) continue;
    for (const other of existing) {
      // The branch schedule validator compares the submitted rows against
      // that same array. A newly-created frontend row has a temporary ID
      // that is intentionally omitted from the request, so its slotId is
      // empty. Skip the identical row object by identity; distinct rows,
      // including duplicate rows without IDs, still go through conflict
      // validation below.
      if (current === other) continue;
      if (other.active === false || (ignoreSlotId && ref(other.slotId) === ref(ignoreSlotId)) || Number(other.dayOfWeek) !== Number(current.dayOfWeek)) continue;
      const otherStart = toMinutes(other.startTime), otherEnd = toMinutes(other.endTime);
      if (otherStart === null || otherEnd === null || !(start < otherEnd && otherStart < end)) continue;
      if (current.branchId === other.branchId && ref(current.batchId) && ref(current.batchId) === ref(other.batchId)) {
        return `${current.dayName || "This day"} overlaps another occurrence of the same Batch (${other.startTime}–${other.endTime}).`;
      }
      if (current.roomId && ref(current.roomId) === ref(other.roomId) && current.branchId === other.branchId) {
        return `Room ${current.roomName || "selected"} is already booked ${other.startTime}–${other.endTime} on ${current.dayName || "this day"}.`;
      }
      if (current.coachId && ref(current.coachId) === ref(other.coachId)) {
        return `The assigned coach is already scheduled ${other.startTime}–${other.endTime} on ${current.dayName || "this day"}.`;
      }
    }
  }
  return "";
}

function findDatedSessionConflict(proposed, sessions = [], excludeSessionId = "") {
  const candidate = {
    ...proposed,
    branchId: proposed.branchId || proposed.branch,
    batchId: proposed.batchId || proposed.batch,
    roomId: proposed.roomId,
    coachId: proposed.coachId || proposed.coach,
    dayOfWeek: 0,
    dayName: proposed.date,
    slotId: excludeSessionId || "new-session",
  };
  const existing = sessions.map((session) => ({
    branchId: ref(session.branch), slotId: ref(session._id), dayOfWeek: 0, dayName: proposed.date,
    startTime: session.startTime, endTime: session.endTime, active: ["SCHEDULED", "COMPLETED"].includes(session.status),
    batchId: ref(session.batch), roomId: ref(session.roomId), coachId: ref(session.coach),
  }));
  return findRecurringConflict({ proposed: [candidate], existing, ignoreSlotId: excludeSessionId });
}

module.exports = { toMinutes, roomAssignmentError, findRecurringConflict, findDatedSessionConflict };
