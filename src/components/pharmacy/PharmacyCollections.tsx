"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, DatePicker, Input, Modal, Spinner, Table, Tabs, cn } from "@/components/ui";
import { Camera, Filter, Search } from "lucide-react";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import { PharmacyDetailLoadingSheet } from "./PharmacyDetailLoader";
import { localDateKey } from "@/lib/date";
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
export function PharmacyCollections(props: CollectionsProps & { onNewSale?: () => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CollectionSession key={`${scope}:${props.locationId}`} {...props} />;
}
function CollectionSession({ locationId, canCollect, canOpenTill = false, initialInvoiceId, autoAcknowledge = false, focusOnly = false, checkoutOnly = false, embeddedCheckout = false, issuedTotalPaise, checkoutPayment, preference, onInvoiceClose, onCollected, onPendingChange, onNewSale }: CollectionsProps & { onNewSale?: () => void }) {
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
  const [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState("");
  const [detailPreview, setDetailPreview] = useState<{ id: string; invoiceNumber?: string; customerName?: string } | null>(null);
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => localDateKey()), [endDate, setEndDate] = useState(() => localDateKey()), [dateError, setDateError] = useState("");
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
  function closeDetail() {
    beginDetail();
    setDetailLoading(false);
    setDetailPreview(null);
    setDetailError("");
    setInvoice(null);
    onInvoiceClose?.();
  }
  async function open(id: string, preview?: InvoiceSummary) {
    const request = beginDetail();
    setError(""); setDetailError(""); setInvoice(null);
    setDetailPreview(preview ? { id, invoiceNumber: preview.invoiceNumber, customerName: preview.customerSnapshot?.anonymous ? "Walk-in customer" : preview.customerSnapshot?.name } : { id });
    setDetailLoading(true);
    try { const value = await readCounterInvoice(id, locationId, request.signal); if (request.isCurrent()) { setInvoice(value); setDetailPreview(null); } }
    catch (failure) { if (request.isCurrent()) { const message = errorMessage(failure); setDetailError(message); if (focusOnly) setError(message); } }
    finally { if (request.isCurrent()) setDetailLoading(false); }
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
    } catch (failure) { if (current()) { const status = (failure as { response?: { status?: number } })?.response?.status || 0; setDetailNeeded(true); setError(errorMessage(failure)); setCanCorrect(status >= 400 && status < 500 && status !== 429); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover(background = false) {
    if (!current() || lock.current || !pending) return;
    lock.current = true; setBusy(true); if (!background) setError("");
    try { const result = await recoverPharmacyCollection(locationId, pending.key); if (result.invoiceId !== pending.invoiceId) throw new Error("Collection invoice reference needs review"); if (current()) accept(result); }
    catch (failure) {
      if (current()) {
        const status = (failure as { response?: { status?: number } })?.response?.status || 0;
        if (status === 404) setCanCorrect(true);
        if (!background || status === 404) setError(previous => background && previous ? previous : errorMessage(failure));
      }
    }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function accept(result: CollectionReceipt) {
    if (autoAcknowledge && result.invoiceId === initialInvoiceId) {
      if (pendingReference(storageKey)?.key !== result.requestKey) throw Error("Collection reference changed. Reopen the result.");
      sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {}); setPending(null); frozen.current = null; setSubmitted(false); onPendingChange?.(false);
    }
    setReceipt(result); setInvoice(null); onCollected?.(result);
  }
  usePharmacyReconnect(Boolean(pending && !receipt && !canCorrect), () => recover(true));
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
  const awaitingInitialBill = Boolean(initialInvoiceId && !invoice && !error && !embeddedCheckout && !(checkoutPayment && issuedTotalPaise !== undefined && !detailNeeded));
  const loadingBillSheet = (
    <PharmacyDetailLoadingSheet
      open={!embeddedCheckout && !invoice && (detailLoading || (!focusOnly && Boolean(detailError)) || awaitingInitialBill)}
      title={detailPreview?.invoiceNumber || "Loading bill"}
      description={detailPreview?.customerName}
      label="Loading bill details..."
      error={!focusOnly && !detailLoading ? detailError : ""}
      errorTitle="Could not open bill"
      onRetry={detailPreview?.id && !detailLoading && detailError ? () => { void open(detailPreview.id); } : undefined}
      onClose={closeDetail}
    />
  );
  const invoiceForm = invoice && !(checkoutPayment && !error && (!pending || pending.invoiceId === invoice.id)) && <PharmacyCollectionForm embedded={embeddedCheckout} key={`${invoice.id}:${invoice.paymentRevision}`} invoice={invoice} preference={invoice.id === initialInvoiceId ? preference : undefined} canOpenTill={canOpenTill} canCollect={journalReady && canCollect && !receipt && (!pending || pending.invoiceId === invoice.id) && !submitted} busy={busy} onClose={closeDetail} onProviderCollected={!pending && canCollect ? result => { if (!current() || result.invoiceId !== invoice.id) return; onCollected?.(result); setRefresh(value => value + 1); void open(invoice.id); } : undefined} onSubmit={input => { void send(invoice.id, input); }} />;
  // Dialog-only callers must not add a grid/flex item to the counter behind the portal.
  if (focusOnly) return <>{error && <Modal open title="Bill unavailable" onClose={() => { setError(""); onInvoiceClose?.(); }}><Alert variant="error" title="Could not open bill">{error}</Alert></Modal>}{loadingBillSheet}{invoiceForm}</>;
  return <section className={cn(styles.list, "gap-3")} data-sales-list={showList || undefined} aria-label="Pharmacy sales and collections">
    {embeddedCheckout && !error && !receipt && <p role="status" className="inline-flex items-center gap-2 text-sm text-text-secondary"><Spinner size="xs" /><span>{busy ? "Saving payment..." : "Checking saved bill..."}</span></p>}


    {error && <Alert variant="error" title="Collection needs attention">{error}</Alert>}
    {pending && !busy && <Alert variant={receipt ? "success" : "warning"} title={receipt ? "Collection confirmed" : "Pending collection"}>
      <p>Reference: {pending.key}</p>{receipt ? <><CollectionReceiptSummary receipt={receipt} /><Button size="sm" variant="outline" disabled={busy} onClick={() => { void open(receipt.invoiceId); }}>View saved bill and receipts</Button><Button size="sm" disabled={busy} onClick={done}>Done with collection</Button></> : <><p>Check this result before collecting again. Keep the same reference after reload.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void recover(); }}>Check collection result</Button>
        {submitted && canCollect && <Button size="sm" disabled={busy} onClick={() => { if (frozen.current) void send(frozen.current.invoiceId, frozen.current.input); }}>Retry same collection</Button>}
        {canCollect && (!submitted || canCorrect) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const invoiceId = pending.invoiceId; if (canCorrect) { try { if (pendingReference(storageKey)?.key === pending.key) sessionStorage.removeItem(storageKey); } catch { /* Keep the original key if storage fails. */ } void journal.save(null).catch(() => {}); setPending(null); } frozen.current = null; setSubmitted(false); setCanCorrect(false); void open(invoiceId); }}>Re-enter original collection</Button>}</>}
    </Alert>}
    {showList && <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2 md:px-4 md:py-3">
        <h1 className="text-sm font-semibold text-text md:text-base">Sales & collections</h1>
        <div className="flex shrink-0 items-center gap-2">{!initialInvoiceId && <Button size="xs" variant="ghost" onClick={() => setRecoveryOpen(true)}>Recover sale</Button>}{onNewSale && <div className="hidden md:block"><Button size="xs" onClick={onNewSale}>New counter sale</Button></div>}</div>
      </div>
      <div aria-label="Payment status"><Tabs fullWidth variant="underline" scrollActiveIntoView={false} activeTab={status} onChange={value => { setStatus(value); setCursor(undefined); }} tabs={[{ id: "all", label: "All" }, { id: "unpaid", label: "Unpaid" }, { id: "paid", label: "Paid" }]} /></div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-2 border-b border-border/60 p-3 md:grid-cols-[minmax(200px,1fr)_auto_auto] md:px-4">
        <Input type="search" aria-label="Search sales" icon={<Search size={15} aria-hidden="true" />} size="sm" containerClassName="min-w-0" placeholder="Bill number, customer or barcode" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />
        <Button type="button" size="sm" variant="outline" aria-label="Scan barcode in sales" title="Scan barcode with camera" onClick={() => setScanOpen(true)}><Camera size={15} aria-hidden="true" /></Button>
        <div className="md:hidden"><Button size="sm" variant="outline" aria-expanded={filtersOpen} aria-controls="sales-date-filter" aria-label="Show filters" icon={<Filter size={15} aria-hidden="true" />} onClick={() => setFiltersOpen(open => !open)} /></div>
        <form id="sales-date-filter" aria-label="Sales date filter" className={cn("col-span-2 min-w-0 items-center gap-2 md:col-span-1 md:flex", filtersOpen ? "flex flex-wrap" : "hidden")} onSubmit={event => { event.preventDefault(); applyDates(); }}>
          <DatePicker label="Sale dates" className="[&_label]:sr-only" mode="range" size="sm" startDate={startDate} endDate={endDate} minDate="2000-01-01" maxDate="2199-12-31" placeholder="Date range" onRangeChange={range => { setStartDate(range.startDate); setEndDate(range.endDate); }} />
          <div className="flex shrink-0 gap-2"><Button size="xs" type="submit">Apply</Button><Button size="xs" variant="outline" onClick={() => { beginRead(); setStartDate(localDateKey()); setEndDate(localDateKey()); setPeriod(null); setCursor(undefined); setDateError(""); setRefresh(value => value + 1); }}>Clear</Button></div>
          <p className="sr-only">Both dates include the full day at this branch{!listBusy && timezone ? ` (${timezone})` : ""}. Search and payment filters still apply.</p>
          {dateError && <p role="alert" className="col-span-2 text-xs text-error sm:col-span-3">{dateError}</p>}
        </form>
      </div>

      {listError && <Alert variant="error" title="Sales unavailable">{listError}<Button size="sm" onClick={() => setRefresh(value => value + 1)}>Retry sales</Button></Alert>}
      <Table<InvoiceSummary> caption="Pharmacy sales" data={visibleItems} loading={listBusy || loadingMore} hasMore={Boolean(next)} onLoadMore={loadMore} variant="flat" density="compact" fitContent searchable={false} pagination defaultRowsPerPage={10} rowsPerPageOptions={[10]} showColumnVisibility={false} mobileCardView mobileLayout="list"
        mobilePaginationAction={onNewSale && <Button size="sm" fullWidth onClick={onNewSale}>New counter sale</Button>}
        renderPageSummary={(rows, count) => <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-xs text-text-secondary md:px-4"><span>{rows.length} of {count}{next ? "+" : ""} bills</span><span>Page total <strong className="font-semibold tabular-nums text-text">{money(rows.reduce((sum, row) => sum + row.totalAmount, 0))}</strong></span></div>}
        emptyMessage={query || status !== "all" || period ? "No matching sales" : "No sales yet"}
        className="rounded-lg [&_th:nth-child(2)]:hidden [&_td:nth-child(2)]:hidden [&_th:nth-child(4)]:hidden [&_td:nth-child(4)]:hidden md:[&_th:nth-child(2)]:table-cell md:[&_td:nth-child(2)]:table-cell md:[&_th:nth-child(4)]:table-cell md:[&_td:nth-child(4)]:table-cell"
        columns={[
          { key: "bill", header: "Bill", width: "28%", render: row => <div className="min-w-0"><strong className="block break-all text-xs font-semibold">{row.invoiceNumber}</strong>{row.documentVersion === 3 && <span className="block text-xs text-text-secondary">Opening balance</span>}<p className="mt-1 break-words text-xs text-text-secondary md:hidden">{row.customerSnapshot?.name || "Walk-in customer"}</p><div className="mt-1 md:hidden"><Badge variant={row.status === "paid" ? "success" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge></div></div> },
          { key: "customer", header: "Customer", render: row => <span className="break-words text-xs text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</span> },
          { key: "total", header: "Total", width: "120px", align: "right", render: row => <span className="break-all text-xs font-semibold tabular-nums">{money(row.totalAmount)}</span> },
          { key: "status", header: "Status", width: "110px", align: "center", render: row => <Badge variant={row.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(row.status) ? "warning" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge> },
          { key: "actions", header: "", width: "90px", align: "right", render: row => <Button size="sm" variant={canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "primary" : "outline"} disabled={busy} aria-label={`${row.documentVersion === 3 ? "Open opening balance" : "Open sale"} ${row.invoiceNumber}`} onClick={() => { void open(row.id, row); }}>{canCollect && ["unpaid", "partially_paid"].includes(row.status) ? "Collect" : "View"}</Button> },
        ]} renderMobileCard={row => <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring" disabled={busy} onClick={() => { void open(row.id, row); }}><span className="min-w-0"><strong className="block break-all text-xs font-semibold text-text">{row.invoiceNumber}</strong><span className="block truncate text-[11px] text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</span></span><span className="shrink-0 text-right"><strong className="block text-xs tabular-nums">{money(row.totalAmount)}</strong><Badge variant={row.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(row.status) ? "warning" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge></span></button>} />
    </Card>}

    {recoveryOpen && <Modal open title="Recover sale" description="Find a saved sale using its original counter reference." onClose={() => setRecoveryOpen(false)} size="md"><PharmacySaleRecovery locationId={locationId} onOpen={id => { setRecoveryOpen(false); void open(id); }} /></Modal>}
    {loadingBillSheet}
    {invoiceForm}
    <PharmacyBarcodeScanDialog
      open={scanOpen}
      title="Scan product barcode to find bills"
      onClose={() => setScanOpen(false)}
      onDetected={code => {
        setSearch(code);
        setQuery(code);
        setCursor(undefined);
      }}
    />
  </section>;
}
