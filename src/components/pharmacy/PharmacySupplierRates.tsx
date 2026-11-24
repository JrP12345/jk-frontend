"use client";
import { useState } from "react";
import { Alert, Button, Input, DatePicker } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { dailyDate } from "@/lib/pharmacyDailyOverview";
import { readSupplierRates, unitRate, type SupplierRates } from "@/lib/pharmacySupplierRates";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { orderError } from "@/lib/pharmacyPurchaseOrders";
import styles from "./PharmacyWorkspace.module.css";
export function PharmacySupplierRates(props: { locationId: string; onInvoice: (id: string) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <RatesSession key={`${scope}:${props.locationId}`} {...props} />;
}
function RatesSession({ locationId, onInvoice }: { locationId: string; onInvoice: (id: string) => void }) {
  const [search, setSearch] = useState(""), [products, setProducts] = useState<PurchaseProduct[]>([]), [selected, setSelected] = useState<PurchaseProduct | null>(null);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [data, setData] = useState<SupplierRates | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [searched, setSearched] = useState(false);
  const begin = useLatestRead();
  function change(action: () => void) { begin(); setData(null); setBusy(false); setError(""); action(); }
  async function find() {
    const request = begin(); setBusy(true); setError(""); setProducts([]); setSelected(null); setData(null); setSearched(false);
    try { const page = await purchasePage<PurchaseProduct>("purchase-products", locationId, { search }, request.signal); if (request.isCurrent()) { setProducts(page.items); setSearched(true); } }
    catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function compare() {
    if (!selected) return;
    if (start && !dailyDate(start) || end && !dailyDate(end) || start && end && start > end) { setError("Choose a valid purchase-date range."); return; }
    const request = begin(); setBusy(true); setError(""); setData(null);
    try { const result = await readSupplierRates(locationId, selected.id, start, end, request.signal); if (request.isCurrent()) setData(result); }
    catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  return <section className={styles.list} aria-label="Supplier purchase-rate comparison"><h2>Compare supplier rates</h2>
    <p>Compare each supplier’s latest posted invoice in the selected period. Historical prices do not confirm a current offer or stock availability.</p>
    <form className={styles.actions} onSubmit={event => { event.preventDefault(); void find(); }}><Input label="Find medicine for rate comparison" value={search} maxLength={100} onChange={event => change(() => { setSearch(event.target.value); setProducts([]); setSelected(null); setSearched(false); })} /><Button type="submit" size="sm" disabled={busy}>Find medicine</Button></form>
    {searched && !products.length && <p>No matching products. Try a more specific medicine name.</p>}
    {!selected && products.map(product => <article className={styles.card} key={product.id}><span>{product.name} {product.strength}</span><Button size="sm" variant="outline" onClick={() => change(() => setSelected(product))}>Compare {product.name}</Button></article>)}
    {selected && <><strong>Selected: {selected.name}</strong><div className={styles.fieldGrid}><DatePicker label="Purchase rate start date" value={start} onChange={value => change(() => setStart(value))} /><DatePicker label="Purchase rate end date" value={end} onChange={value => change(() => setEnd(value))} /></div><p>Leave dates empty for the last year. Up to 366 calendar days can be compared.</p><Button size="sm" disabled={busy} onClick={() => { void compare(); }}>Load supplier comparison</Button></>}
    {busy && <p role="status">Reading purchase history…</p>}{error && <Alert variant="error" title="Comparison unavailable">{error}</Alert>}
    {data && <section aria-label="Reviewed supplier rates"><p>{data.startDate} to {data.endDate} · Read {new Date(data.asOf).toLocaleString()} · Ranked by net cost excluding GST</p><p>{data.note}</p>
      {!data.items.length && <p>No posted purchases for this medicine in this period.</p>}
      {data.items.map(item => <article key={item.supplierId} className={styles.card}><div className={styles.identity}><strong>{item.supplierName}</strong><small>Invoice {item.invoiceNumber} · {item.invoiceDate}</small>
        {item.state === "comparable" ? <><span>Net {unitRate(item.netPaise, item.billedUnits + item.freeUnits)} / {item.baseUnit}</span><span>Including GST {unitRate(item.grossPaise, item.billedUnits + item.freeUnits)} / {item.baseUnit}</span></> : <strong>Unit review required — excluded from ranking</strong>}
        <small>{item.billedUnits} billed + {item.freeUnits} free · {item.receivedUnits} received base units</small><small>Recorded inventory cost {item.costTreatment === "include_tax" ? "includes" : "excludes"} GST</small><small>{item.note}</small></div><Button size="sm" variant="outline" onClick={() => onInvoice(item.purchaseId)}>Open source invoice {item.invoiceNumber}</Button></article>)}
    </section>}
  </section>;
}
