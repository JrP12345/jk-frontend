import api from "./api";

export interface PharmacySaleControl { revision: number; blocked: boolean; reason: string; reviewReference: string; changedAt: string; changedBy: string; blockedAt?: string }
export interface PharmacySaleControls {
  medicineId: string; locationId: string; name: string; saleControl: PharmacySaleControl | null;
  batches: Array<{ id: string; batchNumber: string; expiryDate: string; status: string; saleControl: PharmacySaleControl | null }>;
  nextCursor: string | null;
}
const validControl = (row: PharmacySaleControl | null) => row === null || Boolean(row && Number.isSafeInteger(row.revision) && row.revision >= 1 && typeof row.blocked === "boolean" && typeof row.reason === "string" && typeof row.reviewReference === "string" && Number.isFinite(Date.parse(row.changedAt)));
export async function readPharmacySaleControls(medicineId: string, locationId: string, cursor?: string, signal?: AbortSignal): Promise<PharmacySaleControls> {
  const params = new URLSearchParams({ locationId, ...(cursor ? { cursor } : {}) });
  const { data } = await api.get(`/pharmacy/medicines/${encodeURIComponent(medicineId)}/sale-controls?${params}`, { signal });
  const row = data?.data as PharmacySaleControls;
  if (!row || row.medicineId !== medicineId || row.locationId !== locationId || typeof row.name !== "string" || !validControl(row.saleControl) || !Array.isArray(row.batches) || row.batches.length > 25 || row.batches.some(lot => !/^[a-f\d]{24}$/.test(lot.id) || !validControl(lot.saleControl)) || row.nextCursor !== null && typeof row.nextCursor !== "string") throw new Error("Sale controls could not be confirmed. Reload before making a change.");
  return row;
}
export async function savePharmacySaleControl(kind: "product" | "batch", id: string, locationId: string, input: { expectedRevision: number; blocked: boolean; reason: string; reviewReference: string; confirmed: true }) {
  const { data } = await api.put(`/pharmacy/${kind === "product" ? "medicines" : "batches"}/${encodeURIComponent(id)}/sale-control`, { locationId, ...input });
  const saved = data?.data;
  if (saved?.id !== id || saved.locationId !== locationId || !validControl(saved.saleControl) || saved.saleControl?.revision !== input.expectedRevision + 1 || saved.saleControl.blocked !== input.blocked) throw new Error("Sale-control save is uncertain. Reload to check its current result.");
  return saved as { offlineNotice: string | null };
}
