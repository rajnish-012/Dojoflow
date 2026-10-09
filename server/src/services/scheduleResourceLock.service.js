const crypto = require("node:crypto");
const ScheduleResourceLock = require("../models/ScheduleResourceLock");
const Batch = require("../models/Batch");

async function acquireScheduleResourceLocks({ branchId, scheduleDays, existingDays = [] }) {
  const allDays = [...scheduleDays, ...existingDays];
  const batchIds = [...new Set(allDays.flatMap((day) => (day.slots || []).map((slot) => String(slot.batchId || "")).filter(Boolean)))];
  const batches = batchIds.length ? await Batch.find({ _id: { $in: batchIds }, branch: branchId }).select("_id coach roomId").lean() : [];
  const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
  const keys = new Set();
  for (const day of allDays) {
    if (day.isClosed) continue;
    for (const slot of day.slots || []) {
      if (slot.isActive === false) continue;
      const batch = batchById.get(String(slot.batchId || ""));
      const roomId = String(slot.roomId || batch?.roomId || "");
      const coachId = String(slot.coach || batch?.coach || "");
      const dayKey = Number(day.dayOfWeek);
      if (roomId) keys.add(`room:${branchId}:${roomId}:${dayKey}`);
      if (coachId) keys.add(`coach:${coachId}:${dayKey}`);
      if (batch) keys.add(`batch:${branchId}:${batch._id}:${dayKey}`);
    }
  }
  const token = crypto.randomUUID();
  const locked = [];
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + 5 * 60 * 1000);
  try {
    for (const key of [...keys].sort()) {
      const lock = await ScheduleResourceLock.findOneAndUpdate(
        { key, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
        { $set: { token, lockedUntil, deleteAfter: lockedUntil } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (!lock) throw new Error("Scheduling resource is being updated. Refresh and retry shortly.");
      locked.push(key);
    }
  } catch (error) {
    await ScheduleResourceLock.updateMany({ key: { $in: locked }, token }, { $set: { token: null, lockedUntil: null, deleteAfter: null } });
    if (error?.code === 11000) {
      const conflict = new Error("A room, coach, or Batch is being scheduled by another request. Refresh and retry shortly.");
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
  return async () => {
    if (locked.length) await ScheduleResourceLock.updateMany({ key: { $in: locked }, token }, { $set: { token: null, lockedUntil: null, deleteAfter: null } });
  };
}

module.exports = { acquireScheduleResourceLocks };
