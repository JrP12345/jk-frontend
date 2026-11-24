import api from "./api";
import type { PharmacyReportKind } from "./pharmacyReports";

export const dailySectionKeys = ["sales", "collections", "returns", "margin", "customerDues", "supplierDues", "cashMovements", "newCredit", "stock"] as const;
export type DailySectionKey = typeof dailySectionKeys[number];
export interface DailySection { state: "ready" | "restricted" | "unavailable" | "not_tracked"; values: Record<string, number | null> | null; note: string; items: Array<{ id: string; label: string; units: number; unit: string }> }
export interface PharmacyDailyOverviewData {
  locationId: string; currency: "INR"; timezone: string; date: string; asOf: string; period: { start: string; end: string };
  coverage: { source: "cloud"; offlineSession: "none" | "preparing" | "active" | "expired" }; paymentReview: number | null;
  sections: Record<DailySectionKey, DailySection>;
}
export const dailySourceReports: Record<DailySectionKey, PharmacyReportKind> = { sales: "sales", collections: "collections", returns: "sales_returns", margin: "gross_margin", customerDues: "customer_dues", supplierDues: "supplier_dues", cashMovements: "cash_events", newCredit: "sales", stock: "low_stock" };
const valueKeys: Record<DailySectionKey, string[]> = { sales: ["bills", "grossSalesPaise", "currentDuePaise"], collections: ["totalPaise", "cashPaise", "upiPaise", "cardPaise", "receipts"], returns: ["creditsPaise", "credits"], margin: ["contributionPaise", "costPaise", "netRevenuePaise", "unknownBills"], customerDues: ["duePaise", "refundPayablePaise", "documents"], supplierDues: ["duePaise", "pendingCreditPaise", "refundReceivablePaise"], cashMovements: ["cashInPaise", "cashOutPaise", "refundsPaise", "supplierPaymentsPaise"], newCredit: ["amountPaise", "bills", "unknownBills"], stock: ["lowPhysicalProducts", "expiredLots", "expiringLots", "days"] };
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function dailyDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
const fail = (): never => { throw Error("Daily overview could not be verified. Refresh before relying on these totals."); };
export function validateDailyOverview(raw: unknown, locationId: string, date?: string): PharmacyDailyOverviewData {
  const row = raw as PharmacyDailyOverviewData;
  if (!row || row.locationId !== locationId || row.currency !== "INR" || !dailyDate(row.date) || date && row.date !== date || !instant(row.asOf) || !instant(row.period?.start) || !instant(row.period?.end) || Date.parse(row.period.start) > Date.parse(row.period.end) || Date.parse(row.period.end) > Date.parse(row.asOf) || row.coverage?.source !== "cloud" || !["none", "preparing", "active", "expired"].includes(row.coverage.offlineSession) || row.paymentReview !== null && !whole(row.paymentReview) || !row.sections || Object.keys(row.sections).length !== dailySectionKeys.length) return fail();
  if (typeof row.timezone !== "string" || !row.timezone.trim() || row.timezone.length > 100) return fail();
  try {
    const calendar = new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const day = (value: string) => { const parts = calendar.formatToParts(new Date(value)); return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-"); };
    if (day(row.period.start) !== row.date || day(row.period.end) !== row.date || !date && day(row.asOf) !== row.date) return fail();
  } catch { return fail(); }
  for (const key of dailySectionKeys) {
    const section = row.sections[key];
    if (!section || !["ready", "restricted", "unavailable", "not_tracked"].includes(section.state) || typeof section.note !== "string" || !section.note.trim() || section.note.length > 2000 || !Array.isArray(section.items) || section.items.length > 5 || key !== "stock" && section.items.length) return fail();
    if (section.state !== "ready") { if (section.values !== null || section.items.length) return fail(); continue; }
    if (!section.values || Object.keys(section.values).length !== valueKeys[key].length || valueKeys[key].some(name => !Object.hasOwn(section.values!, name))) return fail();
    for (const [name, value] of Object.entries(section.values)) {
      const nullable = key === "margin" && name !== "unknownBills" || key === "newCredit" && name !== "unknownBills";
      if (value === null ? !nullable : key === "margin" && name === "contributionPaise" ? !Number.isSafeInteger(value) : !whole(value)) return fail();
    }
    if (section.items.some(item => !item || !/^[a-f\d]{24}$/i.test(item.id) || typeof item.label !== "string" || !item.label.trim() || item.label.length > 300 || !whole(item.units) || typeof item.unit !== "string" || !item.unit.trim() || item.unit.length > 80)) return fail();
  }
  const collections = row.sections.collections.values;
  if (collections && BigInt(collections.cashPaise!) + BigInt(collections.upiPaise!) + BigInt(collections.cardPaise!) !== BigInt(collections.totalPaise!)) return fail();
  const margin = row.sections.margin.values;
  if (margin && (margin.unknownBills! > 0 && margin.contributionPaise !== null || margin.contributionPaise !== null && (margin.netRevenuePaise === null || margin.costPaise === null || BigInt(margin.netRevenuePaise) - BigInt(margin.costPaise) !== BigInt(margin.contributionPaise)))) return fail();
  const credit = row.sections.newCredit.values;
  if (credit && ((credit.unknownBills! > 0) !== (credit.amountPaise === null && credit.bills === null) || credit.unknownBills === 0 && (credit.amountPaise === null || credit.bills === null))) return fail();
  const stock = row.sections.stock;
  if (stock.values && (stock.values.days !== 60 || stock.values.lowPhysicalProducts! < stock.items.length)) return fail();
  return row;
}
export async function readDailyOverview(locationId: string, date: string, signal?: AbortSignal) {
  if (date && !dailyDate(date)) throw Error("Choose a valid business day.");
  const { data } = await api.get(`/pharmacy/daily-overview?${new URLSearchParams({ locationId, ...(date ? { date } : {}) })}`, { signal });
  return validateDailyOverview(data?.data, locationId, date || undefined);
}
