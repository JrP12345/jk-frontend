"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { createPharmacyLocalClient } from "@/lib/pharmacyDrafts";
import { commitStockCount, countCsvTemplate, importCountCsv, loadStockCount, previewStockCount, recoverStockCount, stockCountStorageKey, validateCountCommand, type CountCommand, type CountProduct, type StockCountInput, type StockCountPreview, type StockCountSnapshot } from "@/lib/pharmacyStockReconciliation";
import { parseReceiptPaise, type StockReceiptPayload } from "@/lib/pharmacyStockReceipts";
import styles from "./PharmacyWorkspace.module.css";

const message = (e: unknown) => (e as { response?: { data?: { message?: string } } }).response?.data?.message || (e instanceof Error ? e.message : "Keep the original count reference and check its result.");
export function PharmacyStockReconciliation({ locationId, organizationId, onClose, onCompleted }: { locationId: string; organizationId?: string; onClose: () => void; onCompleted: () => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = stockCountStorageKey(scope, locationId);
  const [journal] = useState(() => createPharmacyLocalClient(scope, locationId, "stock-count-intent", validateCountCommand));
  const [snapshot, setSnapshot] = useState<StockCountSnapshot | null>(null), [counts, setCounts] = useState<Record<string, string>>({}), [newLots, setNewLots] = useState<Record<string, StockReceiptPayload[]>>({});
  const [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false), [preview, setPreview] = useState<StockCountPreview | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [pending, setPending] = useState<string | null>(null), [retry, setRetry] = useState(false), [reload, setReload] = useState(0);
  const [search, setSearch] = useState(""), [page, setPage] = useState(0), [adding, setAdding] = useState<CountProduct | null>(null);
  const [rejected, setRejected] = useState(false);
  const frozen = useRef<CountCommand | null>(null), alive = useRef(true), lock = useRef(false), prepared = useRef<StockCountInput | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => {
    const controller = new AbortController(); alive.current = true;
    void (async () => {
      try {
        const restored = await journal.load();
        if (controller.signal.aborted) return;
        const key = sessionStorage.getItem(storageKey) || restored.value?.key;
        if (key) { frozen.current = restored.value?.key === key ? restored.value : null; setPending(key); setRetry(Boolean(frozen.current)); return; }
        const data = await loadStockCount(locationId, organizationId, controller.signal);
        if (!controller.signal.aborted) { setSnapshot(data); setCounts({}); setNewLots({}); setPreview(null); prepared.current = null; }
      } catch (e) { if (!controller.signal.aborted) setError(message(e)); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => { alive.current = false; controller.abort(); };
  }, [journal, storageKey, locationId, organizationId, reload]);
  function edited() { setPreview(null); prepared.current = null; setConfirmed(false); setError(""); }
  async function check() {
    if (lock.current || !snapshot || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const input: StockCountInput = { snapshotHash: snapshot.snapshotHash, reference: reference.trim(), counts: snapshot.products.map(p => ({ medicineId: p.id, lots: p.lots.map(lot => {
        const value = counts[lot.id];
        if (!/^\d+$/.test(value || "") || !Number.isSafeInteger(Number(value))) throw Error(`Enter the actual count for ${p.name}, batch ${lot.batchNumber}, including zero`);
        return { batchId: lot.id, quantity: Number(value) };
      }), newLots: newLots[p.id] || [] })) };
      const result = await previewStockCount(locationId, organizationId, input);
      if (current()) { prepared.current = input; setPreview(result); }
    } catch (e) { if (current()) setError(message(e)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function finish(key: string) {
    await journal.save(null);
    if (!current()) return;
    if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey);
    onCompleted();
  }
  async function save(recover = false) {
    if (lock.current || !current() || !recover && !frozen.current && (!preview || !prepared.current || !confirmed)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const key = pending || crypto.randomUUID();
      if (recover) { await recoverStockCount(locationId, organizationId, key); await finish(key); return; }
      const command = frozen.current || { key, input: { ...prepared.current!, previewHash: preview!.previewHash, confirmed: true as const } };
      sessionStorage.setItem(storageKey, key); setPending(key);
      await journal.save(command); frozen.current = command; setRetry(true);
      await commitStockCount(locationId, organizationId, command); await finish(key);
    } catch (e) { if (current()) { setError(message(e)); setRejected((e as { response?: { data?: { details?: { code?: string } } } }).response?.data?.details?.code === "COUNT_SNAPSHOT_CHANGED"); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  const filtered = snapshot?.products.filter(p => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) || [];
  const rows = filtered.slice(page * 20, page * 20 + 20);
  return <Modal open size="2xl" title="Reconcile physical stock" description="This branch stays paused while you count. Confirmation records adjustments and enables stock tracking together." busy={busy} onClose={onClose} footer={<>
    <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>Close count</Button>
    {!pending && !preview && <Button size="sm" loading={busy} disabled={busy || !snapshot || reference.trim().length < 3} onClick={() => { void check(); }}>Preview differences</Button>}
    {!pending && preview && <Button size="sm" aria-label="Confirm count & enable tracking" disabled={busy || !confirmed} onClick={() => { void save(); }}>Enable tracking</Button>}
  </>}>
    <div className="space-y-4">
      {error && <Alert variant="error" title="Check physical count">{error}</Alert>}
      {pending ? <Alert variant="warning" title="Check the saved count">
        <p>Reference: {pending}. Check its result before starting another count.</p>
        <div className={styles.actions}><Button size="sm" disabled={busy} onClick={() => { void save(true); }}>Check count result</Button>{retry && !rejected && <Button size="sm" disabled={busy} onClick={() => { void save(); }}>Retry same count</Button>}{rejected && <Button size="sm" disabled={busy} onClick={() => {
          void (async () => { try { await journal.save(null); if (!current()) return; sessionStorage.removeItem(storageKey); frozen.current = null; setPending(null); setRetry(false); setRejected(false); setSnapshot(null); setPreview(null); setError(""); setBusy(true); setReload(n => n + 1); } catch (failure) { if (current()) setError(message(failure)); } })();
        }}>Reload rejected count</Button>}</div>
      </Alert> : <>
        {!snapshot && !busy && <Button variant="outline" onClick={() => { setError(""); setBusy(true); setReload(n => n + 1); }}>Reload count</Button>}
        {busy && !snapshot && <p role="status">Loading branch stock...</p>}
        {snapshot && <>
          <Input label="Physical count reference *" maxLength={120} value={reference} disabled={busy} onChange={e => { edited(); setReference(e.target.value); }} />
          <p className="text-sm text-text-secondary">Count in base units. Enter zero explicitly for absent batches. Products without any batches remain at zero unless you add an actual counted batch. Expired and quarantined goods remain unsaleable.</p>
          <div className={styles.actions}><Button size="sm" variant="outline" disabled={busy} onClick={() => {
            const url = URL.createObjectURL(new Blob([countCsvTemplate(snapshot)], { type: "text/csv;charset=utf-8" })), a = document.createElement("a"); a.href = url; a.download = "physical-count.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Download count template</Button><Input label="Import completed count CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => {
            const file = e.target.files?.[0]; if (!file) return;
            void (async () => { try { if (file.size > 8 * 1024 * 1024) throw Error("Choose a count CSV smaller than 8 MB"); const imported = importCountCsv(await file.text(), snapshot); if (current()) { edited(); setCounts(imported); } } catch (failure) { if (current()) setError(message(failure)); } })();
          }} /></div>
          <Input label="Find product in physical count" value={search} disabled={busy} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          <fieldset disabled={busy} className="space-y-3">
            {rows.map(p => <section key={p.id} className="rounded-lg border border-border p-3 space-y-2" aria-label={`Count ${p.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{p.name}</strong><p className="text-xs text-text-secondary">{p.archived ? "Archived product · " : ""}{p.id} · Frozen balance: {p.quantity} {p.unit?.baseUnit}</p></div>{p.unit && !p.archived && <Button size="sm" variant="outline" onClick={() => setAdding(p)}>Add counted batch</Button>}</div>
              {p.lots.map(lot => <div key={lot.id} className="grid grid-cols-1 gap-2 sm:grid-cols-2"><p className="text-sm">{lot.batchNumber} · Exp {lot.expiry.value} · {lot.status}<br /><span className="text-xs text-text-secondary">{lot.id} · Previously {lot.quantity}</span></p><Input label={`Actual ${p.unit?.baseUnit || "units"}: ${p.name} / ${lot.batchNumber}`} type="number" min="0" step="1" value={counts[lot.id] || ""} onChange={e => { edited(); setCounts(previous => ({ ...previous, [lot.id]: e.target.value })); }} /></div>)}
              {!p.lots.length && <p className="text-sm">No recorded batches. Counted zero unless a batch is added below.</p>}
              {(newLots[p.id] || []).map(lot => <div key={lot.receiptLineId} className="flex items-center justify-between gap-2 text-sm"><span>New batch {lot.batchNumber} · Exp {lot.expiry.value} · {lot.packs * p.unit!.unitsPerPack + lot.looseUnits} {p.unit!.baseUnit}</span><Button size="sm" variant="ghost" onClick={() => { edited(); setNewLots(all => ({ ...all, [p.id]: all[p.id].filter(row => row.receiptLineId !== lot.receiptLineId) })); }}>Remove counted batch</Button></div>)}
            </section>)}
          </fieldset>
          <div className={styles.actions}><Button size="sm" variant="outline" disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>Previous products</Button><span className="text-sm">{filtered.length ? page * 20 + 1 : 0}–{Math.min((page + 1) * 20, filtered.length)} of {filtered.length}</span><Button size="sm" variant="outline" disabled={busy || (page + 1) * 20 >= filtered.length} onClick={() => setPage(n => n + 1)}>Next products</Button></div>
          {preview && <Alert variant="info" title="Count preview"><p>{preview.products} products checked · {preview.changedProducts} changed · {preview.newLots} new batches.</p><p>Frozen units: {preview.beforeUnits}. Counted units: {preview.countedUnits}. Difference: {preview.countedUnits - preview.beforeUnits}.</p></Alert>}
          {preview && <Checkbox label="I verified every product and batch, including zero counts, and confirm the physical count" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />}
        </>}
      </>}
    </div>
    {adding && <CountedBatch key={adding.id} product={adding} locationId={locationId} onClose={() => setAdding(null)} onAdd={lot => { edited(); setNewLots(all => ({ ...all, [adding.id]: [...(all[adding.id] || []), lot] })); setAdding(null); }} />}
  </Modal>;
}
function CountedBatch({ product, locationId, onClose, onAdd }: { product: CountProduct; locationId: string; onClose: () => void; onAdd: (value: StockReceiptPayload) => void }) {
  const [form, setForm] = useState({ batch: product.billingSupply?.batchNumber || "", precision: product.billingSupply?.expiry.precision || "month", expiry: product.billingSupply?.expiry.value || "", quantity: "", cost: "", price: (product.pricePaise / 100).toFixed(2), mrp: product.billingSupply ? (product.billingSupply.mrpPaise / 100).toFixed(2) : "" });
  const [error, setError] = useState("");
  const edit = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }));
  return <Modal open size="md" title="Add actual counted batch" description={product.name} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel batch</Button><Button type="submit" form="counted-batch">Add to physical count</Button></>}>
    <form id="counted-batch" className="space-y-3" onSubmit={e => {
      e.preventDefault();
      const quantity = Number(form.quantity), cost = parseReceiptPaise(form.cost), price = parseReceiptPaise(form.price), mrp = parseReceiptPaise(form.mrp);
      if (!form.batch.trim() || !form.expiry || !/^\d+$/.test(form.quantity) || !Number.isSafeInteger(quantity) || quantity < 1 || cost === null || price === null || mrp === null || price > mrp) { setError("Enter an actual batch, printed expiry, positive whole count, acquisition cost, selling price and MRP."); return; }
      onAdd({ medicineId: product.id, locationId, receiptLineId: crypto.randomUUID(), kind: "receipt", expectedUnitVersion: product.unit!.version, packs: Math.floor(quantity / product.unit!.unitsPerPack), looseUnits: quantity % product.unit!.unitsPerPack, batchNumber: form.batch.trim(), expiry: { precision: form.precision as "day" | "month", value: form.expiry }, purchaseTotalPaise: cost, sellingPricePaise: price, mrpPaise: mrp });
    }}>
      {error && <Alert variant="error" title="Check counted batch">{error}</Alert>}
      <Input label="Actual printed batch" maxLength={100} required value={form.batch} onChange={e => edit("batch", e.target.value)} />
      <Select label="Expiry precision" value={form.precision} options={[{ value: "month", label: "Month and year" }, { value: "day", label: "Exact day" }]} onChange={e => { edit("precision", e.target.value); edit("expiry", ""); }} />
      <DatePicker label="Actual printed expiry" mode={form.precision === "month" ? "month" : "date"} value={form.expiry} onChange={value => edit("expiry", value)} />
      <Input label={`Actual count (${product.unit!.baseUnit})`} required type="number" min="1" step="1" value={form.quantity} onChange={e => edit("quantity", e.target.value)} />
      <Input label="Total acquisition cost for this count (INR)" required inputMode="decimal" value={form.cost} onChange={e => edit("cost", e.target.value)} />
      <Input label="Selling price per base unit (INR)" required inputMode="decimal" value={form.price} onChange={e => edit("price", e.target.value)} />
      <Input label="MRP per base unit (INR)" required inputMode="decimal" value={form.mrp} onChange={e => edit("mrp", e.target.value)} />
      <p className="text-sm text-text-secondary">This adds an existing physical batch to the count. It does not create a supplier bill. Count expired goods separately; they will remain unsaleable.</p>
    </form>
  </Modal>;
}
