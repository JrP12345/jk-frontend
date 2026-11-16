// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createPharmacyOfflineLedger, offlineInvoiceNumber, offlineLedgerCanonical, validateOfflineNumberLease, type OfflineNumberLease } from "@/lib/pharmacyOfflineLedger";

const lease = (): OfflineNumberLease => ({ id: "reserved-device-lease", prefix: "I00012627/", financialYear: "2026-27", next: 15, last: 20,
  validFrom: "2026-11-15T00:00:00.000Z", validUntil: "2026-11-15T12:00:00.000Z" });
afterEach(() => vi.unstubAllGlobals());

it("uses only the assigned range and never advances a number before committing", () => {
  const value = lease();
  expect(offlineInvoiceNumber(value, "2026-11-15T06:00:00.000Z", null)).toBe("I00012627/000015");
  expect(value.next).toBe(15);
  expect(offlineInvoiceNumber({ ...value, next: 20 }, "2026-11-15T06:00:00.000Z", null)).toBe("I00012627/000020");
  expect(() => offlineInvoiceNumber({ ...value, next: 21 }, "2026-11-15T06:00:00.000Z", null)).toThrow(/allocation/);
});
it.each([
  { next: 0 }, { next: 1.5 }, { last: 1000000 }, { last: 14 }, { prefix: "SHOP/" }, { prefix: "I00012526/" },
  { financialYear: "2025-26" }, { id: "../branch" }, { validUntil: "2027-04-01T00:00:00.000Z" },
  { validUntil: "2026-11-15T00:00:00.000Z" }, { validFrom: "2026-11-15" }, { validFrom: "invalid" },
])("rejects invalid or unassigned numbering: %j", change => {
  expect(() => validateOfflineNumberLease({ ...lease(), ...change })).toThrow(/allocation/);
});
it("uses the Indian financial-year boundary, including the UTC evening before April", () => {
  const edge = { ...lease(), validFrom: "2026-03-31T18:30:00.000Z", validUntil: "2026-03-31T18:31:00.000Z" };
  expect(() => validateOfflineNumberLease(edge)).not.toThrow();
  expect(() => validateOfflineNumberLease({ ...edge, validFrom: "2026-03-31T18:29:59.999Z" })).toThrow(/allocation/);
});
it("uses a captured owner-defined series only when its format and allocation agree", () => {
  const value: OfflineNumberLease = { ...lease(), prefix: "PJP/26-27/", last: 99999, format: { prefixTemplate: "PJP/{FY}/", digits: 5, resetPolicy: "financial_year", configurationRevision: 2 } };
  expect(offlineInvoiceNumber(value, "2026-11-15T06:00:00.000Z", null)).toBe("PJP/26-27/00015");
  expect(() => validateOfflineNumberLease({ ...value, prefix: "OTHER/" })).toThrow(/allocation/);
  expect(() => validateOfflineNumberLease({ ...value, format: { ...value.format!, configurationRevision: 0 } })).toThrow(/allocation/);
  expect(() => validateOfflineNumberLease({ ...value, last: 100000 })).toThrow(/allocation/);
});
it.each(["2026-11-14T23:59:59.999Z", "2026-11-15T12:00:00.001Z", "invalid"])("rejects issuance outside the allocation window: %s", at => {
  expect(() => offlineInvoiceNumber(lease(), at, null)).toThrow(/expired|clock/);
});
it("rejects clock rollback and permits equal timestamps without reusing the sequence", () => {
  expect(() => offlineInvoiceNumber(lease(), "2026-11-15T06:00:00.000Z", "2026-11-15T06:00:00.001Z")).toThrow(/clock/);
  expect(offlineInvoiceNumber(lease(), "2026-11-15T06:00:00.000Z", "2026-11-15T06:00:00.000Z")).toBe("I00012627/000015");
});
it("canonicalizes exact evidence independently of key insertion order", () => {
  expect(offlineLedgerCanonical({ z: undefined, b: [1, { y: false, x: "₹" }], a: null })).toBe(offlineLedgerCanonical({ a: null, b: [1, { x: "₹", y: false }] }));
  expect(offlineLedgerCanonical([1, 2])).not.toBe(offlineLedgerCanonical([2, 1]));
  expect(offlineLedgerCanonical({ cash: 15 })).not.toBe(offlineLedgerCanonical({ cash: 150 }));
});
it.each([NaN, Infinity, undefined, new Date(), new Map(), { n: NaN }])("rejects non-JSON evidence rather than silently hashing different data: %j", value => {
  expect(() => offlineLedgerCanonical(value)).toThrow(/unsupported/);
});
it("rejects sparse arrays instead of committing ciphertext that cannot be restored", () => {
  expect(() => offlineLedgerCanonical(Array(2))).toThrow(/unsupported/);
});
it("requires a full tenant, branch and device scope before opening a ledger", async () => {
  await expect(createPharmacyOfflineLedger({ organizationId: "", locationId: "branch", deviceId: "device" })).rejects.toThrow(/scope/);
});
it("fails closed when IndexedDB is unavailable; financial evidence has no memory-only fallback", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await expect(createPharmacyOfflineLedger({ organizationId: "org", locationId: "branch", deviceId: "device" })).rejects.toThrow(/unavailable.*Nothing was saved/);
});
