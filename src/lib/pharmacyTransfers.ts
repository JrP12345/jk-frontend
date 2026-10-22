import api from "@/lib/api";
export const transferActions = ["create", "approve", "dispatch", "receive", "resolve", "cancel"] as const;
export type TransferAction = typeof transferActions[number];
export interface TransferReference { key: string; action: TransferAction; transferId?: string }
export interface TransferProduct { id: string; name: string; identity: string; stockQuantity: number; unit: string | null }
export interface TransferLot { id: string; batchNumber: string; quantity: number; expiryDate: string; costBasis: { totalPaise: number; receivedBaseUnits: number; currency: string } }
export interface PharmacyTransfer {
  id: string; organizationId: string; sourceLocationId: string; destinationLocationId: string; sourceMedicineId: string; destinationMedicineId: string; sourceBatchId: string;
  sourceName: string; destinationName: string; unit: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number };
  lot: Omit<TransferLot, "id" | "quantity">; quantity: number; status: "draft" | "approved" | "in_transit" | "closed" | "cancelled"; revision: number;
  dispatchedQuantity: number; receivedQuantity: number; quarantinedQuantity: number; lostQuantity: number; returnedQuantity: number; inTransitQuantity: number;
  transportReference: string; reviewReference: string; eventId?: string; requestKey?: string;
  events?: Array<{ id: string; action: TransferAction; quantity: number; revision: number; disposition: string | null; reviewReference: string; createdAt: string }>;
  nextEventsCursor?: string | null;
}
const id = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function parseTransfer(value: unknown, locationId: string, transferId?: string): PharmacyTransfer {
  const row = value as PharmacyTransfer;
  if (!row || ![row.id, row.organizationId, row.sourceLocationId, row.destinationLocationId, row.sourceMedicineId, row.destinationMedicineId, row.sourceBatchId].every(id) ||
      ![row.sourceLocationId, row.destinationLocationId].includes(locationId) || row.sourceLocationId === row.destinationLocationId || transferId && row.id !== transferId ||
      ![row.quantity, row.revision, row.dispatchedQuantity, row.receivedQuantity, row.quarantinedQuantity, row.lostQuantity, row.returnedQuantity, row.inTransitQuantity].every(whole) || row.quantity < 1 || row.quantity > 1_000_000 || row.dispatchedQuantity > row.quantity ||
      row.dispatchedQuantity !== row.receivedQuantity + row.quarantinedQuantity + row.lostQuantity + row.returnedQuantity + row.inTransitQuantity ||
      !["draft", "approved", "in_transit", "closed", "cancelled"].includes(row.status) || ["draft", "approved", "cancelled"].includes(row.status) && row.dispatchedQuantity !== 0 || row.status === "closed" && (row.inTransitQuantity !== 0 || row.dispatchedQuantity !== row.quantity) ||
      row.status === "in_transit" && (row.dispatchedQuantity !== row.quantity || row.inTransitQuantity < 1) ||
      row.events !== undefined && (!Array.isArray(row.events) || row.events.length > 20 || row.events.some(event => !id(event.id) || !transferActions.includes(event.action) || !whole(event.quantity) || !whole(event.revision) || typeof event.reviewReference !== "string") || row.nextEventsCursor !== null && !id(row.nextEventsCursor)) ||
      !row.unit || !whole(row.unit.version) || row.unit.version < 1 || !whole(row.unit.unitsPerPack) || row.unit.unitsPerPack < 1 || !["tablet", "capsule", "ml", "g", "piece", "dose"].includes(row.unit.baseUnit) || !["strip", "box", "bottle", "vial", "tube", "ampoule", "sachet", "pack", "piece"].includes(row.unit.packUnit) ||
      !row.lot || !Number.isFinite(new Date(row.lot.expiryDate).getTime()) || !whole(row.lot.costBasis?.totalPaise) || !whole(row.lot.costBasis.receivedBaseUnits) || row.lot.costBasis.receivedBaseUnits < 1 || row.lot.costBasis.currency !== "INR" ||
      ![row.sourceName, row.destinationName, row.lot.batchNumber, row.transportReference, row.reviewReference].every(item => typeof item === "string" && item.length > 0 && item.length <= 500)) throw new Error("Transfer response does not reconcile with this branch and source");
  return row;
}
export function parseTransferReference(value: string | null): TransferReference | null {
  if (value === null) return null; const ref = JSON.parse(value) as TransferReference;
  if (!ref || !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) || !transferActions.includes(ref.action) || (ref.action === "create" ? ref.transferId !== undefined : !id(ref.transferId))) throw new Error("Stored transfer reference needs review"); return ref;
}
export async function listTransfers(locationId: string, cursor?: string) {
  const row = (await api.get(`/pharmacy/transfers?locationId=${locationId}${cursor ? `&cursor=${cursor}` : ""}`)).data?.data;
  if (!row || !Array.isArray(row.items) || row.items.length > 20 || row.nextCursor !== null && !id(row.nextCursor)) throw new Error("Transfer history could not be confirmed");
  return { items: row.items.map((item: unknown) => parseTransfer(item, locationId)), nextCursor: row.nextCursor as string | null };
}
export async function readTransfer(locationId: string, transferId: string, eventCursor?: string) { return parseTransfer((await api.get(`/pharmacy/transfers/${transferId}?locationId=${locationId}${eventCursor ? `&eventCursor=${eventCursor}` : ""}`)).data?.data, locationId, transferId); }
function recorded(value: unknown, locationId: string, reference: TransferReference) {
  const row = parseTransfer(value, locationId, reference.transferId);
  if (row.requestKey !== reference.key || !id(row.eventId)) throw new Error("Transfer stage could not be confirmed; retain the reference"); return row;
}
export async function submitTransfer(locationId: string, reference: TransferReference, input: object) {
  const url = reference.action === "create" ? "/pharmacy/transfers" : `/pharmacy/transfers/${reference.transferId}/${reference.action}`;
  return recorded((await api.post(url, { ...input, locationId }, { headers: { "Idempotency-Key": reference.key } })).data?.data, locationId, reference);
}
export async function recoverTransfer(locationId: string, reference: TransferReference) {
  return recorded((await api.get(`/pharmacy/transfer-operations/${reference.key}?locationId=${locationId}&action=${reference.action}${reference.transferId ? `&transferId=${reference.transferId}` : ""}`)).data?.data, locationId, reference);
}
export async function searchTransferProducts(locationId: string, search: string): Promise<TransferProduct[]> {
  const row = (await api.get(`/pharmacy/transfer-products?locationId=${locationId}&search=${encodeURIComponent(search.trim().slice(0, 100))}`)).data?.data;
  if (!row || row.locationId !== locationId || !Array.isArray(row.items) || row.items.length > 20 || row.items.some((item: TransferProduct) => !id(item.id) || typeof item.name !== "string" || typeof item.identity !== "string" || !whole(item.stockQuantity) || item.unit !== null && typeof item.unit !== "string")) throw new Error("Branch product search could not be confirmed"); return row.items;
}
export async function readTransferLots(locationId: string, medicineId: string, cursor?: string) {
  const row = (await api.get(`/pharmacy/transfer-source-lots?locationId=${locationId}&medicineId=${medicineId}${cursor ? `&cursor=${cursor}` : ""}`)).data?.data;
  if (!row || row.locationId !== locationId || row.medicineId !== medicineId || !Array.isArray(row.items) || row.items.length > 20 || row.nextCursor !== null && !id(row.nextCursor) ||
      row.items.some((lot: TransferLot) => !id(lot.id) || !whole(lot.quantity) || lot.quantity < 1 || typeof lot.batchNumber !== "string" || !Number.isFinite(new Date(lot.expiryDate).getTime()) || !whole(lot.costBasis?.totalPaise) || !whole(lot.costBasis.receivedBaseUnits) || lot.costBasis.receivedBaseUnits < 1 || lot.costBasis.currency !== "INR")) throw new Error("Source lots could not be confirmed");
  return row as { items: TransferLot[]; nextCursor: string | null };
}
export function transferError(failure: unknown) { return (failure as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (failure as Error)?.message || "Transfer outcome is uncertain; retain the stage reference"; }
