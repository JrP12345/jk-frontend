import api from "./api";
import type { PurchaseProduct } from "@/services/pharmacyPurchase.service";

export type ShortbookEntry = { id: string; medicineId: string; quantity: number; unitVersion: number; note: string; status: "open" | "resolved"; revision: number; updatedAt: string;
  product: (PurchaseProduct & { stockQuantity: number; rackLocation?: string }) | null };
export type ShortbookDraftSeed = { lines: Array<{ product: PurchaseProduct; quantity: number }>; notes: string };
export async function readShortbook(locationId: string, options: { status?: string; cursor?: string; medicineId?: string }, signal: AbortSignal) {
  const response = await api.get(`/pharmacy/shortbook?${new URLSearchParams({ locationId, ...options })}`, { signal }), page = response.data?.data as { items: ShortbookEntry[]; nextCursor: string | null };
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string" || page.items.some(row => !row || typeof row.id !== "string" || !row.id || typeof row.medicineId !== "string" || !row.medicineId || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 1_000_000 || !Number.isSafeInteger(row.unitVersion) || row.unitVersion < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1 || !["open", "resolved"].includes(row.status) || typeof row.note !== "string" || row.note.length > 300 || typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt)) ||
    row.product !== null && (!row.product || row.product.id !== row.medicineId || typeof row.product.name !== "string" || !Number.isFinite(row.product.price) || row.product.price < 0 || !Number.isSafeInteger(row.product.stockQuantity) || row.product.stockQuantity < 0 || row.product.unitDefinition && (!Number.isSafeInteger(row.product.unitDefinition.version) || row.product.unitDefinition.version < 1 || !Number.isSafeInteger(row.product.unitDefinition.unitsPerPack) || row.product.unitDefinition.unitsPerPack < 1 || row.product.unitDefinition.unitsPerPack > 1_000_000 || typeof row.product.unitDefinition.baseUnit !== "string" || !row.product.unitDefinition.baseUnit || typeof row.product.unitDefinition.packUnit !== "string" || !row.product.unitDefinition.packUnit)))) throw new Error("Shortbook could not be loaded completely. Reload its current entries.");
  return page;
}
export async function saveShortbook(locationId: string, medicineId: string, input: { quantity: number; expectedUnitVersion: number; expectedRevision: number; note: string; status: "open" | "resolved" }) {
  const response = await api.put(`/pharmacy/shortbook/${encodeURIComponent(medicineId)}`, { locationId, ...input }), value = response.data?.data;
  if (!value?.id || value.revision !== input.expectedRevision + 1) throw new Error("Shortbook save could not be confirmed. Reload this entry before editing it.");
}
export const shortbookError = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Shortbook could not be loaded.");
