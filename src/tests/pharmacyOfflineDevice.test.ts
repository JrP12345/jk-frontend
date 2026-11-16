// @vitest-environment node
import crypto from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { offlineEvidenceCanonical } from "@/lib/generated/pharmacyOfflineDocument";
import { deviceKeyFingerprint, enrollmentIntent, enrollOfflineDevice, proveDeviceEnrollment, requestDeviceChallenge, verifyOfflineDeviceStatus, browserDevice, type DevicePublicKey } from "@/lib/pharmacyOfflineDevice";
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const scope = { organizationId: "org", locationId: "branch" }, pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
function fixture() {
  const at = new Date().toISOString(), date = new Date(Date.now() + 330 * 60000), year = date.getUTCFullYear(), start = date.getUTCMonth() >= 3 ? year : year - 1;
  const publicKey = pair.publicKey.export({ format: "jwk" }), signingKey = { id: crypto.createHash("sha256").update(pair.publicKey.export({ type: "spki", format: "der" })).digest("hex"), jwk: publicKey };
  const deviceId = crypto.randomUUID(), enrollmentId = crypto.randomUUID(), deviceJwk = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" });
  const deviceKey = { kty: "EC", crv: "P-256", x: deviceJwk.x!, y: deviceJwk.y! }, keyFingerprint = crypto.createHash("sha256").update(offlineEvidenceCanonical(deviceKey)).digest("hex");
  const grant = { ...scope, version: 1, purpose: "ekavyu.pharmacy.number-reservation.v1", checkoutEnabled: false, actorId: "owner", deviceId, enrollmentId, keyFingerprint,
    lease: { id: enrollmentId, prefix: "PJP/", next: 137, last: 139, financialYear: `${start}-${String(start + 1).slice(-2)}`, validFrom: at,
      validUntil: new Date(Math.min(Date.now() + 3600000, Date.UTC(start + 1, 2, 31, 18, 30) - 1)).toISOString(), format: { prefixTemplate: "PJP/", digits: 4, resetPolicy: "continuous", configurationRevision: 1 } } };
  const status = { ...scope, checkoutEnabled: false, financialYear: grant.lease.financialYear, numberingRevision: 1, signingKey,
    device: { deviceId, enrollmentId, keyFingerprint, publicKey: deviceKey, deviceName: "Counter PC", revision: 1, status: "enrolled", payload: "", signature: "", signingKeyId: signingKey.id } };
  function sign(value = grant) { status.device.payload = JSON.stringify(value); status.device.signature = crypto.sign("RSA-SHA256", Buffer.from(`ekavyu.pharmacy.number-reservation.v1\n${status.device.payload}`), pair.privateKey).toString("base64url"); }
  sign(); return { status, grant, sign };
}
it("verifies the server signature and captured custom lease without enabling checkout", async () => {
  const f = fixture(), result = await verifyOfflineDeviceStatus(f.status, scope);
  expect(result.evidence!.lease.next).toBe(137); expect(result.status.checkoutEnabled).toBe(false);
  await expect(verifyOfflineDeviceStatus({ ...f.status, device: null }, scope)).resolves.toMatchObject({ evidence: null });
});
it("rejects modified signatures, embedded keys, foreign scope and widened checkout claims", async () => {
  const f = fixture();
  await expect(verifyOfflineDeviceStatus({ ...f.status, organizationId: "foreign" }, scope)).rejects.toThrow(/branch/);
  await expect(verifyOfflineDeviceStatus({ ...f.status, checkoutEnabled: true }, scope)).rejects.toThrow(/branch/);
  await expect(verifyOfflineDeviceStatus({ ...f.status, signingKey: { ...f.status.signingKey, id: "b".repeat(64) } }, scope)).rejects.toThrow(/signing key/);
  f.status.device.payload += " "; await expect(verifyOfflineDeviceStatus(f.status, scope)).rejects.toThrow(/signature/);
  f.sign({ ...f.grant, deviceId: crypto.randomUUID() }); await expect(verifyOfflineDeviceStatus(f.status, scope)).rejects.toThrow(/device/);
});
it("rejects signed allocations with mismatched numbers, oversized ranges and invalid fiscal evidence", async () => {
  const f = fixture();
  f.sign({ ...f.grant, lease: { ...f.grant.lease, last: 2000 } }); await expect(verifyOfflineDeviceStatus(f.status, scope)).rejects.toThrow(/bounds/);
  f.sign({ ...f.grant, lease: { ...f.grant.lease, prefix: "OTHER/" } }); await expect(verifyOfflineDeviceStatus(f.status, scope)).rejects.toThrow(/allocation/);
  f.sign({ ...f.grant, lease: { ...f.grant.lease, financialYear: "2000-01" } }); await expect(verifyOfflineDeviceStatus(f.status, scope)).rejects.toThrow(/allocation/);
});
it("validates intent without numeric coercion and fixes the proof field order", () => {
  const input = { expectedRevision: 0, expectedNumberingRevision: 1, expectedFinancialYear: "2026-27", count: 3, deviceName: " Main PC ", reviewReference: " Review ", confirmed: true as const };
  expect(enrollmentIntent(input)).toMatchObject({ deviceName: "Main PC", reviewReference: "Review" });
  expect(() => enrollmentIntent({ ...input, count: "3" as unknown as number })).toThrow(/Confirm/);
  expect(() => enrollmentIntent({ ...input, deviceName: "Unsafe\nname" })).toThrow(/Confirm/);
});
it("signs browser P-256 possession proof that Node verifies, bound to all reviewed intent fields", async () => {
  const keys = await crypto.webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]), exported = await crypto.webcrypto.subtle.exportKey("jwk", keys.publicKey);
  const publicKey = { kty: "EC", crv: "P-256", x: exported.x!, y: exported.y! } as DevicePublicKey;
  const device = { ...scope, id: "identity", deviceId: crypto.randomUUID(), publicKey, privateKey: keys.privateKey as CryptoKey };
  const challengeId = crypto.randomUUID(), expiresAt = new Date(Date.now() + 300000).toISOString();
  const context = JSON.stringify({ version: 1, purpose: "ekavyu.pharmacy.device-enrollment.v1", ...scope, actorId: "owner", deviceId: device.deviceId, keyFingerprint: await deviceKeyFingerprint(publicKey), challengeId, nonce: crypto.randomBytes(32).toString("base64url"), expiresAt });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { ...scope, actorId: "owner", deviceId: device.deviceId, challengeId, context, expiresAt } } });
  const challenge = await requestDeviceChallenge(device, "owner"), fields = { expectedRevision: 0, expectedNumberingRevision: 0, expectedFinancialYear: "2026-27", count: 3, deviceName: "Main PC", reviewReference: "Synthetic review", confirmed: true as const };
  const result = await proveDeviceEnrollment(device, challenge, fields);
  const message = `ekavyu.pharmacy.device-enrollment.v1\n${context}\n${JSON.stringify(enrollmentIntent(fields))}`;
  expect(crypto.verify("sha256", Buffer.from(message), { key: crypto.createPublicKey({ key: publicKey, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(result.proof, "base64url"))).toBe(true);
  await expect(requestDeviceChallenge(device, "other-owner")).rejects.toThrow(/scope/);
  expect(api.post).toHaveBeenCalledWith("/pharmacy/locations/branch/offline-device/challenge?organizationId=org", { deviceId: device.deviceId, publicKey }, expect.anything());
});
it("sends exact enrollment evidence through the existing scoped API", async () => {
  const f = fixture(), input = { challengeId: f.grant.enrollmentId, proof: "proof", expectedRevision: 0, expectedNumberingRevision: 1, expectedFinancialYear: f.status.financialYear, count: 3, deviceName: "Main PC", reviewReference: "Review", confirmed: true as const };
  vi.mocked(api.post).mockResolvedValue({ data: { data: f.status } });
  await enrollOfflineDevice(scope, input); expect(api.post).toHaveBeenCalledWith("/pharmacy/locations/branch/offline-device/enroll?organizationId=org", input);
});
it("fails closed without durable storage instead of creating a temporary PC identity", async () => {
  vi.stubGlobal("indexedDB", undefined); await expect(browserDevice(scope, true)).rejects.toThrow(/Durable/);
});
