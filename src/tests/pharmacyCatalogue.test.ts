import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanCatalogueProduct, createPharmacyCatalogue, estimateDraft } from "@/lib/pharmacyCatalogue";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import type { CounterProduct, CounterQuote } from "@/lib/pharmacyCounter";
const product: CounterProduct = { id: "product", name: "Cotton roll", genericName: "Absorbent cotton", eligible: true, stockQuantity: 100, barcodes: ["000123"], unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } };
it("retains a sale hold in the local catalogue and cannot restore eligibility from stale flags", () => {
  expect(cleanCatalogueProduct({ ...product, eligible: true, saleBlocked: true, saleBlockReason: "Reviewed recall" })).toMatchObject({ eligible: false, saleBlocked: true, saleBlockReason: "Reviewed recall" });
});
const price = { lines: [{ medicineId: "product", lineId: "line", quantity: 2, batches: [{ batchNumber: "LOT", quantity: 2, expiryValue: "2028-12", sellingPricePaise: 1500, mrpPaise: 1800 }] }], calculation: { lines: [{ lineId: "line", quantity: 2, grossAmountPaise: 3000, gstRateBps: 0 }] }, customer: { name: "Private customer", address: "Private address" }, issueInput: { expectedQuoteHash: "private" } } as unknown as CounterQuote;
beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("separates billing-only price observations and never deducts its catalogue stock", async () => {
  const tracked = createPharmacyCatalogue("user", "branch"), billing = createPharmacyCatalogue("user", "branch", "billing_only");
  await tracked.load(); tracked.remember([product], "", false, null); tracked.rememberQuote(price); await tracked.flush();
  await billing.load(); expect(billing.price(product.id)).toBeUndefined();
  billing.remember([{ ...product, retailPricePaise: 1000 }], "", false, null); billing.recordSale([{ medicineId: product.id, quantity: 3 }]); await billing.flush();
  expect(billing.find("Cotton").items[0].stockQuantity).toBe(100);
  expect(billing.estimate({ locationId: "branch", expectedInventoryMode: "billing_only", invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line", medicineId: product.id, quantity: 3, expectedUnitVersion: 1, discountPaise: 0 }] })?.totalPaise).toBe(3000);
  expect(tracked.price(product.id)?.grossPaise).toBe(3000);
});
it("retains the product working set and reduces its stock snapshot only after a confirmed sale", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load(); cache.remember([product], "Cot", false, null);
  cache.recordSale([{ medicineId: product.id, quantity: 3 }]);
  expect(cache.find("Cot").items[0].stockQuantity).toBe(97);
  expect(cache.find("Cot").fresh).toBe(false);
  await cache.flush(); const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.find("Cot").items[0].stockQuantity).toBe(97);
});

it("restores rack locations with the encrypted product snapshot without copying arbitrary catalogue fields", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  cache.remember([{ ...product, rackLocation: "A3 / Shelf 2", secret: "not stored" } as CounterProduct], "cot", false, null); await cache.flush();
  const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.find("cot").items[0]).toMatchObject({ rackLocation: "A3 / Shelf 2" });
  expect(restored.find("cot").items[0]).not.toHaveProperty("secret");
});
it("searches a bounded cached prefix and exact leading-zero barcode without server calls", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load(); cache.remember([product], "Cot", false, null);
  expect(cache.find("cot")).toMatchObject({ items: [product], fresh: true });
  expect(cache.find("absorbent").items).toHaveLength(1);
  expect(cache.find("000123", true).items).toHaveLength(1); expect(cache.find("123", true).items).toEqual([]);
  await cache.flush(); const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.find("Cot").items[0].name).toBe(product.name);
});
it("persists frequent picks and catalogue retail prices as local display totals without trusted issue assertions", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  cache.remember([{ ...product, retailPricePaise: 1525 }], "", false, null);
  cache.recordUse(product.id); cache.recordUse(product.id);
  await cache.flush();
  const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.frequency(product.id)).toBe(2);
  expect(restored.find("").items[0].retailPricePaise).toBe(1525);
  expect(estimateDraft(restored, [{ lineId: "line", product, packs: "0", loose: "1", discount: "0" }], "0", "branch")).toMatchObject({ totalPaise: 1525 });
  restored.remember([product], "", false, null);
  expect(restored.frequency(product.id)).toBe(2);
});
it("preserves the server page boundary and expires old snapshots", async () => {
  vi.useFakeTimers(); const cache = createPharmacyCatalogue("user", "branch"); await cache.load(); cache.remember([product], "Cot", false, "next-page");
  expect(cache.find("Cot")).toMatchObject({ fresh: true, nextCursor: "next-page" });
  vi.advanceTimersByTime(61_000); expect(cache.find("Cot").fresh).toBe(false);
  vi.advanceTimersByTime(12 * 60 * 60 * 1000); expect(cache.find("Cot").items).toEqual([]);
});
it("evicts the oldest products and excludes all acquisition and customer fields from persisted snapshots", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  cache.remember([{ ...product, costPrice: 99, customer: "private" } as CounterProduct], "Cot", false, null); cache.rememberQuote(price); await cache.flush();
  const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(JSON.stringify(restored.find("Cot"))).not.toMatch(/costPrice|customer|private|expectedQuoteHash/);
  for (let page = 0; page < 11; page++) cache.remember(Array.from({ length: 25 }, (_, n) => ({ ...product, id: `product-${page * 25 + n}`, name: `Item ${page * 25 + n}`, barcodes: [] })), `Item ${page}`, false, null);
  expect(cache.find("Cot").items.some(row => row.id === product.id)).toBe(false);
  expect(cache.find("Item").items).toHaveLength(25);
});
it("calculates labelled estimates locally with pack conversion and exact discounts, never issue assertions", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load(); cache.remember([product], "Cot", false, null); cache.rememberQuote(price);
  const lines = [{ lineId: "line", product, packs: "1", loose: "2", discount: "5.50" }];
  expect(estimateDraft(cache, lines, "2", "branch")).toMatchObject({ totalPaise: 17250, lines: [{ grossPaise: 17450 }] });
  expect(JSON.stringify(estimateDraft(cache, lines, "2", "branch"))).not.toMatch(/quoteHash|expectedStockRevision|issueInput/);
  expect(estimateDraft(cache, [{ ...lines[0], loose: "" }], "2", "branch")).toBeNull();
  expect(estimateDraft(cache, [{ ...lines[0], product: { ...product, unitDefinition: { ...product.unitDefinition!, version: 2 } } }], "2", "branch")).toBeNull();
});
it("keeps another user's or branch's snapshots unavailable", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load(); cache.remember([product], "Cot", false, null); await cache.flush();
  const other = createPharmacyCatalogue("user", "other branch"); await other.load(); expect(other.find("Cot").items).toEqual([]);
});

it("matches multiple literal terms across brand, generic, strength and manufacturer in any order", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  cache.remember([{ ...product, name: "Example Plus (A+B)", genericName: "Paracetamol", strength: "500 mg", manufacturer: "Acme Pharma" }], "example", false, null);
  expect(cache.find("  ACME   500 para ").items).toHaveLength(1);
  expect(cache.find("pharma 500").items).toHaveLength(1);
  expect(cache.find("(a+b)").items).toHaveLength(1);
  expect(cache.find("a.*").items).toEqual([]);
  expect(cache.find("para 650").items).toEqual([]);
  expect(cache.find(Array(9).fill("para").join(" ")).items).toHaveLength(1);
  await cache.flush(); const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.find("500 acme").items).toHaveLength(1);
});

it("does not mistake the last server page for a complete cached query", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  const first = { ...product, id: "first", name: "Medicine first" }, last = { ...product, id: "last", name: "Medicine last" };
  cache.remember([first], "Medicine", false, "page-2");
  cache.remember([last], "Medicine", false, null, "page-2");
  expect(cache.find("Medicine")).toMatchObject({ items: [first], nextCursor: "page-2" });
  expect(cache.find("Medicine last")).toMatchObject({ items: [last], fresh: false });
  await cache.flush(); const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.find("Medicine").nextCursor).toBe("page-2");
});

it("finds frequent picks from later pages rather than only the first cached query page", async () => {
  const cache = createPharmacyCatalogue("user", "branch"); await cache.load();
  cache.remember([{ ...product, id: "first" }], "", false, "page-2");
  cache.remember([{ ...product, id: "later" }], "", false, null, "page-2");
  cache.recordUse("later"); cache.recordUse("later"); cache.recordUse("first");
  expect(cache.frequent().map(row => row.id)).toEqual(["later", "first"]);
  await cache.flush(); const restored = createPharmacyCatalogue("user", "branch"); await restored.load();
  expect(restored.frequent().map(row => row.id)).toEqual(["later", "first"]);
});
