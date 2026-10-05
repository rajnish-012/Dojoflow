require("dotenv").config();
const mongoose = require("mongoose");

const INDIA_TIME_ZONE = "Asia/Kolkata";
const formatters = new Intl.DateTimeFormat("en-CA", {
  timeZone: INDIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function indiaDateKey(value) {
  const parts = Object.fromEntries(
    formatters.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localMidnight(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

async function findConflicts(attendanceCollection, makeupCollection) {
  const [attendance, makeupRecords] = await Promise.all([
    attendanceCollection.find({}, { projection: { _id: 1, student: 1, date: 1, attendanceType: 1 } }).toArray(),
    makeupCollection.find({ makeupAttendance: { $type: "objectId" } }, { projection: { makeupAttendance: 1 } }).toArray(),
  ]);
  const makeupIds = new Set(makeupRecords.map((item) => String(item.makeupAttendance)));
  const groups = new Map();
  for (const record of attendance) {
    const isMakeup = record.attendanceType === "MAKEUP" || makeupIds.has(String(record._id));
    if (isMakeup || !record.student || !record.date) continue;
    const key = `${record.student}:${indiaDateKey(record.date)}`;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }
  const duplicateAttendance = [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => ({ key, records: records.map(({ _id, date }) => ({ id: String(_id), date })) }));

  const makeupGroups = new Map();
  for (const makeup of await makeupCollection.find({}, { projection: { _id: 1, originalAttendance: 1 } }).toArray()) {
    if (!makeup.originalAttendance) continue;
    const key = String(makeup.originalAttendance);
    const group = makeupGroups.get(key) || [];
    group.push(String(makeup._id));
    makeupGroups.set(key, group);
  }
  const duplicateMakeups = [...makeupGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([originalAttendance, makeupIds]) => ({ originalAttendance, makeupIds }));
  const invalidMakeups = (await makeupCollection.find({}, { projection: { _id: 1, originalAttendance: 1 } }).toArray())
    .filter((item) => !item.originalAttendance || typeof item.originalAttendance.toHexString !== "function")
    .map((item) => String(item._id));

  return { attendance, makeupIds, duplicateAttendance, duplicateMakeups, invalidMakeups };
}

async function migrateAttendanceDateIndex({ attendanceCollection, makeupCollection, apply = false, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }) {
  const conflicts = await findConflicts(attendanceCollection, makeupCollection);
  if (conflicts.duplicateAttendance.length || conflicts.duplicateMakeups.length || conflicts.invalidMakeups.length) {
    console.error("Conflicting historical records found. No indexes or dates were changed.");
    for (const item of conflicts.duplicateAttendance) console.error(`Duplicate student/date ${item.key}: ${item.records.map((record) => `${record.id} (${record.date.toISOString()})`).join(", ")}`);
    for (const item of conflicts.duplicateMakeups) console.error(`Duplicate makeup for attendance ${item.originalAttendance}: ${item.makeupIds.join(", ")}`);
    if (conflicts.invalidMakeups.length) console.error(`Makeup records missing a valid originalAttendance: ${conflicts.invalidMakeups.join(", ")}`);
    throw new Error("Resolve the reported historical conflicts manually, then rerun the migration.");
  }

  console.log(`No duplicate regular attendance dates or duplicate makeups found (${conflicts.attendance.length} attendance records).`);
  if (!apply) {
    console.log("Dry run only. Review the report, back up the database, then rerun with --apply.");
    return { applied: false };
  }
  if (!["Asia/Kolkata", "Asia/Calcutta"].includes(timeZone)) {
    throw new Error(`Apply requires server TZ=${INDIA_TIME_ZONE}; current timezone is ${timeZone}. Set TZ and rerun.`);
  }

  const indexes = await attendanceCollection.indexes();
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    if (index.unique && index.key?.student === 1 && index.key?.date === 1 &&
        (keys.includes("sessionSlotId") || index.name !== "uniq_regular_attendance_student_date")) {
      await attendanceCollection.dropIndex(index.name);
      console.log(`Dropped legacy attendance index ${index.name}.`);
    }
  }

  const makeupIds = [...conflicts.makeupIds].map((id) => new mongoose.Types.ObjectId(id));
  if (makeupIds.length) {
    await attendanceCollection.updateMany({ _id: { $in: makeupIds } }, { $set: { attendanceType: "MAKEUP" } });
  }
  await attendanceCollection.updateMany(
    { _id: { $nin: makeupIds } },
    { $set: { attendanceType: "REGULAR" } },
  );

  // Existing timestamps can differ within the same India-local calendar date.
  // Canonicalize only after conflict reporting and only once conflicts are clear.
  for (const record of conflicts.attendance) {
    const type = conflicts.makeupIds.has(String(record._id)) ? "MAKEUP" : "REGULAR";
    const normalizedDate = localMidnight(indiaDateKey(record.date));
    if (normalizedDate.getTime() !== new Date(record.date).getTime() || record.attendanceType !== type) {
      await attendanceCollection.updateOne({ _id: record._id }, { $set: { date: normalizedDate, attendanceType: type } });
    }
  }

  await attendanceCollection.createIndex(
    { student: 1, date: 1 },
    { unique: true, partialFilterExpression: { $or: [{ attendanceType: "REGULAR" }, { attendanceType: null }] }, name: "uniq_regular_attendance_student_date" },
  );
  await makeupCollection.createIndex(
    { originalAttendance: 1 },
    { unique: true, name: "uniq_makeup_original_attendance" },
  );
  console.log("Created regular student/date and makeup/originalAttendance unique indexes.");
  return { applied: true };
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  mongoose.connect(process.env.MONGO_URI)
    .then(() => migrateAttendanceDateIndex({
      attendanceCollection: mongoose.connection.collection("attendances"),
      makeupCollection: mongoose.connection.collection("makeups"),
      apply,
    }))
    .catch((error) => {
      console.error("Attendance date-index migration failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { migrateAttendanceDateIndex, findConflicts, indiaDateKey };
