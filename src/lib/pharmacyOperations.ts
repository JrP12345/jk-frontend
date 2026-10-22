import api from "@/lib/api";
import type { User } from "@/store/authStore";

export interface DispensePayload {
  patientId: string; doctorId?: string; locationId: string;
  items: Array<{ medicineId: string; quantity: number }>;
  prescriptionIds: string[]; encounterId?: string; appointmentId?: string;
  prescriptionAllocations?: Array<{ prescriptionId: string; medicineId: string; quantity: number; expectedFulfillmentRevision?: number; expectedRemainingQuantity?: number }>;
}
export interface DispenseResult {
  id: string; invoiceNumber: string; totalAmount: number; balanceDue?: number;
  dispenseOperation: {
    version: 1; key: string; invoiceId: string; invoiceNumber: string; locationId: string;
    addedAmount: number; appendedToExisting: boolean;
    allocations: Array<{ medicineId: string; quantity: number; lineAmount: number;
      batches: Array<{ batchId: string; batchNumber: string; quantity: number }> }>;
  };
}

const referenceEvent = "pharmacy-reference-change";
const validKey = (key: string) => /^[a-zA-Z0-9_-]{8,100}$/.test(key);
export function dispenseReferenceScope(user: User | null, locationId: string) {
  return `ekavyu:pharmacy-dispense:${JSON.stringify([user?.id, user?.organization_id, user?.impersonatedBy?.id || null, locationId])}`;
}
/** Only an opaque key is persisted; no patient, prescription or financial body. */
export function readDispenseReference(scope: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(scope); }
  catch { return "storage-unavailable"; }
}
export function subscribeDispenseReferences(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(referenceEvent, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(referenceEvent, listener); };
}
export async function reserveDispenseReference(scope: string) {
  const reserve = () => {
    if (readDispenseReference(scope)) throw new Error("Resolve the pending dispense before starting another bill.");
    const key = crypto.randomUUID();
    localStorage.setItem(scope, key);
    if (localStorage.getItem(scope) !== key) throw new Error("Dispense reference changed. Check the pending outcome.");
    window.dispatchEvent(new Event(referenceEvent));
    return key;
  };
  return navigator.locks ? navigator.locks.request(scope, reserve) : reserve();
}
export function acknowledgeDispenseReference(scope: string, key: string) {
  if (readDispenseReference(scope) !== key) throw new Error("Dispense reference changed. Reload before continuing.");
  localStorage.removeItem(scope);
  window.dispatchEvent(new Event(referenceEvent));
}
function recordedResult(data: DispenseResult, key: string, locationId: string): DispenseResult {
  const operation = data?.dispenseOperation;
  if (operation?.version !== 1 || operation.key !== key || operation.locationId !== locationId ||
      !operation.invoiceId || !operation.invoiceNumber || !Number.isFinite(operation.addedAmount) || !Array.isArray(operation.allocations)) {
    throw new Error("Dispense result could not be confirmed. Keep the same reference.");
  }
  return data;
}
export async function submitPharmacyDispense(payload: DispensePayload, key: string) {
  if (!validKey(key)) throw new Error("A valid dispense reference is required.");
  const response = await api.post("/pharmacy/dispense", payload, { headers: { "Idempotency-Key": key } });
  return recordedResult(response.data.data, key, payload.locationId);
}
export async function recoverPharmacyDispense(locationId: string, key: string) {
  if (!validKey(key)) throw new Error("The stored dispense reference requires review.");
  const response = await api.get(`/pharmacy/dispense-operations/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`);
  return recordedResult(response.data.data, key, locationId);
}
