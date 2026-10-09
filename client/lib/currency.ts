const SUPPORTED_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP", "AED", "SGD"]);
export const DEFAULT_CURRENCY = "INR";

/** Format academy monetary values using the academy's configured currency. */
export function formatCurrency(value: number | string | null | undefined, currency?: string | null): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const providedCurrency = currency?.trim().toUpperCase() || "";
  const configuredCurrency = providedCurrency || DEFAULT_CURRENCY;
  if (providedCurrency && !SUPPORTED_CURRENCIES.has(providedCurrency)) {
    const numeric = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(safeAmount);
    return `${numeric} (unsupported currency: ${providedCurrency})`;
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: configuredCurrency,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    if (providedCurrency) {
      const numeric = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(safeAmount);
      return `${numeric} (unsupported currency: ${providedCurrency})`;
    }
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: DEFAULT_CURRENCY,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  }
}
