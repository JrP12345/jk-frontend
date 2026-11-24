import api from "./api";

export interface CounterAvailability {
  locationId: string; mode: "cloud" | "offline_preparing" | "offline_active" | "offline_reconciliation"; checkedAt: string;
  offline: { deviceName: string; currentOperator: boolean; validUntil: string } | null;
}
export function validateCounterAvailability(value: unknown, locationId: string): CounterAvailability {
  const row = value as CounterAvailability;
  const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
  if (!row || row.locationId !== locationId || !["cloud", "offline_preparing", "offline_active", "offline_reconciliation"].includes(row.mode) || !date(row.checkedAt) ||
      (row.mode === "cloud" ? row.offline !== null : !row.offline || typeof row.offline.deviceName !== "string" || !row.offline.deviceName.trim() || row.offline.deviceName.length > 80 || /[\p{Cc}\p{Cf}]/u.test(row.offline.deviceName) || typeof row.offline.currentOperator !== "boolean" || !date(row.offline.validUntil))) throw Error("Counter availability could not be confirmed. Refresh before billing.");
  return row;
}
export async function readCounterAvailability(locationId: string, signal?: AbortSignal) {
  const { data } = await api.get(`/pharmacy/locations/${encodeURIComponent(locationId)}/counter-availability`, { signal });
  return validateCounterAvailability(data?.data, locationId);
}
