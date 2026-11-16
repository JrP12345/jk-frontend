import { offlineEvidenceCanonical } from "./generated/pharmacyOfflineDocument";
import type { OfflineLedgerScope } from "./pharmacyOfflineLedger";

export interface OfflineSessionControl extends OfflineLedgerScope {
  version: 1; revision: number; actorId: string; authorityId: string;
  phase: "claiming" | "owned" | "prepared" | "active" | "stopped" | "closed";
  claim: Record<string, unknown>; activation?: Record<string, unknown>; cancellation?: Record<string, unknown>;
  signingKey: { id: string; jwk: JsonWebKey };
}
type Branch = Pick<OfflineLedgerScope, "organizationId" | "locationId">;
const identity = (value: unknown) => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
const uuid = (value: unknown) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const fail = (): never => { throw new Error("Original offline setup state requires recovery. Do not replace this billing PC."); };
function validate(value: unknown): OfflineSessionControl {
  const row = value as OfflineSessionControl;
  if (!row || row.version !== 1 || !identity(row.organizationId) || !identity(row.locationId) || !identity(row.actorId) || !uuid(row.deviceId) || !uuid(row.authorityId) ||
      !Number.isSafeInteger(row.revision) || row.revision < 0 || !["claiming", "owned", "prepared", "active", "stopped", "closed"].includes(row.phase) ||
      !row.claim || typeof row.claim !== "object" || row.claim.authorityId !== row.authorityId || row.claim.deviceId !== row.deviceId ||
      !row.signingKey || !/^[a-f0-9]{64}$/.test(row.signingKey.id) || row.signingKey.jwk.kty !== "RSA" || "d" in row.signingKey.jwk ||
      new TextEncoder().encode(offlineEvidenceCanonical(row)).length > 32000) return fail();
  return structuredClone(row);
}
const request = <T>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
const complete = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("Offline setup write was aborted.")); tx.onerror = () => {}; });
async function database() {
  if (typeof indexedDB === "undefined" || !crypto?.subtle) return fail();
  return new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open("ekavyu-pharmacy-offline-sessions", 1); let blocked = false;
    opening.onupgradeneeded = () => { opening.result.createObjectStore("current", { keyPath: "id" }); opening.result.createObjectStore("history", { keyPath: "id" }); };
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => { blocked = true; reject(new Error("Close other offline setup windows before continuing.")); };
    opening.onsuccess = () => { if (blocked) { opening.result.close(); return; } opening.result.onversionchange = () => opening.result.close(); resolve(opening.result); };
  });
}
async function branchId(scope: Branch) {
  if (!identity(scope.organizationId) || !identity(scope.locationId)) return fail();
  const bytes = new TextEncoder().encode(offlineEvidenceCanonical({ organizationId: scope.organizationId, locationId: scope.locationId }));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
/** This contains bounded setup metadata only. Financial documents, cash, stock
 * and staged Save intents remain inside the protected per-session ledger.
 */
export async function readOfflineSession(scope: Branch): Promise<OfflineSessionControl | null> {
  const id = await branchId(scope), db = await database();
  try {
    const tx = db.transaction("current", "readonly"), done = complete(tx), row = await request(tx.objectStore("current").get(id)); await done;
    return row ? validate(row.value) : null;
  } finally { db.close(); }
}
export async function listOfflineSessions(): Promise<OfflineSessionControl[]> {
  const db = await database();
  try {
    const tx = db.transaction("current", "readonly"), done = complete(tx), rows = await request(tx.objectStore("current").getAll()); await done;
    if (rows.length > 100) return fail();
    return rows.map(row => validate(row.value));
  } finally { db.close(); }
}
export async function saveOfflineSession(value: Omit<OfflineSessionControl, "revision">, expectedRevision: number | null) {
  const next = validate({ ...structuredClone(value), revision: expectedRevision === null ? 0 : expectedRevision + 1 }), id = await branchId(next), db = await database();
  try {
    const tx = db.transaction(["current", "history"], "readwrite", { durability: "strict" }), done = complete(tx); let conflict = false;
    const current = tx.objectStore("current"), check = current.get(id);
    check.onsuccess = () => {
      const previous = check.result?.value as OfflineSessionControl | undefined;
      if (expectedRevision === null ? Boolean(previous) : !previous || previous.revision !== expectedRevision || previous.authorityId !== next.authorityId && previous.phase !== "closed") { conflict = true; tx.abort(); return; }
      try {
        if (previous?.authorityId !== next.authorityId && previous) tx.objectStore("history").put({ id: `${id}:${previous.authorityId}`, value: previous });
        current.put({ id, value: next });
      } catch { tx.abort(); }
    };
    try { await done; } catch (failure) { if (conflict) throw new Error("Another window changed offline setup. Recover its original session."); throw failure; }
    return next;
  } finally { db.close(); }
}
