const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { normalizeCurrency } = require("../../src/utils/currency");
const { validateBillingSnapshot } = require("../../src/services/billingSnapshot.service");

test("supported FeeTerm currencies normalize case and reject unsupported values", () => {
  assert.equal(normalizeCurrency(" aEd "), "AED");
  assert.equal(normalizeCurrency("INR"), "INR");
  assert.equal(normalizeCurrency("USD"), "USD");
  assert.equal(normalizeCurrency("XYZ"), null);
  assert.equal(normalizeCurrency(null), null);
});

test("billing snapshots accept legacy missing currency and validate new currency snapshots", () => {
  const feeTerm = new mongoose.Types.ObjectId();
  const branch = new mongoose.Types.ObjectId();
  const base = {
    feeTerm,
    feeTermVersion: 1,
    planName: "Beginner",
    branch,
    amount: 1200,
    billingFrequency: "MONTHLY",
    registrationFee: 300,
    taxRate: 5,
    discountRules: [],
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: null,
  };
  const enrollment = (billingSnapshot) => ({ feeTerm, branch, billingSnapshot });

  assert.equal(validateBillingSnapshot(enrollment(base)).valid, true);
  assert.equal(validateBillingSnapshot(enrollment({ ...base, currency: "AED" })).valid, true);
  assert.ok(validateBillingSnapshot(enrollment({ ...base, currency: "XYZ" })).missing.includes("supported currency"));
});
