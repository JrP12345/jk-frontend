import api from "./api";
import { organizationPath } from "@/services/organization.service";
import { parsePickupTicket, type StaffPickup } from "./publicPharmacy";

export interface StorefrontSettings { locationId: string; inventoryMode?: "tracked" | "billing_only"; catalogueEnabled: boolean; pickupEnabled: boolean; revision: number }
function settings(raw: StorefrontSettings, locationId: string) {
  if (!raw || raw.locationId !== locationId || typeof raw.catalogueEnabled !== "boolean" || typeof raw.pickupEnabled !== "boolean" || !Number.isSafeInteger(raw.revision) || raw.revision < 0) throw Error("Public pharmacy settings could not be verified");
  return raw;
}
function staffPickup(raw: StaffPickup, locationId: string) {
  parsePickupTicket(raw, locationId);
  if (typeof raw.customerName !== "string" || typeof raw.phone !== "string") throw Error("Pickup contact details could not be loaded");
  return raw;
}
export async function readStorefront(locationId: string, signal?: AbortSignal, organizationId?: string) {
  return settings((await api.get(organizationPath(`/pharmacy/locations/${locationId}/storefront`, organizationId), { signal })).data?.data, locationId);
}
export async function saveStorefront(locationId: string, input: Pick<StorefrontSettings, "catalogueEnabled" | "pickupEnabled"> & { expectedRevision: number }, organizationId?: string) {
  return settings((await api.put(organizationPath(`/pharmacy/locations/${locationId}/storefront`, organizationId), input)).data?.data, locationId);
}
export async function readPickupQueue(locationId: string, status: string, cursor?: string, signal?: AbortSignal) {
  const page = (await api.get("/pharmacy/pickups", { params: { locationId, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) }, signal })).data?.data;
  if (!Array.isArray(page?.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw Error("Pickup queue could not be loaded completely");
  return { items: page.items.map((row: StaffPickup) => staffPickup(row, locationId)), nextCursor: page.nextCursor as string | null };
}
export async function scanPickupTicket(locationId: string, ticket: string) {
  return staffPickup((await api.post("/pharmacy/pickups/scan", { locationId, ticket })).data?.data, locationId);
}
export type PickupTransition = { locationId: string; expectedRevision: number; action: "ready" | "collect" | "cancel"; invoiceNumber?: string };
export async function changePickup(id: string, input: PickupTransition, key: string) {
  return staffPickup((await api.post(`/pharmacy/pickups/${id}/transition`, input, { headers: { "Idempotency-Key": key } })).data?.data, input.locationId);
}
export async function readStaffPickupAttachment(locationId: string, pickupId: string, attachmentId: string, download = false, signal?: AbortSignal): Promise<Blob> {
  const response = await api.get(`/pharmacy/pickups/${encodeURIComponent(pickupId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    params: { locationId, ...(download ? { download: "1" } : {}) },
    responseType: "blob",
    signal,
  });
  return response.data as Blob;
}
export const pickupError = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "The pickup operation could not be confirmed. Refresh before trying again");
