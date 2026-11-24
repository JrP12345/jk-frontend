import api from "./api";
import { dailyDate } from "./pharmacyDailyOverview";
export interface SupplierRate {
  supplierId: string; supplierName: string; purchaseId: string; invoiceNumber: string; invoiceDate: string; costTreatment: "include_tax" | "exclude_tax";
  baseUnit: string; unitVersion: number | null; billedUnits: number; freeUnits: number; netPaise: number; grossPaise: number; receivedUnits: number;
  state: "comparable" | "needs_review"; note: string;
}
export interface SupplierRates { locationId: string; medicineId: string; productName: string; currency: "INR"; timezone: string; asOf: string; startDate: string; endDate: string; basis: "net_excluding_gst"; sourcePurchases: number; items: SupplierRate[]; note: string }
const id = (value: unknown) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 2000;
export function validateSupplierRates(raw: unknown, locationId: string, medicineId: string, start?: string, end?: string): SupplierRates {
  const row = raw as SupplierRates;
  const fail = (): never => { throw Error("Supplier rates could not be verified. Reload before comparing."); };
  if (!row || row.locationId !== locationId || row.medicineId !== medicineId || row.currency !== "INR" || row.basis !== "net_excluding_gst" || !text(row.productName) || !text(row.note) || !dailyDate(row.startDate) || !dailyDate(row.endDate) || row.startDate > row.endDate || start && row.startDate !== start || end && row.endDate !== end || !Number.isFinite(Date.parse(row.asOf)) || !whole(row.sourcePurchases) || row.sourcePurchases > 500 || !Array.isArray(row.items) || row.items.length > row.sourcePurchases) return fail();
  try { new Intl.DateTimeFormat("en", { timeZone: row.timezone }).format(); } catch { return fail(); }
  const suppliers = new Set<string>();
  for (const item of row.items) {
    if (!item || !id(item.supplierId) || suppliers.has(item.supplierId) || !id(item.purchaseId) || !text(item.supplierName) || !text(item.invoiceNumber) || !text(item.baseUnit) || !text(item.note) || !dailyDate(item.invoiceDate) || item.invoiceDate < row.startDate || item.invoiceDate > row.endDate || !["include_tax", "exclude_tax"].includes(item.costTreatment) || !["comparable", "needs_review"].includes(item.state) || item.unitVersion !== null && !whole(item.unitVersion) || item.state === "comparable" && (!item.unitVersion || item.baseUnit === "Unknown") || ![item.billedUnits, item.freeUnits, item.netPaise, item.grossPaise, item.receivedUnits].every(whole) || !Number.isSafeInteger(item.billedUnits + item.freeUnits) || item.billedUnits + item.freeUnits <= 0 || item.receivedUnits > item.billedUnits + item.freeUnits || item.grossPaise < item.netPaise) return fail();
    suppliers.add(item.supplierId);
  }
  return row;
}
export async function readSupplierRates(locationId: string, medicineId: string, start: string, end: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ locationId, medicineId }); if (start) params.set("startDate", start); if (end) params.set("endDate", end);
  const response = await api.get(`/pharmacy/supplier-rates?${params}`, { signal });
  return validateSupplierRates(response.data?.data, locationId, medicineId, start, end);
}
/** Four decimal rupees for display; ranking uses the exact rational on the server. */
export function unitRate(paise: number, units: number) {
  const scaled = (BigInt(paise) * BigInt(200) + BigInt(units)) / (BigInt(units) * BigInt(2)), precision = BigInt(10000);
  return `₹${scaled / precision}.${String(scaled % precision).padStart(4, "0")}`;
}
