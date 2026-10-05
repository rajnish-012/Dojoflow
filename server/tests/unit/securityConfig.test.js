const test = require("node:test");
const assert = require("node:assert/strict");
const { validateServerEnv } = require("../../src/config/env");
const { validatePassword, sessionInvalidationTime } = require("../../src/utils/passwordPolicy");
const bcrypt = require("bcryptjs");
const User = require("../../src/models/User");

const validProductionEnv = () => ({
  NODE_ENV: "production",
  PORT: "5000",
  MONGO_URI: "mongodb+srv://db.cluster.net/dojoflow",
  JWT_SECRET: "r".repeat(64),
  CLIENT_URL: "https://academy.example-school.in",
});

test("production environment accepts valid required settings", () => {
  const config = validateServerEnv(validProductionEnv());
  assert.equal(config.port, 5000);
  assert.deepEqual(config.clientOrigins, ["https://academy.example-school.in"]);
});

test("production environment rejects missing mode and weak or placeholder secrets", () => {
  const noMode = validProductionEnv();
  delete noMode.NODE_ENV;
  assert.throws(() => validateServerEnv(noMode), /NODE_ENV must be set explicitly/);

  const weakSecret = validProductionEnv();
  weakSecret.JWT_SECRET = "short";
  assert.throws(() => validateServerEnv(weakSecret), /JWT_SECRET/);

  const placeholder = validProductionEnv();
  placeholder.JWT_SECRET = "replace-this-with-a-real-random-secret-value";
  assert.throws(() => validateServerEnv(placeholder), /JWT_SECRET/);
});

test("production origins cannot fall back to local or example hosts", () => {
  for (const origin of ["http://localhost:3000", "https://example.com", "https://api.invalid"]) {
    const env = validProductionEnv();
    env.CLIENT_URL = origin;
    assert.throws(() => validateServerEnv(env), /real HTTPS production hostname/);
  }
  const localDatabase = validProductionEnv();
  localDatabase.MONGO_URI = "mongodb://127.0.0.1:27017/dojoflow";
  assert.throws(() => validateServerEnv(localDatabase), /real remote database/);
});

test("password policy is length-based and bcrypt-safe", () => {
  assert.match(validatePassword("short"), /at least 12 characters/);
  assert.equal(validatePassword("correct horse battery staple"), null);
  assert.match(validatePassword("😀".repeat(19)), /72 UTF-8 bytes/);
});

test("password changes invalidate tokens minted before the change", () => {
  const changedAt = sessionInvalidationTime();
  assert.ok(changedAt.getTime() > Date.now());
});

test("User model hashes raw passwords in its save middleware", async () => {
  const rawPassword = "a-long-test-passphrase";
  const user = new User({ name: "Test User", email: "test@example.invalid", password: rawPassword });
  const saveHook = User.schema.s.hooks._pres.get("save").find(({ fn }) => fn.name === "hashPasswordBeforeSave").fn;
  await saveHook.call(user);
  assert.match(user.password, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(rawPassword, user.password), true);
});
