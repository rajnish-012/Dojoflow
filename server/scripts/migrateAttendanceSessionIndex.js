require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection("attendances");
  const indexes = await collection.indexes();
  const legacy = indexes.find((index) => index.unique && index.key?.student === 1 && index.key?.date === 1 && !index.key?.sessionSlotId);
  if (legacy) await collection.dropIndex(legacy.name);
  await collection.createIndex({ student: 1, date: 1, sessionSlotId: 1 }, { unique: true, name: "student_1_date_1_sessionSlotId_1" });
  console.log("Attendance uniqueness now applies per student, date, and scheduled session.");
}

main().catch((error) => {
  console.error("Attendance index migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
