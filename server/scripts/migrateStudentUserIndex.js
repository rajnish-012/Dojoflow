const mongoose = require("mongoose");
const { validateServerEnv } = require("../src/config/env");

const isUserIndex = (index) => index.unique === true && index.key?.user === 1 && Object.keys(index.key).length === 1;
const isDesiredIndex = (index) => isUserIndex(index) && index.partialFilterExpression?.user?.$type === "objectId";

const migrateStudentUserIndex = async (collection) => {
  const duplicates = await collection.aggregate([
    { $match: { user: { $type: "objectId" } } },
    { $group: { _id: "$user", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]).toArray();
  if (duplicates.length) {
    throw new Error("Cannot migrate the student user index: duplicate linked student accounts must be resolved first.");
  }

  let indexes = await collection.listIndexes().toArray();
  let desired = indexes.find(isDesiredIndex);
  if (!desired) {
    await collection.createIndex(
      { user: 1 },
      {
        name: "student_user_objectid_unique",
        unique: true,
        partialFilterExpression: { user: { $type: "objectId" } },
      },
    );
    indexes = await collection.listIndexes().toArray();
    desired = indexes.find(isDesiredIndex);
  }

  for (const index of indexes.filter((candidate) => isUserIndex(candidate) && candidate.name !== desired.name)) {
    await collection.dropIndex(index.name);
  }

  return { indexName: desired.name, removedIndexes: indexes.filter((index) => isUserIndex(index) && index.name !== desired.name).map((index) => index.name) };
};

const run = async () => {
  require("dotenv").config();
  validateServerEnv();
  mongoose.set("autoIndex", false);
  await mongoose.connect(process.env.MONGO_URI);
  const result = await migrateStudentUserIndex(mongoose.connection.db.collection("students"));
  console.log("Student user-link index migration complete", result);
};

if (require.main === module) {
  run().catch((error) => {
    console.error("Student user-link index migration failed", { message: error.message });
    process.exitCode = 1;
  }).finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
}

module.exports = { migrateStudentUserIndex };
