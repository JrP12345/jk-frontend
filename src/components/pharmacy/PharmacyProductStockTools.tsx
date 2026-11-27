"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Select, Spinner } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { createPharmacyLocalClient } from "@/lib/pharmacyDrafts";
import { useLatestRead } from "@/hooks/useLatestRead";
import { dateLabel, money } from "./pharmacyWorkspace";
import type { BatchStickerSeed } from "./PharmacyBarcodeStickersModal";

type Lot = { id: string; batchNumber: string; quantity: number; status: string; expiryDate: string; printedExpiry?: string; sellingPrice: number; mrp?: number; purchaseCost?: number; saleBlocked: boolean };
type StockState = { medicineId: string; locationId: string; name: string; stockQuantity: number; stockRevision: number; unitDefinition: { baseUnit: string } | null;
  totals: { saleable: number; quarantined: number; expired: number; held: number } | null; review: string; batches: Lot[]; nextCursor: string | null };
type CountCommand = { key: string; input: { medicineId: string; batchId?: string; expectedRevision: number; expectedQuantity: number; newQuantity: number; clientRequestId: string; reason: string; notes: string } };
type Movement = { _id: string; revision: number; kind: string; reason: string; beforeQuantity: number; afterQuantity: number; createdAt: string };
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e instanceof Error ? e.message : "Stock operation could not be confirmed. Keep the same reference.");

export function PharmacyProductStockTools({ medicineId, locationId, canAdjust, canReadMovements, onClose, onChanged, onPrintStickers }: {
  medicineId: string; locationId: string; canAdjust: boolean; canReadMovements: boolean; onClose: () => void; onChanged: () => void; onPrintStickers?: (seed: BatchStickerSeed) => void;
}) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-product-count:${scope}:${locationId}:${medicineId}`;
  const [journal] = useState(() => createPharmacyLocalClient<CountCommand | null>(scope, locationId, `product-count-${medicineId}`, raw => {
    if (raw === null) return null;
    const command = raw as CountCommand;
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(command?.key || "") || command.input?.medicineId !== medicineId || command.input.clientRequestId !== command.key ||
      ![command.input.expectedRevision, command.input.expectedQuantity, command.input.newQuantity].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error("Saved physical count needs review");
    return command;
  }));
  const [data, setData] = useState<StockState | null>(null), [cursor, setCursor] = useState<string>(), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [selected, setSelected] = useState(""), [quantity, setQuantity] = useState(""), [reason, setReason] = useState("physical_audit"), [notes, setNotes] = useState("");
  const [canRetry, setCanRetry] = useState(false), [staleCount, setStaleCount] = useState(false);
  const [pending, setPending] = useState<string | null>(null), [result, setResult] = useState<Movement | null>(null), [ready, setReady] = useState(false), [durable, setDurable] = useState(false);
  const [history, setHistory] = useState<Movement[]>([]), [nextRevision, setNextRevision] = useState<number | null>(null), [historyError, setHistoryError] = useState("");
  const alive = useRef(true), lock = useRef(false), command = useRef<CountCommand | null>(null), begin = useLatestRead(), historyRead = useLatestRead();
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);
  useEffect(() => { alive.current = true; void journal.load().then(saved => { if (!current()) return; command.current = saved.value; setCanRetry(Boolean(saved.value)); setDurable(saved.durable); setPending(sessionStorage.getItem(storageKey) || saved.value?.key || null); setReady(true); }).catch(e => { if (current()) setError(errorMessage(e)); }); return () => { alive.current = false; }; }, [journal, storageKey, current]);
  const load = useCallback(async () => {
    const request = begin(); setLoading(true); setError("");
    try { const response = await api.get(`/pharmacy/medicines/${medicineId}/stock-state`, { params: { locationId, ...(cursor ? { cursor } : {}) }, signal: request.signal });
      const value = response.data?.data as StockState;
      if (value?.medicineId !== medicineId || value.locationId !== locationId || !Array.isArray(value.batches) || value.batches.length > 25 || !Number.isSafeInteger(value.stockRevision)) throw Error("Stock snapshot needs review");
      if (request.isCurrent() && current()) { setData(value); setSelected(""); setQuantity(""); }
    } catch (e) { if (request.isCurrent() && current()) { setData(null); setError(errorMessage(e)); } } finally { if (request.isCurrent() && current()) setLoading(false); }
  }, [begin, current, cursor, locationId, medicineId]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  async function movements(beforeRevision?: number) {
    const request = historyRead(); setHistoryError("");
    try { const response = await api.get(`/pharmacy/medicines/${medicineId}/stock-movements`, { params: { locationId, limit: 25, ...(beforeRevision !== undefined ? { beforeRevision } : {}) }, signal: request.signal });
      if (request.isCurrent() && current()) { setHistory(response.data.data.movements); setNextRevision(response.data.data.nextBeforeRevision); }
    } catch (e) { if (request.isCurrent() && current()) setHistoryError(errorMessage(e)); }
  }
  async function recover() {
    if (!pending || lock.current || !current()) return; lock.current = true; setBusy(true); setError("");
    try { const response = await api.get(`/pharmacy/medicines/${medicineId}/stock-adjustments/${pending}`, { params: { locationId } }); if (current()) setResult(response.data.data.movement); }
    catch (e) { if (current()) setError(errorMessage(e)); } finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function count(event: React.FormEvent) {
    event.preventDefault(); if (!current() || lock.current || !canAdjust || !data || !ready || !durable || result) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (pending && !command.current) throw Error("Recover the original count before submitting another adjustment.");
      const batch = data.batches.find(lot => lot.id === selected);
      if (!command.current) {
        if (data.batches.length && !batch || !/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity)) || notes.trim().length < 3) throw Error("Select the exact batch, count its base units and record a count/disposal reference.");
        const key = crypto.randomUUID(); command.current = { key, input: { medicineId, ...(batch ? { batchId: batch.id } : {}), expectedRevision: data.stockRevision, expectedQuantity: batch?.quantity ?? data.stockQuantity,
          newQuantity: Number(quantity), clientRequestId: key, reason, notes: notes.trim() } };
        const saved = await journal.save(command.current);
        if (!saved.durable) { setDurable(false); throw Error("The physical count was not sent. Durable recovery storage is unavailable; restore browser storage first."); }
        setPending(key); setCanRetry(true); sessionStorage.setItem(storageKey, key);
      }
      const response = await api.post("/pharmacy/adjust-stock", command.current.input, { headers: { "Idempotency-Key": command.current.key } });
      if (current()) { setResult(response.data.data.movement); onChanged(); }
    } catch (e) { if (current()) { setError(errorMessage(e)); setStaleCount((e as { response?: { data?: { details?: { code?: string } } } })?.response?.data?.details?.code === "STOCK_COUNT_STALE"); } } finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recount() {
    if (!staleCount || busy || !current()) return;
    try { const saved = await journal.save(null); if (!saved.durable) throw Error("Restore durable storage before clearing the rejected count."); sessionStorage.removeItem(storageKey); command.current = null; setPending(null); setCanRetry(false); setStaleCount(false); setNotes(""); await load(); }
    catch (e) { if (current()) setError(errorMessage(e)); }
  }
  async function acknowledge() {
    if (!result || busy) return;
    try { await journal.save(null); sessionStorage.removeItem(storageKey); command.current = null; setPending(null); setCanRetry(false); setResult(null); setNotes(""); onChanged(); void load(); }
    catch (e) { setError(errorMessage(e)); }
  }
  return <Modal open title="Batches, stock and movement history" description={data?.name} onClose={onClose} busy={busy} size="lg"><div className="space-y-4">
    {error && <Alert variant="error" title="Stock needs attention">{error}</Alert>}
    {loading && <div role="status" className="flex items-center gap-2 py-2 text-xs text-text-secondary"><Spinner size="sm" /><span>Loading current stock…</span></div>}
    {pending && <Alert variant={result ? "success" : "warning"} title={result ? "Stock adjustment confirmed" : "Check original physical count"}><p className="break-all">Reference {pending}</p>{result ? <><p>Revision {result.revision}: {result.beforeQuantity} → {result.afterQuantity}</p><Button size="sm" disabled={busy} onClick={() => { void acknowledge(); }}>Done with this count</Button></> : <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !canReadMovements} onClick={() => { void recover(); }}>Check count result</Button>{staleCount && <Button size="sm" disabled={busy} onClick={() => { void recount(); }}>Reload stock and recount rejected adjustment</Button>}{canRetry && canAdjust && !staleCount && <Button size="sm" disabled={busy} onClick={() => { void count({ preventDefault() {} } as React.FormEvent); }}>Retry same count</Button>}</div>}</Alert>}
    {data && <><p>Physical stock: <strong>{data.stockQuantity} {data.unitDefinition?.baseUnit || "units"}</strong>{data.totals && <> · Saleable {data.totals.saleable} · Quarantined {data.totals.quarantined} · Expired {data.totals.expired} · Held {data.totals.held}</>}</p>
      {data.review && <Alert variant="warning" title="Reconciliation required">{data.review}</Alert>}
      <div className="space-y-2">{data.batches.map(lot => <article className="rounded-lg border border-border p-3" key={lot.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{lot.batchNumber}</strong><div className="flex items-center gap-2"><span>{lot.quantity} {data.unitDefinition?.baseUnit} · {lot.status}{lot.saleBlocked ? " · Sale hold" : ""}</span>{onPrintStickers && <Button size="xs" variant="outline" onClick={() => onPrintStickers({ medicineId: data.medicineId, batchNumber: lot.batchNumber, expiry: lot.printedExpiry || lot.expiryDate.slice(0, 7), sellingPricePaise: Math.round(lot.sellingPrice * 100), mrpPaise: lot.mrp !== undefined ? Math.round(lot.mrp * 100) : undefined, copies: Math.max(1, Math.min(lot.quantity || 1, 25)) })}>Print stickers</Button>}</div></div><p className="text-sm text-text-secondary">Expiry {lot.printedExpiry || dateLabel(lot.expiryDate)} · Selling {money(lot.sellingPrice)} · MRP {lot.mrp === undefined ? "Missing: counter billing blocked" : money(lot.mrp)}{lot.purchaseCost !== undefined ? ` · Cost ${money(lot.purchaseCost)}` : ""}</p></article>)}</div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || loading} onClick={() => { if (cursor) setCursor(undefined); else void load(); }}>First batch page</Button>{data.nextCursor && <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => setCursor(data.nextCursor!)}>Next batch page</Button>}</div>
      {canAdjust && !pending && <form onSubmit={event => { void count(event); }} className="space-y-3 rounded-lg border border-border p-3"><h3 className="font-semibold">Record a physical count or disposal</h3><p className="text-sm">Count actual base units. Quarantined goods can only be reduced through a referenced disposal; this never releases them for sale.</p>
        {!durable && ready && <Alert variant="warning" title="Local recovery storage required">Allow durable browser storage before submitting a physical adjustment.</Alert>}
        {!!data.batches.length && <Select label="Count batch" value={selected} onChange={e => { setSelected(e.target.value); setQuantity(""); }} options={[{ value: "", label: "Choose the exact batch" }, ...data.batches.map(lot => ({ value: lot.id, label: `${lot.batchNumber} · ${lot.status} · ${lot.quantity} units` }))]} />}
        <Input label="Actual units remaining" type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
        <Select label="Stock adjustment reason" value={reason} onChange={e => setReason(e.target.value)} options={[{ value: "physical_audit", label: "Physical count correction" }, { value: "damaged", label: "Damaged goods disposal" }, { value: "expired", label: "Expired goods disposal" }, { value: "other", label: "Other reviewed correction" }]} />
        <Input label="Count / disposal source reference" minLength={3} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} required />
        <Button type="submit" loading={busy} disabled={!durable || !ready || loading}>Confirm physical adjustment</Button>
      </form>}
    </>}
    {canReadMovements && <section className="space-y-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => { void movements(); }}>Show latest movements</Button>{historyError && <p role="alert">{historyError}</p>}{history.map(row => <p className="text-sm" key={row._id}>Revision {row.revision} · {row.kind} · {row.beforeQuantity} → {row.afterQuantity} · {dateLabel(row.createdAt)}</p>)}{nextRevision !== null && <Button size="sm" variant="outline" onClick={() => { void movements(nextRevision); }}>Older movements</Button>}</section>}
  </div></Modal>;
}
