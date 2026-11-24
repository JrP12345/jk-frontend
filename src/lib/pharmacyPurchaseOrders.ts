import api from "./api";
import { createPharmacyLocalClient } from "./pharmacyDrafts";
import type { PharmacyParty, PurchaseDraft } from "@/services/pharmacyPurchase.service";
import type { ShortbookDraftSeed } from "./pharmacyShortbook";
import { purchaseReceivingPlan } from "./pharmacyReceiving";
export type OrderUnit = { version: number; baseUnit: string; packUnit: string; unitsPerPack: number; outerPackUnit?: string; packsPerOuter?: number };
export type OrderLine = { lineId: string; medicineId: string; medicineSnapshot: { name: string; genericName?: string; strength?: string; manufacturer?: string }; unitSnapshot: OrderUnit; packs: number; looseUnits: number; quantity: number };
export type OrderSummary = { id: string; reference: string; supplierId: string; supplierSnapshot: Pick<PharmacyParty, "name">; state: string; status: string; revision: number; invoiceCount: number; createdAt: string };
export type OrderResponseLine = { lineId: string; acceptedQuantity: number; quotedUnitPricePaise?: number; note: string };
export type PurchaseOrder = OrderSummary & {
  locationId: string; supplierSnapshot: PharmacyParty; buyerSnapshot: { name: string; branch: string; address?: string }; notes: string; status: string; lines: OrderLine[];
  sent?: { channel: string; reference: string; recordedAt: string }; response?: { reference: string; recordedAt: string; lines: OrderResponseLine[] };
  dispatch?: { reference: string; expectedDelivery?: string; recordedAt: string };
  closure?: { reference: string; recordedAt: string };
  comparison: Array<{ lineId: string; medicineId: string; name: string; baseUnit: string; ordered: number; accepted: number | null; invoiced: number; received: number; pendingInvoice: number; pendingReceipt: number; shortAccepted: number | null; overInvoiced: number }>;
  invoices: Array<{ id: string; number: string; payablePaise: number; receiptCount: number; revision: number }>;
};
export type OrderDraftInput = { locationId: string; supplierId: string; expectedSupplierRevision: number; expectedRevision?: number; reference: string; notes: string;
  lines: Array<{ lineId: string; medicineId: string; expectedUnitVersion: number; packs: number; looseUnits: number }> };
export type OrderActionInput = { locationId: string; expectedRevision: number; action: "submit" | "respond" | "dispatch" | "cancel" | "link_invoice" | "close_remainder"; reference: string; confirmed: true;
  channel?: string; expectedDelivery?: string; lines?: OrderResponseLine[]; purchaseId?: string; confirmVariance?: boolean };
export type OrderCommand = { key: string; kind: "save"; orderId?: string; input: OrderDraftInput } | { key: string; kind: "action"; orderId: string; input: OrderActionInput };
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const states = ["draft", "submitted", "accepted", "partially_accepted", "rejected", "dispatched", "cancelled", "closed"];
const statuses = [...states, "billed", "partially_received", "received"];
const identifier = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/.test(value);
export function validatePurchaseOrder(raw: unknown, locationId: string): PurchaseOrder {
  const row = raw as PurchaseOrder;
  if (!row || !identifier(row.id) || row.locationId !== locationId || !identifier(row.supplierId) || !row.reference || !whole(row.revision) || !states.includes(row.state) || ![...states, "billed", "partially_received", "received"].includes(row.status) || !row.supplierSnapshot?.name || !row.buyerSnapshot?.name || !Array.isArray(row.lines) || !row.lines.length || row.lines.length > 100 ||
      row.lines.some(line => !line.lineId || !identifier(line.medicineId) || !line.medicineSnapshot?.name || !line.unitSnapshot || ![line.unitSnapshot.version, line.unitSnapshot.unitsPerPack, line.packs, line.looseUnits, line.quantity].every(whole) || line.unitSnapshot.version < 1 || line.unitSnapshot.unitsPerPack < 1 || line.quantity < 1 || line.looseUnits >= line.unitSnapshot.unitsPerPack || line.quantity !== line.packs * line.unitSnapshot.unitsPerPack + line.looseUnits) ||
      !Array.isArray(row.comparison) || row.comparison.length !== row.lines.length || row.comparison.some(line => !row.lines.some(source => source.lineId === line.lineId && source.medicineId === line.medicineId && source.quantity === line.ordered) || ![line.ordered, line.invoiced, line.received, line.pendingInvoice, line.pendingReceipt, line.overInvoiced].every(whole) || line.received > line.invoiced || line.accepted !== null && !whole(line.accepted)) ||
      !Array.isArray(row.invoices) || row.invoices.length > 50 || row.invoices.some(invoice => !identifier(invoice.id) || !invoice.number || !whole(invoice.payablePaise))) throw new Error("Order response is incomplete. Reload the original order before changing it.");
  return row;
}
export async function listOrders(locationId: string, search: string, cursor: string | undefined, supplierId: string | undefined, signal: AbortSignal) {
  const { data } = await api.get(`/pharmacy/purchase-orders?${new URLSearchParams({ locationId, ...(search ? { search } : {}), ...(cursor ? { cursor } : {}), ...(supplierId ? { supplierId } : {}) })}`, { signal });
  const page = data?.data as { items: OrderSummary[]; nextCursor: string | null };
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.items.some(row => !identifier(row.id) || !row.reference || !row.supplierSnapshot?.name || !states.includes(row.state) || !statuses.includes(row.status)) || page.nextCursor !== null && !identifier(page.nextCursor)) throw new Error("Order list could not be confirmed");
  return page;
}
export async function readOrder(id: string, locationId: string, signal?: AbortSignal) {
  const { data } = await api.get(`/pharmacy/purchase-orders/${id}?${new URLSearchParams({ locationId })}`, { signal });
  const row = validatePurchaseOrder(data?.data, locationId); if (row.id !== id) throw new Error("Order identity differs"); return row;
}
export async function sendOrderCommand(command: OrderCommand) {
  const path = command.kind === "action" ? `/pharmacy/purchase-orders/${command.orderId}/actions` : `/pharmacy/purchase-orders${command.orderId ? `/${command.orderId}` : ""}`;
  const options = { headers: { "Idempotency-Key": command.key } }, { data } = command.kind === "save" && command.orderId ? await api.put(path, command.input, options) : await api.post(path, command.input, options);
  const result = validatePurchaseOrder(data?.data, command.input.locationId);
  if (command.orderId && result.id !== command.orderId) throw new Error("Order result differs from the original request"); return result;
}
export async function recoverOrderCommand(command: OrderCommand) {
  const { data } = await api.get(`/pharmacy/purchase-order-commands/${command.key}?${new URLSearchParams({ locationId: command.input.locationId, kind: command.kind, ...(command.orderId ? { orderId: command.orderId } : {}) })}`);
  const result = validatePurchaseOrder(data?.data, command.input.locationId);
  if (command.orderId && result.id !== command.orderId) throw new Error("Recovered order identity differs"); return result;
}
export async function orderHistory(id: string, locationId: string, cursor?: string, signal?: AbortSignal) {
  const { data } = await api.get(`/pharmacy/purchase-orders/${id}/history?${new URLSearchParams({ locationId, ...(cursor ? { cursor } : {}) })}`, { signal });
  const page = data?.data as { items: Array<{ id: string; action: string; createdAt: string; details: { reference?: string; revision?: number; recordedByStaff?: boolean } }>; nextCursor: string | null };
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.items.some(row => !identifier(row.id) || !row.action || !Number.isFinite(Date.parse(row.createdAt))) || page.nextCursor !== null && !identifier(page.nextCursor)) throw new Error("Order history could not be confirmed"); return page;
}
export function createOrderJournal(scope: string, locationId: string) {
  return createPharmacyLocalClient<OrderCommand | null>(scope, locationId, "purchase-order-command", raw => {
    if (raw === null) return null;
    const row = raw as OrderCommand;
    if (!row || typeof row.key !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(row.key) || !["save", "action"].includes(row.kind) || !row.input || row.input.locationId !== locationId || row.kind === "action" && !identifier(row.orderId) || row.orderId !== undefined && !identifier(row.orderId) || JSON.stringify(raw).length > 500_000) throw new Error("Saved order command needs review");
    return JSON.parse(JSON.stringify(row)) as OrderCommand;
  });
}
export const orderError = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Order outcome needs review");
export function orderSeedFromPurchase(purchase: PurchaseDraft): ShortbookDraftSeed {
  if (purchase.status !== "posted") throw new Error("Reorder from an actual posted supplier invoice");
  const lines = new Map<string, ShortbookDraftSeed["lines"][number]>();
  for (const { source } of purchaseReceivingPlan(purchase)) {
    const previous = lines.get(source.medicineId), quantity = source.billedBaseUnits + source.freeBaseUnits;
    if (previous && JSON.stringify(previous.product.unitDefinition) !== JSON.stringify(source.unitSnapshot)) throw new Error("Review the invoice's differing product units before reordering");
    const total = quantity + (previous?.quantity || 0);
    if (!Number.isSafeInteger(total) || total > 1_000_000_000) throw new Error("Reorder quantity exceeds the supported bound");
    lines.set(source.medicineId, { product: { id: source.medicineId, name: source.medicineSnapshot.name, price: 0, unitDefinition: source.unitSnapshot }, quantity: total });
  }
  return { lines: [...lines.values()], notes: `Reorder of supplier invoice ${purchase.supplierInvoiceNumber}; recheck current product units and supplier terms.` };
}
