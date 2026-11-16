import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPharmacyBranchCatalogue, type CataloguePage, type CataloguePageQuery } from "@/lib/pharmacyBranchCatalogue";
import { createPharmacyCatalogue, estimateDraft } from "@/lib/pharmacyCatalogue";
import * as drafts from "@/lib/pharmacyDrafts";
import type { CounterProduct } from "@/lib/pharmacyCounter";

const identifier = (n: number) => n.toString(16).padStart(24, "0");
const product = (n: number): CounterProduct => ({ id: identifier(n), name: `Medicine ${n}`, genericName: "Synthetic ingredient", manufacturer: "Example maker", strength: "500 mg", eligible: true, stockQuantity: 10, retailPricePaise: 1500,
  barcodes: [`000${n}`], unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } });
function source(initial: CounterProduct[]) {
  const state = { products: initial };
  const fetch = vi.fn(async (query: CataloguePageQuery): Promise<CataloguePage> => {
    const all = [...state.products].sort((a, b) => a.id.localeCompare(b.id)), after = query.after || null, through = query.through || all.at(-1)?.id || null;
    const rows = all.filter(row => (!after || row.id > after) && (!through || row.id <= through)), items = rows.slice(0, 200), nextCursor = rows.length > 200 ? items.at(-1)!.id : null;
    const hash = createHash("sha256").update(JSON.stringify({ after, items, nextCursor })).digest("hex");
    return { version: 1, locationId: "branch", after, through, hash, count: items.length, nextCursor, items: query.knownHash === hash ? null : items };
  });
  return { state, fetch };
}
const sync = (cache: ReturnType<typeof createPharmacyBranchCatalogue>, fetch: (query: CataloguePageQuery, signal: AbortSignal) => Promise<CataloguePage>) => cache.sync(fetch, new AbortController().signal);
beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await drafts.clearPharmacyDrafts(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("loads and restores a complete 10,000-product branch beyond the recent working set", async () => {
  const server = source(Array.from({ length: 10_000 }, (_, n) => product(n + 1))), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load();
  await sync(cache, server.fetch); expect(server.fetch).toHaveBeenCalledTimes(50); expect(cache.status).toMatchObject({ complete: true, count: 10_000, durable: false });
  expect(cache.find("medicine 10000")[0].id).toBe(identifier(10000)); expect(cache.find("00010000", true)[0].id).toBe(identifier(10000)); expect(cache.find("10000", true)).toEqual([]);
  const restored = createPharmacyBranchCatalogue("owner", "branch"); await restored.load(); expect(restored.status.count).toBe(10_000); expect(restored.find("maker 500 medicine 9999")[0].id).toBe(identifier(9999));
});

it("revalidates unchanged pages without rewriting product records on refresh or cart edits", async () => {
  const saves: string[] = [], original = drafts.createPharmacyLocalClient;
  vi.spyOn(drafts, "createPharmacyLocalClient").mockImplementation((...args: Parameters<typeof original>) => {
    const store = original(...args); return { ...store, save: async value => { saves.push(args[2]); return store.save(value); } };
  });
  const server = source(Array.from({ length: 220 }, (_, n) => product(n + 1))), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  saves.length = 0; server.fetch.mockClear(); await sync(cache, server.fetch);
  expect(server.fetch.mock.calls.every(([query]) => Boolean(query.knownHash))).toBe(true); expect(saves).toEqual(["branch-catalogue:v1"]);
  const recent = createPharmacyCatalogue("owner", "branch"); await recent.load(); recent.attachBranch(cache);
  recent.recordUse(identifier(219)); expect(estimateDraft(recent, [{ lineId: "line", product: product(219), packs: "0", loose: "2", discount: "0" }], "0", "branch")?.totalPaise).toBe(3000);
  await recent.flush(); expect(saves.filter(name => name.startsWith("branch-catalogue"))).toEqual(["branch-catalogue:v1"]);
});

it("applies changed products and removes missing/deleted products only on a complete refresh", async () => {
  vi.useFakeTimers(); const server = source([product(1), product(2)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  const recent = createPharmacyCatalogue("owner", "branch"); await recent.load(); recent.remember([product(1)], "medicine", false, null); recent.attachBranch(cache);
  vi.advanceTimersByTime(1000); server.state.products = [{ ...product(2), name: "Renamed product", eligible: false, retailPricePaise: 2000 }, product(3)]; await sync(cache, server.fetch);
  expect(cache.get(identifier(1))).toBeUndefined(); expect(recent.find("Medicine 1").items).toEqual([]); expect(recent.find("renamed").items).toMatchObject([{ id: identifier(2), eligible: false, retailPricePaise: 2000 }]);
  expect(recent.find("renamed").fresh).toBe(false);
});

it("retains the prior complete view when a later page fails and publishes nothing partial after reload", async () => {
  const server = source(Array.from({ length: 201 }, (_, n) => product(n + 1))), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  server.state.products[0] = { ...product(1), name: "Uncommitted change" };
  const request = vi.fn(async (query: CataloguePageQuery) => { if (query.after) throw Error("offline"); return server.fetch(query); });
  await expect(sync(cache, request)).rejects.toThrow("offline"); expect(cache.get(identifier(1))!.product.name).toBe("Medicine 1"); expect(cache.status).toMatchObject({ complete: true, count: 201, error: "offline" });
  const restored = createPharmacyBranchCatalogue("owner", "branch"); await restored.load(); expect(restored.get(identifier(1))!.product.name).toBe("Medicine 1");
});

it("does not mark a first interrupted traversal complete or accept a late cancelled response", async () => {
  const server = source(Array.from({ length: 201 }, (_, n) => product(n + 1))), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load();
  const controller = new AbortController(); let finish!: (page: CataloguePage) => void;
  const work = cache.sync(async query => { if (!query.after) return server.fetch(query); return new Promise(resolve => { finish = resolve; }); }, controller.signal);
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  expect(cache.status.complete).toBe(false); controller.abort(); finish(await server.fetch({ after: identifier(200), through: identifier(201) })); await expect(work).rejects.toMatchObject({ name: "AbortError" });
  const restored = createPharmacyBranchCatalogue("owner", "branch"); await restored.load(); expect(restored.status.complete).toBe(false);
});

it("does not mix branch/authority caches and invalidates queued work on logout", async () => {
  const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  const other = createPharmacyBranchCatalogue("owner", "other"); await other.load(); expect(other.status.complete).toBe(false);
  window.dispatchEvent(new Event("auth-logout")); await expect(sync(cache, server.fetch)).rejects.toThrow(/workspace changed/);
  const different = createPharmacyBranchCatalogue("other-owner", "branch"); await different.load(); expect(different.status.complete).toBe(false);
});

it.each([
  { locationId: "foreign" }, { version: 2 }, { count: 201 }, { through: "invalid" }, { after: identifier(5) }, { hash: "invalid" }, { items: null }
])("rejects invalid page identity/boundaries without claiming completeness: %j", async change => {
  const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load();
  await expect(sync(cache, async query => ({ ...await server.fetch(query), ...change }) as CataloguePage)).rejects.toThrow(/incomplete/); expect(cache.status.complete).toBe(false);
});

it("expires cached completeness and renews unchanged pages near their session storage expiry", async () => {
  vi.useFakeTimers(); const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  vi.advanceTimersByTime(7 * 60 * 60 * 1000); await sync(cache, server.fetch);
  vi.advanceTimersByTime(6 * 60 * 60 * 1000); const restored = createPharmacyBranchCatalogue("owner", "branch"); await restored.load(); expect(restored.status.complete).toBe(true);
  vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1); expect(restored.status.complete).toBe(false); expect(restored.find("medicine")).toEqual([]);
});

it("rejects over-bound branches without replacing an earlier complete catalogue", async () => {
  const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  server.state.products = Array.from({ length: 20_001 }, (_, n) => product(n + 1));
  await expect(sync(cache, server.fetch)).rejects.toThrow(/exceeds 20000/); expect(cache.status.count).toBe(1);
});

it("preserves an empty branch as a completed refresh and strips extra private fields", async () => {
  const server = source([]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch); expect(cache.status).toMatchObject({ complete: true, count: 0 });
  server.state.products = [{ ...product(1), costPrice: 10, customer: "private" } as CounterProduct]; await sync(cache, server.fetch);
  expect(JSON.stringify(cache.find("medicine"))).not.toMatch(/costPrice|customer|private/);
});

it("invalidates earlier barcode and negative query results when a later branch refresh changes them", async () => {
  vi.useFakeTimers(); const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"); await cache.load(); await sync(cache, server.fetch);
  const recent = createPharmacyCatalogue("owner", "branch"); await recent.load(); recent.attachBranch(cache);
  recent.remember([product(1)], "0001", true, null); recent.remember([], "new medicine", false, null);
  vi.advanceTimersByTime(1000); server.state.products = [{ ...product(1), barcodes: ["changed-barcode"], name: "New medicine" }]; await sync(cache, server.fetch);
  expect(recent.find("0001", true)).toMatchObject({ items: [], fresh: false });
  expect(recent.find("changed-barcode", true)).toMatchObject({ items: [{ id: identifier(1) }], fresh: false });
  expect(recent.find("new medicine").items).toMatchObject([{ id: identifier(1) }]);
});

it("does not reuse a negative query that completed while the full traversal was still running", async () => {
  vi.useFakeTimers(); const server = source([product(1)]), cache = createPharmacyBranchCatalogue("owner", "branch"), recent = createPharmacyCatalogue("owner", "branch");
  await cache.load(); await recent.load(); recent.attachBranch(cache);
  await sync(cache, async query => { vi.advanceTimersByTime(100); recent.remember([], "medicine", false, null); vi.advanceTimersByTime(100); return server.fetch(query); });
  expect(recent.find("medicine")).toMatchObject({ items: [{ id: identifier(1) }], fresh: false });
});

it("bounds search results while preserving literal matches, ordering and exact barcode ambiguity", async () => {
  const products = Array.from({ length: 500 }, (_, n) => product(n + 1));
  products[0].barcodes!.push("BATCH CODE A B C D E F G H", "DUPLICATE-EXACT"); products[1].barcodes!.push("DUPLICATE-EXACT");
  const server = source(products), cache = createPharmacyBranchCatalogue("owner", "branch");
  await cache.load(); await sync(cache, server.fetch);
  expect(cache.find("medicine", false, 25).map(row => row.id)).toEqual(products.slice(0, 25).map(row => row.id));
  expect(cache.find("medicine")).toHaveLength(500);
  expect(cache.find(products.at(-1)!.barcodes![0], true, 2)).toMatchObject([{ id: products.at(-1)!.id }]);
  expect(cache.find("BATCH CODE A B C D E F G H", true, 2)).toMatchObject([{ id: products[0].id }]);
  expect(cache.find("DUPLICATE-EXACT", true, 2)).toHaveLength(2);
  expect(() => cache.find("medicine", false, 0)).toThrow(/limit/);
});

it("keeps 25 results when newer working-set edits invalidate the first 250 branch matches", async () => {
  vi.useFakeTimers(); const products = Array.from({ length: 500 }, (_, n) => product(n + 1)), server = source(products);
  const cache = createPharmacyBranchCatalogue("owner", "branch"), recent = createPharmacyCatalogue("owner", "branch");
  await cache.load(); await recent.load(); recent.attachBranch(cache); await sync(cache, server.fetch);
  vi.advanceTimersByTime(1); recent.remember(products.slice(0, 250).map(row => ({ ...row, name: "Renamed", genericName: "Renamed" })), "renamed", false, null);
  expect(recent.find("medicine").items.map(row => row.id)).toEqual(products.slice(250, 275).map(row => row.id));
});
