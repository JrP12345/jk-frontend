import api from "@/lib/api";
export const pharmacyImportKinds = ["catalogue", "opening_stock", "customer_dues", "supplier_dues"] as const;
export type PharmacyImportKind = typeof pharmacyImportKinds[number];
export const pharmacyImportLabels: Record<PharmacyImportKind, string> = { catalogue: "Empty catalogue products", opening_stock: "Opening physical stock", customer_dues: "Opening customer dues", supplier_dues: "Opening supplier dues" };
export interface ImportInspection { headers: string[]; rowCount: number; fields: string[]; optionalFields: string[] }
export interface ImportView {
  id: string; locationId: string; kind: PharmacyImportKind; digest: string; fileHash: string; sourceReference: string; reviewReference: string;
  rows: Array<{ sourceLine: number; sourceId: string; sourceKey: string; fields: Record<string, string>; error: string | null }>;
  units: Array<{ sourceKey: string; sourceLines: number[]; status: "posted" | "invalid" | "failed" | "unprocessed" | "conflict" | "unknown"; error: string | null; result: unknown }>;
  counts: { posted: number; invalid: number; failed: number; unprocessed: number };
  totals: { basis: "valid_preview_rows"; validRows: number; invalidRows: number; acquisitionPaise: number; duesPaise: number; baseQuantities: Array<{ baseUnit: string; quantity: number }> };
}
const digest = (value: unknown) => typeof value === "string" && /^[a-f\d]{64}$/.test(value);
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function parseImportView(value: unknown, locationId: string): ImportView {
  const view = value as ImportView | null;
  if (!view || !/^[a-f\d]{24}$/.test(view.id) || view.locationId !== locationId || !pharmacyImportKinds.includes(view.kind) || !digest(view.digest) || !digest(view.fileHash) ||
      typeof view.sourceReference !== "string" || typeof view.reviewReference !== "string" || !Array.isArray(view.rows) || !view.rows.length || view.rows.length > 200 ||
      !Array.isArray(view.units) || !view.units.length || view.units.length > view.rows.length || !object(view.counts) || !Object.values(view.counts).every(whole)) throw new Error("Import review response is incomplete");
  if (view.rows.some(row => !whole(row.sourceLine) || row.sourceLine < 2 || typeof row.sourceId !== "string" || !digest(row.sourceKey) || !object(row.fields) || Object.values(row.fields).some(cell => typeof cell !== "string") || row.error !== null && typeof row.error !== "string") ||
      new Set(view.rows.map(row => row.sourceLine)).size !== view.rows.length || new Set(view.units.map(unit => unit.sourceKey)).size !== view.units.length ||
      view.units.some(unit => !digest(unit.sourceKey) || !["posted", "invalid", "failed", "unprocessed", "conflict", "unknown"].includes(unit.status) ||
        !Array.isArray(unit.sourceLines) || !unit.sourceLines.length || unit.sourceLines.some(line => !view.rows.some(row => row.sourceLine === line && row.sourceKey === unit.sourceKey)) || unit.error !== null && typeof unit.error !== "string") ||
      view.rows.some(row => !view.units.some(unit => unit.sourceKey === row.sourceKey && unit.sourceLines.includes(row.sourceLine)))) throw new Error("Import source rows are inconsistent");
  const counts = { posted: view.units.filter(unit => unit.status === "posted").length, invalid: view.units.filter(unit => unit.status === "invalid").length,
    failed: view.units.filter(unit => ["failed", "conflict", "unknown"].includes(unit.status)).length, unprocessed: view.units.filter(unit => unit.status === "unprocessed").length };
  if (Object.entries(counts).some(([key, count]) => view.counts[key as keyof typeof counts] !== count) || !view.totals || view.totals.basis !== "valid_preview_rows" ||
      ![view.totals.validRows, view.totals.invalidRows, view.totals.acquisitionPaise, view.totals.duesPaise].every(whole) || view.totals.validRows + view.totals.invalidRows !== view.rows.length ||
      !Array.isArray(view.totals.baseQuantities) || view.totals.baseQuantities.some(quantity => typeof quantity.baseUnit !== "string" || !whole(quantity.quantity))) throw new Error("Import reconciliation totals are inconsistent");
  return view;
}
export async function inspectImport(locationId: string, kind: PharmacyImportKind, csv: string, signal?: AbortSignal): Promise<ImportInspection> {
  const response = await api.post("/pharmacy/imports/inspect", { locationId, kind, csv }, { signal });
  const value = response.data?.data as ImportInspection;
  if (!value || !Array.isArray(value.headers) || !value.headers.length || value.headers.length > 40 || value.headers.some(header => typeof header !== "string") ||
      !whole(value.rowCount) || !value.rowCount || value.rowCount > 200 || !Array.isArray(value.fields) || !value.fields.length || value.fields.some(field => typeof field !== "string") || !Array.isArray(value.optionalFields)) throw new Error("CSV column response is incomplete");
  return value;
}
export async function previewImport(input: { locationId: string; kind: PharmacyImportKind; csv: string; mapping: Record<string, string>; sourceReference: string; reviewReference: string }, signal?: AbortSignal) {
  const response = await api.post("/pharmacy/imports/preview", input, { signal });
  const result = parseImportView(response.data?.data, input.locationId);
  if (result.kind !== input.kind || result.sourceReference !== input.sourceReference.trim().normalize("NFKC") || result.reviewReference !== input.reviewReference.trim()) throw new Error("Import source review changed");
  return result;
}
export async function readImport(locationId: string, id: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/imports/${encodeURIComponent(id)}?locationId=${encodeURIComponent(locationId)}`, { signal });
  const result = parseImportView(response.data?.data, locationId);
  if (result.id !== id) throw new Error("Import source identity changed");
  return result;
}
export async function postImportChunk(view: ImportView, sourceKeys: string[], signal?: AbortSignal) {
  const response = await api.post(`/pharmacy/imports/${view.id}/commit`, { locationId: view.locationId, expectedDigest: view.digest, sourceKeys, confirmedSource: true }, { signal });
  const result = parseImportView(response.data?.data, view.locationId);
  if (result.id !== view.id || result.digest !== view.digest) throw new Error("Import source identity changed; check the original manifest");
  return result;
}
export async function listImports(locationId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: Array<{ id: string; kind: PharmacyImportKind; createdAt: string }>; nextCursor: string | null }> {
  const params = new URLSearchParams({ locationId, ...(cursor ? { cursor } : {}) });
  const response = await api.get(`/pharmacy/imports?${params}`, { signal }), data = response.data?.data;
  if (!data || !Array.isArray(data.items) || data.items.length > 20 || data.items.some((item: { id: string; kind: PharmacyImportKind; createdAt: string }) => !/^[a-f\d]{24}$/.test(item.id) || !pharmacyImportKinds.includes(item.kind) || !Number.isFinite(Date.parse(item.createdAt))) ||
      data.nextCursor !== null && !/^[a-f\d]{24}$/.test(data.nextCursor)) throw new Error("Import history response is incomplete");
  return data;
}
export async function downloadImport(view: ImportView, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/imports/${view.id}/export?locationId=${view.locationId}`, { responseType: "blob", signal });
  if (!(response.data instanceof Blob) || !String(response.headers["content-type"] || response.data.type).startsWith("text/csv")) throw new Error("Import reconciliation export is unavailable");
  return response.data;
}
export async function importError(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) try { const parsed = JSON.parse(await data.text()); if (typeof parsed.message === "string") return parsed.message; } catch { /* Use safe fallback. */ }
  return object(data) && typeof data.message === "string" ? data.message : error instanceof Error ? error.message : "Import outcome is uncertain. Retain this reviewed manifest and check its source results before retrying.";
}
