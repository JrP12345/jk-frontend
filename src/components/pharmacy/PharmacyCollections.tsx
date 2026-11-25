"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, DatePicker, Input, Modal, Table, Tabs, cn } from "@/components/ui";
import { Search } from "lucide-react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [invoice, setInvoice] = useState<CounterInvoice | null>(null), [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState(""), [dateError, setDateError] = useState("");
  const [period, setPeriod] = useState<{ startDate: string; endDate: string } | null>(null), [timezone, setTimezone] = useState("");
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setCursor(undefined); }, 250); return () => clearTimeout(timer); }, [search]);
  const listKey = JSON.stringify([query, status, cursor, period]);
  const [loadedListKey, setLoadedListKey] = useState("");
  const showList = !focusOnly && !checkoutOnly;
  const listBusy = loading || query !== search.trim() || loadedListKey !== listKey;
  const visibleItems = listBusy ? [] : items;
  const beginRead = useLatestRead(), beginDetail = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setListError(""); setItems([]);
    try { const page = await collectionInvoicePage(locationId, cursor, request.signal, { search: query, status, ...period }); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); setTimezone(page.period?.timezone || ""); } }
    catch (failure) { if (request.isCurrent()) setListError(errorMessage(failure)); }
    finally { if (request.isCurrent()) { setLoadedListKey(listKey); setLoading(false); } }
  }, [beginRead, locationId, cursor, query, status, period, listKey]);
  async function loadMore() {
    if (!next || loadingMore) return false;
    const request = beginRead(); setLoadingMore(true); setListError("");
    try { const page = await collectionInvoicePage(locationId, next, request.signal, { search: query, status, ...period }); if (!request.isCurrent()) return false; setItems(previous => [...previous, ...page.items.filter(row => !previous.some(existing => existing.id === row.id))]); setNext(page.nextCursor); return true; }
    catch (failure) { if (request.isCurrent()) setListError(errorMessage(failure)); return false; }
    finally { setLoadingMore(false); }
  }
  function applyDates() {
    if (!startDate || !endDate) { setDateError("Choose both sale dates, or clear the date filter."); return; }
    const valid = (value: string) => { const date = new Date(`${value}T12:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2000-01-01" && value <= "2199-12-31" && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
    if (!valid(startDate) || !valid(endDate) || startDate > endDate) { setDateError("Choose valid dates with the start on or before the end."); return; }
    beginRead(); setCursor(undefined); setDateError(""); setPeriod({ startDate, endDate });
  }
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
  const invoiceForm = invoice && !(checkoutPayment && !error && (!pending || pending.invoiceId === invoice.id)) && <PharmacyCollectionForm embedded={embeddedCheckout} key={`${invoice.id}:${invoice.paymentRevision}`} invoice={invoice} preference={invoice.id === initialInvoiceId ? preference : undefined} canOpenTill={canOpenTill} canCollect={journalReady && canCollect && !receipt && (!pending || pending.invoiceId === invoice.id) && !submitted} busy={busy} onClose={() => { setInvoice(null); onInvoiceClose?.(); }} onProviderCollected={!pending && canCollect ? result => { if (!current() || result.invoiceId !== invoice.id) return; onCollected?.(result); setRefresh(value => value + 1); void open(invoice.id); } : undefined} onSubmit={input => { void send(invoice.id, input); }} />;
  // Dialog-only callers must not add a grid/flex item to the counter behind the portal.
  if (focusOnly) return <>{error && <Modal open title="Bill unavailable" onClose={() => { setError(""); onInvoiceClose?.(); }}><Alert variant="error" title="Could not open bill">{error}</Alert></Modal>}{invoiceForm}</>;
  return <section className={cn(styles.list, "gap-3")} aria-label="Pharmacy sales and collections">
    {embeddedCheckout && !error && !receipt && <p role="status" className="text-sm text-text-secondary">{busy ? "Saving payment..." : "Checking saved bill..."}</p>}


    {error && <Alert variant="error" title="Collection needs attention">{error}</Alert>}
    {pending && !busy && <Alert variant={receipt ? "success" : "warning"} title={receipt ? "Collection confirmed" : "Pending collection"}>
      <p>Reference: {pending.key}</p>{receipt ? <><CollectionReceiptSummary receipt={receipt} /><Button size="sm" variant="outline" disabled={busy} onClick={() => { void open(receipt.invoiceId); }}>View saved bill and receipts</Button><Button size="sm" disabled={busy} onClick={done}>Done with collection</Button></> : <><p>Check this result before collecting again. Keep the same reference after reload.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void recover(); }}>Check collection result</Button>
        {submitted && canCollect && <Button size="sm" disabled={busy} onClick={() => { if (frozen.current) void send(frozen.current.invoiceId, frozen.current.input); }}>Retry same collection</Button>}
        {canCollect && (!submitted || canCorrect) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { frozen.current = null; setSubmitted(false); setCanCorrect(false); void open(pending.invoiceId); }}>Re-enter original collection</Button>}</>}
    </Alert>}
    {showList && <Card padding="sm" className="rounded-xl shadow-none" contentClassName="gap-3">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end">
        <Input label="Search bills" type="search" aria-label="Search sales" icon={<Search size={16} aria-hidden="true" />} size="sm" containerClassName="min-w-0 xl:w-72 xl:shrink-0" placeholder="Bill number or customer" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />
        <form aria-label="Sales date filter" className="grid min-w-0 grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(140px,180px)_minmax(140px,180px)_auto]" onSubmit={event => { event.preventDefault(); applyDates(); }}>
          <DatePicker size="sm" label="From" value={startDate} minDate="2000-01-01" maxDate="2199-12-31" onChange={setStartDate} />
          <DatePicker size="sm" label="To" value={endDate} minDate="2000-01-01" maxDate="2199-12-31" onChange={setEndDate} />
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1"><Button size="sm" type="submit">Apply</Button><Button size="sm" variant="outline" onClick={() => { beginRead(); setStartDate(""); setEndDate(""); setPeriod(null); setCursor(undefined); setDateError(""); setRefresh(value => value + 1); }}>Clear</Button></div>
          <p className="sr-only">Both dates include the full day at this branch{!listBusy && timezone ? ` (${timezone})` : ""}. Search and payment filters still apply.</p>
          {dateError && <p role="alert" className="col-span-2 text-xs text-error sm:col-span-3">{dateError}</p>}
        </form>
        {!initialInvoiceId && <Button size="sm" variant="ghost" className="self-start xl:ml-auto xl:self-end" onClick={() => setRecoveryOpen(true)}>Recover sale</Button>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div aria-label="Payment status" className="min-w-0"><Tabs variant="pills" scrollActiveIntoView={false} activeTab={status} onChange={value => { setStatus(value); setCursor(undefined); }} tabs={[{ id: "all", label: "All" }, { id: "unpaid", label: "Unpaid" }, { id: "paid", label: "Paid" }]} /></div>

      </div>
      {listError && <Alert variant="error" title="Sales unavailable">{listError}<Button size="sm" onClick={() => setRefresh(value => value + 1)}>Retry sales</Button></Alert>}
      <Table<InvoiceSummary> caption="Pharmacy sales" data={visibleItems} loading={listBusy || loadingMore} hasMore={Boolean(next)} onLoadMore={loadMore} variant="flat" density="compact" fitContent searchable={false} pagination defaultRowsPerPage={10} rowsPerPageOptions={[10]} showColumnVisibility={false} mobileCardView={false}
        emptyMessage={query || status !== "all" || period ? "No matching sales" : "No sales yet"}
        className="rounded-lg [&_th:nth-child(2)]:hidden [&_td:nth-child(2)]:hidden [&_th:nth-child(4)]:hidden [&_td:nth-child(4)]:hidden md:[&_th:nth-child(2)]:table-cell md:[&_td:nth-child(2)]:table-cell md:[&_th:nth-child(4)]:table-cell md:[&_td:nth-child(4)]:table-cell"
        columns={[
          { key: "bill", header: "Bill", width: "28%", render: row => <div className="min-w-0"><strong className="block break-all text-xs font-semibold">{row.invoiceNumber}</strong>{row.documentVersion === 3 && <span className="block text-xs text-text-secondary">Opening balance</span>}<p className="mt-1 break-words text-xs text-text-secondary md:hidden">{row.customerSnapshot?.name || "Walk-in customer"}</p><div className="mt-1 md:hidden"><Badge variant={row.status === "paid" ? "success" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge></div></div> },
          { key: "customer", header: "Customer", render: row => <span className="break-words text-xs text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</span> },
          { key: "total", header: "Total", width: "120px", align: "right", render: row => <span className="break-all text-xs font-semibold tabular-nums">{money(row.totalAmount)}</span> },
          { key: "status", header: "Status", width: "110px", align: "center", render: row => <Badge variant={row.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(row.status) ? "warning" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge> },
          { key: "actions", header: "", width: "90px", align: "right", render: row => <Button size="sm" variant={canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "primary" : "outline"} disabled={busy} aria-label={`${row.documentVersion === 3 ? "Open opening balance" : "Open sale"} ${row.invoiceNumber}`} onClick={() => { void open(row.id); }}>{canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "Collect" : "View"}</Button> },
        ]} />
    </Card>}

    {recoveryOpen && <Modal open title="Recover sale" onClose={() => setRecoveryOpen(false)} size="md"><PharmacySaleRecovery locationId={locationId} onOpen={id => { setRecoveryOpen(false); void open(id); }} /></Modal>}
    {invoiceForm}
  </section>;
}
