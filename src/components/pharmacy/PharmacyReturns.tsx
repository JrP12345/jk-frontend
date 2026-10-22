"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { returnInvoicePage, readReturnSource, previewReturn, submitReturn, recoverReturn, type ReturnSource, type ReturnQuote, type ReturnCommit, type ReturnResult } from "@/lib/pharmacyReturns";
import type { InvoiceSummary } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
import { PharmacyReturnDocumentButton } from "./PharmacyReturnDocumentButton";

const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Return could not be confirmed. Keep the same reference.");
type Reference = { key: string; invoiceId: string };
function readReference(storageKey: string): Reference | null { const value = sessionStorage.getItem(storageKey); if (!value) return null; const ref = JSON.parse(value); if (!ref || !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) || typeof ref.invoiceId !== "string" || !ref.invoiceId) throw new Error("Return reference requires review before another posting"); return ref; }
export function PharmacyReturns(props: { locationId: string; canProcess: boolean; canApprove: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user)); return <ReturnSession key={`${scope}:${props.locationId}`} {...props} />;
}
function ReturnSession({ locationId, canProcess, canApprove }: { locationId: string; canProcess: boolean; canApprove: boolean }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-return:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { ref: readReference(storageKey), error: "" }; } catch (failure) { return { ref: null, error: message(failure) }; } });
  const [pending, setPending] = useState(initial.ref), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [result, setResult] = useState<ReturnResult | null>(null), [correctable, setCorrectable] = useState(false);
  const [items, setItems] = useState<InvoiceSummary[]>([]), [next, setNext] = useState<string | null>(null), [search, setSearch] = useState(""), [listError, setListError] = useState("");
  const [source, setSource] = useState<ReturnSource | null>(null), [quote, setQuote] = useState<ReturnQuote | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({}), [conditions, setConditions] = useState<Record<string, string>>({}), [reason, setReason] = useState(""), [review, setReview] = useState(""), [quarantine, setQuarantine] = useState(false);
  const alive = useRef(true), lock = useRef(false), revision = useRef(0), frozen = useRef<{ input: ReturnCommit; invoiceId: string; key: string } | null>(null);
  const beginList = useLatestRead(), beginDetail = useLatestRead(), beginQuote = useLatestRead();
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async (cursor?: string, number = "") => { const request = beginList(); setListError(""); try { const page = await returnInvoicePage(locationId, number, cursor, request.signal); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); } } catch (failure) { if (request.isCurrent()) setListError(message(failure)); } }, [beginList, locationId]);
  useEffect(() => { void load(); }, [load]);
  function invalidate() { revision.current++; setQuote(null); setError(""); }
  async function open(id: string, correction = false) { if (busy || submitted && !correction || pending && pending.invoiceId !== id) return; const request = beginDetail(); invalidate(); setSource(null); try { const value = await readReturnSource(id, locationId, request.signal); if (request.isCurrent()) { setSource(value); setQuantities({}); setConditions({}); setQuarantine(false); } } catch (failure) { if (request.isCurrent()) setError(message(failure)); } }
  async function preview() {
    if (!source || !canProcess || busy || submitted) return; const request = beginQuote(), version = revision.current; setError(""); setQuote(null);
    try {
      const lines = source.lines.filter(line => quantities[`${line.sourceLineId}:${line.sourceBatchId}`] && quantities[`${line.sourceLineId}:${line.sourceBatchId}`] !== "0").map(line => { const id = `${line.sourceLineId}:${line.sourceBatchId}`, value = quantities[id]; if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0 || Number(value) > line.remainingQuantity) throw new Error("Use positive whole quantities within the remaining sold lots."); return { sourceLineId: line.sourceLineId, sourceBatchId: line.sourceBatchId, quantity: Number(value), condition: conditions[id] || "unknown" }; });
      if (!lines.length || !quarantine || reason.trim().length < 3 || review.trim().length < 3) throw new Error("Select returned quantities and record actual reason, condition/approval reference and physical quarantine.");
      const value = await previewReturn(source.invoiceId, { locationId, lines, reason: reason.trim(), reviewReference: review.trim(), confirmedQuarantine: true }, request.signal);
      if (request.isCurrent() && version === revision.current) setQuote(value);
    } catch (failure) { if (request.isCurrent() && version === revision.current) setError(message(failure)); }
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
  return <section className={styles.list} aria-label="Pharmacy sales returns"><header><h2>Sales returns</h2><p>Return original sold lots into physical quarantine. A credit note and any refund payable are separate from money paid out.</p></header>
    {error && <Alert variant="error" title="Return needs attention">{error}</Alert>}{pending && <Alert variant={result ? "success" : "warning"} title={result ? "Return committed" : "Pending return"}><p>Reference {pending.key}</p>{result ? <><p>Credit note {result.creditNoteNumber} · Credit {money(result.creditedPaise / 100)} · Remaining due {money(result.balancePaise / 100)} · Refund payable {money(result.refundPayablePaise / 100)}</p><p>Returned goods are quarantined. Refund payouts are recorded separately. Tax adjustment needs professional review.</p><PharmacyReturnDocumentButton returnId={result.returnId} locationId={locationId} /><Button size="sm" disabled={busy} onClick={done}>Done with return</Button></> : <><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check return result</Button>{submitted && <Button size="sm" disabled={busy || !canApprove} onClick={() => { void post(true); }}>Retry same return</Button>}{(!submitted || correctable) && <Button size="sm" disabled={busy} variant="outline" onClick={() => { frozen.current = null; setSubmitted(false); setCorrectable(false); void open(pending.invoiceId, true); }}>Review original return</Button>}</>}</Alert>}
    <form className={styles.actions} onSubmit={event => { event.preventDefault(); void load(undefined, search); }}><Input label="Find return invoice number" value={search} onChange={event => setSearch(event.target.value)} maxLength={50} /><Button size="sm" type="submit">Find return invoice</Button></form>{listError && <Alert variant="error" title="Return invoices unavailable">{listError}</Alert>}
    {items.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.invoiceNumber}</strong><small>{row.customerSnapshot?.name || "Walk-in customer"} · {money(row.totalAmount)}</small></div><Button size="sm" variant="outline" disabled={busy || submitted || Boolean(pending && pending.invoiceId !== row.id)} onClick={() => { void open(row.id); }}>Review return {row.invoiceNumber}</Button></article>)}{next && <Button size="sm" onClick={() => { void load(next, search); }}>Next return invoice page</Button>}
    {source && <section className={styles.rx} aria-label="Original return source"><h3>{source.invoiceNumber} · {source.customerName}</h3><p>Original total {money(source.totalPaise / 100)} · Credits {money(source.creditedPaise / 100)} · Due {money(source.balancePaise / 100)}</p>
      <fieldset className={styles.form} disabled={!editable}>{source.lines.map(line => { const id = `${line.sourceLineId}:${line.sourceBatchId}`; return <fieldset className={styles.rx} key={id}><strong>{line.description} · Batch {line.batchNumber}</strong><p>Sold {line.soldQuantity}, already returned {line.returnedQuantity}, remaining {line.remainingQuantity} {line.unitSnapshot.baseUnit}. Printed expiry {line.expiryValue}.</p><Input label={`Return quantity ${line.batchNumber}`} type="number" min="0" max={line.remainingQuantity} step="1" value={quantities[id] || "0"} onChange={event => { invalidate(); setQuantities(previous => ({ ...previous, [id]: event.target.value })); }} /><Select label={`Returned condition ${line.batchNumber}`} value={conditions[id] || "unknown"} onChange={event => { invalidate(); setConditions(previous => ({ ...previous, [id]: event.target.value })); }} options={["unknown", "unopened", "opened", "damaged", "expired"].map(value => ({ value, label: value }))} /></fieldset>; })}
        <Input label="Actual return reason" value={reason} maxLength={500} onChange={event => { invalidate(); setReason(event.target.value); }} /><Input label="Actual approval/review reference" value={review} maxLength={200} onChange={event => { invalidate(); setReview(event.target.value); }} /><label><input type="checkbox" checked={quarantine} onChange={event => { invalidate(); setQuarantine(event.target.checked); }} /> I placed these returned goods in physical quarantine</label><Button size="sm" onClick={() => { void preview(); }}>Review source credit</Button>
      </fieldset>{quote && <section aria-label="Reviewed return credit"><p>Credit {money(quote.totals.payablePaise / 100)} · Captured value {money(quote.totals.baseAmountPaise / 100)} · CGST {money(quote.totals.cgstPaise / 100)} · SGST {money(quote.totals.sgstPaise / 100)}</p><p>Original prices, discounts and tax components apply. Returned stock stays quarantined; tax adjustment requires professional review.</p><Button size="sm" disabled={!canApprove || !editable} onClick={() => { void post(); }}>Approve and post return</Button>{!canApprove && <p>Posting requires a return operator with financial approval authority.</p>}</section>}
      {source.credits.map(credit => <div key={credit.id}><PharmacyReturnDocumentButton returnId={credit.returnId} locationId={locationId} /><p>Saved credit {credit.creditNoteNumber} · {money(credit.payablePaise / 100)}</p></div>)}
    </section>}
  </section>;
}
