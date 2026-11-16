import type { CounterProduct } from "./pharmacyCounter";

export type DraftLine = { lineId: string; product: CounterProduct; packs: string; loose: string; discount: string };
export type DraftCart = { lines: DraftLine[]; customerId: string | null; discount: string; billNumber?: number };
export type CounterDraft = { cart: DraftCart; held: DraftCart[] };
const DATABASE = "ekavyu-pharmacy-drafts", STORE = "drafts", SECRET = "ekavyu-pharmacy-draft-key";
const LIFETIME = 12 * 60 * 60 * 1000;
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
const sessionPrefix = async (secret: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
type Record = { id: string; revision: number; expires: number; iv: Uint8Array; ciphertext: ArrayBuffer };
const memory = new Map<string, { revision: number; expires: number; value: unknown }>();
let generation = 0;
const queues = new Map<string, Promise<unknown>>();
function serial<T>(owner: string, work: () => Promise<T>): Promise<T> {
  // Keep CAS writes ordered for one record. A catalogue snapshot must not block
  // a different record's paid-Save recovery intent or another branch's cart.
  const prior = queues.get(owner) || Promise.resolve();
  const result = prior.then(work, work);
  const settled = result.then(() => {}, () => {});
  queues.set(owner, settled);
  void settled.then(() => { if (queues.get(owner) === settled) queues.delete(owner); });
  return result;
}
export const emptyCounterDraft = (): CounterDraft => ({ cart: { lines: [], customerId: null, discount: "0" }, held: [] });

/** Allowlist draft fields. Never persist customer details, prices, receipts or payment inputs. */
export function cleanCounterDraft(input: unknown): CounterDraft {
  const value = input as CounterDraft;
  const text = (value: unknown, max = 150) => typeof value === "string" && value.length <= max;
  const amount = (value: unknown) => typeof value === "string" && value.length <= 32;
  function cart(raw: DraftCart): DraftCart {
    if (!raw || !Array.isArray(raw.lines) || raw.lines.length > 100 || !amount(raw.discount) || raw.customerId !== null && !text(raw.customerId, 100)) throw Error("Saved cart needs review");
    const lines = raw.lines.map(line => {
      const p = line?.product, unit = p?.unitDefinition;
      if (!line || !text(line.lineId, 100) || !text(p?.id, 100) || typeof p?.name !== "string" || typeof p?.genericName !== "string" || !unit || !text(unit.baseUnit, 40) || !text(unit.packUnit, 40) || !Number.isSafeInteger(unit.version) || unit.version < 1 || !Number.isSafeInteger(unit.unitsPerPack) || unit.unitsPerPack < 1 || !amount(line.packs) || !amount(line.loose) || !amount(line.discount)) throw Error("Saved product quantities or units need review");
      return { lineId: line.lineId, packs: line.packs, loose: line.loose, discount: line.discount,
        product: { id: p.id, name: p.name, genericName: p.genericName, ...(typeof p.strength === "string" ? { strength: p.strength } : {}), eligible: true, stockQuantity: 0, unitDefinition: { version: unit.version, baseUnit: unit.baseUnit, packUnit: unit.packUnit, unitsPerPack: unit.unitsPerPack } } };
    });
    if (new Set(lines.map(line => line.lineId)).size !== lines.length || new Set(lines.map(line => line.product.id)).size !== lines.length) throw Error("Saved cart contains duplicate products");
    if (raw.billNumber !== undefined && (!Number.isSafeInteger(raw.billNumber) || raw.billNumber < 1)) throw Error("Saved bill label needs review");
    return { lines, customerId: raw.customerId, discount: raw.discount, ...(raw.billNumber !== undefined ? { billNumber: raw.billNumber } : {}) };
  }
  if (!value || !Array.isArray(value.held) || value.held.length > 3) throw Error("Saved carts need review");
  return { cart: cart(value.cart), held: value.held.map(cart) };
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Device storage is busy"));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
async function readRecord(id: string): Promise<Record | undefined> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE), request = store.get(id);
    let result: Record | undefined;
    request.onsuccess = () => { const value = request.result as Record | undefined; if (value && value.expires > Date.now()) result = value; else if (value) store.delete(id); };
    const cursor = store.openCursor(); cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value.expires <= Date.now()) row.delete(); row.continue(); } };
    tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(tx.error || Error("Device storage read failed"));
  }); } finally { db.close(); }
}
async function writeRecord(record: Record, expected: number, epoch: number) {
  const db = await open();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE), request = store.get(record.id);
    let conflict = false, writeFailure: unknown;
    request.onsuccess = () => {
      try {
        const previous = request.result as Record | undefined;
        if (epoch !== generation || (previous && previous.expires > Date.now() ? previous.revision : 0) !== expected) { conflict = true; tx.abort(); }
        else store.put(record);
      } catch (failure) {
        // Synchronous storage failures occur inside this event, outside the Promise executor.
        writeFailure = failure;
        try { tx.abort(); } catch { reject(failure); }
      }
    };
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(writeFailure || Error(conflict ? "This draft changed in another tab. Reload the saved cart before continuing." : "Device storage write failed"));
  }); } finally { db.close(); }
}

export function createPharmacyDraftClient(scope: string, locationId: string) {
  return createPharmacyLocalClient(scope, locationId, "cart", cleanCounterDraft);
}

/** Encrypted session storage shared by pharmacy drafts, bounded catalogue snapshots and recovery intents. */
export function createPharmacyLocalClient<T>(scope: string, locationId: string, namespace: string, clean: (value: unknown) => T) {
  try { const previous = sessionStorage.getItem(`${SECRET}:scope`); if (previous && previous !== scope) void clearPharmacyDrafts(); } catch { /* The client reports memory-only storage below. */ }
  const epoch = generation;
  let revision = 0, disk = typeof indexedDB !== "undefined" && Boolean(globalThis.crypto?.subtle);
  const owner = JSON.stringify(namespace === "cart" ? [scope, locationId] : [scope, locationId, namespace]);
  let secret: string;
  try { sessionStorage.setItem(`${SECRET}:scope`, scope); secret = sessionStorage.getItem(SECRET) || ""; if (!/^[a-f\d]{64}$/.test(secret)) { secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join(""); sessionStorage.setItem(SECRET, secret); } }
  catch { disk = false; secret = "memory"; }
  const memoryId = `${owner}:${secret}`;
  const volatileKey = `${SECRET}:volatile:${owner}`;
  try { if (sessionStorage.getItem(volatileKey)) disk = false; } catch { disk = false; }
  function degraded() { disk = false; try { sessionStorage.setItem(volatileKey, "1"); } catch { /* This session already reports memory-only drafts. */ } }
  const valid = () => { if (epoch !== generation) throw Error("The signed-in workspace changed"); };
  let encryptionTask: Promise<{ key: CryptoKey; id: string }> | undefined;
  async function encryption() {
    return encryptionTask ??= prepareEncryption();
  }
  async function prepareEncryption() {
    const raw = Uint8Array.from(secret.match(/../g)!, pair => parseInt(pair, 16));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(memoryId));
    return { key, id: `${await sessionPrefix(secret)}:${hex(digest)}` };
  }
  return {
    load: () => serial(memoryId, async () => {
      valid(); let saved: T | null = null;
      if (disk) {
        try { const { key, id } = await encryption(), row = await readRecord(id); valid();
          if (row) { const decoded = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv), additionalData: new TextEncoder().encode(owner) }, key, row.ciphertext); valid(); saved = clean(JSON.parse(new TextDecoder().decode(decoded))); revision = row.revision; }
        } catch (failure) { valid(); if (failure instanceof DOMException && failure.name === "OperationError" || failure instanceof SyntaxError || failure instanceof Error && failure.message.startsWith("Saved")) throw Error("Saved cart could not be opened. Contact your administrator before continuing."); degraded(); }
      }
      if (!disk) { const row = memory.get(memoryId); if (row && row.expires > Date.now()) { saved = clean(row.value); revision = row.revision; } }
      return { value: saved, durable: disk };
    }),
    save: (input: T) => {
      const value = clean(input);
      return serial(memoryId, async () => {
        valid();
        if (disk) {
          try { const { key, id } = await encryption(), iv = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(owner) }, key, new TextEncoder().encode(JSON.stringify(value)));
            valid(); await writeRecord({ id, revision: revision + 1, expires: Date.now() + LIFETIME, iv, ciphertext }, revision, epoch); revision++; return { durable: true };
          } catch (failure) { valid(); if (failure instanceof Error && failure.message.includes("another tab")) throw failure; degraded(); }
        }
        const prior = memory.get(memoryId); if (prior && prior.expires > Date.now() && prior.revision !== revision) throw Error("This draft changed in another tab. Reload the saved cart before continuing.");
        revision++; memory.set(memoryId, { revision, expires: Date.now() + LIFETIME, value }); return { durable: false };
      });
    },
  };
}

export function clearPharmacyDrafts() {
  generation++; memory.clear();
  let secret: string | null = null;
  try { secret = sessionStorage.getItem(SECRET); for (const key of Object.keys(sessionStorage)) if (key.startsWith(SECRET) || key === "ekavyu-pharmacy-offline-context") sessionStorage.removeItem(key); } catch { /* Encryption key is already unavailable. */ }
  // Invalidate queued writers synchronously above, then wait for old in-flight
  // transactions before removing their ciphertext. New sessions use a new key.
  return Promise.allSettled([...queues.values()]).then(async () => {
    if (typeof indexedDB === "undefined" || !secret || !/^[a-f\d]{64}$/.test(secret) || !globalThis.crypto?.subtle) return;
    try {
      const prefix = `${await sessionPrefix(secret)}:`, db = await open();
      try { await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite"), cursor = tx.objectStore(STORE).openCursor();
        cursor.onsuccess = () => { const row = cursor.result; if (row) { if (String(row.key).startsWith(prefix)) row.delete(); row.continue(); } };
        tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
      }); } finally { db.close(); }
    } catch { /* Old ciphertext is inaccessible after its sign-in key is removed. */ }
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("auth-context-change", event => {
    const detail = (event as CustomEvent<{ previousScope: string; scope: string; transient?: boolean }>).detail;
    // A reload verifies the same server session before opening its encrypted draft.
    try {
      const owner = sessionStorage.getItem(`${SECRET}:scope`);
      if (detail?.previousScope === "anonymous" && detail.scope !== "anonymous" && detail.scope === owner) return;
      // A transport outage suspends online authority; retain only the session's encrypted preparation data.
      if (detail?.transient && detail.previousScope === owner && sessionStorage.getItem(SECRET)) return;
    } catch { /* Clear drafts if their session cannot be verified. */ }
    void clearPharmacyDrafts();
  });
  window.addEventListener("auth-logout", () => { void clearPharmacyDrafts(); });
  window.addEventListener("storage", event => { if (event.key === "ekavyu_logout_at") void clearPharmacyDrafts(); });
}
