import { openProtectedOfflineKey, type ProtectedOfflineKey } from "./pharmacyOfflineCrypto";
import type { OfflineLedgerScope, StoredOfflineReceipt, OfflineLedgerStop } from "./pharmacyOfflineLedger";
import { offlineEvidenceCanonical } from "./generated/pharmacyOfflineDocument";

export interface OfflineRecoveryBackup {
  version: 1; purpose: "ekavyu.pharmacy.read-only-recovery.v1"; scope: OfflineLedgerScope; exportedAt: string;
  authorityId?: string;
  key: ProtectedOfflineKey;
  records: Array<{ id: string; revision: number; iv: string; ciphertext: string }>;
}
const bytes = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value)).map(byte => byte.toString(16).padStart(2, "0")).join("");
const hash = async (value: string) => hex(await crypto.subtle.digest("SHA-256", bytes(value)));
const fail = (): never => { throw new Error("Original protected backup and enrolled PC evidence are required for recovery."); };
/** Recovery never imports database files, installs an identity, resumes a number
 * lease or enables issuance. Callers authenticate the original enrollment key;
 * the server separately validates every original receipt during import.
 */
export async function openPharmacyOfflineRecovery(serialized: string, passphrase: string, expectedScope: OfflineLedgerScope, enrolledPublicKey: JsonWebKey) {
  if (typeof serialized !== "string" || serialized.length > 64 * 1024 * 1024) return fail();
  let backup: OfflineRecoveryBackup; try { backup = JSON.parse(serialized); } catch { return fail(); }
  if (!backup || backup.version !== 1 || backup.purpose !== "ekavyu.pharmacy.read-only-recovery.v1" ||
      offlineEvidenceCanonical(backup.scope) !== offlineEvidenceCanonical(expectedScope) || !Array.isArray(backup.records) || backup.records.length > 65000 ||
      !backup.key || enrolledPublicKey?.kty !== "EC" || enrolledPublicKey.crv !== "P-256" || "d" in enrolledPublicKey) return fail();
  if (backup.authorityId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(backup.authorityId)) return fail();
  const prefix = await hash(offlineEvidenceCanonical(backup.authorityId ? { ...expectedScope, authorityId: backup.authorityId } : expectedScope)), records = new Map<string, OfflineRecoveryBackup["records"][number]>();
  let key: CryptoKey | null = await openProtectedOfflineKey(backup.key, passphrase, prefix);
  for (const row of backup.records) {
    if (!row || typeof row.id !== "string" || row.id.length > 220 || !row.id.startsWith(`${prefix}:`) || records.has(row.id) ||
        !Number.isSafeInteger(row.revision) || row.revision < 0 || !/^[a-f0-9]{24}$/.test(row.iv) || typeof row.ciphertext !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(row.ciphertext) || row.ciphertext.length > 40 * 1024 * 1024) return fail();
    records.set(row.id, row);
  }
  let unlocked = true;
  async function read<T>(id: string): Promise<T> {
    if (!unlocked || !key) throw new Error("This recovery view is locked.");
    const row = records.get(id); if (!row) return fail();
    const iv = Uint8Array.from(row.iv.match(/../g)!, byte => parseInt(byte, 16)), ciphertext = Uint8Array.from(atob(row.ciphertext), char => char.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: bytes(`${id}:${row.revision}`) }, key, ciphertext);
    if (!unlocked) throw new Error("This recovery view is locked.");
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
  const source = await read<{ publicKey: JsonWebKey; data: { authorityId: string; lease: { next: number } } }>(`${prefix}:prepared`);
  if (source.publicKey.x !== enrolledPublicKey.x || source.publicKey.y !== enrolledPublicKey.y) return fail();
  const publicKey = await crypto.subtle.importKey("jwk", enrolledPublicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return {
    readOnly: true as const,
    lock() { unlocked = false; key = null; records.clear(); },
    async overview() {
      const head = await read<{ lease: { next: number }; lastDigest: string | null }>(`${prefix}:head`);
      if (!source.data || !Number.isSafeInteger(source.data.lease?.next) || source.data.lease.next < 1 || !Number.isSafeInteger(head.lease?.next) ||
          head.lease.next < source.data.lease.next || head.lease.next - source.data.lease.next > 1000) return fail();
      return { authorityId: source.data.authorityId, first: source.data.lease.next, next: head.lease.next, lastDigest: head.lastDigest };
    },
    async receipt(commandId: string): Promise<StoredOfflineReceipt> {
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(commandId)) return fail();
      const original = await read<StoredOfflineReceipt>(`${prefix}:sale:${commandId}`), receipt = original.receipt;
      if (receipt.version !== 2 || receipt.commandId !== commandId || !receipt.authorityId || backup.authorityId && receipt.authorityId !== backup.authorityId || typeof original.deviceSignature !== "string" || !/^[\w-]{86}$/.test(original.deviceSignature) ||
          offlineEvidenceCanonical(receipt.scope) !== offlineEvidenceCanonical(expectedScope) || await hash(offlineEvidenceCanonical(receipt)) !== original.digest) return fail();
      const signature = Uint8Array.from(atob(original.deviceSignature.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
      if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, bytes(`ekavyu.pharmacy.offline-sale.v1\n${receipt.authorityId}\n${original.digest}`))) return fail();
      return original;
    },
    references() { if (!unlocked) throw new Error("This recovery view is locked."); return [...records.keys()].filter(id => id.startsWith(`${prefix}:sale:`)).map(id => id.slice(`${prefix}:sale:`.length)); },
    async stopped(): Promise<OfflineLedgerStop | null> {
      const head = await read<{ stopped?: OfflineLedgerStop }>(`${prefix}:head`);
      if (!head.stopped) return null;
      const { proof, ...checkpoint } = head.stopped;
      if (typeof proof !== "string" || !/^[\w-]{86}$/.test(proof)) return fail();
      const signature = Uint8Array.from(atob(proof.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
      if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, bytes(`ekavyu.pharmacy.stopped-ledger.v1\n${offlineEvidenceCanonical(expectedScope)}\n${offlineEvidenceCanonical(checkpoint)}`))) return fail();
      return head.stopped;
    },
  };
}
