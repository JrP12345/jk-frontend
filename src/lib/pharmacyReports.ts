import api from "./api";
export const pharmacyReportKinds = ["stock", "low_stock", "expiry", "valuation", "dead_stock", "movements", "purchases", "sales", "collections", "sales_returns", "purchase_returns", "supplier_dues", "customer_dues", "tax", "cash_events"] as const;
export type PharmacyReportKind = typeof pharmacyReportKinds[number];
export interface ReportFilters { locationId: string; startDate?: string; endDate?: string; limit: number; days: number; cursor?: string }
export interface ReportColumn { key: string; label: string; format: "text" | "integer" | "paise" | "date" }
export type ReportRow = Record<string, string | number | null> & { id: string };
export interface PharmacyReportPage { kind: PharmacyReportKind; label: string; locationId: string; currency: "INR"; timezone: string; asOf: string; startDate: string; endDate: string; days: number; limit: number; cursor: string | null; digest: string; totalScope: "page"; totals: Record<string, number | null>; rows: ReportRow[]; columns: ReportColumn[]; nextCursor: string | null; scanned: number; basis: string }
export interface ReportChoice { kind: PharmacyReportKind; label: string }
function parsePage(value: unknown, kind: PharmacyReportKind, filters: ReportFilters): PharmacyReportPage {
  const page = value as PharmacyReportPage;
  if (!page || page.kind !== kind || page.locationId !== filters.locationId || page.currency !== "INR" || page.totalScope !== "page" || page.limit !== filters.limit || page.days !== filters.days || page.cursor !== (filters.cursor || null) || typeof page.basis !== "string" || typeof page.label !== "string" || !/^[a-f\d]{64}$/.test(page.digest) || !Number.isFinite(Date.parse(page.asOf)) || !/^\d{4}-\d{2}-\d{2}$/.test(page.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(page.endDate) || !Number.isSafeInteger(page.scanned) || page.scanned < 0 || page.scanned > filters.limit || !Array.isArray(page.rows) || page.rows.length > 500 || !Array.isArray(page.columns) || !page.columns.length || page.columns.length > 25 || page.nextCursor !== null && (typeof page.nextCursor !== "string" || !/^(?:[a-f\d]{24}|[po]:[a-f\d]{24}|o:start)$/i.test(page.nextCursor))) throw new Error("Report is incomplete or does not match this branch and page");
  try { new Intl.DateTimeFormat("en-IN", { timeZone: page.timezone }).format(new Date(page.asOf)); } catch { throw new Error("Report timezone needs review"); }
  if (filters.startDate && page.startDate !== filters.startDate || filters.endDate && page.endDate !== filters.endDate || page.rows.some(row => !row || typeof row.id !== "string" || !row.id || Object.values(row).some(value => value !== null && (typeof value !== "string" && typeof value !== "number" || typeof value === "number" && !Number.isSafeInteger(value))))) throw new Error("Report source scope or cell types need review");
  if (new Set(page.columns.map(column => column.key)).size !== page.columns.length || new Set(page.rows.map(row => row.id)).size !== page.rows.length) throw new Error("Report columns or source rows are repeated");
  for (const column of page.columns) {
    if (!column || !/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(column.key) || ["constructor", "prototype"].includes(column.key) || typeof column.label !== "string" || column.label.length > 120 || !["text", "integer", "paise", "date"].includes(column.format)) throw new Error("Report column definition needs review");
    for (const row of page.rows) { const value = row[column.key]; if (!Object.hasOwn(row, column.key) || value !== null && (["integer", "paise"].includes(column.format) ? !Number.isSafeInteger(value) : typeof value !== "string" && typeof value !== "number") || column.format === "date" && value !== null && !Number.isFinite(Date.parse(String(value)))) throw new Error("Report source cells need review"); }
  }
  if (!page.totals || typeof page.totals !== "object" || Array.isArray(page.totals)) throw new Error("Report subtotals need review");
  for (const [key, total] of Object.entries(page.totals)) {
    if (!page.columns.some(column => column.key === key && column.format === "paise")) throw new Error("Report subtotal is not an authorized amount column");
    const values = page.rows.map(row => row[key]);
    if (values.some(value => value === null) ? total !== null : !Number.isSafeInteger(total) || values.reduce<bigint>((sum, value) => sum + BigInt(value as number), BigInt(0)) !== BigInt(total!)) throw new Error("Report page subtotal does not reconcile");
  }
  return page;
}
export async function readReportChoices(locationId: string, signal?: AbortSignal): Promise<ReportChoice[]> {
  const data = (await api.get("/pharmacy/reports", { params: { locationId }, signal })).data?.data;
  if (!data || data.locationId !== locationId || !Array.isArray(data.items) || data.items.length > pharmacyReportKinds.length || data.items.some((row: ReportChoice) => !pharmacyReportKinds.includes(row.kind) || typeof row.label !== "string") || new Set(data.items.map((row: ReportChoice) => row.kind)).size !== data.items.length) throw new Error("Available reports could not be checked"); return data.items;
}
export async function readPharmacyReport(kind: PharmacyReportKind, filters: ReportFilters, signal?: AbortSignal) { return parsePage((await api.get(`/pharmacy/reports/${kind}`, { params: filters, signal })).data?.data, kind, filters); }
export async function readStockAlert(kind: "low_stock" | "expiry", locationId: string, days: number, cursor?: string, signal?: AbortSignal) {
  const filters = { locationId, days, limit: 25, ...(cursor ? { cursor } : {}) }; return parsePage((await api.get(`/pharmacy/stock-alerts/${kind}`, { params: filters, signal })).data?.data, kind, filters);
}
export async function downloadReport(page: PharmacyReportPage, filters: ReportFilters) {
  const response = await api.get(`/pharmacy/reports/${page.kind}/export`, { params: { ...filters, expectedDigest: page.digest }, responseType: "blob" });
  if (!(response.data instanceof Blob) || !String(response.headers["content-type"] || "").startsWith("text/csv") || response.headers["x-report-digest"] !== page.digest) throw new Error("Export does not match the reviewed report page");
  return response.data as Blob;
}
export async function reportError(failure: unknown) {
  const error = failure as { response?: { data?: unknown }; message?: string }, data = error.response?.data;
  if (data instanceof Blob) { try { const body = JSON.parse(await data.text()); if (typeof body?.message === "string") return body.message as string; } catch {} }
  return (data as { message?: string } | undefined)?.message || error.message || "Report could not be confirmed. Refresh and try again.";
}
