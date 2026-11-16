export interface PharmacyNumberFormat { prefixTemplate: string; digits: number; resetPolicy: "continuous" | "financial_year" }
export interface PharmacyNumberSnapshot extends PharmacyNumberFormat { version: 1; prefix: string; sequence: number; configurationRevision: number }
export function pharmacyNumberPrefix(format: PharmacyNumberFormat, financialYear: string) {
  if (!format || typeof format.prefixTemplate !== "string" || !Number.isSafeInteger(format.digits) || format.digits < 1 || format.digits > 9 ||
      !["continuous", "financial_year"].includes(format.resetPolicy) || !/^20\d{2}-\d{2}$/.test(financialYear) || Number(financialYear.slice(0, 4)) > 2098 || String(Number(financialYear.slice(0, 4)) + 1).slice(-2) !== financialYear.slice(-2)) throw new Error("Review the prefix, number of digits and reset policy.");
  const tokens = format.prefixTemplate.match(/\{FY\}/g)?.length ?? 0;
  if (format.resetPolicy === "financial_year" ? tokens !== 1 : tokens !== 0) throw new Error("Use exactly one {FY} for yearly numbering, or no {FY} for a continuous sequence.");
  const prefix = format.prefixTemplate.replace("{FY}", financialYear.slice(2));
  if (!/^[A-Z0-9][A-Z0-9/-]*[/-]$/.test(prefix) || prefix.length + format.digits > 16 || /^[ICO][A-Z0-9]{4}[0-9]{4}\/$/.test(prefix))
    throw new Error("Use an uppercase branch prefix ending in / or -, with at most 16 characters including the number. Internal document prefixes are reserved.");
  return prefix;
}
export function validCapturedPharmacyNumber(invoice: { invoiceNumber: string; numberingVersion?: number; numberingSnapshot?: PharmacyNumberSnapshot; invoiceSeries?: string; financialYear: string; issuedAt: string }) {
  if (invoice.numberingVersion === undefined || invoice.numberingVersion === 2)
    return !invoice.numberingSnapshot && /^I[A-Z0-9]{4}[0-9]{4}\/[0-9]{6}$/.test(invoice.invoiceNumber);
  if (invoice.numberingVersion !== 3 || !invoice.numberingSnapshot || !Number.isFinite(Date.parse(invoice.issuedAt))) return false;
  try {
    const snapshot = invoice.numberingSnapshot, date = new Date(Date.parse(invoice.issuedAt) + 330 * 60000);
    const year = date.getUTCFullYear(), start = date.getUTCMonth() >= 3 ? year : year - 1;
    if (snapshot.version !== 1 || !Number.isSafeInteger(snapshot.configurationRevision) || snapshot.configurationRevision < 1 ||
        !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1 || snapshot.sequence >= 10 ** snapshot.digits ||
        invoice.financialYear !== `${start}-${String(start + 1).slice(-2)}`) return false;
    const prefix = pharmacyNumberPrefix(snapshot, invoice.financialYear);
    return snapshot.prefix === prefix && invoice.invoiceSeries === prefix && invoice.invoiceNumber === `${prefix}${String(snapshot.sequence).padStart(snapshot.digits, "0")}`;
  } catch { return false; }
}
