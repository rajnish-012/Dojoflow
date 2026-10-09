const SUPPORTED_CURRENCIES = Object.freeze(["INR", "USD", "EUR", "GBP", "AED", "SGD"]);
const supportedCurrencySet = new Set(SUPPORTED_CURRENCIES);

function normalizeCurrency(value) {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  return supportedCurrencySet.has(currency) ? currency : null;
}

module.exports = { SUPPORTED_CURRENCIES, normalizeCurrency };
