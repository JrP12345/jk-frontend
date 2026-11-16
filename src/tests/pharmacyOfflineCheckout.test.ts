// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import api from "@/lib/api";
import { browserDevice } from "@/lib/pharmacyOfflineDevice";
import { createPharmacyOfflineLedger } from "@/lib/pharmacyOfflineLedger";
import { installPharmacyOfflineAssets } from "@/lib/pharmacyOfflineAssets";
import { readOfflineSession, saveOfflineSession, type OfflineSessionControl } from "@/lib/pharmacyOfflineSession";
import { startOfflineCheckout, prepareOfflineCheckout, openOfflineCheckout, cancelOfflinePreparation } from "@/lib/pharmacyOfflineCheckout";
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/services/organization.service", () => ({ organizationPath: (path: string) => path }));
vi.mock("@/lib/pharmacyTill", () => ({ activeDrawer: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineDevice", () => ({ browserDevice: vi.fn(), readOfflineDevice: vi.fn(), readOriginalOfflineDevice: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineLedger", () => ({ createPharmacyOfflineLedger: vi.fn() }));
vi.mock("@/lib/pharmacyOfflinePreparation", () => ({ offlineTrustedSigningKey: vi.fn().mockResolvedValue({}), verifyOfflinePreparation: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineAssets", () => ({ installPharmacyOfflineAssets: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineSession", () => ({ readOfflineSession: vi.fn(), saveOfflineSession: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineSync", () => ({ createPharmacyOfflineSync: vi.fn(() => ({ pause: vi.fn(), flush: vi.fn() })) }));
const scope = { organizationId: "a".repeat(24), locationId: "b".repeat(24) }, actorId = "c".repeat(24), authorityId = "a1111111-1111-4111-8111-111111111111", deviceId = "d1111111-1111-4111-8111-111111111111";
const prepared = { actorId, authorityId, manifestDigest: "d".repeat(64) };
const control = (): OfflineSessionControl => ({ version: 1, ...scope, actorId, deviceId, authorityId, phase: "prepared", revision: 1, claim: { reviewReference: "Reviewed fixture" }, signingKey: { id: "f".repeat(64), jwk: {} } });
let current: OfflineSessionControl;
let ledger: { unlock: ReturnType<typeof vi.fn>; preparation: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn>; activate: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; activeSale: ReturnType<typeof vi.fn>; prepareSale: ReturnType<typeof vi.fn>; stageSale: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  vi.clearAllMocks(); current = control(); vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("navigator", { onLine: true, storage: { persisted: vi.fn().mockResolvedValue(true), persist: vi.fn().mockResolvedValue(true) } });
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  vi.mocked(browserDevice).mockResolvedValue({ ...scope, deviceId, privateKey: pair.privateKey } as never);
  vi.mocked(readOfflineSession).mockImplementation(async () => current);
  vi.mocked(saveOfflineSession).mockImplementation(async value => { current = { ...value, revision: (value.revision ?? 0) + 1 }; return current; });
  vi.mocked(installPharmacyOfflineAssets).mockResolvedValue(undefined);
  ledger = { unlock: vi.fn(), preparation: vi.fn().mockResolvedValue(prepared), exists: vi.fn().mockResolvedValue(true), activate: vi.fn(), close: vi.fn(), activeSale: vi.fn().mockResolvedValue(null), prepareSale: vi.fn(), stageSale: vi.fn(), commit: vi.fn() };
  vi.mocked(createPharmacyOfflineLedger).mockResolvedValue(ledger as never);
});
afterEach(() => vi.unstubAllGlobals());
it("does not reserve ownership when durable browser storage is denied", async () => {
  vi.mocked(navigator.storage.persist).mockResolvedValue(false);
  await expect(startOfflineCheckout(scope, actorId, "Reviewed fixture", 10)).rejects.toThrow(/Persistent/);
  expect(api.post).not.toHaveBeenCalled(); expect(saveOfflineSession).not.toHaveBeenCalled();
});
it("does not activate checkout when public restart assets cannot be verified", async () => {
  vi.mocked(installPharmacyOfflineAssets).mockRejectedValue(new Error("Synthetic public asset mismatch"));
  await expect(prepareOfflineCheckout(current, actorId, "Synthetic passphrase")).rejects.toThrow(/asset mismatch/);
  expect(api.post).not.toHaveBeenCalled(); expect(ledger.activate).not.toHaveBeenCalled(); expect(ledger.close).toHaveBeenCalledOnce();
});
it("persists the exact signed activation before POST and recovers its lost response without signing a replacement", async () => {
  vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } }); vi.mocked(api.post).mockRejectedValueOnce(new Error("Synthetic lost activation response"));
  await expect(prepareOfflineCheckout(current, actorId, "Synthetic passphrase")).rejects.toThrow(/lost activation/);
  const activation = current.activation; expect(activation).toBeDefined(); expect(current.phase).toBe("prepared");
  expect(vi.mocked(saveOfflineSession).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.post).mock.invocationCallOrder[0]);
  vi.mocked(api.get).mockResolvedValue({ data: { data: { originalGrant: true } } });
  expect((await prepareOfflineCheckout(current, actorId, "Synthetic passphrase")).phase).toBe("active");
  expect(current.activation).toEqual(activation); expect(api.post).toHaveBeenCalledOnce(); expect(ledger.activate).toHaveBeenCalledWith({ originalGrant: true }, {});
});
it("saves locally by freezing one durable intent before commit and makes no HTTP Save request", async () => {
  const cart = { commandId: "original-command" }, sale = { commandId: "original-command", frozen: true }, saved = { digest: "original-digest" };
  ledger.prepareSale.mockResolvedValue(sale); ledger.commit.mockResolvedValue(saved);
  const runtime = await openOfflineCheckout(current, actorId, "Synthetic passphrase"); expect(await runtime.save(cart as never)).toBe(saved);
  expect(ledger.stageSale).toHaveBeenCalledWith(sale); expect(ledger.stageSale.mock.invocationCallOrder[0]).toBeLessThan(ledger.commit.mock.invocationCallOrder[0]);
  expect(api.post).not.toHaveBeenCalled(); runtime.close();
});
it("recovers the committed original Save and refuses a different command until the draft is resolved", async () => {
  const saved = { digest: "original-digest" }; ledger.activeSale.mockResolvedValue({ sale: { commandId: "original-command" }, saved });
  const runtime = await openOfflineCheckout(current, actorId, "Synthetic passphrase");
  expect(await runtime.save({ commandId: "original-command" } as never)).toBe(saved);
  await expect(runtime.save({ commandId: "different-command" } as never)).rejects.toThrow(/earlier/);
  expect(ledger.prepareSale).not.toHaveBeenCalled(); expect(ledger.commit).not.toHaveBeenCalled(); runtime.close();
});
it("retains and retries the same signed cancellation after a lost server response", async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: { owned: false } } }); vi.mocked(api.post).mockRejectedValueOnce(new Error("Synthetic lost cancellation"));
  await expect(cancelOfflinePreparation(current, actorId, "Actual cancellation review")).rejects.toThrow(/lost cancellation/);
  const cancellation = current.cancellation; expect(cancellation).toBeDefined();
  vi.mocked(api.post).mockResolvedValue({ data: { data: { authorityId, state: "closed" } } });
  expect((await cancelOfflinePreparation(current, actorId, "A changed review must not replace proof")).phase).toBe("closed");
  expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(cancellation); expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(cancellation); expect(api.get).toHaveBeenCalledOnce();
});
