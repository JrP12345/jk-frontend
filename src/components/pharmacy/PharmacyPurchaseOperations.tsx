"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select, DatePicker } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import type { PharmacyParty, PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

type Pending = { key: string; kind: "post" | "receipt" };
type DeliveryLine = { lineId: string; purchaseLineId: string; billed: string; free: string; batch: string; precision: string; expiry: string };
type Receipt = { id: string; deliveryReference: string; receivedAt: string; lines: Array<{ lineId: string; batchNumber: string; billedBaseUnits: number; freeBaseUnits: number; costPaise: number; expiry: { value: string } }> };
const message = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "Outcome could not be confirmed. Keep the same reference.");
function stored(key: string): Pending | null {
  const raw = sessionStorage.getItem(key); if (!raw) return null;
  const value = JSON.parse(raw) as Pending;
  if (!["post", "receipt"].includes(value.kind) || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.key)) throw new Error("Purchase reference needs review before another operation.");
  return value;
}
export function PharmacyPurchaseOperations({ purchase, canManage, canReceive, onClose, onChanged }: { purchase: PurchaseDraft; canManage: boolean; canReceive: boolean; onClose: () => void; onChanged: () => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-purchase-operation:${scope}:${purchase.locationId}:${purchase.id}`;
  const [initial] = useState(() => { try { return { pending: stored(storageKey), error: "" }; } catch (error) { return { pending: null, error: message(error) }; } });
  const [pending, setPending] = useState(initial.pending), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState<{ requestKey: string; receiptId?: string; payablePaise?: number } | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [canCorrect, setCanCorrect] = useState(false);
  const alive = useRef(true), lock = useRef(false), frozen = useRef<{ ref: Pending; payload: object } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function validateResult(value: unknown, ref: Pending) {
    const result = value as { purchaseId?: unknown; requestKey?: unknown; payablePaise?: unknown; receiptId?: unknown } | null;
    if (!result || result.purchaseId !== purchase.id || result.requestKey !== ref.key ||
        (ref.kind === "post" ? typeof result.payablePaise !== "number" || !Number.isSafeInteger(result.payablePaise) || result.payablePaise < 0 : typeof result.receiptId !== "string" || !result.receiptId)) throw new Error("Purchase outcome could not be confirmed. Check the saved reference.");
    return result as { requestKey: string; receiptId?: string; payablePaise?: number };
  }
  const [party, setParty] = useState<PharmacyParty | null>(null), [lookupError, setLookupError] = useState("");
  const [posting, setPosting] = useState({ state: "", taxMode: "", cost: "", round: "0", review: "" });
  const [deliveryReference, setDeliveryReference] = useState("");
  const addLine = (): DeliveryLine => ({ lineId: crypto.randomUUID(), purchaseLineId: purchase.lines[0].lineId, billed: "0", free: "0", batch: "", precision: "month", expiry: "" });
  const [lines, setLines] = useState<DeliveryLine[]>(() => [addLine()]);
  const [receipts, setReceipts] = useState<Receipt[]>([]), [cursor, setCursor] = useState<string | null>(null), [historyError, setHistoryError] = useState("");
  const beginHistory = useRef(0);
  const fetchHistory = useCallback(async (after?: string) => {
    const response = await api.get(`/pharmacy/purchases/${purchase.id}/receipts?locationId=${encodeURIComponent(purchase.locationId)}${after ? `&cursor=${encodeURIComponent(after)}` : ""}`), page = response.data?.data;
    if (!page || !Array.isArray(page.items) || page.items.length > 10 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Delivery history could not be loaded completely.");
    return page as { items: Receipt[]; nextCursor: string | null };
  }, [purchase.id, purchase.locationId]);
  async function loadHistory(after?: string) {
    const sequence = ++beginHistory.current; setHistoryError("");
    try { const page = await fetchHistory(after); if (current() && sequence === beginHistory.current) { setReceipts(page.items); setCursor(page.nextCursor); } }
    catch (failure) { if (current() && sequence === beginHistory.current) setHistoryError(message(failure)); }
  }
  useEffect(() => {
    let active = true;
    if (purchase.status === "draft") void api.get(`/pharmacy/parties/${purchase.supplierId}?locationId=${encodeURIComponent(purchase.locationId)}`).then(response => { if (active) setParty(response.data.data); }).catch(() => { if (active) setLookupError("Supplier could not be loaded. Reopen before posting."); });
    else void fetchHistory().then(page => { if (active) { setReceipts(page.items); setCursor(page.nextCursor); } }).catch(failure => { if (active) setHistoryError(message(failure)); });
    return () => { active = false; };
  }, [purchase.status, purchase.supplierId, purchase.locationId, fetchHistory]);
  async function send(kind: Pending["kind"], payload: object) {
    if (lock.current || !current() || !canManage || kind === "receipt" && !canReceive || confirmed) return;
    lock.current = true; setBusy(true); setError(""); setCanCorrect(false);
    try {
      const existing = stored(storageKey);
      if ((pending?.key || null) !== (existing?.key || null) || existing && existing.kind !== kind) throw new Error("Purchase reference changed. Check its result before continuing.");
      const ref = pending || { kind, key: crypto.randomUUID() };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref)); // Persist only opaque reference before dispatch.
      setPending(ref);
      const pinned = frozen.current?.ref.key === ref.key ? frozen.current.payload : JSON.parse(JSON.stringify(payload)) as object;
      frozen.current = { ref, payload: pinned }; setHasSubmitted(true);
      const response = await api.post(`/pharmacy/purchases/${purchase.id}/${kind === "post" ? "post" : "receipts"}`, pinned, { headers: { "Idempotency-Key": ref.key } });
      const result = validateResult(response.data?.data, ref);
      if (current()) setConfirmed(result);
    } catch (failure) { if (current()) { setError(message(failure)); setCanCorrect([400, 409].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function check() {
    if (!pending || lock.current || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await api.get(`/pharmacy/purchases/${purchase.id}/operations/${pending.kind}/${pending.key}?locationId=${encodeURIComponent(purchase.locationId)}`), result = validateResult(response.data?.data, pending);
      if (current()) setConfirmed(result);
    } catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function acknowledge() {
    if (!pending || !confirmed || busy || !current()) return;
    try { if (stored(storageKey)?.key !== confirmed.requestKey) throw new Error("Purchase reference changed. Reopen before continuing."); sessionStorage.removeItem(storageKey); onChanged(); }
    catch (failure) { setError(message(failure)); }
  }
  function post(event: React.FormEvent) {
    event.preventDefault(); const absolute = parseReceiptPaise(posting.round.replace(/^-/, "")), roundOffPaise = absolute === null ? null : posting.round.startsWith("-") ? -absolute : absolute;
    if (!party || !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(posting.state) || !posting.taxMode || !posting.cost || posting.review.trim().length < 3 || roundOffPaise === null || Math.abs(roundOffPaise) > 99) { setError("Record the actual review, supplier state, tax split, cost treatment and round-off within INR 0.99."); return; }
    void send("post", { locationId: purchase.locationId, expectedRevision: purchase.revision, expectedSupplierRevision: party.revision, supplierStateCode: posting.state, taxMode: posting.taxMode, costTreatment: posting.cost, roundOffPaise, reviewReference: posting.review.trim() });
  }
  function receive(event: React.FormEvent) {
    event.preventDefault();
    if (deliveryReference.trim().length < 3 || !lines.length || lines.some(line => !/^\d+$/.test(line.billed) || !/^\d+$/.test(line.free) || !Number.isSafeInteger(Number(line.billed) + Number(line.free)) || Number(line.billed) + Number(line.free) <= 0 || !line.batch.trim() || !line.expiry)) { setError("Record the actual delivery reference, positive whole billed/free base units, batch and printed expiry for each received line."); return; }
    void send("receipt", { locationId: purchase.locationId, expectedRevision: purchase.revision, deliveryReference: deliveryReference.trim(), lines: lines.map(line => ({ lineId: line.lineId, purchaseLineId: line.purchaseLineId, billedBaseUnits: Number(line.billed), freeBaseUnits: Number(line.free), batchNumber: line.batch.trim(), expiry: { precision: line.precision, value: line.expiry } })) });
  }
  const postingMode = purchase.status === "draft", disabled = busy || Boolean(confirmed) || Boolean(hasSubmitted && pending), allowed = canManage && (postingMode || canReceive);
  return <Modal open title={postingMode ? "Post saved supplier invoice" : "Receive purchase delivery"} onClose={onClose} busy={busy} size="lg" bodyClassName={styles.dialog} footer={<Button size="sm" variant="outline" disabled={busy} onClick={onClose}>Close purchase</Button>}>
    <p>{purchase.supplierInvoiceNumber} · {purchase.supplierSnapshot.name}. Supplier stated total: {money(purchase.statedTotalPaise / 100)}.</p>
    {purchase.posting && <p>Posted payable: {money(purchase.posting.payablePaise / 100)}. Delivery receipts do not create another payable.</p>}
    {postingMode && <p>Only the saved draft is posted. This freezes the supplier bill and establishes its payable; stock is received separately. Review source tax and supplier eligibility before posting.</p>}
    {(error || lookupError) && <Alert variant="error" title="Purchase needs attention">{error || lookupError}</Alert>}
    {pending && <Alert variant={confirmed ? "success" : "warning"} title={confirmed ? "Purchase operation confirmed" : "Pending purchase operation"}>
      <p>Reference: {pending.key}</p>{confirmed ? <><p>{confirmed.receiptId ? "Delivery recorded." : `Supplier payable posted: ${money((confirmed.payablePaise || 0) / 100)}.`}</p><Button size="sm" disabled={busy} onClick={acknowledge}>Done with purchase operation</Button></> : <><p>Check the result before another operation. Retry uses the same saved reference and submitted details. After reload, re-enter the original details only if no committed result is visible.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void check(); }}>Check purchase result</Button>{hasSubmitted && allowed && <Button size="sm" disabled={busy} onClick={() => { if (frozen.current) void send(frozen.current.ref.kind, frozen.current.payload); }}>Retry same purchase operation</Button>}{canCorrect && allowed && <Button size="sm" variant="outline" disabled={busy} onClick={() => { frozen.current = null; setHasSubmitted(false); setCanCorrect(false); }}>Correct details using same reference</Button>}</>}
    </Alert>}
    {allowed && (!pending || !hasSubmitted && pending.kind === (postingMode ? "post" : "receipt")) && !confirmed && (postingMode ? <form onSubmit={post} className={styles.form} noValidate><fieldset className={styles.form} disabled={disabled}>
      <Input label="Reviewed supplier state code" maxLength={2} value={posting.state} onChange={event => setPosting({ ...posting, state: event.target.value })} />
      <Select label="Reviewed supplier GST split" value={posting.taxMode} onChange={event => setPosting({ ...posting, taxMode: event.target.value })} options={[{ value: "", label: "Choose reviewed tax split" }, { value: "sgst", label: "CGST + SGST" }, { value: "utgst", label: "CGST + UTGST" }, { value: "igst", label: "IGST" }]} />
      <Select label="Reviewed acquisition cost treatment" value={posting.cost} onChange={event => setPosting({ ...posting, cost: event.target.value })} options={[{ value: "", label: "Choose reviewed cost treatment" }, { value: "exclude_tax", label: "Exclude supplier GST from stock cost" }, { value: "include_tax", label: "Include supplier GST in stock cost" }]} />
      <Input label="Reviewed invoice round-off (INR)" value={posting.round} onChange={event => setPosting({ ...posting, round: event.target.value })} /><Input label="Supplier eligibility and tax review reference" maxLength={200} value={posting.review} onChange={event => setPosting({ ...posting, review: event.target.value })} />
      <Button size="sm" type="submit" disabled={!party || Boolean(lookupError)} loading={busy}>Post saved supplier invoice</Button>
    </fieldset></form> : <form onSubmit={receive} className={styles.form} noValidate><fieldset className={styles.form} disabled={disabled}>
      <Input label="Actual delivery reference" maxLength={100} value={deliveryReference} onChange={event => setDeliveryReference(event.target.value)} />
      {lines.map((line, index) => {
        const source = purchase.lines.find(row => row.lineId === line.purchaseLineId)!, progress = purchase.receiptProgress?.find(row => row.lineId === line.purchaseLineId);
        const edit = (field: keyof DeliveryLine, value: string) => setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, [field]: value } : row));
        return <fieldset className={styles.rx} key={line.lineId} aria-label={`Delivery line ${index + 1}`}><Select label={`Source purchase line ${index + 1}`} value={line.purchaseLineId} onChange={event => edit("purchaseLineId", event.target.value)} options={purchase.lines.map((row, number) => ({ value: row.lineId, label: `${number + 1}. ${row.medicineSnapshot.name}` }))} />
          <p>Remaining: {source.billedBaseUnits - (progress?.billedBaseUnits || 0)} billed, {source.freeBaseUnits - (progress?.freeBaseUnits || 0)} free {source.unitSnapshot.baseUnit}.</p>
          <div className={styles.fieldGrid}><Input label={`Received billed base units ${index + 1}`} type="number" min="0" step="1" value={line.billed} onChange={event => edit("billed", event.target.value)} /><Input label={`Received free base units ${index + 1}`} type="number" min="0" step="1" value={line.free} onChange={event => edit("free", event.target.value)} /></div>
          <Input label={`Printed batch ${index + 1}`} value={line.batch} maxLength={100} onChange={event => edit("batch", event.target.value)} /><Select label={`Expiry precision ${index + 1}`} value={line.precision} onChange={event => { edit("precision", event.target.value); edit("expiry", ""); }} options={[{ value: "month", label: "Printed month" }, { value: "day", label: "Printed day" }]} /><DatePicker label={`Printed expiry ${index + 1}`} mode={line.precision === "month" ? "month" : "date"} value={line.expiry} onChange={value => edit("expiry", value)} />
          <Button size="sm" variant="ghost" onClick={() => setLines(previous => previous.filter(row => row.lineId !== line.lineId))}>Remove delivery line {index + 1}</Button>
        </fieldset>;
      })}
      <Button size="sm" variant="outline" disabled={lines.length >= 100} onClick={() => setLines(previous => [...previous, addLine()])}>Add delivery lot</Button><Button size="sm" type="submit" loading={busy}>Record purchase delivery</Button>
    </fieldset></form>)}
    {!postingMode && <section aria-label="Recorded purchase deliveries"><h3>Recorded deliveries</h3>{historyError && <Alert variant="error" title="Delivery history unavailable">{historyError}<Button size="sm" onClick={() => { void loadHistory(); }}>Retry delivery history</Button></Alert>}
      {receipts.map(receipt => <article key={receipt.id}><strong>{receipt.deliveryReference}</strong><p>{receipt.receivedAt}</p>{receipt.lines.map(line => <p key={line.lineId}>Batch {line.batchNumber}: {line.billedBaseUnits} billed + {line.freeBaseUnits} free. Printed expiry {line.expiry.value}. Cost {money(line.costPaise / 100)}.</p>)}</article>)}
      {cursor && <Button size="sm" variant="outline" onClick={() => { void loadHistory(cursor); }}>Next delivery page</Button>}
    </section>}
  </Modal>;
}
