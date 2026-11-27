import api from "./api";

export interface PublicPharmacyFlags { catalogueEnabled: boolean; pickupEnabled: boolean }
export interface PublicMedicine { id: string; name: string; genericName: string; strength: string; baseUnit: string; unitVersion: number; available: boolean; availabilityKnown?: boolean }
export interface PickupAttachment { id: string; name: string; contentType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; size: number }
export interface PickupUploadAttachment { name: string; contentType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; base64Data: string }
export interface PickupItem { unitVersion?: number; medicineId: string; name: string; strength: string; baseUnit: string; quantity: number }
export interface PickupTicket { id: string; reference: string; locationId: string; status: "requested" | "ready" | "collected" | "cancelled" | "expired"; revision: number; createdAt: string; expiresAt: string; readyAt?: string; collectedAt?: string; invoiceNumber?: string; notes?: string; attachments?: PickupAttachment[]; items: PickupItem[]; location?: { name: string; city: string; phone: string } | null }
export interface StaffPickup extends PickupTicket { customerName: string; phone: string; invoiceId?: string }
export interface PickupRequest { name: string; phone: string; ticketSecret: string; items: Array<{ medicineId: string; unitVersion: number; quantity: number }>; notes?: string; attachments?: PickupUploadAttachment[] }
const whole = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export const PICKUP_UPLOAD_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const MAX_PICKUP_FILES = 4;
export const MAX_PICKUP_FILE_BYTES = 4 * 1024 * 1024;
export function parsePickupTicket(value: unknown, locationId?: string): PickupTicket {
  const row = value as PickupTicket;
  if (!row?.id || !/^PK-[A-F0-9]{10}$/.test(row.reference) || !row.locationId || locationId && row.locationId !== locationId || !["requested", "ready", "collected", "cancelled", "expired"].includes(row.status) || !whole(row.revision) || !Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.expiresAt)) || !Array.isArray(row.items) || row.items.length > 25 || new Set(row.items.map(item => item.medicineId)).size !== row.items.length || row.items.some(item => !item.medicineId || !item.name || !item.baseUnit || !whole(item.quantity) || item.quantity < 1)) throw Error("Pickup details could not be verified. Refresh the ticket");
  if (row.notes !== undefined && (typeof row.notes !== "string" || row.notes.length > 2000)) throw Error("Pickup description could not be verified. Refresh the ticket");
  if (row.attachments !== undefined && (!Array.isArray(row.attachments) || row.attachments.length > MAX_PICKUP_FILES || row.attachments.some(att => !att?.id || typeof att.name !== "string" || !att.name.trim() || !(PICKUP_UPLOAD_MIMES as readonly string[]).includes(att.contentType) || !whole(att.size) || att.size < 1))) throw Error("Pickup attachments could not be verified. Refresh the ticket");
  if (!row.items.length && !row.notes?.trim() && !row.attachments?.length) throw Error("Pickup details could not be verified. Refresh the ticket");
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
export async function readPublicPickupAttachment(token: string, attachmentId: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("Open the original pickup link to see this ticket");
  const response = await api.post("/public/pharmacy-pickup/attachment", { token, attachmentId }, { responseType: "blob", signal });
  return response.data instanceof Blob ? response.data : new Blob([response.data]);
}
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
async function compressImageIfNeeded(file: File, normalizedType: PickupUploadAttachment["contentType"]): Promise<{ blob: Blob; contentType: PickupUploadAttachment["contentType"] }> {
  if (normalizedType === "application/pdf" || typeof document === "undefined" || typeof createImageBitmap !== "function") return { blob: file, contentType: normalizedType };
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const maxEdge = 1800, scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
      if (scale === 1 && file.size <= 1_200_000) return { blob: file, contentType: normalizedType };
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return { blob: file, contentType: normalizedType };
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const targetType = normalizedType === "image/png" && file.size <= 1_800_000 ? "image/png" : "image/jpeg";
      const encoded = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, targetType, 0.82));
      if (encoded && encoded.size > 0 && encoded.size < file.size) return { blob: encoded, contentType: targetType };
    } finally { bitmap.close(); }
  } catch { /* Fall back to validated original file when image decoding is unavailable (e.g. non-browser runtimes). */ }
  return { blob: file, contentType: normalizedType };
}
export async function preparePickupAttachment(file: File): Promise<PickupUploadAttachment> {
  const rawType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!(PICKUP_UPLOAD_MIMES as readonly string[]).includes(rawType)) throw Error("Choose a PNG, JPG, WebP image or PDF document.");
  const { blob, contentType } = await compressImageIfNeeded(file, rawType as PickupUploadAttachment["contentType"]);
  const buffer = typeof blob.arrayBuffer === "function" ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_PICKUP_FILE_BYTES) throw Error(`${file.name || "Attachment"} is over the 4 MB limit even after optimization.`);
  return { name: (file.name || "prescription").slice(0, 140), contentType, base64Data: bytesToBase64(new Uint8Array(buffer)) };
}
export const pickupStatusLabels: Record<PickupTicket["status"], string> = { requested: "Waiting for pharmacy confirmation", ready: "Ready for pickup", collected: "Collected", cancelled: "Cancelled", expired: "Ticket expired" };
