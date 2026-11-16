import api from "./api";
import { organizationPath } from "@/services/organization.service";
import type { StockReceiptPayload } from "./pharmacyStockReceipts";

export interface CountProduct {
  id: string; name: string; archived: boolean; quantity: number; revision: number;
  unit: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number } | null;
  pricePaise: number; billingSupply: { batchNumber: string; expiry: { precision: "day" | "month"; value: string }; mrpPaise: number } | null;
  lots: Array<{ id: string; batchNumber: string; expiry: { precision: "day" | "month"; value: string }; quantity: number; status: string }>;
}
export interface StockCountSnapshot { locationId: string; snapshotHash: string; revision: number; products: CountProduct[] }
export interface StockCountInput { snapshotHash: string; reference: string; counts: Array<{ medicineId: string; lots: Array<{ batchId: string; quantity: number }>; newLots: StockReceiptPayload[] }> }
export interface StockCountPreview { locationId: string; previewHash: string; products: number; changedProducts: number; beforeUnits: number; countedUnits: number; newLots: number }
export interface StockCountResult extends Omit<StockCountPreview, "previewHash"> { requestKey: string; inventoryMode: "tracked"; revision: number }
const whole = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const id = (v: unknown): v is string => typeof v === "string" && /^[a-f\d]{24}$/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f\d]{64}$/.test(v);
const countPath = (locationId: string, suffix: string, organizationId?: string) => organizationPath(`/pharmacy/locations/${encodeURIComponent(locationId)}/stock-reconciliation${suffix}`, organizationId);
export const stockCountStorageKey = (scope: string, locationId: string) => `pharmacy-stock-count:${scope}:${locationId}`;
export async function loadStockCount(locationId: string, organizationId: string | undefined, signal: AbortSignal): Promise<StockCountSnapshot> {
  const data = (await api.get(countPath(locationId, "", organizationId), { signal })).data?.data as StockCountSnapshot;
  if (!data || data.locationId !== locationId || !hash(data.snapshotHash) || !whole(data.revision) || !Array.isArray(data.products) || data.products.length > 20000 ||
    new Set(data.products.map(p => p.id)).size !== data.products.length || data.products.some(p => !id(p.id) || typeof p.name !== "string" || typeof p.archived !== "boolean" || !whole(p.quantity) || !whole(p.revision) || !Array.isArray(p.lots) || new Set(p.lots.map(lot => lot.id)).size !== p.lots.length || p.lots.some(lot => !id(lot.id) || !whole(lot.quantity) || typeof lot.batchNumber !== "string" || !lot.expiry?.value || !["day", "month"].includes(lot.expiry.precision)) || p.unit !== null && (!p.unit || !whole(p.unit.version) || p.unit.version < 1 || !whole(p.unit.unitsPerPack) || p.unit.unitsPerPack < 1))) throw Error("Physical count snapshot is incomplete. Reload before counting.");
  return data;
}
function validateSummary(data: Omit<StockCountPreview, "previewHash">, locationId: string) {
  if (!data || data.locationId !== locationId || ![data.products, data.changedProducts, data.beforeUnits, data.countedUnits, data.newLots].every(whole) || data.changedProducts > data.products) throw Error("Count result could not be confirmed. Keep the original reference.");
}
export async function previewStockCount(locationId: string, organizationId: string | undefined, value: StockCountInput): Promise<StockCountPreview> {
  const data = (await api.post(countPath(locationId, "/preview", organizationId), value)).data?.data as StockCountPreview;
  validateSummary(data, locationId);
  if (!hash(data.previewHash) || data.products !== value.counts.length) throw Error("Count preview is incomplete. Preview again.");
  return data;
}
export type CountCommand = { key: string; input: StockCountInput & { previewHash: string; confirmed: true } };
export function validateCountCommand(raw: unknown): CountCommand | null {
  if (raw === null) return null;
  const v = raw as CountCommand;
  if (!v || !/^[a-zA-Z0-9_-]{8,100}$/.test(v.key) || !v.input || !hash(v.input.snapshotHash) || !hash(v.input.previewHash) || v.input.confirmed !== true || typeof v.input.reference !== "string" || !Array.isArray(v.input.counts)) throw Error("Saved count reference needs review");
  return JSON.parse(JSON.stringify(v)) as CountCommand;
}
function confirmedResult(data: StockCountResult, locationId: string, key: string) {
  validateSummary(data, locationId);
  if (data.inventoryMode !== "tracked" || data.requestKey !== key || !whole(data.revision)) throw Error("Count outcome could not be confirmed. Keep the original reference.");
  return data;
}
export async function commitStockCount(locationId: string, organizationId: string | undefined, command: CountCommand) {
  const data = (await api.post(countPath(locationId, "/commit", organizationId), command.input, { headers: { "Idempotency-Key": command.key } })).data?.data;
  return confirmedResult(data, locationId, command.key);
}
export async function recoverStockCount(locationId: string, organizationId: string | undefined, key: string) {
  return confirmedResult((await api.get(countPath(locationId, `/operations/${encodeURIComponent(key)}`, organizationId))).data?.data, locationId, key);
}

const csvColumns = "medicine_id,batch_id,product,batch,base_unit,counted_base_units";
/** Human-readable labels are inert; identity always comes from the owned IDs. */
export function countCsvTemplate(snapshot: StockCountSnapshot) {
  const cell = (text: string) => `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  return [csvColumns, ...snapshot.products.flatMap(p => p.lots.map(lot => `${p.id},${lot.id},${cell(p.name)},${cell(lot.batchNumber)},${cell(p.unit?.baseUnit || "units")},`))].join("\r\n");
}
export function importCountCsv(text: string, snapshot: StockCountSnapshot): Record<string, string> {
  if (new TextEncoder().encode(text).byteLength > 8 * 1024 * 1024) throw Error("Choose a count CSV smaller than 8 MB");
  const rows: string[][] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i <= source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else if (char === undefined) throw Error("Count CSV contains an unclosed quote");
      else cell += char;
    } else if (char === "," || char === "\r" || char === "\n" || char === undefined) {
      cells.push(cell); cell = ""; closed = false;
      if (cells.length > 6) throw Error("Use the original six count columns");
      if (char !== ",") {
        if (cells.length > 1 || cells[0] !== "") rows.push(cells);
        cells = [];
        if (char === "\r" && source[i + 1] === "\n") i++;
        if (rows.length > 50001) throw Error("Count CSV exceeds 50,000 batch rows");
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (closed || char === '"') throw Error("Count CSV has an invalid quoted field");
    else cell += char;
    if (cell.length > 1000) throw Error("Count CSV contains an oversized field");
  }
  if (rows.shift()?.join(",") !== csvColumns) throw Error("Use the downloaded count template with its original columns");
  const owned = new Map(snapshot.products.flatMap(p => p.lots.map(lot => [lot.id, p.id] as const))), counts: Record<string, string> = {};
  for (const values of rows) {
    const medicineId = values[0].trim(), batchId = values[1]?.trim(), quantity = values[5]?.trim();
    if (values.length !== 6 || owned.get(batchId) !== medicineId || Object.hasOwn(counts, batchId) || !/^\d+$/.test(quantity) || !whole(Number(quantity))) throw Error("Each existing batch needs one whole base-unit count, including zero. Keep the original IDs.");
    counts[batchId] = quantity;
  }
  if (Object.keys(counts).length !== owned.size) throw Error("Count every existing batch before importing");
  return counts;
}
