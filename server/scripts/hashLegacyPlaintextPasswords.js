require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const { validateServerEnv } = require("../src/config/env");

const HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function migrate() {
  const { mongoUri } = validateServerEnv();
  await mongoose.connect(mongoUri);
  let migratedCount = 0;
  const cursor = User.find({}).select("+password").cursor();
  for await (const user of cursor) {
    if (typeof user.password !== "string" || HASH_PATTERN.test(user.password)) continue;
    user.password = await bcrypt.hash(user.password, 12);
    user.mustResetPassword = true;
    user.passwordChangedAt = new Date(Date.now() + 1000);
    await user.save();
    migratedCount += 1;
  }
  console.log(`Legacy password migration complete. ${migratedCount} account(s) require password recovery.`);
}

migrate()
  .catch((error) => {
    console.error("Legacy password migration failed.", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
