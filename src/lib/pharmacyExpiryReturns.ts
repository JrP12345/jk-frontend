import api from "./api";
import type { SupplierReturnSource } from "./pharmacyFinance";
import { validatePharmacyUnits, type PharmacyUnitDefinition } from "./pharmacyUnits";
export interface ExpiryReturnDocument extends Omit<SupplierReturnSource, "lines"> { lines: Array<SupplierReturnSource["lines"][number] & { unitSnapshot: PharmacyUnitDefinition }> }
export interface ExpiryReturnPreparation { locationId: string; asOf: string; cutoff: string; days: number; note: string; documents: ExpiryReturnDocument[]; review: Array<{ batchId: string; product: string; batch: string; units: number; reason: string }> }
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const id = (value: unknown) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim()) && value.length <= 2000;
export async function readExpiryReturnPreparation(locationId: string, days: number, signal?: AbortSignal): Promise<ExpiryReturnPreparation> {
  const response = await api.get("/pharmacy/expiry-return-preparation", { params: { locationId, days }, signal }), value = response.data?.data as ExpiryReturnPreparation;
  const invalid = (): never => { throw Error("Expiry return sources could not be verified. Refresh before preparing returns."); };
  if (!value || value.locationId !== locationId || value.days !== days || !Number.isFinite(Date.parse(value.asOf)) || !Number.isFinite(Date.parse(value.cutoff)) || Date.parse(value.cutoff) - Date.parse(value.asOf) !== days * 86400000 || !text(value.note) || !Array.isArray(value.documents) || value.documents.length > 25 || !Array.isArray(value.review) || value.review.length > 200) return invalid();
  const purchases = new Set<string>(), batches = new Set<string>();
  for (const doc of value.documents) {
    if (!id(doc.purchaseId) || purchases.has(doc.purchaseId) || doc.locationId !== locationId || !id(doc.supplierId) || !text(doc.supplierName) || !text(doc.supplierInvoiceNumber) || doc.currency !== "INR" || !whole(doc.purchaseRevision) || !whole(doc.settlementRevision) || !Array.isArray(doc.lines) || !doc.lines.length || doc.lines.length > 200) return invalid(); purchases.add(doc.purchaseId);
    for (const row of doc.lines) {
      if (!id(row.batchId) || batches.has(row.batchId) || !id(row.receiptId) || !text(row.receiptLineId) || !text(row.description) || !text(row.batchNumber) || !text(row.expiryValue) || ![row.remainingQuantity, row.onHandQuantity, row.receivedQuantity, row.returnedQuantity].every(whole) || row.remainingQuantity < 1 || row.returnedQuantity > row.receivedQuantity || row.remainingQuantity > row.onHandQuantity || row.remainingQuantity > row.receivedQuantity - row.returnedQuantity) return invalid();
      validatePharmacyUnits(row.unitSnapshot); batches.add(row.batchId);
    }
  }
  for (const row of value.review) { if (!id(row.batchId) || batches.has(row.batchId) || !text(row.product) || !text(row.batch) || !text(row.reason) || !whole(row.units)) return invalid(); batches.add(row.batchId); }
  if (batches.size > 200) return invalid(); return value;
}
export function prepareSupplierExpiryDrafts(value: ExpiryReturnPreparation, selected: Record<string, string>) {
  const groups = new Map<string, { supplierId: string; supplierName: string; documents: Array<{ source: ExpiryReturnDocument; quantities: Record<string, string> }> }>();
  const known = new Set(value.documents.flatMap(doc => doc.lines.map(row => row.batchId)));
  if (Object.keys(selected).some(key => !known.has(key))) throw Error("A selected batch is no longer in the reviewed source.");
  for (const source of value.documents) {
    const quantities: Record<string, string> = {};
    for (const row of source.lines) if (Object.hasOwn(selected, row.batchId)) {
      const quantity = selected[row.batchId]; if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > row.remainingQuantity) throw Error(`Return whole base units within the remaining source allowance for ${row.description}.`);
      quantities[`${row.receiptId}:${row.receiptLineId}`] = quantity;
    }
    if (Object.keys(quantities).length) { const group = groups.get(source.supplierId) || { supplierId: source.supplierId, supplierName: source.supplierName, documents: [] }; group.documents.push({ source, quantities }); groups.set(source.supplierId, group); }
  }
  if (!groups.size) throw Error("Select the actual lots and quantities to prepare."); return [...groups.values()];
}
export function expiryDraftCsv(group: ReturnType<typeof prepareSupplierExpiryDrafts>[number], asOf: string) {
  const cell = (value: unknown) => { let text = String(value ?? ""); if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const rows: unknown[][] = [["draft_only", "snapshot_at", "supplier_id", "supplier", "purchase_id", "original_invoice", "medicine", "batch", "printed_expiry", "quantity_base_units", "base_unit", "receipt_id", "receipt_line_id"]];
  for (const { source, quantities } of group.documents) for (const row of source.lines) { const quantity = quantities[`${row.receiptId}:${row.receiptLineId}`]; if (quantity) rows.push(["NO_STOCK_MOVEMENT_OR_CREDIT", asOf, group.supplierId, group.supplierName, source.purchaseId, source.supplierInvoiceNumber, row.description, row.batchNumber, row.expiryValue, quantity, row.unitSnapshot.baseUnit, row.receiptId, row.receiptLineId]); }
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
