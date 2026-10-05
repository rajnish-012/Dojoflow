require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGzip } = require("node:zlib");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

async function* serializeDatabase(db) {
  const collections = await db.listCollections().toArray();
  yield `${EJSON.stringify({ type: "header", database: db.databaseName, createdAt: new Date().toISOString(), collectionCount: collections.length }, { relaxed: false })}\n`;
  for (const collectionInfo of collections) {
    const collection = db.collection(collectionInfo.name);
    const indexes = await collection.indexes();
    yield `${EJSON.stringify({ type: "collection", name: collectionInfo.name, indexes }, { relaxed: false })}\n`;
    for await (const document of collection.find({})) {
      yield `${EJSON.stringify({ type: "document", collection: collectionInfo.name, document }, { relaxed: false })}\n`;
    }
  }
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured before creating a database backup.");
  await mongoose.connect(process.env.MONGO_URI, { readPreference: "primary" });
  const outputDirectory = path.resolve(__dirname, "../backups");
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").replace(/Z$/, "Z");
  const outputPath = path.join(outputDirectory, `forcestrike-${timestamp}.ejson.gz`);
  await pipeline(Readable.from(serializeDatabase(mongoose.connection.db)), createGzip({ level: 9 }), fs.createWriteStream(outputPath, { flags: "wx" }));
  console.log(`Database backup created: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("MongoDB backup failed", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
