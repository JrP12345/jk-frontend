/**
 * HealthOS Offline-First Cabin Queue & Outbox Sync Engine
 * Uses native IndexedDB to guarantee continuous OPD operations during network dropouts.
 */

const DB_NAME = "healthos_offline_db";
const DB_VERSION = 1;

export interface OutboxItem {
  localId?: number;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  payload: any;
  createdAt: number;
  attempts: number;
}

export interface CachedQueueItem {
  id: string;
  clinicId: string;
  tokenNumber: number;
  patientName: string;
  patientPhone?: string;
  patientId?: string;
  status: string;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("cabinQueue")) {
        const queueStore = db.createObjectStore("cabinQueue", { keyPath: "id" });
        queueStore.createIndex("clinicId", "clinicId", { unique: false });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "localId", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache active cabin queue items for offline availability.
 */
export async function cacheCabinQueue(clinicId: string, items: any[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction("cabinQueue", "readwrite");
    const store = tx.objectStore("cabinQueue");

    for (const item of items) {
      store.put({
        id: item.id || item._id,
        clinicId,
        tokenNumber: item.tokenNumber,
        patientName: item.patientName || item.patientId?.name || "Patient",
        patientPhone: item.patientPhone || item.patientId?.phone || "",
        patientId: item.patientId?._id || item.patientId,
        status: item.status || "waiting",
        updatedAt: Date.now(),
      });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OfflineStore] Failed to cache cabin queue:", err);
  }
}

/**
 * Retrieve cached cabin queue during internet outages.
 */
export async function getCachedCabinQueue(clinicId: string): Promise<CachedQueueItem[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction("cabinQueue", "readonly");
    const store = tx.objectStore("cabinQueue");
    const index = store.index("clinicId");
    const request = index.getAll(clinicId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[OfflineStore] Failed to retrieve cached queue:", err);
    return [];
  }
}

/**
 * Queue a draft prescription or consultation note in outbox when offline.
 */
export async function enqueueOutbox(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH",
  payload: any
): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction("outbox", "readwrite");
  const store = tx.objectStore("outbox");

  const item: OutboxItem = {
    endpoint,
    method,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };

  const request = store.add(item);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count how many outbox items are currently pending synchronization.
 */
export async function getPendingOutboxCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const request = store.count();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Flush all pending outbox records to the server once connection is restored.
 */
export async function flushOutbox(apiClient: any): Promise<{ synced: number; failed: number }> {
  try {
    const db = await openDatabase();
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const request = store.getAll();

    const items: OutboxItem[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (items.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        if (item.method === "POST") {
          await apiClient.post(item.endpoint, item.payload);
        } else if (item.method === "PUT") {
          await apiClient.put(item.endpoint, item.payload);
        }

        // Successfully sent, remove from outbox
        const delTx = db.transaction("outbox", "readwrite");
        delTx.objectStore("outbox").delete(item.localId!);
        await new Promise((r) => {
          delTx.oncomplete = r;
        });
        synced++;
      } catch (err) {
        console.error("[OfflineStore] Failed to flush outbox item:", item.localId, err);
        failed++;
      }
    }

    return { synced, failed };
  } catch (err) {
    console.error("[OfflineStore] Outbox sync error:", err);
    return { synced: 0, failed: 0 };
  }
}

// Auto-sync listener on window reconnection
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    try {
      const apiModule = await import("./api");
      const result = await flushOutbox(apiModule.default);
      if (result.synced > 0) {
        window.dispatchEvent(
          new CustomEvent("offline-sync-complete", {
            detail: result,
          })
        );
      }
    } catch {
      // Ignore background sync attempt error
    }
  });
}
