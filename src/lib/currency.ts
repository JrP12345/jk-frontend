/**
 * Currency formatting utility supporting multi-currency display
 * for organizations and patient billing across INR, USD, EUR, GBP, AED, etc.
 */

export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "CAD" | "AUD" | "SGD" | "JPY";

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
  JPY: "ja-JP",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  CAD: "CA$",
  AUD: "AU$",
  SGD: "SG$",
  JPY: "¥",
};

/**
 * Format an amount in a given currency.
 * @param amount - The numerical amount to format
 * @param currency - 3-letter currency code (defaults to "INR")
 * @param options - Custom Intl formatting options
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "INR",
  options?: Intl.NumberFormatOptions
): string {
  const numericAmount = Number(amount) || 0;
  const cleanCurrency = (currency || "INR").trim().toUpperCase();
  const locale = CURRENCY_LOCALE_MAP[cleanCurrency] || "en-US";

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cleanCurrency,
      maximumFractionDigits: cleanCurrency === "JPY" ? 0 : 2,
      minimumFractionDigits: Number.isInteger(numericAmount) ? 0 : 2,
      ...options,
    });
    return formatter.format(numericAmount);
  } catch {
    // Fallback if environment doesn't recognize currency code
    const symbol = CURRENCY_SYMBOLS[cleanCurrency] || `${cleanCurrency} `;
    return `${symbol}${numericAmount.toLocaleString()}`;
  }
}

/**
 * Returns the short symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string = "INR"): string {
  const cleanCurrency = (currency || "INR").trim().toUpperCase();
  return CURRENCY_SYMBOLS[cleanCurrency] || `${cleanCurrency} `;
}

/**
 * Formats a compact amount (e.g. ₹1.2k, $4.5M)
 */
export function formatCompactCurrency(
  amount: number | null | undefined,
  currency: string = "INR"
): string {
  const numericAmount = Number(amount) || 0;
  const cleanCurrency = (currency || "INR").trim().toUpperCase();
  const locale = CURRENCY_LOCALE_MAP[cleanCurrency] || "en-US";

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cleanCurrency,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    return formatter.format(numericAmount);
  } catch {
    const symbol = getCurrencySymbol(cleanCurrency);
    return `${symbol}${numericAmount >= 1000 ? `${(numericAmount / 1000).toFixed(1)}k` : numericAmount}`;
  }
}
