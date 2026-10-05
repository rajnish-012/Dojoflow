// Explicit, one-time Super Admin provisioning. This script never creates
// defaults, resets an existing account, or prints credentials.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const { ensureDefaultRoles } = require("./src/config/defaultRoles");
const { validatePassword } = require("./src/utils/passwordPolicy");
const { validateServerEnv } = require("./src/config/env");

const provisionAdmin = async () => {
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || "").trim();
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  const passwordError = validatePassword(password);
  if (!name || !email || passwordError) {
    throw new Error("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and a valid BOOTSTRAP_ADMIN_PASSWORD before provisioning.");
  }
  const config = validateServerEnv();
  await mongoose.connect(config.mongoUri);
  await ensureDefaultRoles();
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) throw new Error("An account with that email already exists; provisioning will not modify accounts.");

  await User.create({ name, email, password, role: "SUPER_ADMIN", branch: null });
  console.log("Initial Super Admin account created. Sign in using the credentials supplied to this one-time command.");
};

provisionAdmin()
  .catch((error) => {
    console.error("Admin provisioning failed.", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
