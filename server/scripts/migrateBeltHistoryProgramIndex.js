require("dotenv").config();
const mongoose = require("mongoose");
const BeltHistory = require("../src/models/BeltHistory");

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await BeltHistory.collection.indexes();
  const legacy = indexes.find((index) =>
    index.unique &&
    index.key?.student === 1 &&
    index.key?.toBelt === 1 &&
    !index.key?.sessionTypeId,
  );
  if (legacy) {
    console.log(`${apply ? "Dropping" : "Would drop"} legacy promotion index: ${legacy.name}`);
    if (apply) await BeltHistory.collection.dropIndex(legacy.name);
  } else {
    console.log("No legacy student+toBelt unique promotion index found.");
  }
  const targetExists = indexes.some((index) =>
    index.unique && index.key?.student === 1 && index.key?.sessionTypeId === 1 && index.key?.toBelt === 1,
  );
  if (!targetExists) {
    console.log(`${apply ? "Creating" : "Would create"} unique student+program+belt index.`);
    if (apply) await BeltHistory.collection.createIndex(
      { student: 1, sessionTypeId: 1, toBelt: 1 },
      { unique: true, name: "student_1_sessionTypeId_1_toBelt_1" },
    );
  } else {
    console.log("Program-scoped promotion index already exists.");
  }
  if (!apply) console.log("Run with --apply to update database indexes.");
}

main().catch((error) => {
  console.error("Belt history index migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
