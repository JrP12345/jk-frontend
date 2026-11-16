"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, QuantityInput, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readShortbook, saveShortbook, shortbookError, type ShortbookEntry, type ShortbookDraftSeed } from "@/lib/pharmacyShortbook";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import styles from "./PharmacyWorkspace.module.css";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";

interface Props { locationId: string; canManage: boolean; initialProduct?: PurchaseProduct; onDraft: (seed: ShortbookDraftSeed) => void }
type Form = { product: PurchaseProduct; entry: ShortbookEntry | null; quantity: string; note: string; status: "open" | "resolved" };
export function PharmacyShortbook(props: Props) { const scope = authScopeKey(useAuthStore(state => state.user)); return <ShortbookSession key={`${scope}:${props.locationId}:${props.canManage}`} {...props} />; }
function ShortbookSession({ locationId, canManage, initialProduct, onDraft }: Props) {
  const [rows, setRows] = useState<ShortbookEntry[]>([]), [cursor, setCursor] = useState<string>(), [next, setNext] = useState<string | null>(null), [status, setStatus] = useState("open"), [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [lookupError, setLookupError] = useState(""), [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""), [products, setProducts] = useState<PurchaseProduct[]>([]), [form, setForm] = useState<Form | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [productKey, setProductKey] = useState("");
  const read = useLatestRead(), productRead = useLatestRead(), selectionRead = useLatestRead(), alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const readKey = `${locationId}:${status}:${cursor || ""}:${retry}`, loading = loadedKey !== readKey;
  useEffect(() => {
    const request = read();
    void readShortbook(locationId, { status, ...(cursor ? { cursor } : {}) }, request.signal).then(page => { if (request.isCurrent()) { setRows(page.items); setNext(page.nextCursor); setError(""); setSelected([]); setLoadedKey(readKey); } }).catch(failure => { if (request.isCurrent()) { setRows([]); setNext(null); setError(shortbookError(failure)); setLoadedKey(readKey); } });
  }, [locationId, status, cursor, readKey, read]);
  useEffect(() => {
    const request = productRead(); if (!canManage || !search.trim()) return;
    const timer = setTimeout(() => { void purchasePage<PurchaseProduct>("purchase-products", locationId, { search: search.trim() }, request.signal).then(page => { if (request.isCurrent()) { setProducts(page.items.filter(product => product.unitDefinition)); setProductKey(search.trim()); setLookupError(""); } }).catch(failure => { if (request.isCurrent()) setLookupError(shortbookError(failure)); }); }, 250);
    return () => clearTimeout(timer);
  }, [locationId, search, canManage, productRead]);
  const choose = useCallback(async (product: PurchaseProduct) => {
    if (lock.current || !canManage) return;
    const request = selectionRead(); setForm(null); setLookupError(""); setNotice("");
    try {
      const page = await readShortbook(locationId, { medicineId: product.id }, request.signal), entry = page.items[0] || null;
      if (entry && !entry.product?.unitDefinition) throw new Error("Product is unavailable. Resolve its original shortage or choose an active product.");
      const latest = entry?.product || product;
      if (request.isCurrent()) setForm({ product: latest, entry, quantity: entry ? entry.unitVersion === latest.unitDefinition.version ? String(entry.quantity) : "" : "1", note: entry?.note || "", status: "open" });
    } catch (failure) { if (request.isCurrent()) setLookupError(shortbookError(failure)); }
  }, [canManage, locationId, selectionRead]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active && initialProduct) void choose(initialProduct); }); return () => { active = false; }; }, [initialProduct, choose]);
  async function save() {
    if (!form || !canManage || lock.current) return;
    const quantity = /^\d+$/.test(form.quantity) ? Number(form.quantity) : NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) { setLookupError("Enter 1 to 1,000,000 whole base units."); return; }
    // Invalidate replaceable selection reads before dispatch, but never cancel/replay the write.
    selectionRead(); lock.current = true; setBusy(true); setLookupError(""); setNotice("");
    try {
      await saveShortbook(locationId, form.product.id, { quantity, note: form.note.trim(), status: form.status, expectedRevision: form.entry?.revision || 0, expectedUnitVersion: form.product.unitDefinition.version });
      if (alive.current) { setForm(null); setRetry(value => value + 1); setNotice("Shortbook saved. Stock and supplier balances are unchanged."); }
    } catch (failure) { if (alive.current) setLookupError(shortbookError(failure)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function resolve(row: ShortbookEntry) {
    if (!canManage || lock.current) return;
    lock.current = true; setBusy(true); setLookupError("");
    try { await saveShortbook(locationId, row.medicineId, { quantity: row.quantity, expectedRevision: row.revision, expectedUnitVersion: row.unitVersion, note: row.note, status: "resolved" }); if (alive.current) { setForm(null); setRetry(value => value + 1); } }
    catch (failure) { if (alive.current) setLookupError(shortbookError(failure)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const visibleRows = loading ? [] : rows;
  const ready = visibleRows.filter(row => selected.includes(row.id) && row.status === "open" && row.product?.unitDefinition?.version === row.unitVersion);
  return <section className={styles.list} aria-label="Pharmacy shortbook">
    <header><h3>Shortbook</h3><p>Record products to replenish in base units. Copy quantities into a supplier invoice draft when the invoice arrives; review its prices, tax and receiving as usual.</p></header>
    <div className={styles.actions}><Select label="Shortbook status" value={status} onChange={event => { setStatus(event.target.value); setCursor(undefined); }} options={[{ value: "open", label: "Open shortages" }, { value: "resolved", label: "Resolved shortages" }]} /><Button size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>Refresh shortbook</Button></div>
    {!loading && error && <Alert variant="error" title="Shortbook unavailable">{error}</Alert>}{notice && <p role="status">{notice}</p>}{loading && <p role="status">Loading shortbook...</p>}
    {canManage && <div className={styles.rx}><Input label="Find product for shortbook" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />{(search.trim() && productKey === search.trim() ? products : []).map(product => <Button key={product.id} variant="outline" size="sm" disabled={busy} onClick={() => { void choose(product); }}>Choose {product.name}</Button>)}</div>}
    {lookupError && <Alert variant="error" title="Shortbook entry needs attention">{lookupError}{form && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void choose(form.product); }}>Reload current shortbook entry</Button>}</Alert>}
    {form && canManage && <fieldset className={styles.rx} disabled={busy}><h4>{form.product.name}</h4>{form.entry && form.entry.unitVersion !== form.product.unitDefinition.version && <p>Units changed. Re-enter the quantity in the current base unit.</p>}<QuantityInput label={`Shortbook quantity (${form.product.unitDefinition.baseUnit})`} value={form.quantity} min={1} max={1_000_000} onValueChange={quantity => setForm({ ...form, quantity })} /><Input label="Shortbook note" value={form.note} maxLength={300} onChange={event => setForm({ ...form, note: event.target.value })} /><Select label="Entry status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Form["status"] })} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved after review" }]} /><div className={styles.actions}><Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel entry</Button><Button size="sm" loading={busy} onClick={() => { void save(); }}>Save shortbook entry</Button></div></fieldset>}
    {visibleRows.map(row => { const usable = Boolean(row.product?.unitDefinition && row.product.unitDefinition.version === row.unitVersion); return <article className={styles.card} key={row.id}><div className={styles.cardTop}><div><strong>{row.product?.name || "Unavailable product"}</strong><p>Requested {row.quantity} {usable ? row.product!.unitDefinition.baseUnit : "base units — product or units need review"}{row.product?.rackLocation ? ` · Rack ${row.product.rackLocation}` : ""}</p>{row.note && <p>{row.note}</p>}</div>{canManage && row.status === "open" && usable && <Checkbox label={`Include ${row.product!.name} in purchase draft`} checked={selected.includes(row.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id))} />}</div>{canManage && row.product?.unitDefinition && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void choose(row.product!); }}>Edit shortbook {row.product.name}</Button>}{canManage && row.status === "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void resolve(row); }}>Resolve shortage {row.product?.name || row.medicineId}</Button>}</article>; })}
    {!loading && !error && !rows.length && <p>No {status} entries on this shortbook page.</p>}
    {canManage && <><Button size="sm" disabled={busy || loading || !ready.length} onClick={() => onDraft({ lines: ready.map(row => ({ product: row.product!, quantity: row.quantity })), notes: `Shortbook ${ready.map(row => row.id).join(", ")}` })}>Copy selected to purchase draft</Button><p className={styles.meta}>Copying keeps entries open. Resolve shortages after checking stock received. No supplier order, stock or financial entry is created here.</p></>}
    <div className={styles.actions}>{cursor && <Button size="sm" variant="outline" onClick={() => setCursor(undefined)}>First shortbook page</Button>}{!loading && next && <Button size="sm" variant="outline" onClick={() => setCursor(next)}>Next shortbook page</Button>}</div>
  </section>;
}
