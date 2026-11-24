import api from "./api";

export interface PublicPharmacyFlags { catalogueEnabled: boolean; pickupEnabled: boolean }
export interface PublicMedicine { id: string; name: string; genericName: string; strength: string; baseUnit: string; unitVersion: number; available: boolean; availabilityKnown?: boolean }
export interface PickupItem { unitVersion?: number; medicineId: string; name: string; strength: string; baseUnit: string; quantity: number }
export interface PickupTicket { id: string; reference: string; locationId: string; status: "requested" | "ready" | "collected" | "cancelled" | "expired"; revision: number; createdAt: string; expiresAt: string; readyAt?: string; collectedAt?: string; invoiceNumber?: string; items: PickupItem[]; location?: { name: string; city: string; phone: string } | null }
export interface StaffPickup extends PickupTicket { customerName: string; phone: string; invoiceId?: string }
export interface PickupRequest { name: string; phone: string; ticketSecret: string; items: Array<{ medicineId: string; unitVersion: number; quantity: number }> }
const whole = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export function parsePickupTicket(value: unknown, locationId?: string): PickupTicket {
  const row = value as PickupTicket;
  if (!row?.id || !/^PK-[A-F0-9]{10}$/.test(row.reference) || !row.locationId || locationId && row.locationId !== locationId || !["requested", "ready", "collected", "cancelled", "expired"].includes(row.status) || !whole(row.revision) || !Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.expiresAt)) || !Array.isArray(row.items) || !row.items.length || row.items.length > 25 || new Set(row.items.map(item => item.medicineId)).size !== row.items.length || row.items.some(item => !item.medicineId || !item.name || !item.baseUnit || !whole(item.quantity) || item.quantity < 1)) throw Error("Pickup details could not be verified. Refresh the ticket");
  return row;
}
export function pickupTokenFromScan(value: string): string {
  const raw = value.trim();
  if (/^[a-f0-9]{64}$/.test(raw) || /^PK-[A-F0-9]{10}$/.test(raw)) return raw;
  try { const url = new URL(raw); if (["http:", "https:"].includes(url.protocol) && url.pathname === "/pickup" && /^[a-f0-9]{64}$/.test(url.hash.slice(1))) return url.hash.slice(1); } catch { /* Scanner input is shown for correction. */ }
  throw Error("Scan a pickup QR, or enter its ticket link or PK reference");
}
export const makePickupSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
export async function publicMedicines(slug: string, locationId: string, search: string, cursor?: string, signal?: AbortSignal) {
  const response = await api.get(`/public/locations/${encodeURIComponent(slug)}/medicines`, { params: { search, ...(cursor ? { cursor } : {}) }, signal }), row = response.data?.data;
  if (!row || row.location?.id !== locationId || row.catalogueEnabled !== true || typeof row.pickupEnabled !== "boolean" || !Array.isArray(row.items) || row.items.length > 25 || row.nextCursor !== null && typeof row.nextCursor !== "string" || row.items.some((item: PublicMedicine) => !item?.id || !item.name || !item.baseUnit || !whole(item.unitVersion) || item.unitVersion < 1 || typeof item.available !== "boolean")) throw Error("The medicine list could not be loaded completely");
  return row as { items: PublicMedicine[]; nextCursor: string | null; pickupEnabled: boolean };
}
export async function requestPickup(slug: string, locationId: string, input: PickupRequest, key: string) {
  const response = await api.post(`/public/locations/${encodeURIComponent(slug)}/pickups`, input, { headers: { "Idempotency-Key": key } });
  return parsePickupTicket(response.data?.data, locationId);
}
export async function readPickupTicket(token: string, signal?: AbortSignal) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("Open the original pickup link to see this ticket");
  return parsePickupTicket((await api.post("/public/pharmacy-pickup/status", { token }, { signal })).data?.data);
}
export const pickupStatusLabels: Record<PickupTicket["status"], string> = { requested: "Waiting for pharmacy confirmation", ready: "Ready for pickup", collected: "Collected", cancelled: "Cancelled", expired: "Ticket expired" };
