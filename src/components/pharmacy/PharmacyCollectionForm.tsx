"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Select } from "@/components/ui";
import { CheckCircle2, Clock3 } from "lucide-react";
import ui from "./PharmacyCollectionDetails.module.css";
import Modal from "@/components/ui/Modal";
import { useLatestRead } from "@/hooks/useLatestRead";
import { collectionReceiptPage, type CollectionInput, type CollectionMethod, type CollectionReceipt, type CounterInvoice } from "@/lib/pharmacyCollections";
import { prepareCounterCollection, type PaymentPart } from "@/lib/pharmacyPayment";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { PharmacyDocumentButton } from "./PharmacyDocumentButton";
import { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
import { PharmacyOnlinePayment } from "./PharmacyOnlinePayment";

/** A checkout preference only pre-fills fields; saved invoice amounts and explicit receipt confirmation still govern submission. */
export type CounterPaymentPreference = { method: CollectionMethod; cashTendered?: string };
export function PharmacyCollectionForm({ invoice, canCollect, canOpenTill = false, busy, onClose, onSubmit, onProviderCollected, preference, embedded = false }: { invoice: CounterInvoice; canCollect: boolean; canOpenTill?: boolean; busy: boolean; onClose: () => void; onSubmit: (input: CollectionInput) => void; onProviderCollected?: (receipt: CollectionReceipt) => void; preference?: CounterPaymentPreference; embedded?: boolean }) {
  const formId = useId();
  const [drawerReady, setDrawerReady] = useState(false), [split, setSplit] = useState(false), [full, setFull] = useState(true);
  const [entries, setEntries] = useState<PaymentPart[]>(() => [{ componentId: crypto.randomUUID(), amount: String(invoice.balanceDue), paymentMethod: preference?.method || "cash", referenceNumber: "" }]);
  const [tender, setTender] = useState(() => preference?.method && preference.method !== "cash" ? "0" : preference?.cashTendered ?? String(invoice.balanceDue)), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const [history, setHistory] = useState<CollectionReceipt[]>([]), [cursor, setCursor] = useState<string | null>(null), [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const beginRead = useLatestRead();
  const loadHistory = useCallback(async (after?: string) => {
    const request = beginRead(); setHistoryLoading(true);
    try { const page = await collectionReceiptPage(invoice.id, invoice.locationId, after, request.signal); if (request.isCurrent()) { setHistoryError(""); setHistory(page.items); setCursor(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setHistoryError(failure instanceof Error ? failure.message : "Receipt history unavailable"); }
    finally { if (request.isCurrent()) setHistoryLoading(false); }
  }, [beginRead, invoice.id, invoice.locationId]);
  useEffect(() => { void Promise.resolve().then(() => loadHistory()); }, [loadHistory]);
  const editable = canCollect && ["unpaid", "partially_paid"].includes(invoice.status) && invoice.balanceDue > 0;
  const payment = prepareCounterCollection(invoice, entries, tender, full);
  const canSubmit = editable && drawerReady && !busy && !payment.problem && confirmed;
  function edited() { setConfirmed(false); setError(""); }
  function selectMethod(method: CollectionMethod) {
    if (busy) return; edited(); setSplit(false);
    setEntries(previous => [{ ...previous[0], amount: full ? String(invoice.balanceDue) : previous[0].amount, paymentMethod: method, referenceNumber: "" }]);
    setTender(method === "cash" ? full ? String(invoice.balanceDue) : entries[0].amount : "0");
  }
  function addPayment() { if (busy || entries.length >= 10) return; edited(); setSplit(true); setEntries(previous => [...previous, { componentId: crypto.randomUUID(), amount: "", paymentMethod: "upi", referenceNumber: "" }]); }
  function editPart(id: string, field: keyof PaymentPart, value: string) { edited(); setEntries(previous => previous.map(part => part.componentId === id ? { ...part, [field]: value, ...(field === "paymentMethod" ? { referenceNumber: "" } : {}) } : part)); }
  function settlement(next: boolean) { edited(); setFull(next); if (!split && next) setEntries(previous => [{ ...previous[0], amount: String(invoice.balanceDue) }]); }
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (!editable || busy || !drawerReady) return;
    if (!confirmed || !payment.input) { setError(payment.problem || "Confirm actual receipt before recording payment."); return; }
    onSubmit(payment.input);
  }
  const settled = invoice.status === "paid" && invoice.balanceDue === 0;
  const statusLabel = settled ? invoice.creditedPaise ? "Settled" : "Paid in full" : invoice.status === "partially_paid" ? "Partially paid" : invoice.status === "unpaid" ? "Payment due" : invoice.status.replaceAll("_", " ");
  const documents = <div className={ui.documents}>
    <section aria-label="Saved collection receipts" className={ui.history} aria-busy={historyLoading}>
      <header className={ui.historyHeading}><h3>Payments{history.length > 1 ? ` (${history.length}${cursor ? "+" : ""})` : ""}</h3><PharmacyDocumentButton directPrint invoice={invoice} /></header>
      {historyLoading && <p role="status" className={ui.empty}>Loading receipts...</p>}
      {historyError && <Alert variant="error" title="Receipt history unavailable">{historyError}<Button size="sm" onClick={() => { void loadHistory(); }}>Retry receipt history</Button></Alert>}
      {!historyLoading && !historyError && !history.length && <p className={ui.empty}>No payment receipts recorded for this bill.</p>}
      {history.map(receipt => <article key={receipt.receiptId} className={ui.receiptCard}><CollectionReceiptSummary receipt={receipt} /><div className={ui.receiptActions}><PharmacyDocumentButton directPrint invoice={invoice} receipt={receipt} /></div></article>)}
      {cursor && <Button size="sm" variant="outline" disabled={historyLoading} onClick={() => { void loadHistory(cursor); }}>Next receipt page</Button>}
    </section>
  </div>;
  const content = <>
    <div className={ui.content}>
      <section className={ui.overview} data-complete={settled || undefined} aria-label="Bill payment summary">
        <header className={ui.overviewHeading}><p className={ui.customer}>{invoice.customerSnapshot?.anonymous ? "Walk-in customer" : invoice.customerSnapshot?.name || "Recorded customer"}</p><span className={ui.status} data-complete={settled || undefined}>{settled ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{statusLabel}</span></header>
        <p className={ui.heroLabel}>{settled || invoice.balanceDue === 0 ? "Bill total" : "Amount due"}</p>
        <strong className={ui.heroAmount}>{money(settled || invoice.balanceDue === 0 ? invoice.totalAmount : invoice.balanceDue)}</strong>
        {(!settled || Boolean(invoice.creditedPaise || invoice.refundedPaise)) && <dl className={ui.overviewTotals}><div><dt>{settled || invoice.balanceDue === 0 ? "Received" : "Bill total"}</dt><dd>{money(settled || invoice.balanceDue === 0 ? invoice.amountPaid : invoice.totalAmount)}</dd></div><div><dt>{settled || invoice.balanceDue === 0 ? "Balance due" : "Received"}</dt><dd>{money(settled || invoice.balanceDue === 0 ? invoice.balanceDue : invoice.amountPaid)}</dd></div></dl>}
      </section>
      {Boolean(invoice.creditedPaise || invoice.refundedPaise) && <div className={ui.adjustments}><dl><div><dt>Credits applied</dt><dd>{money((invoice.creditedPaise || 0) / 100)}</dd></div><div><dt>Confirmed refunds</dt><dd>{money((invoice.refundedPaise || 0) / 100)}</dd></div></dl><p>Received shows gross receipts before refunds.</p></div>}
      {error && <Alert variant="error" title="Check collection details">{error}</Alert>}
      {editable && <>
        <PharmacyDrawerGate compact locationId={invoice.locationId} canOpen={canOpenTill} onReady={setDrawerReady} />
        {onProviderCollected && <PharmacyOnlinePayment invoice={invoice} disabled={busy || !drawerReady} onCollected={onProviderCollected} />}
        <form id={formId} onSubmit={submit} noValidate><fieldset disabled={busy} className={styles.form}>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Payment method">{(["cash", "upi", "card"] as const).map(method => <Button key={method} variant={!split && entries[0].paymentMethod === method ? "primary" : "outline"} aria-pressed={!split && entries[0].paymentMethod === method} onClick={() => selectMethod(method)}>{method === "cash" ? "Cash" : method === "upi" ? "UPI" : "Card"}</Button>)}<Button variant={split ? "primary" : "outline"} aria-pressed={split} aria-label={split ? "Split payment selected" : "Add split payment"} onClick={() => { if (!split) addPayment(); }}>Split</Button></div>
          {!invoice.customerSnapshot?.anonymous && <div className="flex gap-2" role="group" aria-label="Settlement amount"><Button size="sm" variant={full ? "primary" : "outline"} aria-pressed={full} onClick={() => settlement(true)}>Full payment</Button><Button size="sm" variant={!full ? "primary" : "outline"} aria-pressed={!full} onClick={() => settlement(false)}>Partial payment</Button></div>}
          {entries.map((entry, index) => {
            const other = entries.reduce((sum, part) => sum + (part.componentId === entry.componentId ? 0 : parseReceiptPaise(part.amount) ?? 0), 0), remaining = Math.max(0, Math.round(invoice.balanceDue * 100) - other);
            return <fieldset key={entry.componentId} className={split ? styles.rx : "min-w-0 space-y-3"} aria-label={`Collection component ${index + 1}`}>
              {split && <><div className="flex items-center justify-between gap-2"><h3>Payment {index + 1}</h3><Button size="sm" variant="ghost" aria-label={`Remove payment component ${index + 1}`} disabled={entries.length <= 1} onClick={() => { edited(); setEntries(previous => previous.filter(part => part.componentId !== entry.componentId)); }}>Remove</Button></div><Select label={`Payment method ${index + 1}`} value={entry.paymentMethod} onChange={event => editPart(entry.componentId, "paymentMethod", event.target.value)} options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "card", label: "Card" }]} /></>}
              {(split || !full) && <Input aria-label={`Amount received ${index + 1} (INR)`} label={split ? `Amount ${index + 1} (INR)` : "Amount to collect (INR)"} type="number" min="0.01" step="0.01" value={entry.amount} onChange={event => editPart(entry.componentId, "amount", event.target.value)} />}
              {split && <Button size="sm" variant="ghost" disabled={!remaining} onClick={() => editPart(entry.componentId, "amount", (remaining / 100).toFixed(2))}>Use remaining {money(remaining / 100)}</Button>}
              {entry.paymentMethod !== "cash" && <Input label={`Actual payment reference ${index + 1}`} hint={entry.paymentMethod === "upi" ? "Verify receipt in your UPI app, then enter the transaction reference." : "Confirm approval on the card terminal, then enter its reference."} required minLength={3} value={entry.referenceNumber} maxLength={200} onChange={event => editPart(entry.componentId, "referenceNumber", event.target.value)} />}
            </fieldset>;
          })}
          {split && <Button size="sm" variant="outline" disabled={entries.length >= 10} onClick={addPayment}>Add payment method</Button>}
          {payment.cash > 0 && <><Input aria-label="Cash tendered (INR)" label="Cash received (INR)" hint="Cash handed over by the customer. Extra cash is returned as change." size="lg" type="number" min="0" step="0.01" value={tender} onChange={event => { edited(); setTender(event.target.value); }} /><div className="flex flex-wrap gap-2" role="group" aria-label="Cash tender shortcuts">{[payment.cash, ...[10000, 20000, 50000].filter(value => value > payment.cash)].map((value, index) => <Button key={value} size="sm" variant="outline" className="rounded-full" onClick={() => { edited(); setTender((value / 100).toFixed(2)); }}>{index === 0 ? "Exact" : money(value / 100)}</Button>)}</div><dl className="flex justify-between gap-3 rounded-xl bg-surface-alt p-3 text-base font-semibold"><dt>Change to return</dt><dd className="tabular-nums">{payment.change === null ? "—" : money(payment.change / 100)}</dd></dl></>}
          {!full && payment.remaining !== null && payment.remaining >= 0 && <p className="text-sm font-medium">Due after this payment: {money(payment.remaining / 100)}</p>}
          {payment.problem && <p role="status" className="text-xs leading-relaxed text-text-secondary">{payment.problem}</p>}
          <div className="rounded-xl border border-border p-3"><Checkbox label="I confirmed that these amounts were actually received" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /></div>
        </fieldset></form>
      </>}
      {editable ? <details className={ui.expandable}><summary>Bill details and saved receipts</summary>{documents}</details> : documents}
    </div>
  </>;
  return embedded ? <Card padding="none" className={ui.embedded} contentClassName="gap-3"><header><h2 className="text-sm font-semibold">Payment for {invoice.invoiceNumber}</h2><p className="text-xs text-text-secondary">{editable ? "Bill saved. Record the received payment below." : "View the saved bill and payment receipts."}</p></header>{content}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={onClose} aria-label="Close collections">{editable ? "Cancel" : "Done"}</Button>{editable && <Button size="sm" type="submit" form={formId} loading={busy} aria-label="Record payment" disabled={!canSubmit}>Save payment</Button>}</div></Card> : <Modal open presentation="sheet" title={invoice.documentVersion === 3 ? "Collect opening balance" : editable ? "Collect payment" : "Bill & receipts"} ariaLabel={invoice.documentVersion === 3 ? "Collect opening balance" : "Collect payment"} description={invoice.invoiceNumber} onClose={onClose} busy={busy} size="md" bodyClassName={styles.dialog} footer={editable ? <><Button size="sm" variant="outline" disabled={busy} onClick={onClose} aria-label="Close collections">{editable ? "Cancel" : "Done"}</Button>{editable && <Button size="sm" type="submit" form={formId} loading={busy} aria-label="Record payment" disabled={!canSubmit}>Record {money(payment.total / 100)} received</Button>}</> : undefined}>{content}</Modal>;
}
