const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeValue, snapshot } = require("../../src/services/audit.service");

test("audit snapshots redact credentials recursively while retaining useful values", () => {
  const result = sanitizeValue({ status: "ACTIVE", PasswordHash: "hash", nested: { accessToken: "secret", balance: 30 }, cardNumber: "4111111111111111" });
  assert.deepEqual(result, { status: "ACTIVE", PasswordHash: "[REDACTED]", nested: { accessToken: "[REDACTED]", balance: 30 }, cardNumber: "[REDACTED]" });
});

test("audit snapshots bound strings and reject oversized snapshots", () => {
  assert.equal(sanitizeValue("x".repeat(2100)).length, 2000);
  assert.throws(() => snapshot({ payloads: Array.from({ length: 20 }, () => "x".repeat(1500)) }), /exceeds the allowed size/);
});
