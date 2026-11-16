// @vitest-environment node
import { expect, it } from "vitest";
import { protectOfflineKey, openProtectedOfflineKey, OFFLINE_KEY_ITERATIONS } from "@/lib/pharmacyOfflineCrypto";

const passphrase = "Synthetic offline passphrase 2026!";
it("wraps a non-extractable financial key and restores the same encryption identity", async () => {
  const result = await protectOfflineKey(passphrase, "original-branch-device");
  expect(result.key.extractable).toBe(false); expect(result.wrapped.ciphertext).toHaveLength(96);
  expect(JSON.stringify(result.wrapped)).not.toContain(passphrase); expect(OFFLINE_KEY_ITERATIONS).toBe(600000);
  const reopened = await openProtectedOfflineKey(result.wrapped, passphrase, "original-branch-device");
  expect(reopened.extractable).toBe(false);
  const iv = crypto.getRandomValues(new Uint8Array(12)), original = new TextEncoder().encode("issued invoice evidence");
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, result.key, original);
  expect(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, reopened, encrypted))).toBe("issued invoice evidence");
  await expect(crypto.subtle.exportKey("raw", reopened)).rejects.toThrow();
});
it("rejects wrong credentials, branch/device substitution and changed encrypted key material", async () => {
  const { wrapped } = await protectOfflineKey(passphrase, "original-branch-device");
  await expect(openProtectedOfflineKey(wrapped, "Different long passphrase!", "original-branch-device")).rejects.toThrow();
  await expect(openProtectedOfflineKey(wrapped, passphrase, "another-branch-device")).rejects.toThrow();
  const changed = { ...wrapped, ciphertext: `${wrapped.ciphertext[0] === "0" ? "1" : "0"}${wrapped.ciphertext.slice(1)}` };
  await expect(openProtectedOfflineKey(changed, passphrase, "original-branch-device")).rejects.toThrow();
});
it("uses independent salt and IV and fails closed on weak credentials and malformed storage", async () => {
  const first = await protectOfflineKey(passphrase, "scope"), second = await protectOfflineKey(passphrase, "scope");
  expect(first.wrapped.salt).not.toBe(second.wrapped.salt); expect(first.wrapped.iv).not.toBe(second.wrapped.iv);
  await expect(protectOfflineKey("1234", "scope")).rejects.toThrow(/12 to 128/);
  await expect(openProtectedOfflineKey({ ...first.wrapped, ciphertext: "00" }, passphrase, "scope")).rejects.toThrow(/recovery/);
});
