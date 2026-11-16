import type { OfflinePreparedData } from "./pharmacyOfflinePreparation";
import { offlineEvidenceCanonical, PHARMACY_OFFLINE_DOCUMENT_SHA256 } from "./generated/pharmacyOfflineDocument";
import { PHARMACY_CALCULATION_ENGINE_SHA256 } from "./generated/pharmacyCalculation";

export interface VerifiedOfflineCheckoutGrant {
  authorityId: string; actorId: string; deviceId: string; enrollmentId: string;
  manifestDigest: string; validFrom: string; validUntil: string;
}
export type OfflineServerSigner = { id: string; key: CryptoKey };
const bytes = (value: string) => new TextEncoder().encode(value);
const fail = (): never => { throw new Error("The signed checkout grant does not match this prepared PC. Reconnect before billing."); };
/** Use the independently authenticated enrollment key. A response's own JWK is
 * descriptive only; it can never establish trust or enable local checkout.
 */
export async function verifyOfflineCheckoutGrant(value: unknown, prepared: OfflinePreparedData, trusted: OfflineServerSigner): Promise<VerifiedOfflineCheckoutGrant> {
  const row = value as { authorityId?: string; payload?: string; sha256?: string; signature?: string; signingKey?: { id: string } };
  if (!row || row.authorityId !== prepared.authorityId || typeof row.payload !== "string" || bytes(row.payload).length > 16000 ||
      row.signingKey?.id !== trusted.id || trusted.key.type !== "public" || trusted.key.algorithm.name !== "RSASSA-PKCS1-v1_5" ||
      typeof row.signature !== "string" || !/^[\w-]{256,1024}$/.test(row.signature)) return fail();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(row.payload)))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== row.sha256) return fail();
  const signature = Uint8Array.from(atob(row.signature.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", trusted.key, signature, bytes(`ekavyu.pharmacy.checkout-grant.v1\n${row.payload}`))) return fail();
  let raw: Record<string, unknown>; try { raw = JSON.parse(row.payload); } catch { return fail(); }
  if (!raw || raw.version !== 1 || raw.purpose !== "ekavyu.pharmacy.checkout-grant.v1" || raw.checkoutEnabled !== true || raw.inventoryMode !== "tracked" ||
      ["organizationId", "locationId", "actorId", "authorityId", "deviceId", "enrollmentId"].some(field => raw[field] !== prepared[field as keyof OfflinePreparedData]) ||
      raw.manifestDigest !== prepared.manifestDigest || !Number.isSafeInteger(raw.actorAuthVersion) || Number(raw.actorAuthVersion) < 0 ||
      offlineEvidenceCanonical(raw.calculation) !== offlineEvidenceCanonical({ policy: "pharmacy-paise-v2", sha256: PHARMACY_CALCULATION_ENGINE_SHA256, documentSha256: PHARMACY_OFFLINE_DOCUMENT_SHA256 }) ||
      offlineEvidenceCanonical(raw.lease) !== offlineEvidenceCanonical(prepared.lease) || offlineEvidenceCanonical(raw.drawer) !== offlineEvidenceCanonical(prepared.drawer) ||
      typeof raw.validFrom !== "string" || !Number.isFinite(Date.parse(raw.validFrom)) || new Date(raw.validFrom).toISOString() !== raw.validFrom ||
      raw.validFrom < prepared.preparedAt || raw.validFrom >= prepared.validUntil || raw.validUntil !== prepared.validUntil) return fail();
  return { authorityId: prepared.authorityId, actorId: prepared.actorId, deviceId: prepared.deviceId, enrollmentId: prepared.enrollmentId,
    manifestDigest: prepared.manifestDigest, validFrom: raw.validFrom, validUntil: prepared.validUntil };
}
