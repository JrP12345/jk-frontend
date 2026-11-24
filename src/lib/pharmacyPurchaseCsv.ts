import api from "@/lib/api";
import type { PurchaseLine, PurchaseProduct } from "@/services/pharmacyPurchase.service";

export const purchaseCsvLabels = {
  outerPacks: "Billed outer packs", freeOuterPacks: "Free outer packs",
  source: "Source item code or unique description *", packs: "Billed packs", looseUnits: "Billed loose units", freePacks: "Free packs", freeLooseUnits: "Free loose units",
  baseAmount: "Line base amount before discount/tax (INR) *", discount: "Line discount amount (INR)", gst: "Invoice GST (%) *", hsn: "Invoice HSN *",
  sellingPrice: "Selling price (INR) *", mrp: "MRP (INR)",
} as const;
export type PurchaseCsvField = keyof typeof purchaseCsvLabels;
export interface PurchaseCsvProfile { revision: number; mapping: Partial<Record<PurchaseCsvField, string>>; priceBasis: "base_unit" | "pack" | "outer_pack"; matches: Array<{ sourceValue: string; product: PurchaseProduct | null; error: string | null }> }
export interface PurchaseCsvInspection { locationId: string; supplierId: string; formatKey: string; profile: PurchaseCsvProfile | null; headers: string[]; records: Array<{ sourceLine: number; cells: Record<string, string> }>; fields: PurchaseCsvField[] }
export interface PurchaseCsvRow { sourceLine: number; sourceValue: string; error: string | null; line: PurchaseLine | null; product: PurchaseProduct | null }
export interface PurchaseCsvPreview { rows: PurchaseCsvRow[]; ignoredColumns: string[] }
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/.test(value);
export async function inspectPurchaseCsv(locationId: string, supplierId: string, csv: string, signal: AbortSignal): Promise<PurchaseCsvInspection> {
  const response = await api.post("/pharmacy/purchase-csv/inspect", { locationId, supplierId, csv }, { signal }), data = response.data?.data as PurchaseCsvInspection;
  if (!data || data.locationId !== locationId || data.supplierId !== supplierId || !hash(data.formatKey) || !Array.isArray(data.headers) || !data.headers.length || data.headers.length > 40 || data.headers.some(header => typeof header !== "string" || !header) ||
      new Set(data.headers).size !== data.headers.length || !Array.isArray(data.records) || !data.records.length || data.records.length > 100 ||
      data.records.some(row => !whole(row.sourceLine) || row.sourceLine < 2 || !row.cells || data.headers.some(header => typeof row.cells[header] !== "string")) ||
      new Set(data.records.map(row => row.sourceLine)).size !== data.records.length || !Array.isArray(data.fields) || data.fields.length !== Object.keys(purchaseCsvLabels).length ||
      new Set(data.fields).size !== data.fields.length || data.fields.some(field => !Object.hasOwn(purchaseCsvLabels, field))) throw new Error("CSV columns could not be checked. Choose the file again.");
  const profile = data.profile;
  if (profile !== null) {
    if (!profile || !whole(profile.revision) || profile.revision < 1 || !["base_unit", "pack", "outer_pack"].includes(profile.priceBasis) || !profile.mapping || typeof profile.mapping !== "object" ||
        Object.keys(profile.mapping).some(field => !Object.hasOwn(purchaseCsvLabels, field)) || Object.values(profile.mapping).some(column => typeof column !== "string" || !data.headers.includes(column)) ||
        new Set(Object.values(profile.mapping)).size !== Object.values(profile.mapping).length || !profile.mapping.source || !Array.isArray(profile.matches) || profile.matches.length > 100 ||
        new Set(profile.matches.map(match => match.sourceValue)).size !== profile.matches.length) throw new Error("Saved supplier mappings are incomplete. Check the file again.");
    for (const match of profile.matches) {
      if (typeof match.sourceValue !== "string" || !data.records.some(row => row.cells[profile.mapping.source!].trim() === match.sourceValue) ||
          match.error !== null && (typeof match.error !== "string" || !match.error || match.product !== null)) throw new Error("Saved supplier item mapping is inconsistent.");
      if (match.error === null) {
        const product = match.product, unit = product?.unitDefinition;
        if (!product || typeof product.id !== "string" || !product.id || typeof product.name !== "string" || !product.name || !hash(product.identityHash) || !unit ||
            !whole(unit.version) || unit.version < 1 || typeof unit.baseUnit !== "string" || !unit.baseUnit || typeof unit.packUnit !== "string" || !unit.packUnit ||
            !whole(unit.unitsPerPack) || unit.unitsPerPack < 1 || unit.unitsPerPack > 1_000_000) throw new Error("Saved medicine identity could not be checked.");
      }
    }
  }
  return data;
}
export interface PurchaseCsvPreviewInput { locationId: string; supplierId: string; csv: string; priceBasis: "base_unit" | "pack" | "outer_pack"; mapping: Partial<Record<PurchaseCsvField, string>>; matches: Array<{ sourceValue: string; medicineId: string; expectedUnitVersion: number; expectedIdentityHash?: string }> }
export async function previewPurchaseCsv(input: PurchaseCsvPreviewInput, signal: AbortSignal): Promise<PurchaseCsvPreview> {
  const response = await api.post("/pharmacy/purchase-csv/preview", input, { signal }), data = response.data?.data as PurchaseCsvPreview;
  if (!data || !Array.isArray(data.rows) || !data.rows.length || data.rows.length > 100 || !Array.isArray(data.ignoredColumns) || data.ignoredColumns.some(column => typeof column !== "string") ||
      new Set(data.rows.map(row => row.sourceLine)).size !== data.rows.length) throw new Error("CSV preview is incomplete. Check it again before applying.");
  const ids = new Set<string>();
  for (const row of data.rows) {
    if (!whole(row.sourceLine) || row.sourceLine < 2 || typeof row.sourceValue !== "string" || row.error !== null && typeof row.error !== "string") throw new Error("CSV preview row is incomplete.");
    if (row.error !== null) { if (!row.error || row.line !== null || row.product !== null) throw new Error("CSV error row is inconsistent."); continue; }
    const line = row.line, product = row.product, unit = product?.unitDefinition;
    if (!line || !product || !unit || !/^[a-zA-Z0-9_-]{8,100}$/.test(line.lineId) || ids.has(line.lineId) || line.medicineId !== product.id ||
        !input.matches.some(match => match.sourceValue === row.sourceValue && match.medicineId === product.id && match.expectedUnitVersion === unit.version && (match.expectedIdentityHash === undefined || match.expectedIdentityHash === product.identityHash)) ||
        typeof product.name !== "string" || !product.name || !unit.baseUnit || !unit.packUnit || !whole(unit.version) || line.expectedUnitVersion !== unit.version ||
        product.identityHash !== undefined && !hash(product.identityHash) ||
        !whole(unit.unitsPerPack) || unit.unitsPerPack < 1 || unit.unitsPerPack > 1_000_000 ||
        [line.packs, line.looseUnits, line.freePacks, line.freeLooseUnits, line.baseAmountPaise, line.discountPaise, line.gstRateBps, line.sellingPricePaise].some(value => !whole(value)) ||
        line.gstRateBps > 10000 || line.discountPaise > line.baseAmountPaise || line.looseUnits >= unit.unitsPerPack || line.freeLooseUnits >= unit.unitsPerPack ||
        line.mrpPaise !== undefined && (!whole(line.mrpPaise) || line.sellingPricePaise > line.mrpPaise) || !/^\d{4}(\d{2})?(\d{2})?$/.test(line.hsnCode)) throw new Error("CSV medicine or amounts changed. Check the preview again.");
    ids.add(line.lineId);
    const billed = line.packs * unit.unitsPerPack + line.looseUnits, free = line.freePacks * unit.unitsPerPack + line.freeLooseUnits;
    if (!Number.isSafeInteger(billed + free) || billed + free <= 0 || billed === 0 && line.baseAmountPaise !== 0) throw new Error("CSV quantities are inconsistent. Check the preview again.");
  }
  return data;
}
export async function rememberPurchaseCsvMapping(input: PurchaseCsvPreviewInput & { expectedRevision: number; confirmedMappings: true }, formatKey: string) {
  const response = await api.put("/pharmacy/purchase-csv/profile", input), data = response.data?.data;
  if (!data || data.locationId !== input.locationId || data.supplierId !== input.supplierId || data.formatKey !== formatKey || data.revision !== input.expectedRevision + 1) throw new Error("Supplier mapping save could not be confirmed. Retry the same mapping or choose the file again to check it.");
  return data as { locationId: string; supplierId: string; formatKey: string; revision: number };
}
