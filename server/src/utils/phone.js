const { parsePhoneNumberFromString } = require("libphonenumber-js");

/** Normalize supported phone input to E.164. Legacy local values default to India. */
function normalizePhone(value, defaultCountry = "IN") {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = parsePhoneNumberFromString(value.trim(), defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

module.exports = { normalizePhone };
