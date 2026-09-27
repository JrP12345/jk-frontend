/**
 * Browser persistence for clinical data is retired. The former IndexedDB
 * queue/outbox stored patient names, phone numbers, and note payloads on the
 * device. Clinical work must be saved to the authenticated server while online.
 */
const LEGACY_DB_NAME = "healthos_offline_db";

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

if (typeof window !== "undefined") {
  purgeLegacyClinicalBrowserData().catch(() => {});
}
