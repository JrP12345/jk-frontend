"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { ReceiptText, Search } from "lucide-react";
import { PharmacyCollectionForm, type CounterPaymentPreference } from "./PharmacyCollectionForm";
export { PharmacyCollectionForm } from "./PharmacyCollectionForm";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { pendingCollectionReference as pendingReference, collectionInvoicePage, readCounterInvoice, recoverPharmacyCollection, submitPharmacyCollection, type CollectionInput, type CollectionReceipt, type CounterInvoice, type InvoiceSummary } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
import { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";
import { PharmacySaleRecovery } from "./PharmacySaleRecovery";
import { createCollectionJournal } from "@/lib/pharmacyCommandJournal";
import { usePharmacyReconnect } from "@/hooks/usePharmacyReconnect";
import { prepareCheckoutPayment, prepareIssuedCheckoutPayment, type CounterCheckoutPayment } from "@/lib/pharmacyPayment";
export { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";

const errorMessage = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Collection could not be confirmed. Keep the same reference.");
type CollectionsProps = { locationId: string; canCollect: boolean; canOpenTill?: boolean; initialInvoiceId?: string; autoAcknowledge?: boolean; focusOnly?: boolean; checkoutOnly?: boolean; embeddedCheckout?: boolean; issuedTotalPaise?: number; checkoutPayment?: CounterCheckoutPayment; preference?: CounterPaymentPreference; onInvoiceClose?: () => void; onCollected?: (receipt: CollectionReceipt) => void; onPendingChange?: (pending: boolean) => void };
export function PharmacyCollections(props: CollectionsProps) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CollectionSession key={`${scope}:${props.locationId}`} {...props} />;
}
function CollectionSession({ locationId, canCollect, canOpenTill = false, initialInvoiceId, autoAcknowledge = false, focusOnly = false, checkoutOnly = false, embeddedCheckout = false, issuedTotalPaise, checkoutPayment, preference, onInvoiceClose, onCollected, onPendingChange }: CollectionsProps) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-collection:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { pending: pendingReference(storageKey), error: "" }; } catch (failure) { return { pending: null, error: errorMessage(failure) }; } });
  const [pending, setPending] = useState(initial.pending), [receipt, setReceipt] = useState<CollectionReceipt | null>(null), [error, setError] = useState(initial.error);
  useEffect(() => { onPendingChange?.(Boolean(pending)); }, [onPendingChange, pending]);
  const [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [canCorrect, setCanCorrect] = useState(false);
  const frozen = useRef<{ invoiceId: string; input: CollectionInput; key: string } | null>(null), lock = useRef(false), alive = useRef(true);
  const automaticAttempted = useRef(false);
  const [detailNeeded, setDetailNeeded] = useState(Boolean(initial.pending));
  const automaticSend = useRef<(id: string, input: CollectionInput) => void>(() => {});
  const [journal] = useState(() => createCollectionJournal(scope, locationId)), [journalReady, setJournalReady] = useState(false);
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    void journal.load().then(saved => { if (!current()) return; if (saved.value && saved.value.key === initial.pending?.key && saved.value.invoiceId === initial.pending.invoiceId) { frozen.current = saved.value; setSubmitted(true); } setJournalReady(true); }).catch(failure => { if (current()) { setError(errorMessage(failure)); setJournalReady(true); } });
  }, [journal, initial.pending, current]);
  const [items, setItems] = useState<InvoiceSummary[]>([]), [cursor, setCursor] = useState<string | undefined>(), [next, setNext] = useState<string | null>(null), [loading, setLoading] = useState(true), [listError, setListError] = useState("");
  const [invoice, setInvoice] = useState<CounterInvoice | null>(null), [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setCursor(undefined); }, 250); return () => clearTimeout(timer); }, [search]);
  const listKey = JSON.stringify([query, status, cursor]);
  const [loadedListKey, setLoadedListKey] = useState("");
  const showList = !focusOnly && !checkoutOnly;
  const listBusy = loading || query !== search.trim() || loadedListKey !== listKey;
  const visibleItems = listBusy ? [] : items;
  const beginRead = useLatestRead(), beginDetail = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setListError(""); setItems([]);
    try { const page = await collectionInvoicePage(locationId, cursor, request.signal, { search: query, status }); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setListError(errorMessage(failure)); }
    finally { if (request.isCurrent()) { setLoadedListKey(listKey); setLoading(false); } }
  }, [beginRead, locationId, cursor, query, status, listKey]);
  useEffect(() => { if (!focusOnly && !checkoutOnly) void Promise.resolve().then(load); }, [load, refresh, focusOnly, checkoutOnly]);
  useEffect(() => {
    if (!initialInvoiceId || checkoutPayment && issuedTotalPaise !== undefined && !detailNeeded) return;
    const request = beginDetail();
    void readCounterInvoice(initialInvoiceId, locationId, request.signal).then(value => { if (request.isCurrent()) setInvoice(value); }).catch(failure => { if (request.isCurrent()) setError(errorMessage(failure)); });
  }, [initialInvoiceId, locationId, beginDetail, checkoutPayment, issuedTotalPaise, detailNeeded]);
  async function open(id: string) {
    const request = beginDetail(); setError("");
    try { const value = await readCounterInvoice(id, locationId, request.signal); if (request.isCurrent()) setInvoice(value); }
    catch (failure) { if (request.isCurrent()) setError(errorMessage(failure)); }
  }
  async function send(invoiceId: string, input: CollectionInput) {
    if (!current() || !journalReady || lock.current || !canCollect || receipt) return;
    lock.current = true; setBusy(true); setError(""); setCanCorrect(false);
    try {
      const stored = pendingReference(storageKey);
      if ((stored?.key || null) !== (pending?.key || null) || pending && pending.invoiceId !== invoiceId) throw new Error("Collection reference changed. Check its result before collecting again.");
      const ref = pending || { key: crypto.randomUUID(), invoiceId };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref));
      setPending(ref);
      const pinned = frozen.current || { invoiceId, input: JSON.parse(JSON.stringify(input)) as CollectionInput, key: ref.key };
      await journal.save(pinned); if (!current()) return;
      frozen.current = pinned; setSubmitted(true);
      const result = await submitPharmacyCollection(pinned.invoiceId, pinned.input, pinned.key);
      if (current()) accept(result);
    } catch (failure) { if (current()) { setDetailNeeded(true); setError(errorMessage(failure)); setCanCorrect([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await recoverPharmacyCollection(locationId, pending.key); if (result.invoiceId !== pending.invoiceId) throw new Error("Collection invoice reference needs review"); if (current()) accept(result); }
    catch (failure) { if (current()) setError(errorMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function accept(result: CollectionReceipt) {
    if (autoAcknowledge && result.invoiceId === initialInvoiceId) {
      if (pendingReference(storageKey)?.key !== result.requestKey) throw Error("Collection reference changed. Reopen the result.");
      sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {}); setPending(null); frozen.current = null; setSubmitted(false); onPendingChange?.(false);
    }
    setReceipt(result); setInvoice(null); onCollected?.(result);
  }
  usePharmacyReconnect(Boolean(pending && !receipt && !canCorrect), recover);
  function done() {
    if (!current() || busy || !pending || !receipt) return;
    try { if (pendingReference(storageKey)?.key !== receipt.requestKey) throw new Error("Collection reference changed. Reopen the result."); sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {}); setPending(null); setReceipt(null); setSubmitted(false); frozen.current = null; setError(""); setRefresh(value => value + 1); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { automaticSend.current = (id, input) => { void send(id, input); }; });
  useEffect(() => {
    if (!checkoutPayment || !initialInvoiceId || !invoice && issuedTotalPaise === undefined || !journalReady || !canCollect || pending || receipt || automaticAttempted.current) return;
    automaticAttempted.current = true;
    const input = issuedTotalPaise !== undefined ? prepareIssuedCheckoutPayment(locationId, issuedTotalPaise, checkoutPayment) : prepareCheckoutPayment(invoice!, checkoutPayment);
    if (input) automaticSend.current(initialInvoiceId, input);
    else void Promise.resolve().then(() => { setDetailNeeded(true); setError("The saved bill balance differs from the confirmed payment. Review payment below; no money has been recorded."); });
  }, [checkoutPayment, invoice, journalReady, canCollect, pending, receipt, initialInvoiceId, issuedTotalPaise, locationId]);
  const invoiceForm = invoice && !(checkoutPayment && !error && (!pending || pending.invoiceId === invoice.id)) && <PharmacyCollectionForm embedded={embeddedCheckout} key={`${invoice.id}:${invoice.paymentRevision}`} invoice={invoice} preference={invoice.id === initialInvoiceId ? preference : undefined} canOpenTill={canOpenTill} canCollect={journalReady && canCollect && !receipt && (!pending || pending.invoiceId === invoice.id) && !submitted} busy={busy} onClose={() => { setInvoice(null); onInvoiceClose?.(); }} onSubmit={input => { void send(invoice.id, input); }} />;
  if (focusOnly) return <section aria-label="Saved bill">{error && <Alert variant="error" title="Bill unavailable">{error}<Button onClick={onInvoiceClose}>Close</Button></Alert>}{invoiceForm}</section>;
  return <section className={styles.list} aria-label="Pharmacy sales and collections">
    {embeddedCheckout && !error && !receipt && <p role="status" className="text-sm text-text-secondary">{busy ? "Saving payment..." : "Checking saved bill..."}</p>}
    {!checkoutOnly && <header><h2>Sales & collections</h2><p>Open a saved bill to record payment or view its receipts. Confirm money received before recording a payment.</p></header>}
    {!initialInvoiceId && <details className="rounded-xl border border-border bg-surface px-4"><summary className="min-h-11 cursor-pointer py-3 text-sm text-text-secondary">Recover a sale using its original reference</summary><div className="pb-4"><PharmacySaleRecovery locationId={locationId} onOpen={id => { void open(id); }} /></div></details>}
    {error && <Alert variant="error" title="Collection needs attention">{error}</Alert>}
    {pending && !busy && <Alert variant={receipt ? "success" : "warning"} title={receipt ? "Collection confirmed" : "Pending collection"}>
      <p>Reference: {pending.key}</p>{receipt ? <><CollectionReceiptSummary receipt={receipt} /><Button size="sm" variant="outline" disabled={busy} onClick={() => { void open(receipt.invoiceId); }}>View saved bill and receipts</Button><Button size="sm" disabled={busy} onClick={done}>Done with collection</Button></> : <><p>Check this result before collecting again. Keep the same reference after reload.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void recover(); }}>Check collection result</Button>
        {submitted && canCollect && <Button size="sm" disabled={busy} onClick={() => { if (frozen.current) void send(frozen.current.invoiceId, frozen.current.input); }}>Retry same collection</Button>}
        {canCollect && (!submitted || canCorrect) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { frozen.current = null; setSubmitted(false); setCanCorrect(false); void open(pending.invoiceId); }}>Re-enter original collection</Button>}</>}
    </Alert>}
    {showList && <div aria-busy={listBusy}><Card contentClassName="gap-4">
      <Input type="search" aria-label="Search sales" icon={<Search size={17} aria-hidden="true" />} size="lg" placeholder="Find a sale by bill number or customer" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-2"><div role="group" aria-label="Payment status" className="flex gap-2">{[{ id: "all", label: "All" }, { id: "unpaid", label: "Unpaid" }, { id: "paid", label: "Paid" }].map(filter => <Button key={filter.id} size="sm" variant={status === filter.id ? "primary" : "outline"} className="rounded-full" aria-pressed={status === filter.id} onClick={() => { setStatus(filter.id); setCursor(undefined); }}>{filter.label}</Button>)}</div><p className="text-xs text-text-secondary">Newest first · This branch</p></div>
      {listBusy && <p role="status">Loading counter invoices...</p>}{listError && <Alert variant="error" title="Sales unavailable">{listError}<Button size="sm" onClick={() => setRefresh(value => value + 1)}>Retry sales</Button></Alert>}
      <div className="divide-y divide-border">{visibleItems.map(row => <article className="flex min-w-0 flex-wrap items-center gap-3 py-4" key={row.id}>
        <div className="min-w-0 flex-1 break-words"><strong className="text-sm font-semibold">{row.invoiceNumber}</strong><p className="mt-1 text-xs text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</p></div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3"><div className="space-y-1 text-right"><p className="text-sm font-semibold tabular-nums">{money(row.totalAmount)}</p><Badge variant={row.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(row.status) ? "warning" : "neutral"}>{row.status.replaceAll("_", " ")}</Badge></div><Button size="sm" variant={canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "primary" : "outline"} disabled={busy} aria-label={`${row.documentVersion === 3 ? "Open opening balance" : "Open sale"} ${row.invoiceNumber}`} onClick={() => { void open(row.id); }}>{row.documentVersion === 3 ? "Open balance" : canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "Collect" : "View bill"}</Button></div>
      </article>)}</div>
      {!listBusy && !listError && !visibleItems.length && <EmptyState icon={<ReceiptText aria-hidden="true" />} title={query || status !== "all" ? "No matching sales" : "No sales yet"} description={query || status !== "all" ? "Try another bill number, customer or payment filter." : "Saved invoices and their payment records will appear here."} className="py-5" />}
    </Card></div>}
    {showList && <div className={styles.actions}>{cursor && <Button size="sm" variant="outline" disabled={listBusy} onClick={() => setCursor(undefined)}>First sales page</Button>}{next && <Button size="sm" variant="outline" disabled={listBusy} onClick={() => setCursor(next)}>Next sales page</Button>}</div>}
    {invoiceForm}
  </section>;
}
