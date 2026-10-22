"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Button, Input, Select, DatePicker } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { acknowledgeStockReceiptReference, parseReceiptPaise, readStockReceiptReference, recoverStockReceipt, reserveStockReceiptReference, stockReceiptScope, submitStockReceipt, subscribeStockReceiptReferences, type StockReceiptPayload, type StockReceiptResult } from "@/lib/pharmacyStockReceipts";
import type { Medicine } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

interface Props { medicine: Medicine | null; locationId: string; canReceive: boolean; canRecover: boolean; onClose: () => void; onCommitted: () => void }
const message = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "Keep the same receipt reference and check its outcome.");
export function PharmacyStockReceipts({ medicine, locationId, canReceive, canRecover, onClose, onCommitted }: Props) {
  const user = useAuthStore(state => state.user), scope = stockReceiptScope(user, locationId), authScope = authScopeKey(user);
  const pending = useSyncExternalStore(subscribeStockReceiptReferences, () => readStockReceiptReference(scope), () => null);
  const [confirmed, setConfirmed] = useState<StockReceiptResult | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [retryKey, setRetryKey] = useState<string | null>(null);
  const draft = useRef<{ key: string; payload: StockReceiptPayload } | null>(null), lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === authScope, [authScope]);
  const check = useCallback(async (key: string) => {
    if (lock.current || !canRecover) return;
    lock.current = true; setBusy(true);
    try { const data = await recoverStockReceipt(locationId, key); if (current()) { setConfirmed(data); setError(""); } }
    catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }, [locationId, canRecover, current]);
  useEffect(() => { if (pending && canRecover) void check(pending); }, [pending, canRecover, check]);
  async function send(payload: StockReceiptPayload, retry?: string) {
    if (lock.current || !canReceive || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (retry && (draft.current && draft.current.key !== retry || readStockReceiptReference(scope) !== retry)) throw new Error("Receipt reference changed. Reload and check its outcome.");
      const key = retry || await reserveStockReceiptReference(scope);
      const pinned = retry && draft.current ? draft.current.payload : JSON.parse(JSON.stringify({ ...payload, receiptLineId: key })) as StockReceiptPayload;
      draft.current = { key, payload: pinned }; setRetryKey(key);
      const data = await submitStockReceipt(pinned, key);
      if (current()) { setConfirmed(data); onClose(); onCommitted(); }
    } catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function done() {
    if (!confirmed || confirmed.requestKey !== pending || busy) return;
    try { acknowledgeStockReceiptReference(scope, confirmed.requestKey); draft.current = null; setRetryKey(null); setConfirmed(null); setError(""); onClose(); onCommitted(); }
    catch (failure) { setError(message(failure)); }
  }
  return <>
    {pending && canRecover && (confirmed?.requestKey === pending ? <Alert variant="success" title="Stock receipt confirmed" action={<Button size="sm" disabled={busy} onClick={done}>Done with stock receipt</Button>}>
      Received {confirmed.receivedQuantity} {confirmed.batch.unitSnapshot.baseUnit} in batch {confirmed.batch.batchNumber}. Printed expiry: {confirmed.batch.expirySnapshot.value}.
    </Alert> : <Alert variant="warning" title="Pending stock receipt" action={<div className={styles.actions}><Button size="sm" variant="outline" disabled={busy} onClick={() => { void check(pending); }}>Check stock receipt</Button>{retryKey === pending && canReceive && <Button size="sm" disabled={busy} onClick={() => { if (draft.current) void send(draft.current.payload, pending); }}>Retry same stock receipt</Button>}</div>}>
      <p>{error || "Check this receipt before receiving more stock. Keep the reference if review is needed."}</p>{!retryKey && canReceive && <p>Choose the original medicine and re-enter its receipt details. The stored reference will be reused to prevent duplicate stock.</p>}<p className={styles.reference}>Reference: {pending}</p>
    </Alert>)}
    {medicine && <ReceiptForm key={medicine.id} medicine={medicine} resuming={Boolean(pending)} disabled={busy || Boolean(pending && (retryKey === pending || confirmed?.requestKey === pending)) || !canReceive} busy={busy} error={!pending ? error : ""} onClose={onClose} onSubmit={payload => { void send(payload, pending || undefined); }} />}
  </>;
}
function ReceiptForm({ medicine, resuming, disabled, busy, error, onClose, onSubmit }: { medicine: Medicine; resuming: boolean; disabled: boolean; busy: boolean; error: string; onClose: () => void; onSubmit: (payload: StockReceiptPayload) => void }) {
  const unit = medicine.unitDefinition!;
  const [form, setForm] = useState({ kind: "receipt", batchNumber: "", precision: "month", expiry: "", packs: "0", looseUnits: "0", purchaseTotal: "", sellingPrice: String(medicine.price), mrp: "", source: "" });
  const [validation, setValidation] = useState("");
  const edit = (field: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [field]: value }));
  function save(event: React.FormEvent) {
    event.preventDefault(); if (disabled) return;
    const packs = Number(form.packs), looseUnits = Number(form.looseUnits), quantity = packs * unit.unitsPerPack + looseUnits;
    const purchaseTotalPaise = parseReceiptPaise(form.purchaseTotal), sellingPricePaise = parseReceiptPaise(form.sellingPrice), mrpPaise = form.mrp.trim() ? parseReceiptPaise(form.mrp) : undefined;
    if (!form.batchNumber.trim() || form.batchNumber.trim().length > 100 || !form.expiry || !form.packs.trim() || !form.looseUnits.trim() || !Number.isSafeInteger(packs) || packs < 0 || !Number.isSafeInteger(looseUnits) || looseUnits < 0 || looseUnits >= unit.unitsPerPack || !Number.isSafeInteger(quantity) || quantity <= 0 ||
        purchaseTotalPaise === null || sellingPricePaise === null || mrpPaise === null || mrpPaise !== undefined && sellingPricePaise > mrpPaise || form.kind === "opening" && form.source.trim().length < 3) { setValidation("Enter a batch, printed expiry, positive whole base-unit quantity, exact prices and an opening source when applicable."); return; }
    onSubmit({ medicineId: medicine.id, locationId: medicine.locationId, receiptLineId: "reserved-before-post", kind: form.kind as "opening" | "receipt", expectedUnitVersion: unit.version, packs, looseUnits,
      batchNumber: form.batchNumber.trim(), expiry: { precision: form.precision as "day" | "month", value: form.expiry }, purchaseTotalPaise, sellingPricePaise,
      ...(mrpPaise !== undefined ? { mrpPaise } : {}), ...(form.kind === "opening" ? { openingSourceReference: form.source.trim() } : {}) });
  }
  return <Modal open onClose={onClose} busy={busy} title="Receive stock" description={medicine.name} size="md" bodyClassName={styles.dialog} footer={<><Button size="sm" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button size="sm" type="submit" form="stock-receipt-form" loading={busy} disabled={disabled}>Record stock receipt</Button></>}>
    <form id="stock-receipt-form" className={styles.form} onSubmit={save} noValidate>
      {(validation || error) && <Alert variant="error" title="Check stock receipt">{validation || error}</Alert>}
      {resuming && <p role="status">Re-enter the original receipt details. This uses the stored reference to prevent duplicate stock; conflicting committed details require review.</p>}
      <p className={styles.summary}>1 {unit.packUnit} = {unit.unitsPerPack} {unit.baseUnit}. Prices below are in INR; acquisition cost is the total for all received units.</p>
      <fieldset disabled={disabled} className={styles.form}>
        <Select label="Receipt kind" value={form.kind} onChange={event => edit("kind", event.target.value)} options={[{ value: "receipt", label: "Stock receipt" }, { value: "opening", label: "Opening physical count" }]} />
        {form.kind === "opening" && <Input label="Opening source reference *" maxLength={120} value={form.source} onChange={event => edit("source", event.target.value)} />}
        <Input label="Printed batch number *" maxLength={100} value={form.batchNumber} onChange={event => edit("batchNumber", event.target.value)} />
        <div className={styles.fieldGrid}><Select label="Printed expiry precision" value={form.precision} onChange={event => setForm(previous => ({ ...previous, precision: event.target.value, expiry: "" }))} options={[{ value: "month", label: "Month and year" }, { value: "day", label: "Exact day" }]} />
          <DatePicker label="Printed expiry *" mode={form.precision === "month" ? "month" : "date"} value={form.expiry} onChange={value => edit("expiry", value)} /></div>
        <div className={styles.fieldGrid}><Input label={`Full packs (${unit.packUnit}) *`} type="number" min="0" step="1" value={form.packs} onChange={event => edit("packs", event.target.value)} /><Input label={`Loose units (${unit.baseUnit}) *`} type="number" min="0" max={unit.unitsPerPack - 1} step="1" value={form.looseUnits} onChange={event => edit("looseUnits", event.target.value)} /></div>
        <Input label="Total acquisition cost (INR) *" type="number" min="0" step="0.01" value={form.purchaseTotal} onChange={event => edit("purchaseTotal", event.target.value)} />
        <div className={styles.fieldGrid}><Input label={`Selling price per ${unit.baseUnit} (INR) *`} type="number" min="0" step="0.01" value={form.sellingPrice} onChange={event => edit("sellingPrice", event.target.value)} /><Input label={`MRP per ${unit.baseUnit} (INR)`} type="number" min="0" step="0.01" value={form.mrp} onChange={event => edit("mrp", event.target.value)} /></div>
      </fieldset>
    </form>
  </Modal>;
}
