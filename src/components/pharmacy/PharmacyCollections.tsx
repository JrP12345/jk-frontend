"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { collectionInvoicePage, collectionReceiptPage, readCounterInvoice, recoverPharmacyCollection, submitPharmacyCollection, type CollectionInput, type CollectionMethod, type CollectionReceipt, type CounterInvoice, type InvoiceSummary } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
import { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";
import { PharmacyDocumentButton } from "./PharmacyDocumentButton";
import { PharmacySaleRecovery } from "./PharmacySaleRecovery";
export { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";

const errorMessage = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Collection could not be confirmed. Keep the same reference.");
type PendingCollection = { key: string; invoiceId: string };
function pendingReference(storageKey: string): PendingCollection | null {
  const value = sessionStorage.getItem(storageKey); if (!value) return null;
  const result = JSON.parse(value) as PendingCollection;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(result.key) || typeof result.invoiceId !== "string" || !result.invoiceId) throw new Error("Collection reference requires review before another payment.");
  return result;
}
export function PharmacyCollections({ locationId, canCollect, initialInvoiceId }: { locationId: string; canCollect: boolean; initialInvoiceId?: string }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CollectionSession key={`${scope}:${locationId}`} locationId={locationId} canCollect={canCollect} initialInvoiceId={initialInvoiceId} />;
}
function CollectionSession({ locationId, canCollect, initialInvoiceId }: { locationId: string; canCollect: boolean; initialInvoiceId?: string }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-collection:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { pending: pendingReference(storageKey), error: "" }; } catch (failure) { return { pending: null, error: errorMessage(failure) }; } });
  const [pending, setPending] = useState(initial.pending), [receipt, setReceipt] = useState<CollectionReceipt | null>(null), [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [canCorrect, setCanCorrect] = useState(false);
  const frozen = useRef<{ invoiceId: string; input: CollectionInput; key: string } | null>(null), lock = useRef(false), alive = useRef(true);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [items, setItems] = useState<InvoiceSummary[]>([]), [cursor, setCursor] = useState<string | undefined>(), [next, setNext] = useState<string | null>(null), [loading, setLoading] = useState(false), [listError, setListError] = useState("");
  const [invoice, setInvoice] = useState<CounterInvoice | null>(null), [refresh, setRefresh] = useState(0);
  const beginRead = useLatestRead(), beginDetail = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setListError(""); setItems([]);
    try { const page = await collectionInvoicePage(locationId, cursor, request.signal); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setListError(errorMessage(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, locationId, cursor]);
  useEffect(() => { void load(); }, [load, refresh]);
  useEffect(() => {
    if (!initialInvoiceId) return;
    const request = beginDetail();
    void readCounterInvoice(initialInvoiceId, locationId, request.signal).then(value => { if (request.isCurrent()) setInvoice(value); }).catch(failure => { if (request.isCurrent()) setError(errorMessage(failure)); });
  }, [initialInvoiceId, locationId, beginDetail]);
  async function open(id: string) {
    const request = beginDetail(); setError("");
    try { const value = await readCounterInvoice(id, locationId, request.signal); if (request.isCurrent()) setInvoice(value); }
    catch (failure) { if (request.isCurrent()) setError(errorMessage(failure)); }
  }
  async function send(invoiceId: string, input: CollectionInput) {
    if (!current() || lock.current || !canCollect || receipt) return;
    lock.current = true; setBusy(true); setError(""); setCanCorrect(false);
    try {
      const stored = pendingReference(storageKey);
      if ((stored?.key || null) !== (pending?.key || null) || pending && pending.invoiceId !== invoiceId) throw new Error("Collection reference changed. Check its result before collecting again.");
      const ref = pending || { key: crypto.randomUUID(), invoiceId };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref));
      setPending(ref);
      const pinned = frozen.current || { invoiceId, input: JSON.parse(JSON.stringify(input)) as CollectionInput, key: ref.key };
      frozen.current = pinned; setSubmitted(true);
      const result = await submitPharmacyCollection(pinned.invoiceId, pinned.input, pinned.key);
      if (current()) { setReceipt(result); setInvoice(null); }
    } catch (failure) { if (current()) { setError(errorMessage(failure)); setCanCorrect([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await recoverPharmacyCollection(locationId, pending.key); if (result.invoiceId !== pending.invoiceId) throw new Error("Collection invoice reference needs review"); if (current()) { setReceipt(result); setInvoice(null); } }
    catch (failure) { if (current()) setError(errorMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function done() {
    if (!current() || busy || !pending || !receipt) return;
    try { if (pendingReference(storageKey)?.key !== receipt.requestKey) throw new Error("Collection reference changed. Reopen the result."); sessionStorage.removeItem(storageKey); setPending(null); setReceipt(null); setSubmitted(false); frozen.current = null; setError(""); setRefresh(value => value + 1); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  return <section className={styles.list} aria-label="Pharmacy sales and collections">
    <header><h2>Sales & collections</h2><p>Record only money actually received. A QR display or payment attempt is not confirmation.</p></header>
    {!initialInvoiceId && <PharmacySaleRecovery locationId={locationId} onOpen={id => { void open(id); }} />}
    {error && <Alert variant="error" title="Collection needs attention">{error}</Alert>}
    {pending && <Alert variant={receipt ? "success" : "warning"} title={receipt ? "Collection confirmed" : "Pending collection"}>
      <p>Reference: {pending.key}</p>{receipt ? <><CollectionReceiptSummary receipt={receipt} /><Button size="sm" variant="outline" disabled={busy} onClick={() => { void open(receipt.invoiceId); }}>View saved bill and receipts</Button><Button size="sm" disabled={busy} onClick={done}>Done with collection</Button></> : <><p>Check this result before collecting again. Keep the same reference after reload.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void recover(); }}>Check collection result</Button>
        {submitted && canCollect && <Button size="sm" disabled={busy} onClick={() => { if (frozen.current) void send(frozen.current.invoiceId, frozen.current.input); }}>Retry same collection</Button>}
        {canCollect && (!submitted || canCorrect) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { frozen.current = null; setSubmitted(false); setCanCorrect(false); void open(pending.invoiceId); }}>Re-enter original collection</Button>}</>}
    </Alert>}
    {loading && <p role="status">Loading counter invoices...</p>}{listError && <Alert variant="error" title="Sales unavailable">{listError}<Button size="sm" onClick={() => setRefresh(value => value + 1)}>Retry sales</Button></Alert>}
    {items.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.invoiceNumber}</strong><small>{row.customerSnapshot?.name || "Walk-in customer"} · {row.status.replaceAll("_", " ")}</small><span>{money(row.totalAmount)}</span></div><Button size="sm" variant="outline" disabled={busy} onClick={() => { void open(row.id); }}>{row.documentVersion === 3 ? "Open opening balance" : "Open sale"} {row.invoiceNumber}</Button></article>)}
    <div className={styles.actions}>{cursor && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(undefined)}>First sales page</Button>}{next && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(next)}>Next sales page</Button>}</div>
    {invoice && <PharmacyCollectionForm key={`${invoice.id}:${invoice.paymentRevision}`} invoice={invoice} canCollect={canCollect && !receipt && (!pending || pending.invoiceId === invoice.id) && !submitted} busy={busy} onClose={() => setInvoice(null)} onSubmit={input => { void send(invoice.id, input); }} />}
  </section>;
}
export function PharmacyCollectionForm({ invoice, canCollect, busy, onClose, onSubmit }: { invoice: CounterInvoice; canCollect: boolean; busy: boolean; onClose: () => void; onSubmit: (input: CollectionInput) => void }) {
  const [drawerReady, setDrawerReady] = useState(false);
  const [entries, setEntries] = useState(() => [{ componentId: crypto.randomUUID(), amount: String(invoice.balanceDue), paymentMethod: "cash" as CollectionMethod, referenceNumber: "" }]);
  const [tender, setTender] = useState(String(invoice.balanceDue)), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const [history, setHistory] = useState<CollectionReceipt[]>([]), [cursor, setCursor] = useState<string | null>(null), [historyError, setHistoryError] = useState("");
  const beginRead = useLatestRead();
  const loadHistory = useCallback(async (after?: string) => {
    const request = beginRead(); setHistoryError("");
    try { const page = await collectionReceiptPage(invoice.id, invoice.locationId, after, request.signal); if (request.isCurrent()) { setHistory(page.items); setCursor(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setHistoryError(errorMessage(failure)); }
  }, [beginRead, invoice.id, invoice.locationId]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (!canCollect || busy || !drawerReady) return;
    const values = entries.map(entry => ({ componentId: entry.componentId, amountPaise: parseReceiptPaise(entry.amount), paymentMethod: entry.paymentMethod, ...(entry.referenceNumber.trim() ? { referenceNumber: entry.referenceNumber.trim() } : {}) }));
    const cash = values.filter(entry => entry.paymentMethod === "cash").reduce((sum, entry) => sum + (entry.amountPaise || 0), 0), cashTenderedPaise = parseReceiptPaise(tender), expectedBalancePaise = parseReceiptPaise(String(invoice.balanceDue));
    const total = values.reduce((sum, entry) => sum + (entry.amountPaise || 0), 0);
    if (!confirmed || expectedBalancePaise === null || cashTenderedPaise === null || cashTenderedPaise < cash || cash === 0 && cashTenderedPaise !== 0 || !values.length || values.some(entry => entry.amountPaise === null || entry.amountPaise <= 0 || entry.paymentMethod !== "cash" && (!entry.referenceNumber || entry.referenceNumber.length < 3)) || !Number.isSafeInteger(total) || total > expectedBalancePaise || invoice.customerSnapshot?.anonymous && total !== expectedBalancePaise) { setError("Confirm actual receipt, exact positive amounts, terminal/UPI references and cash tender. Anonymous customers require full settlement."); return; }
    onSubmit({ locationId: invoice.locationId, expectedPaymentRevision: invoice.paymentRevision, expectedBalancePaise, cashTenderedPaise, manualConfirmed: true, entries: values as CollectionInput["entries"] });
  }
  const editable = canCollect && ["unpaid", "partially_paid"].includes(invoice.status) && invoice.balanceDue > 0;
  return <Modal open title={invoice.documentVersion === 3 ? "Opening balance collections" : "Counter invoice collections"} description={invoice.invoiceNumber} onClose={onClose} busy={busy} size="lg" bodyClassName={styles.dialog} footer={<Button size="sm" variant="outline" disabled={busy} onClick={onClose}>Close collections</Button>}>
    <p>Total {money(invoice.totalAmount)} · Paid {money(invoice.amountPaid)} · Remaining {money(invoice.balanceDue)}.</p>
    {Boolean(invoice.creditedPaise || invoice.refundedPaise) && <p>Credits {money((invoice.creditedPaise || 0) / 100)} · Confirmed refunds {money((invoice.refundedPaise || 0) / 100)}. Paid above records gross receipts.</p>}
    <PharmacyDocumentButton invoice={invoice} />
    {invoice.customerSnapshot?.anonymous ? <p>Walk-in customer: receive the full remaining amount.</p> : <p>Recorded customer: {invoice.customerSnapshot?.name}. Any uncollected balance remains due.</p>}
    {error && <Alert variant="error" title="Check collection details">{error}</Alert>}
    {editable && <PharmacyDrawerGate locationId={invoice.locationId} onReady={setDrawerReady} />}
    {editable && <form onSubmit={submit} className={styles.form} noValidate><fieldset disabled={busy || !drawerReady} className={styles.form}>
      {entries.map((entry, index) => { const edit = (field: keyof typeof entry, value: string) => setEntries(previous => previous.map(row => row.componentId === entry.componentId ? { ...row, [field]: value } : row)); return <fieldset key={entry.componentId} className={styles.rx} aria-label={`Collection component ${index + 1}`}>
        <Select label={`Payment method ${index + 1}`} value={entry.paymentMethod} onChange={event => edit("paymentMethod", event.target.value)} options={[{ value: "cash", label: "Cash received" }, { value: "upi", label: "UPI received and verified" }, { value: "card", label: "Card terminal confirmed" }]} />
        <Input label={`Amount received ${index + 1} (INR)`} type="number" min="0.01" step="0.01" value={entry.amount} onChange={event => edit("amount", event.target.value)} />{entry.paymentMethod !== "cash" && <Input label={`Actual payment reference ${index + 1}`} value={entry.referenceNumber} maxLength={200} onChange={event => edit("referenceNumber", event.target.value)} />}
        <Button size="sm" variant="ghost" onClick={() => setEntries(previous => previous.filter(row => row.componentId !== entry.componentId))}>Remove payment component {index + 1}</Button>
      </fieldset>; })}
      <Button size="sm" variant="outline" disabled={entries.length >= 10} onClick={() => setEntries(previous => [...previous, { componentId: crypto.randomUUID(), amount: "", paymentMethod: "cash", referenceNumber: "" }])}>Add split payment</Button>
      <Input label="Cash tendered (INR)" type="number" min="0" step="0.01" value={tender} onChange={event => setTender(event.target.value)} />
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I confirmed that these amounts were actually received</label>
      <Button size="sm" type="submit" loading={busy}>Record confirmed collection</Button>
    </fieldset></form>}
    <section aria-label="Saved collection receipts"><h3>Saved receipts</h3>{historyError && <Alert variant="error" title="Receipt history unavailable">{historyError}<Button size="sm" onClick={() => { void loadHistory(); }}>Retry receipt history</Button></Alert>}{history.map(receipt => <div key={receipt.receiptId}><CollectionReceiptSummary receipt={receipt} /><PharmacyDocumentButton invoice={invoice} receipt={receipt} /></div>)}{cursor && <Button size="sm" variant="outline" onClick={() => { void loadHistory(cursor); }}>Next receipt page</Button>}</section>
  </Modal>;
}
