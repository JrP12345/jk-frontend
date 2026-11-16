import api from "./api";
import { browserDevice, pharmacyOfflineIdentityStore as deviceStore, offlineIdentityCompletion as completion } from "./pharmacyOfflineIdentity";
import { organizationPath } from "@/services/organization.service";
import { offlineLedgerCanonical, validateOfflineNumberLease, type OfflineNumberLease } from "./pharmacyOfflineLedger";

export interface DeviceScope { organizationId: string; locationId: string }
export interface DevicePublicKey { kty: "EC"; crv: "P-256"; x: string; y: string }
export interface EnrollmentIntent { expectedRevision: number; expectedNumberingRevision: number; expectedFinancialYear: string; count: number; deviceName: string; reviewReference: string; confirmed: true }
export interface EnrollmentRequest extends EnrollmentIntent { challengeId: string; proof: string }
export interface DeviceChallenge extends DeviceScope { actorId: string; deviceId: string; challengeId: string; context: string; expiresAt: string }
export interface ReservationEvidence extends DeviceScope { version: 1; purpose: "ekavyu.pharmacy.number-reservation.v1"; checkoutEnabled: false; actorId: string; deviceId: string; keyFingerprint: string; enrollmentId: string; lease: OfflineNumberLease }
export interface OfflineDeviceStatus extends DeviceScope {
  checkoutEnabled: false; financialYear: string; numberingRevision: number;
  signingKey: { id: string; jwk: JsonWebKey };
  device: null | { deviceId: string; deviceName: string; enrollmentId: string; revision: number; status: "enrolled" | "revoked"; keyFingerprint: string; publicKey: DevicePublicKey; payload: string; signature: string; signingKeyId: string };
}
export interface BrowserDevice extends DeviceScope { id: string; deviceId: string; privateKey: CryptoKey; publicKey: DevicePublicKey }
export interface PendingEnrollment { actorId: string; request: EnrollmentRequest }
const DOMAIN = "ekavyu.pharmacy.number-reservation.v1", UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const path = (scope: DeviceScope) => organizationPath(`/pharmacy/locations/${encodeURIComponent(scope.locationId)}/offline-device`, scope.organizationId);
const bytes = (value: string) => new TextEncoder().encode(value);
const base64url = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
function decode(value: string) {
  if (!/^[\w-]+$/.test(value)) throw new Error("Invalid device signature.");
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0));
}
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), n => n.toString(16).padStart(2, "0")).join("");
export async function deviceKeyFingerprint(key: DevicePublicKey) { return hex(await crypto.subtle.digest("SHA-256", bytes(offlineLedgerCanonical(key)))); }
export function enrollmentIntent(value: EnrollmentIntent): EnrollmentIntent {
  if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !Number.isSafeInteger(value.expectedNumberingRevision) || value.expectedNumberingRevision < 0 ||
      !/^20\d{2}-\d{2}$/.test(value.expectedFinancialYear) || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > 1000 ||
      typeof value.deviceName !== "string" || value.deviceName.trim().length < 2 || value.deviceName.length > 80 ||
      typeof value.reviewReference !== "string" || value.reviewReference.trim().length < 3 || value.reviewReference.length > 500 ||
      /[\p{Cc}\p{Cf}]/u.test(value.deviceName + value.reviewReference) || value.confirmed !== true) throw new Error("Confirm the PC name, allocation size and review reference.");
  return { expectedRevision: value.expectedRevision, expectedNumberingRevision: value.expectedNumberingRevision, expectedFinancialYear: value.expectedFinancialYear,
    count: value.count, deviceName: value.deviceName.trim(), reviewReference: value.reviewReference.trim(), confirmed: true };
}
/** This verifies number reservation evidence only. It NEVER enables checkout. */
export async function verifyOfflineDeviceStatus(value: unknown, scope: DeviceScope): Promise<{ status: OfflineDeviceStatus; evidence: ReservationEvidence | null }> {
  const row = value as OfflineDeviceStatus;
  if (!row || row.organizationId !== scope.organizationId || row.locationId !== scope.locationId || row.checkoutEnabled !== false ||
      !/^20\d{2}-\d{2}$/.test(row.financialYear) || !Number.isSafeInteger(row.numberingRevision) || row.numberingRevision < 0 ||
      !row.signingKey || !/^[a-f0-9]{64}$/.test(row.signingKey.id) || row.signingKey.jwk?.kty !== "RSA" || "d" in row.signingKey.jwk) throw new Error("PC enrollment does not match this branch.");
  const key = await crypto.subtle.importKey("jwk", row.signingKey.jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
  if (hex(await crypto.subtle.digest("SHA-256", await crypto.subtle.exportKey("spki", key))) !== row.signingKey.id) throw new Error("PC enrollment signing key needs review.");
  if (row.device === null) return { status: row, evidence: null };
  const device = row.device;
  if (!device?.publicKey || device.publicKey.kty !== "EC" || device.publicKey.crv !== "P-256" || !/^[\w-]{43}$/.test(device.publicKey.x) || !/^[\w-]{43}$/.test(device.publicKey.y) ||
      Object.keys(device.publicKey).some(key => !["kty", "crv", "x", "y"].includes(key)) || await deviceKeyFingerprint(device.publicKey) !== device.keyFingerprint) throw new Error("Original enrolled device public key differs from its signed fingerprint.");
  if (!device || !UUID.test(device.deviceId) || !UUID.test(device.enrollmentId) || typeof device.deviceName !== "string" || !device.deviceName.trim() || device.deviceName.length > 80 ||
      !["enrolled", "revoked"].includes(device.status) || !Number.isSafeInteger(device.revision) || device.revision < 1 ||
      !/^[a-f0-9]{64}$/.test(device.keyFingerprint) || device.signingKeyId !== row.signingKey.id || typeof device.payload !== "string" || device.payload.length > 8000 || typeof device.signature !== "string") throw new Error("PC enrollment evidence needs review.");
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(device.signature), bytes(`${DOMAIN}\n${device.payload}`))) throw new Error("PC enrollment signature could not be verified.");
  const evidence = JSON.parse(device.payload) as ReservationEvidence;
  if (!evidence || evidence.version !== 1 || evidence.purpose !== DOMAIN || evidence.checkoutEnabled !== false || evidence.organizationId !== scope.organizationId || evidence.locationId !== scope.locationId ||
      evidence.deviceId !== device.deviceId || evidence.enrollmentId !== device.enrollmentId || evidence.keyFingerprint !== device.keyFingerprint || !evidence.actorId || evidence.lease?.id !== device.enrollmentId)
    throw new Error("PC enrollment evidence does not match this branch or device.");
  validateOfflineNumberLease(evidence.lease);
  const duration = Date.parse(evidence.lease.validUntil) - Date.parse(evidence.lease.validFrom);
  if (duration > 24 * 60 * 60_000 || evidence.lease.last - evidence.lease.next + 1 > 1000) throw new Error("PC enrollment allocation exceeds its bounds.");
  return { status: row, evidence };
}
export async function readOfflineDevice(scope: DeviceScope, signal?: AbortSignal) {
  return verifyOfflineDeviceStatus((await api.get(path(scope), { signal })).data?.data, scope);
}
export async function readOriginalOfflineDevice(scope: DeviceScope, deviceId: string) {
  if (!UUID.test(deviceId)) throw new Error("Invalid original PC reference.");
  return verifyOfflineDeviceStatus((await api.get(`${path(scope)}/history/${encodeURIComponent(deviceId)}`)).data?.data, scope);
}
export async function requestDeviceChallenge(device: BrowserDevice, actorId: string, signal?: AbortSignal): Promise<DeviceChallenge> {
  const response = (await api.post(actionPath(device, "challenge"), { deviceId: device.deviceId, publicKey: device.publicKey }, { signal })).data?.data as DeviceChallenge;
  if (!response || response.organizationId !== device.organizationId || response.locationId !== device.locationId || response.actorId !== actorId || response.deviceId !== device.deviceId || !UUID.test(response.challengeId) || typeof response.context !== "string") throw new Error("Device challenge scope could not be confirmed.");
  const context = JSON.parse(response.context);
  if (context.version !== 1 || context.purpose !== "ekavyu.pharmacy.device-enrollment.v1" || context.organizationId !== device.organizationId || context.locationId !== device.locationId || context.actorId !== actorId ||
      context.deviceId !== device.deviceId || context.challengeId !== response.challengeId || context.expiresAt !== response.expiresAt || context.keyFingerprint !== await deviceKeyFingerprint(device.publicKey) ||
      typeof context.nonce !== "string" || !/^[\w-]{43}$/.test(context.nonce) || Date.parse(response.expiresAt) <= Date.now() || Date.parse(response.expiresAt) > Date.now() + 6 * 60_000) throw new Error("Device challenge has expired or changed.");
  return response;
}
export async function proveDeviceEnrollment(device: BrowserDevice, challenge: DeviceChallenge, value: EnrollmentIntent): Promise<EnrollmentRequest> {
  if (challenge.organizationId !== device.organizationId || challenge.locationId !== device.locationId || challenge.deviceId !== device.deviceId) throw new Error("Device challenge does not belong to this PC.");
  const intent = enrollmentIntent(value), message = `ekavyu.pharmacy.device-enrollment.v1\n${challenge.context}\n${JSON.stringify(intent)}`;
  return { ...intent, challengeId: challenge.challengeId, proof: base64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.privateKey, bytes(message))) };
}
const actionPath = (scope: DeviceScope, action: string) => organizationPath(`/pharmacy/locations/${encodeURIComponent(scope.locationId)}/offline-device/${action}`, scope.organizationId);
export async function enrollOfflineDevice(scope: DeviceScope, request: EnrollmentRequest) { return verifyOfflineDeviceStatus((await api.post(actionPath(scope, "enroll"), request)).data?.data, scope); }
export async function revokeOfflineDevice(scope: DeviceScope, expectedRevision: number, reviewReference: string) {
  return verifyOfflineDeviceStatus((await api.post(actionPath(scope, "revoke"), { expectedRevision, reviewReference: reviewReference.trim(), confirmed: true })).data?.data, scope);
}
export async function cancelDeviceEnrollment(scope: DeviceScope, challengeId: string) {
  return verifyOfflineDeviceStatus((await api.post(actionPath(scope, "cancel"), { challengeId, confirmed: true })).data?.data, scope);
}

export { browserDevice, readPendingEnrollment, savePendingEnrollment, clearCancelledEnrollment } from "./pharmacyOfflineIdentity";
export async function confirmEnrollmentLocally(scope: DeviceScope, value: OfflineDeviceStatus) {
  const { status, evidence } = await verifyOfflineDeviceStatus(value, scope), identity = await browserDevice(scope);
  if (!identity || !evidence || identity.deviceId !== evidence.deviceId || await deviceKeyFingerprint(identity.publicKey) !== evidence.keyFingerprint) throw new Error("This browser does not hold the enrolled PC key.");
  const { db, id } = await deviceStore(scope);
  try {
    const tx = db.transaction("enrollments", "readwrite", { durability: "strict" }), done = completion(tx);
    try { tx.objectStore("enrollments").put({ id, status }); } catch (failure) { tx.abort(); await done.catch(() => {}); throw failure; }
    await done;
  } finally { db.close(); }
}
