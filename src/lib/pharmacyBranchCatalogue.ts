import type { CounterProduct } from "./pharmacyCounter";
import { cleanCatalogueProduct } from "./pharmacyCatalogue";
import { createPharmacyLocalClient } from "./pharmacyDrafts";
import { yieldPharmacyBackgroundWork } from "./pharmacyBackgroundWork";

const PAGE_SIZE = 200, MAX_PAGES = 100, LIFETIME = 12 * 60 * 60 * 1000;
const id = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const time = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= Date.now() + 30_000;
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
type Descriptor = { after: string | null; hash: string; count: number; nextCursor: string | null; storedAt: number; checkedAt: number };
type Manifest = { version: 1; locationId: string; through: string | null; startedAt: number; checkedAt: number; count: number; pages: Descriptor[] };
export type CataloguePage = { version: 1; locationId: string; after: string | null; through: string | null; hash: string; count: number; nextCursor: string | null; items: CounterProduct[] | null };
export type CataloguePageQuery = { after?: string; through?: string; knownHash?: string };
export type CatalogueStatus = { complete: boolean; count: number; checkedAt: number | null; durable: boolean; error: string };
function invalid(): never { throw Error("Saved branch catalogue is incomplete. Refresh it online; recent products remain available."); }
function descriptor(raw: Descriptor): Descriptor {
  if (!raw || raw.after !== null && !id(raw.after) || !hash(raw.hash) || !Number.isInteger(raw.count) || raw.count < 0 || raw.count > PAGE_SIZE ||
      raw.nextCursor !== null && (!id(raw.nextCursor) || raw.count !== PAGE_SIZE || raw.after !== null && raw.nextCursor <= raw.after) || !time(raw.storedAt) || !time(raw.checkedAt)) invalid();
  return { after: raw.after, hash: raw.hash, count: raw.count, nextCursor: raw.nextCursor, storedAt: raw.storedAt, checkedAt: raw.checkedAt };
}
function cleanManifest(value: unknown, locationId: string): Manifest {
  const raw = value as Manifest;
  if (!raw || raw.version !== 1 || raw.locationId !== locationId || raw.through !== null && !id(raw.through) || !time(raw.startedAt) || !time(raw.checkedAt) || raw.checkedAt < raw.startedAt ||
      !Array.isArray(raw.pages) || !raw.pages.length || raw.pages.length > MAX_PAGES || !Number.isInteger(raw.count) || raw.count < 0 || raw.count > MAX_PAGES * PAGE_SIZE) invalid();
  const pages = raw.pages.map(descriptor);
  if (pages[0].after !== null || pages.at(-1)!.nextCursor !== null || pages.reduce((sum, page) => sum + page.count, 0) !== raw.count ||
      pages.some((page, n) => n > 0 && (pages[n - 1].nextCursor === null || page.after !== pages[n - 1].nextCursor) || page.nextCursor !== null && (raw.through === null || page.nextCursor > raw.through)) || raw.through === null && raw.count !== 0) invalid();
  return { version: 1, locationId, through: raw.through, startedAt: raw.startedAt, checkedAt: raw.checkedAt, count: raw.count, pages };
}
function cleanPage(value: unknown): CounterProduct[] {
  if (!Array.isArray(value) || value.length > PAGE_SIZE) invalid();
  return value.map(product => { const clean = cleanCatalogueProduct(product); if (!id(clean.id)) invalid(); return clean; });
}
function checkRows(items: CounterProduct[], page: Descriptor, through: string | null) {
  if (items.length !== page.count || items.some((row, n) => through === null || row.id > through || row.id <= (n ? items[n - 1].id : page.after || "")) ||
      page.nextCursor !== null && items.at(-1)?.id !== page.nextCursor) invalid();
}

/** Full anonymous branch preparation, encrypted in small content-addressed pages.
 * Publish one manifest only after traversal completes; keep the prior complete view on failure.
 * Refresh revalidates bounded pages; this is not a transactional stock snapshot/change stream.
 */
export function createPharmacyBranchCatalogue(scope: string, locationId: string) {
  const manifestStore = createPharmacyLocalClient(scope, locationId, "branch-catalogue:v1", value => cleanManifest(value, locationId));
  const stores = new Map<string, ReturnType<typeof createPharmacyLocalClient<CounterProduct[]>>>();
  const pageStore = (key: string) => { let store = stores.get(key); if (!store) { store = createPharmacyLocalClient(scope, locationId, `branch-catalogue:v1:${key}`, cleanPage); stores.set(key, store); } return store; };
  let manifest: Manifest | null = null, rows = new Map<string, { product: CounterProduct; observedAt: number }>(), pages = new Map<string, CounterProduct[]>();
  let fields = new Map<string, string[]>(), barcodes = new Map<string, Set<string>>(), durable = false, error = "", syncing = false, usableUntil = 0;
  const usable = () => Boolean(manifest && Date.now() < usableUntil);
  async function publish(next: Manifest, contents: Map<string, CounterProduct[]>, active: () => void = () => {}) {
    const nextRows = new Map<string, { product: CounterProduct; observedAt: number }>(), nextFields = new Map<string, string[]>(), nextBarcodes = new Map<string, Set<string>>();
    for (const page of next.pages) for (const product of contents.get(page.hash)!) {
      if (nextRows.size > 0 && nextRows.size % PAGE_SIZE === 0) { await yieldPharmacyBackgroundWork(); active(); }
      if (nextRows.has(product.id)) invalid();
      nextRows.set(product.id, { product, observedAt: page.checkedAt });
      nextFields.set(product.id, [product.name, product.genericName, product.strength || "", product.manufacturer || ""].map(normalize));
      for (const barcode of product.barcodes || []) { const matches = nextBarcodes.get(barcode) || new Set(); matches.add(product.id); nextBarcodes.set(barcode, matches); }
    }
    if (nextRows.size !== next.count) invalid();
    active();
    usableUntil = Math.min(next.checkedAt, ...next.pages.map(page => page.storedAt)) + LIFETIME;
    manifest = next; rows = nextRows; fields = nextFields; barcodes = nextBarcodes; pages = contents;
  }
  return {
    async load() {
      try {
        const saved = await manifestStore.load(); durable = saved.durable;
        if (!saved.value || Date.now() - saved.value.checkedAt >= LIFETIME) return;
        const contents = new Map<string, CounterProduct[]>();
        for (const page of saved.value.pages) { const result = await pageStore(page.hash).load(); durable &&= result.durable; if (!result.value) invalid(); checkRows(result.value, page, saved.value.through); contents.set(page.hash, result.value); }
        await publish(saved.value, contents);
      } catch (failure) { error = failure instanceof Error ? failure.message : "Offline catalogue could not be opened."; }
    },
    async sync(fetchPage: (query: CataloguePageQuery, signal: AbortSignal) => Promise<CataloguePage>, signal: AbortSignal, onProgress: (count: number) => void = () => {}) {
      if (syncing) return;
      syncing = true; error = "";
      const active = () => { if (signal.aborted) throw new DOMException("Catalogue refresh cancelled", "AbortError"); };
      try {
        active(); const startedAt = Date.now(), descriptors: Descriptor[] = [], contents = new Map<string, CounterProduct[]>();
        const prior = new Map(manifest?.pages.map(page => [page.after, page]) || []);
        let after: string | null = null, through: string | null = null, count = 0, persistent = durable || !manifest;
        for (let n = 0; n < MAX_PAGES; n++) {
          active(); const old = prior.get(after), oldItems = old && pages.get(old.hash);
          const result = await fetchPage({ ...(after ? { after, through: through! } : {}), ...(oldItems ? { knownHash: old!.hash } : {}) }, signal); active();
          if (!result || result.version !== 1 || result.locationId !== locationId || result.after !== after || result.through !== null && !id(result.through) || n > 0 && result.through !== through) invalid();
          if (n === 0) through = result.through;
          const checkedAt = Date.now(), entry = descriptor({ ...result, checkedAt, storedAt: checkedAt });
          const items = result.items === null ? old && old.hash === result.hash && old.count === result.count && old.nextCursor === result.nextCursor && oldItems : cleanPage(result.items);
          if (!items) invalid(); checkRows(items, entry, through);
          // Reuse unchanged encrypted pages. Renew only near their existing storage expiry.
          if (oldItems && old!.hash === entry.hash && checkedAt - old!.storedAt < LIFETIME / 2) entry.storedAt = old!.storedAt;
          else { const store = pageStore(entry.hash); if (!oldItems || old!.hash !== entry.hash) await store.load(); active(); const saved = await store.save(items); persistent &&= saved.durable; active(); }
          contents.set(entry.hash, items); descriptors.push(entry); count += items.length; onProgress(count);
          if (entry.nextCursor === null) {
            const next = cleanManifest({ version: 1, locationId, through, startedAt, checkedAt, count, pages: descriptors }, locationId);
            active(); const saved = await manifestStore.save(next); active(); persistent &&= saved.durable;
            await publish(next, contents, active); durable = persistent; return;
          }
          after = entry.nextCursor;
        }
        throw Error(`Offline catalogue exceeds ${MAX_PAGES * PAGE_SIZE} products. Use online search; the previous complete catalogue is unchanged.`);
      } catch (failure) { if (!signal.aborted) error = failure instanceof Error ? failure.message : "Catalogue refresh failed."; throw failure; }
      finally { syncing = false; }
    },
    get(id: string) { return usable() ? rows.get(id) : undefined; },
    find(search: string, exact = false, limit = PAGE_SIZE * MAX_PAGES): CounterProduct[] {
      if (!usable()) return [];
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE * MAX_PAGES) throw new Error("Invalid local catalogue result limit.");
      const terms = [...new Set(normalize(search).split(" ").filter(Boolean))];
      if (!exact && terms.length > 8) return [];
      const result: CounterProduct[] = [];
      if (exact) {
        for (const id of barcodes.get(search.trim()) || []) { result.push(rows.get(id)!.product); if (result.length === limit) break; }
      } else {
        for (const [id, values] of fields) {
          if (!terms.every(term => values.some(value => value.includes(term)))) continue;
          result.push(rows.get(id)!.product); if (result.length === limit) break;
        }
      }
      return result;
    },
    get status(): CatalogueStatus { const complete = usable(); return { complete, count: complete ? manifest!.count : 0, checkedAt: complete ? manifest!.checkedAt : null, durable, error }; },
    get startedAt() { return usable() ? manifest!.startedAt : null; },
    get checkedAt() { return usable() ? manifest!.checkedAt : null; },
  };
}
