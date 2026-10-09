// Explicit, one-time Super Admin provisioning. This script never creates
// defaults, resets an existing account, or prints credentials.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const { ensureDefaultRoles } = require("./src/config/defaultRoles");
const { validatePassword } = require("./src/utils/passwordPolicy");
const { validateServerEnv } = require("./src/config/env");

const redactSecrets = (value) => {
  let text = String(value || "");
  const secrets = Object.entries(process.env)
    .filter(([name, secret]) => secret && /(PASSWORD|SECRET|TOKEN|URI|KEY|CREDENTIAL)/i.test(name))
    .map(([, secret]) => String(secret));
  for (const secret of secrets) text = text.split(secret).join("[REDACTED]");

  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      const parsed = new URL(mongoUri);
      for (const credential of [parsed.username, parsed.password]) {
        if (!credential) continue;
        for (const representation of [credential, decodeURIComponent(credential)]) {
          text = text.split(representation).join("[REDACTED]");
        }
      }
    } catch {
      text = text.split(mongoUri).join("[REDACTED]");
    }
  }
  return text;
};

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
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    console.log("Bootstrap admin already exists; refusing to overwrite.");
    return false;
  }

  await ensureDefaultRoles();
  await User.create({
    name,
    email,
    // phone is optional in User. null avoids validating its empty-string default
    // against the schema's minimum-length constraint.
    phone: null,
    password,
    role: "SUPER_ADMIN",
    branch: null,
  });
  console.log("Initial Super Admin account created. Sign in using the credentials supplied to this one-time command.");
  return true;
};

provisionAdmin()
  .catch((error) => {
    const diagnostic = {
      name: error?.name || "Error",
      message: error?.name === "ValidationError"
        ? "User validation failed."
        : redactSecrets(error?.message || "Unknown error"),
      ...(error?.code === undefined ? {} : { code: error.code }),
    };

    if (error?.name === "ValidationError" && error.errors) {
      diagnostic.validationErrors = Object.entries(error.errors).map(([field, detail]) => ({
        field,
        kind: detail?.kind || detail?.name || "validation",
        message: field === "password"
          ? "Password validation failed."
          : redactSecrets(detail?.message || "Field validation failed."),
      }));
    }

    if (process.env.NODE_ENV === "development" && error?.stack) {
      diagnostic.stack = redactSecrets(error.stack);
    }
    console.error("Admin provisioning failed.", diagnostic);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
