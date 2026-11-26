"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, ArrowRight, Info } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Select, Checkbox, Modal, Spinner, Table } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { returnInvoicePage, readReturnSource, previewReturn, submitReturn, recoverReturn, type ReturnSource, type ReturnQuote, type ReturnCommit, type ReturnResult } from "@/lib/pharmacyReturns";
import type { InvoiceSummary } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";
import { PharmacyReturnDocumentButton } from "./PharmacyReturnDocumentButton";

const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Return could not be confirmed. Keep the same reference.");
type Reference = { key: string; invoiceId: string };
function readReference(storageKey: string): Reference | null { const value = sessionStorage.getItem(storageKey); if (!value) return null; const ref = JSON.parse(value); if (!ref || !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) || typeof ref.invoiceId !== "string" || !ref.invoiceId) throw new Error("Return reference requires review before another posting"); return ref; }
export function PharmacyReturns(props: { initialInvoiceId?: string; locationId: string; canProcess: boolean; canApprove: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user)); return <ReturnSession key={`${scope}:${props.locationId}`} {...props} />;
}
function ReturnSession({ initialInvoiceId, locationId, canProcess, canApprove }: { initialInvoiceId?: string; locationId: string; canProcess: boolean; canApprove: boolean }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-return:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { ref: readReference(storageKey), error: "" }; } catch (failure) { return { ref: null, error: message(failure) }; } });
  const [pending, setPending] = useState(initial.ref), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [result, setResult] = useState<ReturnResult | null>(null), [correctable, setCorrectable] = useState(false);
  const [items, setItems] = useState<InvoiceSummary[]>([]), [next, setNext] = useState<string | null>(null), [search, setSearch] = useState(""), [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [listVersion, setListVersion] = useState(0), [query, setQuery] = useState("");
  const [detailLoading, setDetailLoading] = useState(false), [reviewingCredit, setReviewingCredit] = useState(false);
  const [source, setSource] = useState<ReturnSource | null>(null), [quote, setQuote] = useState<ReturnQuote | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({}), [conditions, setConditions] = useState<Record<string, string>>({}), [reason, setReason] = useState(""), [review, setReview] = useState(""), [quarantine, setQuarantine] = useState(false);
  const alive = useRef(true), lock = useRef(false), revision = useRef(0), frozen = useRef<{ input: ReturnCommit; invoiceId: string; key: string } | null>(null);
  const beginList = useLatestRead(), beginDetail = useLatestRead(), beginQuote = useLatestRead();
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async (number = "") => {
    const request = beginList(); setListError(""); setListLoading(true); setLoadingMore(false); setItems([]); setNext(null); setQuery(number.trim());
    try { if (!locationId) return; const page = await returnInvoicePage(locationId, number, undefined, request.signal); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); setListVersion(value => value + 1); } }
    catch (failure) { if (request.isCurrent()) setListError(message(failure)); }
    finally { if (request.isCurrent()) setListLoading(false); }
  }, [beginList, locationId]);
  async function loadMore() {
    if (!next || listLoading || loadingMore) return false;
    const request = beginList(); setLoadingMore(true); setListError("");
    try { const page = await returnInvoicePage(locationId, query, next, request.signal); if (!request.isCurrent()) return false; setItems(previous => [...previous, ...page.items.filter(row => !previous.some(existing => existing.id === row.id))]); setNext(page.nextCursor); return true; }
    catch (failure) { if (request.isCurrent()) setListError(message(failure)); return false; }
    finally { if (request.isCurrent()) setLoadingMore(false); }
  }
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const firstInvoice = useRef(false);
  useEffect(() => { if (!initialInvoiceId || firstInvoice.current || pending && pending.invoiceId !== initialInvoiceId) return; firstInvoice.current = true; const request = beginDetail(); setDetailLoading(true); void readReturnSource(initialInvoiceId, locationId, request.signal).then(value => { if (request.isCurrent()) { setSource(value); setQuantities({}); setConditions({}); setQuarantine(false); setReason("Parcel cancelled or not collected"); } }).catch(e => { if (request.isCurrent()) setError(message(e)); }).finally(() => { if (request.isCurrent()) setDetailLoading(false); }); }, [initialInvoiceId, locationId, pending, beginDetail]);
  function invalidate() { revision.current++; beginQuote(); setReviewingCredit(false); setQuote(null); setError(""); }
  function closeSource() { if (busy) return; beginDetail(); beginQuote(); revision.current++; setDetailLoading(false); setReviewingCredit(false); setSource(null); setQuote(null); }
  async function open(id: string, correction = false) { if (busy || submitted && !correction || pending && pending.invoiceId !== id) return; const request = beginDetail(); invalidate(); setSource(null); setDetailLoading(true); try { const value = await readReturnSource(id, locationId, request.signal); if (request.isCurrent()) { setSource(value); setQuantities({}); setConditions({}); setQuarantine(false); setReason(""); setReview(""); } } catch (failure) { if (request.isCurrent()) setError(message(failure)); } finally { if (request.isCurrent()) setDetailLoading(false); } }
  async function preview() {
    if (!source || !canProcess || busy || submitted || reviewingCredit) return; const request = beginQuote(), version = revision.current; setError(""); setQuote(null); setReviewingCredit(true);
    try {
      const lines = source.lines.filter(line => quantities[`${line.sourceLineId}:${line.sourceBatchId}`] && quantities[`${line.sourceLineId}:${line.sourceBatchId}`] !== "0").map(line => { const id = `${line.sourceLineId}:${line.sourceBatchId}`, value = quantities[id]; if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0 || Number(value) > line.remainingQuantity) throw new Error("Use positive whole quantities within the remaining sold lots."); return { sourceLineId: line.sourceLineId, sourceBatchId: line.sourceBatchId, quantity: Number(value), condition: conditions[id] || "unknown" }; });
      if (!lines.length || !quarantine || reason.trim().length < 3 || review.trim().length < 3) throw new Error("Select returned quantities and record actual reason, condition/approval reference and physical quarantine.");
      const value = await previewReturn(source.invoiceId, { locationId, lines, reason: reason.trim(), reviewReference: review.trim(), confirmedQuarantine: true }, request.signal);
      if (request.isCurrent() && version === revision.current) setQuote(value);
    } catch (failure) { if (request.isCurrent() && version === revision.current) setError(message(failure)); }
    finally { if (request.isCurrent()) setReviewingCredit(false); }
  }
  async function post(retry = false) {
    if (!current() || lock.current || !canProcess || !canApprove || result || !retry && (!quote || !source)) return;
    lock.current = true; setBusy(true); setError(""); setCorrectable(false); revision.current++;
    try {
      const stored = readReference(storageKey); if ((stored?.key || null) !== (pending?.key || null)) throw new Error("Return reference changed. Check it before another posting.");
      const ref = pending || { key: crypto.randomUUID(), invoiceId: source!.invoiceId }; if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref)); setPending(ref);
      const pinned = frozen.current || { input: JSON.parse(JSON.stringify(quote!.issueInput)) as ReturnCommit, invoiceId: ref.invoiceId, key: ref.key }; frozen.current = pinned; setSubmitted(true);
      const value = await submitReturn(pinned.invoiceId, pinned.input, pinned.key); if (current()) { setResult(value); setSource(null); setQuote(null); }
    } catch (failure) { if (current()) { setError(message(failure)); setCorrectable([400, 409].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() { if (!current() || lock.current || !pending) return; lock.current = true; setBusy(true); setError(""); revision.current++; try { const value = await recoverReturn(locationId, pending.key); if (value.invoiceId !== pending.invoiceId) throw new Error("Recovered return invoice needs review"); if (current()) { setResult(value); setSource(null); setQuote(null); } } catch (failure) { if (current()) setError(message(failure)); } finally { lock.current = false; if (current()) setBusy(false); } }
  function done() { if (!result || busy) return; try { if (readReference(storageKey)?.key !== result.requestKey) throw new Error("Return reference changed; recover the saved result"); sessionStorage.removeItem(storageKey); setPending(null); setResult(null); setSubmitted(false); setSource(null); setReason(""); setReview(""); frozen.current = null; setError(""); void load(); } catch (failure) { setError(message(failure)); } }
  const editable = canProcess && !submitted && !result && !busy;
  const recovery = pending && <Alert variant={result ? "success" : "warning"} title={result ? "Return committed" : "Pending return"}>
    {result ? <div className="space-y-3"><p className="text-xs font-medium">Credit note {result.creditNoteNumber}</p><dl className="grid grid-cols-3 gap-3 text-xs">{[{ label: "Credit", value: result.creditedPaise }, { label: "Remaining due", value: result.balancePaise }, { label: "Refund payable", value: result.refundPayablePaise }].map(item => <div key={item.label}><dt>{item.label}</dt><dd className="mt-1 font-semibold tabular-nums">{money(item.value / 100)}</dd></div>)}</dl><p className="text-xs">Returned goods are quarantined. Refund payouts are recorded separately. Tax adjustment needs professional review.</p><div className="flex flex-wrap items-center gap-2"><PharmacyReturnDocumentButton returnId={result.returnId} creditNoteNumber={result.creditNoteNumber} locationId={locationId} /><Button size="xs" aria-label="Done with return" disabled={busy} onClick={done}>New return</Button></div></div> : <div className="space-y-2"><p className="break-all text-xs">Reference {pending.key}</p><div className="flex flex-wrap gap-2"><Button size="xs" disabled={busy} onClick={() => { void recover(); }}>Check return result</Button>{submitted && <Button size="xs" disabled={busy || !canApprove} onClick={() => { void post(true); }}>Retry same return</Button>}{(!submitted || correctable) && <Button size="xs" disabled={busy} variant="outline" onClick={() => { frozen.current = null; setSubmitted(false); setCorrectable(false); void open(pending.invoiceId, true); }}>Review original return</Button>}</div></div>}
  </Alert>;
  const reviewDisabled = (row: InvoiceSummary) => busy || detailLoading || submitted || Boolean(pending && pending.invoiceId !== row.id);
  const status = (row: InvoiceSummary) => row.status ? <Badge variant={row.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(row.status) ? "warning" : "neutral"}>{row.status === "partially_paid" ? "Part paid" : row.status.replaceAll("_", " ")}</Badge> : <span className="text-xs text-text-secondary">Not recorded</span>;
  return <section className="min-w-0 space-y-3" aria-label="Pharmacy sales returns">
    {!source && !detailLoading && <>{error && <Alert variant="error" title="Return needs attention">{error}</Alert>}{recovery}</>}
    <Card padding="none" className="shadow-none" contentClassName="gap-0">
      <header className="border-b border-border/70 px-3 py-3 md:px-4"><h2 className="text-sm font-semibold text-text md:text-base">Sales returns</h2><p className="mt-1 text-xs text-text-secondary">Find the original bill to review returned items and credit.</p></header>
      <form className="flex items-end gap-2 border-b border-border/60 p-3 md:px-4" onSubmit={event => { event.preventDefault(); void load(search); }}>
        <div className="min-w-0 flex-1 md:max-w-sm"><Input size="sm" label="Bill number" aria-label="Find return invoice number" icon={<Search size={15} aria-hidden="true" />} placeholder="Search by bill number" value={search} onChange={event => setSearch(event.target.value)} maxLength={50} /></div><Button size="xs" type="submit" aria-label="Find return invoice" disabled={listLoading || loadingMore}>Find</Button>
        {query && <Button size="xs" variant="ghost" disabled={listLoading || loadingMore} onClick={() => { setSearch(""); void load(); }}>Clear</Button>}
      </form>
      <Table<InvoiceSummary> key={listVersion} caption="Return invoices" variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination defaultRowsPerPage={10} rowsPerPageOptions={[10]} data={items} loading={listLoading || loadingMore} error={listError} onRetry={() => { void load(query); }} hasMore={Boolean(next)} onLoadMore={loadMore} mobileLayout="list"
        columns={[
          { key: "invoiceNumber", header: "Bill", render: row => <span className="text-xs font-medium text-text">{row.invoiceNumber}</span> },
          { key: "customer", header: "Customer", render: row => <span className="text-xs text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</span> },
          { key: "totalAmount", header: "Bill total", align: "right", render: row => <span className="text-xs tabular-nums">{money(row.totalAmount)}</span> },
          { key: "status", header: "Payment", render: status },
          { key: "actions", header: "", align: "right", render: row => <Button size="xs" variant="outline" aria-label={`Review return ${row.invoiceNumber}`} disabled={reviewDisabled(row)} onClick={() => { void open(row.id); }}>Review</Button> },
        ]}
        renderMobileCard={row => <button type="button" aria-label={`Review return ${row.invoiceNumber}`} disabled={reviewDisabled(row)} onClick={() => { void open(row.id); }} className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"><span className="min-w-0 flex-1"><strong className="block break-all text-xs font-semibold text-text">{row.invoiceNumber}</strong><span className="mt-0.5 block truncate text-[11px] text-text-secondary">{row.customerSnapshot?.name || "Walk-in customer"}</span></span><span className="shrink-0 text-right"><strong className="mb-1 block text-xs tabular-nums">{money(row.totalAmount)}</strong>{status(row)}</span><ArrowRight size={14} className="shrink-0 text-text-secondary" aria-hidden="true" /></button>}
        emptyMessage={!locationId ? "Choose a location to review returns." : query ? "No bills match this number." : "No bills available for return review."} />
      <p className="flex items-start gap-1.5 border-t border-border/60 px-3 py-2 text-[11px] text-text-secondary md:px-4"><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />Returns go into quarantine. Credit notes and refund payments are recorded separately.</p>
    </Card>
    <Modal open={Boolean(source || detailLoading)} title={source ? `Return ${source.invoiceNumber}` : "Review return"} description={source?.customerName} size="xl" presentation="sheet" busy={busy} onClose={closeSource} footer={source && canProcess && (!submitted || busy) ? <div className="flex w-full items-center justify-end gap-2"><Button size="sm" variant={quote ? "outline" : "primary"} className="flex-1 md:flex-none" aria-label="Review source credit" disabled={!editable} loading={reviewingCredit} onClick={() => { void preview(); }}>Review credit</Button>{quote && <Button size="sm" className="flex-1 md:flex-none" aria-label="Approve and post return" disabled={!canApprove || !editable} loading={busy} onClick={() => { void post(); }}>Post return</Button>}</div> : undefined}>
      {detailLoading ? <div role="status" className="flex items-center gap-2 p-3 text-sm"><Spinner size="sm" />Loading original bill…</div> : source && <section className="min-w-0 space-y-4" aria-label="Original return source">
        {error && <Alert variant="error" title="Return needs attention">{error}</Alert>}{recovery}
        <dl className="grid grid-cols-3 gap-3 border-b border-border/60 pb-3 text-xs">{[{ label: "Original total", value: source.totalPaise }, { label: "Previous credits", value: source.creditedPaise }, { label: "Balance due", value: source.balancePaise }].map(item => <div key={item.label}><dt className="text-text-secondary">{item.label}</dt><dd className="mt-1 font-semibold tabular-nums text-text">{money(item.value / 100)}</dd></div>)}</dl>
        {source.inventoryMode === "billing_only" && <p className="rounded-lg bg-surface-alt p-3 text-xs text-text-secondary">Stock was not tracked for this sale. Its return credit will not update inventory.</p>}
        <fieldset disabled={!editable} className="min-w-0 space-y-4"><legend className="mb-2 text-xs font-semibold text-text">Returned items</legend><div className="divide-y divide-border/60">{source.lines.map(line => { const id = `${line.sourceLineId}:${line.sourceBatchId}`; return <fieldset className="grid min-w-0 gap-3 py-3 first:pt-0 md:grid-cols-[minmax(0,1fr)_8rem_10rem] md:items-end" key={id}>
          <div className="min-w-0"><strong className="text-xs font-semibold text-text">{line.description}</strong><p className="mt-1 text-[11px] text-text-secondary">Batch {line.batchNumber} · Printed expiry {line.expiryValue}</p><p className="mt-1 text-[11px] text-text-secondary">Sold {line.soldQuantity} · Returned {line.returnedQuantity} · Remaining {line.remainingQuantity} {line.unitSnapshot.baseUnit}</p></div>
          <div className="grid grid-cols-2 gap-2 md:contents"><Input size="sm" label="Quantity" aria-label={`Return quantity ${line.batchNumber}`} type="number" min="0" max={line.remainingQuantity} step="1" value={quantities[id] || "0"} onChange={event => { invalidate(); setQuantities(previous => ({ ...previous, [id]: event.target.value })); }} /><div className="flex min-w-0 flex-col gap-1.5"><label className="text-xs font-medium text-text" htmlFor={`${id}-condition-trigger`}>Condition</label><Select size="sm" id={`${id}-condition`} aria-label={`Returned condition ${line.batchNumber}`} value={conditions[id] || "unknown"} onChange={event => { invalidate(); setConditions(previous => ({ ...previous, [id]: event.target.value })); }} options={["unknown", "unopened", "opened", "damaged", "expired"].map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))} /></div></div>
        </fieldset>; })}</div>
          <div className="grid gap-3 border-t border-border/60 pt-3 md:grid-cols-2"><Input size="sm" label="Return reason" aria-label="Actual return reason" placeholder="Why are these goods being returned?" value={reason} maxLength={500} onChange={event => { invalidate(); setReason(event.target.value); }} /><Input size="sm" label="Approval / review reference" aria-label="Actual approval/review reference" value={review} maxLength={200} onChange={event => { invalidate(); setReview(event.target.value); }} /></div>
          <Checkbox label="I placed these returned goods in physical quarantine" checked={quarantine} onChange={event => { invalidate(); setQuarantine(event.target.checked); }} />
        </fieldset>
        {quote && <section aria-label="Reviewed return credit" className="space-y-2 rounded-lg border border-border/70 bg-surface-alt p-3"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-text">Return credit</h3><strong className="text-sm tabular-nums text-text">{money(quote.totals.payablePaise / 100)}</strong></div><dl className="grid grid-cols-3 gap-2 text-[11px] text-text-secondary">{[{ label: "Captured value", value: quote.totals.baseAmountPaise }, { label: "CGST", value: quote.totals.cgstPaise }, { label: "SGST", value: quote.totals.sgstPaise }].map(item => <div key={item.label}><dt>{item.label}</dt><dd className="mt-0.5 tabular-nums">{money(item.value / 100)}</dd></div>)}</dl><p className="text-[11px] text-text-secondary">Original prices, discounts and tax components apply. Returned stock stays quarantined; tax adjustment requires professional review.</p>{!canApprove && <p className="text-xs text-text-secondary">Posting requires a return operator with financial approval authority.</p>}</section>}
        {source.credits.length > 0 && <section className="space-y-2 border-t border-border/60 pt-3" aria-label="Saved return credits"><h3 className="text-xs font-semibold text-text">Previous credit notes</h3>{source.credits.map(credit => <div key={credit.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><p>{credit.creditNoteNumber} · {money(credit.payablePaise / 100)}</p><PharmacyReturnDocumentButton returnId={credit.returnId} creditNoteNumber={credit.creditNoteNumber} locationId={locationId} /></div>)}</section>}
      </section>}
    </Modal>
  </section>;
}
