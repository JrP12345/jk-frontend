import { validatePharmacyUnits } from "./pharmacyUnits";
import type { CounterIntent, CounterProduct, CounterQuote } from "./pharmacyCounter";
import { createPharmacyLocalClient } from "./pharmacyDrafts";

export type PriceSnapshot = { observedAt: number; unitVersion: number; quantity: number; grossPaise: number; gstRateBps?: number; batches: CounterQuote["lines"][number]["batches"] };
type CachedProduct = { product: CounterProduct; observedAt: number; uses?: number; price?: PriceSnapshot };
type Query = { key: string; ids: string[]; nextCursor: string | null; at: number };
type Snapshot = { products: CachedProduct[]; queries: Query[] };
type BranchSource = { get(id: string): { product: CounterProduct; observedAt: number } | undefined; find(search: string, exact?: boolean, limit?: number): CounterProduct[]; readonly startedAt: number | null; readonly checkedAt: number | null };
const MAX_PRODUCTS = 250, FRESH = 60_000, EXPIRES = 12 * 60 * 60 * 1000;
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
const safe = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const amount = (value: string) => { if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null; const [whole, fraction = ""] = value.trim().split("."); const n = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); return n <= BigInt(100_000_000_000) ? n : null; };
export function cleanCatalogueProduct(p: CounterProduct): CounterProduct {
  if (!p || !p.id || typeof p.name !== "string" || typeof p.genericName !== "string" || !safe(p.stockQuantity) || typeof p.eligible !== "boolean") throw Error("Saved catalogue needs review");
  const unit = p.unitDefinition;
  if (unit && (!safe(unit.version) || unit.version < 1 || !safe(unit.unitsPerPack) || unit.unitsPerPack < 1 || typeof unit.baseUnit !== "string" || typeof unit.packUnit !== "string")) throw Error("Saved catalogue units need review");
  return { id: p.id, name: p.name, genericName: p.genericName, stockQuantity: p.stockQuantity, eligible: p.eligible && p.saleBlocked !== true,
    ...(p.saleBlocked === true ? { saleBlocked: true, saleBlockReason: typeof p.saleBlockReason === "string" ? p.saleBlockReason.slice(0, 500) : "Sale hold" } : {}),
    ...(typeof p.strength === "string" ? { strength: p.strength } : {}), ...(typeof p.manufacturer === "string" ? { manufacturer: p.manufacturer } : {}),
    ...(typeof p.rackLocation === "string" && p.rackLocation.length <= 60 ? { rackLocation: p.rackLocation } : {}),
    ...(safe(p.retailPricePaise) ? { retailPricePaise: p.retailPricePaise } : {}),
    barcodes: (p.barcodes || []).filter(code => typeof code === "string" && code.length > 0 && code.length <= 100).slice(0, 20),
    ...(unit ? { unitDefinition: validatePharmacyUnits(unit) } : {}) };
}
function cleanSnapshot(input: unknown): Snapshot {
  const data = input as Snapshot;
  if (!data || !Array.isArray(data.products) || data.products.length > MAX_PRODUCTS || !Array.isArray(data.queries) || data.queries.length > 50) throw Error("Saved catalogue needs review");
  return { products: data.products.map(row => {
    if (!safe(row.observedAt) || row.uses !== undefined && !safe(row.uses)) throw Error("Saved catalogue timestamp needs review");
    const p = row.price;
    if (p && (![p.observedAt, p.unitVersion, p.quantity, p.grossPaise].every(safe) || p.quantity < 1 || !Array.isArray(p.batches) || p.batches.length > 100 || p.batches.some(b => !safe(b.quantity) || !safe(b.sellingPricePaise) || !safe(b.mrpPaise) || typeof b.expiryValue !== "string"))) throw Error("Saved price snapshot needs review");
    return { product: cleanCatalogueProduct(row.product), observedAt: row.observedAt, ...(row.uses !== undefined ? { uses: row.uses } : {}), ...(p ? { price: { observedAt: p.observedAt, unitVersion: p.unitVersion, quantity: p.quantity, grossPaise: p.grossPaise, ...(safe(p.gstRateBps) ? { gstRateBps: p.gstRateBps } : {}), batches: p.batches.map(b => ({ batchNumber: b.batchNumber, quantity: b.quantity, expiryValue: b.expiryValue, sellingPricePaise: b.sellingPricePaise, mrpPaise: b.mrpPaise })) } } : {}) };
  }), queries: data.queries.map(q => { if (typeof q.key !== "string" || !Array.isArray(q.ids) || q.ids.length > 25 || q.ids.some(id => typeof id !== "string") || !safe(q.at) || q.nextCursor !== null && typeof q.nextCursor !== "string") throw Error("Saved catalogue query needs review"); return { key: q.key, ids: q.ids, nextCursor: q.nextCursor, at: q.at }; }) };
}

/** Bounded encrypted working set, never a guarantee of stock, dispensing authority or a final price. */
export function createPharmacyCatalogue(scope: string, locationId: string, inventoryMode: "tracked" | "billing_only" = "tracked") {
  const store = createPharmacyLocalClient(scope, locationId, inventoryMode === "tracked" ? "catalogue" : "catalogue-billing-only", cleanSnapshot);
  let rows = new Map<string, CachedProduct>(), queries: Query[] = [], searchFields = new Map<string, string[]>(), barcodes = new Map<string, Set<string>>();
  let saveTask: Promise<unknown> = Promise.resolve(), durable = true;
  let branch: BranchSource | undefined;
  function resolve(id: string): CachedProduct | undefined {
    const local = rows.get(id), full = branch?.get(id), boundary = branch?.startedAt;
    if (full && (!local || full.observedAt > local.observedAt)) return { ...local, ...full, ...(local?.price && local.price.unitVersion === full.product.unitDefinition?.version ? { price: local.price } : { price: undefined }) };
    if (!full && boundary !== null && boundary !== undefined && local && local.observedAt <= boundary) return undefined;
    return local && Date.now() - local.observedAt < EXPIRES ? local : full;
  }
  const matches = (product: CounterProduct, terms: string[]) => terms.length <= 8 && terms.every(term => [product.name, product.genericName, product.strength || "", product.manufacturer || ""].some(field => normalize(field).includes(term)));
  function index() {
    searchFields = new Map(); barcodes = new Map();
    const add = (map: Map<string, Set<string>>, key: string, id: string) => { const ids = map.get(key) || new Set<string>(); ids.add(id); map.set(key, ids); };
    for (const { product: p, observedAt } of rows.values()) {
      if (Date.now() - observedAt >= EXPIRES) continue;
      searchFields.set(p.id, [p.name, p.genericName, p.strength || "", p.manufacturer || ""].map(normalize));
      for (const code of p.barcodes || []) add(barcodes, code, p.id);
    }
  }
  function persist() {
    const snapshot = { products: [...rows.values()], queries };
    saveTask = saveTask.then(() => store.save(snapshot)).then(result => { durable = result.durable; }).catch(() => { durable = false; });
    return saveTask;
  }
  return {
    attachBranch(source: BranchSource) { branch = source; },
    load: async () => { try { const saved = await store.load(); durable = saved.durable; if (saved.value) { rows = new Map(saved.value.products.filter(row => Date.now() - row.observedAt < EXPIRES).map(row => [row.product.id, row])); queries = saved.value.queries; index(); } } catch { durable = false; } },
    find(search: string, exact = false) {
      const key = `${exact ? "barcode" : "name"}:${exact ? search.trim() : normalize(search)}`, q = queries.find(query => query.key === key);
      const terms = [...new Set(normalize(search).split(" ").filter(Boolean))];
      const ids = exact ? barcodes.get(search.trim()) : new Set([...searchFields].filter(([, fields]) => terms.length <= 8 && terms.every(term => fields.some(field => field.includes(term)))).map(([id]) => id));
      // A newer working set can invalidate at most MAX_PRODUCTS branch hits.
      // Retain that headroom before returning 25, without allocating every match.
      const candidates = new Set([...(ids || []), ...(branch?.find(search, exact, MAX_PRODUCTS + 25).map(product => product.id) || [])]);
      const resolved = [...candidates].map(id => resolve(id)?.product).filter((p): p is CounterProduct => Boolean(p) && (exact ? Boolean(p!.barcodes?.includes(search.trim())) : matches(p!, terms)));
      const validQuery = (query: Query) => query.at >= (branch?.checkedAt || 0) && Date.now() - query.at < FRESH && query.ids.every(id => { const row = resolve(id); return row && row.observedAt <= query.at; });
      const queryFresh = Boolean(q && validQuery(q) && q.ids.every(id => exact ? resolve(id)!.product.barcodes?.includes(search.trim()) : matches(resolve(id)!.product, terms)));
      const products = q && queryFresh ? q.ids.map(id => resolve(id)!.product) : resolved.slice(0, 25);
      const completePrefix = !exact && queries.some(query => query.key.startsWith("name:") && key.startsWith(query.key) && !query.nextCursor && validQuery(query));
      return { items: products, nextCursor: queryFresh ? q?.nextCursor || null : null, fresh: completePrefix || queryFresh };
    },
    remember(items: CounterProduct[], search: string, exact: boolean, nextCursor: string | null, cursor?: string) {
      for (const item of items) { const product = cleanCatalogueProduct(item), previous = rows.get(product.id); if (exact) product.barcodes = [...new Set([...(product.barcodes || []), search.trim()])]; rows.delete(product.id); rows.set(product.id, { product, observedAt: Date.now(), ...(previous?.uses ? { uses: previous.uses } : {}), ...(previous?.price && previous.product.unitDefinition?.version === product.unitDefinition?.version ? { price: previous.price } : {}) }); }
      while (rows.size > MAX_PRODUCTS) rows.delete(rows.keys().next().value!);
      const key = `${exact ? "barcode" : "name"}:${exact ? search.trim() : normalize(search)}`;
      // Only the first page describes a query's completeness. A final later page does not.
      if (!cursor) queries = [...queries.filter(q => q.key !== key), { key, ids: items.map(p => p.id), nextCursor, at: Date.now() }].slice(-50);
      index(); void persist();
    },
    rememberQuote(quote: CounterQuote) {
      for (const line of quote.lines) {
        const row = rows.get(line.medicineId), total = quote.calculation.lines.find(l => l.lineId === line.lineId);
        if (!row || !total || !row.product.unitDefinition || line.batches.length > 100) continue;
        const gross = line.batches.reduce((sum, lot) => sum + lot.quantity * lot.sellingPricePaise, 0);
        // Keep only anonymous stock/price evidence; never cache quote hashes, customer details or issue assertions.
        row.price = { observedAt: Date.now(), unitVersion: row.product.unitDefinition.version, quantity: line.quantity, grossPaise: gross, ...(safe(total.gstRateBps) ? { gstRateBps: total.gstRateBps } : {}), batches: line.batches };
      }
      void persist();
    },
    estimate(intent: CounterIntent) {
      const totals: Array<{ lineId: string; grossPaise: number; unitPaise: number }> = []; let subtotal = BigInt(0);
      for (const line of intent.lines) {
        const row = resolve(line.medicineId), price = row?.price;
        if (!row?.product.eligible || row.product.unitDefinition?.version !== line.expectedUnitVersion) return null;
        const cached = price && Date.now() - price.observedAt < EXPIRES && price.unitVersion === line.expectedUnitVersion ? price : null;
        const retail = row.product.retailPricePaise;
        if (!cached && !safe(retail)) return null;
        const unit = cached ? cached.grossPaise / cached.quantity : retail!;
        const basis = BigInt(cached?.grossPaise ?? retail!) * BigInt(line.quantity), denominator = BigInt(cached?.quantity ?? 1);
        const gross = (basis * BigInt(2) + denominator) / (denominator * BigInt(2)) - BigInt(line.discountPaise);
        if (gross < BigInt(0) || gross > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        subtotal += gross; totals.push({ lineId: line.lineId, grossPaise: Number(gross), unitPaise: unit });
      }
      const total = subtotal - BigInt(intent.invoiceDiscountPaise);
      return total >= BigInt(0) && total <= BigInt(Number.MAX_SAFE_INTEGER) ? { totalPaise: Number(total), lines: totals } : null;
    },
    frequency: (id: string) => rows.get(id)?.uses || 0,
    frequent: () => [...rows.values()].filter(row => (row.uses || 0) > 0 && resolve(row.product.id))
      .sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 25).map(row => resolve(row.product.id)!.product),
    recordUse(id: string) { const row = resolve(id); if (row) { rows.delete(id); rows.set(id, { ...row, uses: Math.min((row.uses || 0) + 1, Number.MAX_SAFE_INTEGER) }); while (rows.size > MAX_PRODUCTS) rows.delete(rows.keys().next().value!); index(); void persist(); } },
    recordSale(lines: Array<{ medicineId: string; quantity: number }>) {
      if (inventoryMode === "billing_only") return;
      for (const line of lines) { const row = rows.get(line.medicineId); if (row && Number.isSafeInteger(line.quantity) && line.quantity > 0) { row.product = { ...row.product, stockQuantity: Math.max(0, row.product.stockQuantity - line.quantity) }; row.observedAt = Date.now(); } }
      queries = queries.map(query => ({ ...query, at: 0 })); index(); void persist();
    },
    price: (id: string) => resolve(id)?.price,
    get durable() { return durable; }, flush: () => saveTask,
  };
}

type EditableLine = { lineId: string; product: CounterProduct; packs: string; loose: string; discount: string };
export function draftIntent(lines: EditableLine[], discount: string, locationId: string, customerId?: string): CounterIntent | null {
  try {
    const invoiceDiscount = amount(discount); if (invoiceDiscount === null || !lines.length) return null;
    return { locationId, ...(customerId ? { customerId } : {}), invoiceDiscountPaise: Number(invoiceDiscount), roundOffPaise: 0, lines: lines.map(l => {
      if (!/^\d+$/.test(l.packs) || !/^\d+$/.test(l.loose) || !l.product.unitDefinition) throw Error("Invalid quantity");
      const quantity = BigInt(l.packs) * BigInt(l.product.unitDefinition.unitsPerPack) + BigInt(l.loose), discount = amount(l.discount);
      if (quantity < BigInt(1) || quantity > BigInt(Number.MAX_SAFE_INTEGER) || discount === null) throw Error("Invalid quantity");
      return { lineId: l.lineId, medicineId: l.product.id, quantity: Number(quantity), expectedUnitVersion: l.product.unitDefinition.version, discountPaise: Number(discount) };
    }) };
  } catch { return null; }
}
export function estimateDraft(catalogue: ReturnType<typeof createPharmacyCatalogue>, lines: EditableLine[], discount: string, locationId: string) {
  const input = draftIntent(lines, discount, locationId);
  return input ? catalogue.estimate(input) : null;
}
