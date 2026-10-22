import api from "@/lib/api";
import type { User } from "@/store/authStore";

export interface StockReceiptPayload {
  medicineId: string; locationId: string; receiptLineId: string; kind: "opening" | "receipt";
  expectedUnitVersion: number; packs: number; looseUnits: number; batchNumber: string;
  expiry: { precision: "day" | "month"; value: string }; purchaseTotalPaise: number; sellingPricePaise: number; mrpPaise?: number; openingSourceReference?: string;
}
export interface StockReceiptResult {
  requestKey: string; batchId: string; medicineId: string; locationId: string; receiptLineId: string;
  kind: "opening" | "receipt"; receivedQuantity: number; movementId: string; revision: number;
  batch: { batchNumber: string; receivedQuantity: number; expirySnapshot: { precision: "day" | "month"; value: string }; unitSnapshot: { baseUnit: string; unitsPerPack: number } };
}
const eventName = "pharmacy-stock-reference-change";
const validKey = (key: string) => /^[a-zA-Z0-9_-]{8,100}$/.test(key);
export const stockReceiptScope = (user: User | null, locationId: string) => `ekavyu:pharmacy-stock-receipt:${JSON.stringify([user?.id, user?.organization_id, user?.impersonatedBy?.id || null, locationId])}`;
export function readStockReceiptReference(scope: string) {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(scope); } catch { return "storage-unavailable"; }
}
export function subscribeStockReceiptReferences(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener(eventName, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(eventName, listener); };
}
export async function reserveStockReceiptReference(scope: string) {
  const reserve = () => {
    if (readStockReceiptReference(scope)) throw new Error("Resolve the pending stock receipt before receiving more stock.");
    const key = crypto.randomUUID(); localStorage.setItem(scope, key);
    if (localStorage.getItem(scope) !== key) throw new Error("Stock receipt reference changed. Check its outcome.");
    window.dispatchEvent(new Event(eventName)); return key;
  };
  return navigator.locks ? navigator.locks.request(scope, reserve) : reserve();
}
export function acknowledgeStockReceiptReference(scope: string, key: string) {
  if (readStockReceiptReference(scope) !== key) throw new Error("Stock receipt reference changed. Reload before continuing.");
  localStorage.removeItem(scope); window.dispatchEvent(new Event(eventName));
}
function result(value: StockReceiptResult, key: string, locationId: string) {
  if (!value || value.requestKey !== key || value.locationId !== locationId || !value.batchId || !value.medicineId || !value.movementId || !validKey(value.receiptLineId) ||
      !Number.isSafeInteger(value.receivedQuantity) || value.receivedQuantity <= 0 || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
      !["opening", "receipt"].includes(value.kind) || value.batch?.receivedQuantity !== value.receivedQuantity || !value.batch.unitSnapshot?.baseUnit || !value.batch.expirySnapshot?.value) throw new Error("Stock receipt could not be confirmed. Keep the same reference.");
  return value;
}
export async function submitStockReceipt(payload: StockReceiptPayload, key: string) {
  if (!validKey(key)) throw new Error("A valid stock receipt reference is required.");
  const response = await api.post("/pharmacy/stock-receipts", payload, { headers: { "Idempotency-Key": key } });
  return result(response.data?.data, key, payload.locationId);
}
export async function recoverStockReceipt(locationId: string, key: string) {
  if (!validKey(key)) throw new Error("The stock receipt reference needs review.");
  const response = await api.get(`/pharmacy/stock-receipts/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`);
  return result(response.data?.data, key, locationId);
}
export function parseReceiptPaise(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split("."), paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise <= 100_000_000_000 ? paise : null;
}
