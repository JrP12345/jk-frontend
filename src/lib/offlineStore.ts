/**
 * Browser persistence for clinical data is retired. The former IndexedDB
 * queue/outbox stored patient names, phone numbers, and note payloads on the
 * device. Clinical work must be saved to the authenticated server while online.
 */
const LEGACY_DB_NAME = "healthos_offline_db";

export interface OutboxItem {
  localId?: number;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  payload: never;
  createdAt: number;
  attempts: number;
}

export interface CachedQueueItem {
  id: string;
  clinicId: string;
  tokenNumber: number;
  status: string;
  updatedAt: number;
}

/** Best-effort removal of PHI persisted by older frontend versions. */
export async function purgeLegacyClinicalBrowserData(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  await new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export async function cacheCabinQueue(_clinicId: string, _items: unknown[]): Promise<void> {
  await purgeLegacyClinicalBrowserData();
}

export async function getCachedCabinQueue(_clinicId: string): Promise<CachedQueueItem[]> {
  await purgeLegacyClinicalBrowserData();
  return [];
}

export async function enqueueOutbox(
  _endpoint: string,
  _method: "POST" | "PUT" | "PATCH",
  _payload: unknown,
): Promise<number> {
  await purgeLegacyClinicalBrowserData();
  throw new Error("Offline clinical outbox is disabled to prevent browser PHI storage");
}

export async function getPendingOutboxCount(): Promise<number> {
  await purgeLegacyClinicalBrowserData();
  return 0;
}

export async function flushOutbox(_apiClient: unknown): Promise<{ synced: number; failed: number }> {
  await purgeLegacyClinicalBrowserData();
  return { synced: 0, failed: 0 };
}

if (typeof window !== "undefined") {
  purgeLegacyClinicalBrowserData().catch(() => {});
}
