"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { activeDrawer, drawerHistory, readDrawer, recoverDrawer, submitDrawer, type CashierDrawer, type DrawerKind, type DrawerOutcome, type DrawerReference, type DrawerChannel } from "@/lib/pharmacyTill";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import { printElement } from "@/lib/printBrand";
import styles from "./PharmacyWorkspace.module.css";
interface Props { locationId: string; canOpen: boolean; canClose: boolean; canMove: boolean; channel?: DrawerChannel }
function stored(key: string): DrawerReference | null {
  const value = sessionStorage.getItem(key); if (!value) return null; const ref = JSON.parse(value) as DrawerReference;
  if (!ref || !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) || !["open", "close", "movement"].includes(ref.kind) || ref.kind !== "open" && !/^[a-f\d]{24}$/i.test(ref.drawerId || "")) throw new Error("Drawer operation reference needs review"); return ref;
}
export function PharmacyTill(props: Props) { const scope = authScopeKey(useAuthStore(state => state.user)); return <DrawerSession key={`${scope}:${props.locationId}`} {...props} />; }
function DrawerSession({ locationId, canOpen, canClose, canMove, channel = "pharmacy" }: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-drawer:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { ref: stored(storageKey), error: "" }; } catch (failure) { return { ref: null, error: pharmacyFinanceMessage(failure) }; } });
  const [pending, setPending] = useState(initial.ref), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [result, setResult] = useState<DrawerOutcome | null>(null), [review, setReview] = useState(false), [submitted, setSubmitted] = useState(false);
  const [drawer, setDrawer] = useState<CashierDrawer | null>(null), [history, setHistory] = useState<CashierDrawer[]>([]), [next, setNext] = useState<string | null>(null), [loading, setLoading] = useState(true), [readError, setReadError] = useState("");
  const frozen = useRef<{ ref: DrawerReference; input: object } | null>(null), alive = useRef(true), lock = useRef(false), document = useRef<HTMLDivElement>(null), beginRead = useLatestRead();
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setReadError("");
    try { const [active, page] = await Promise.all([pending?.drawerId ? readDrawer(locationId, pending.drawerId, channel) : activeDrawer(locationId, request.signal, channel), drawerHistory(locationId, undefined, request.signal, channel)]); if (request.isCurrent()) { setDrawer(active); setHistory(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) { setDrawer(null); setReadError(pharmacyFinanceMessage(failure)); } }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, locationId, channel, pending]);
  useEffect(() => { void load(); }, [load]);
  async function send(kind: DrawerKind, input: object, drawerId?: string) {
    if (!current() || lock.current || result || (kind === "open" ? !canOpen : kind === "close" ? !canClose : !canMove)) return;
    lock.current = true; setBusy(true); setError(""); setReview(false);
    try {
      const saved = stored(storageKey); if ((saved?.key || null) !== (pending?.key || null) || pending && (pending.kind !== kind || pending.drawerId !== drawerId)) throw new Error("Resolve the pending drawer operation first");
      const ref = pending || { key: crypto.randomUUID(), kind, ...(drawerId ? { drawerId } : {}) }; if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref)); setPending(ref);
      const command = frozen.current || { ref, input: JSON.parse(JSON.stringify(input)) as object }; frozen.current = command; setSubmitted(true);
      const outcome = await submitDrawer(locationId, command.ref, command.input, channel); if (current()) setResult(outcome);
    } catch (failure) { if (current()) { setError(pharmacyFinanceMessage(failure)); setReview([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return; lock.current = true; setBusy(true); setError("");
    try { const outcome = await recoverDrawer(locationId, pending, channel); if (current()) setResult(outcome); }
    catch (failure) { if (current()) setError(pharmacyFinanceMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function done() {
    if (!current() || busy || !result) return;
    try { if (stored(storageKey)?.key !== result.requestKey) throw new Error("Drawer operation reference changed; recover its original result"); sessionStorage.removeItem(storageKey); setPending(null); setResult(null); frozen.current = null; setSubmitted(false); setReview(false); void load(); }
    catch (failure) { setError(pharmacyFinanceMessage(failure)); }
  }
  async function inspect(id: string) { if (busy || pending) return; setReadError(""); try { const row = await readDrawer(locationId, id, channel); if (current()) setDrawer(row); } catch (failure) { if (current()) setReadError(pharmacyFinanceMessage(failure)); } }
  async function page() { if (!next || busy) return; const request = beginRead(); try { const page = await drawerHistory(locationId, next, request.signal, channel); if (request.isCurrent()) { setHistory(page.items); setNext(page.nextCursor); } } catch (failure) { if (request.isCurrent()) setReadError(pharmacyFinanceMessage(failure)); } }
  const locked = busy || Boolean(result) || Boolean(pending && !review && submitted);
  return <section className={styles.list} aria-label="Physical cash drawer"><header><h2>Cash drawer</h2><p>Open the drawer you actually use. Count opening cash, record actual movements and count cash again at handover.</p></header>
    {error && <Alert variant="error" title="Drawer outcome needs attention">{error}</Alert>}
    {pending && <Alert variant={result ? "success" : "warning"} title={result ? "Drawer operation confirmed" : "Pending drawer operation"}><p>Reference {pending.key}</p>{result ? <><p>{result.drawer.drawerCode}: {result.kind === "close" ? "closed" : result.kind === "open" ? "opened" : "cash movement recorded"}. This is the original committed result.</p><Button size="sm" disabled={busy} onClick={done}>Done with drawer operation</Button></> : <><p>Check this result before another drawer command. Reload retains this reference.</p><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check drawer result</Button>{submitted && <Button size="sm" disabled={busy} onClick={() => { const saved = frozen.current; if (saved) void send(saved.ref.kind, saved.input, saved.ref.drawerId); }}>Retry same drawer operation</Button>}{(!submitted || review) && <Button size="sm" disabled={busy} onClick={() => { frozen.current = null; setSubmitted(false); setReview(true); void load(); }}>Reload original drawer source</Button>}</>}</Alert>}
    {readError && <Alert variant="error" title="Drawer unavailable">{readError}</Alert>}{loading ? <p role="status">Loading drawer...</p> : <>
      <Button size="sm" variant="outline" disabled={busy || Boolean(pending)} onClick={() => { void load(); }}>Refresh drawer</Button>
      {!readError && !drawer && canOpen && (!pending || pending.kind === "open") && <DrawerOpen disabled={locked} onSubmit={input => { void send("open", input); }} />}
      {(result?.drawer || drawer) && <div ref={document}><DrawerSummary drawer={(result?.drawer || drawer)!} /></div>}
      {!readError && drawer?.status === "active" && !result && <DrawerActions key={`${drawer.id}:${drawer.revision}`} drawer={drawer} canClose={canClose} canMove={canMove} disabled={locked} pending={pending} onSubmit={(kind, input) => { void send(kind, input, drawer.id); }} />}
      {(result?.drawer || drawer)?.status === "closed" && <Button size="sm" variant="outline" onClick={() => { void printElement(document.current, { title: `Drawer ${((result?.drawer || drawer)!).drawerCode}`, paper: "A4" }).catch(failure => { if (current()) setError(pharmacyFinanceMessage(failure)); }); }}>Print saved drawer close</Button>}
      <h3>Drawer history</h3>{history.map(row => <article className={styles.card} key={row.id}><strong>{row.drawerCode} · {row.cashierName} · {row.status}</strong><p>{new Date(row.startedAt).toLocaleString("en-IN", { timeZone: row.timezone })} ({row.timezone})</p><Button size="sm" variant="outline" disabled={busy || Boolean(pending)} onClick={() => { void inspect(row.id); }}>View drawer {row.drawerCode}</Button></article>)}{next && <Button size="sm" disabled={busy || Boolean(pending)} onClick={() => { void page(); }}>Next drawer page</Button>}
    </>}
  </section>;
}
function DrawerOpen({ disabled, onSubmit }: { disabled: boolean; onSubmit: (input: object) => void }) {
  const [code, setCode] = useState(""), [float, setFloat] = useState(""), [error, setError] = useState("");
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); if (disabled) return; const amount = parseReceiptPaise(float); if (amount === null || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code.trim().toUpperCase())) { setError("Enter the actual drawer code and exact counted opening cash"); return; } onSubmit({ drawerCode: code.trim().toUpperCase(), openingFloatPaise: amount }); }}><fieldset className={styles.form} disabled={disabled}><Input label="Physical drawer code" value={code} maxLength={40} onChange={event => setCode(event.target.value)} /><Input label="Counted opening cash" type="number" min="0" step="0.01" value={float} onChange={event => setFloat(event.target.value)} />{error && <p role="alert">{error}</p>}<Button size="sm" type="submit">Open physical drawer</Button></fieldset></form>;
}
function DrawerActions({ drawer, canClose, canMove, disabled, pending, onSubmit }: { drawer: CashierDrawer; canClose: boolean; canMove: boolean; disabled: boolean; pending: DrawerReference | null; onSubmit: (kind: "close" | "movement", input: object) => void }) {
  const [direction, setDirection] = useState("out"), [amount, setAmount] = useState(""), [reference, setReference] = useState(""), [reason, setReason] = useState(""), [counted, setCounted] = useState(""), [variance, setVariance] = useState(""), [notes, setNotes] = useState(""), [error, setError] = useState("");
  return <div className={styles.form}>{error && <p role="alert">{error}</p>}{canMove && (!pending || pending.kind === "movement" && pending.drawerId === drawer.id) && <form onSubmit={event => { event.preventDefault(); if (disabled) return; const paise = parseReceiptPaise(amount); if (!paise || reference.trim().length < 3 || reason.trim().length < 3) { setError("Confirm the actual cash movement amount, reference and reason"); return; } onSubmit("movement", { expectedRevision: drawer.revision, direction, amountPaise: paise, referenceNumber: reference.trim(), reviewReference: reason.trim() }); }}><fieldset disabled={disabled} className={styles.form}><h3>Actual cash movement</h3><Select label="Cash movement direction" value={direction} onChange={event => setDirection(event.target.value)} options={[{ value: "out", label: "Cash taken out" }, { value: "in", label: "Cash added" }]} /><Input label="Actual cash movement amount" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /><Input label="Actual cash movement reference" value={reference} maxLength={100} onChange={event => setReference(event.target.value)} /><Input label="Cash movement reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /><Button size="sm" type="submit">Record actual cash movement</Button></fieldset></form>}
    {canClose && (!pending || pending.kind === "close" && pending.drawerId === drawer.id) && <form onSubmit={event => { event.preventDefault(); if (disabled) return; const amount = parseReceiptPaise(counted); if (amount === null || amount !== drawer.drawerTotals.expectedCashPaise && !variance.trim()) { setError("Count the actual closing cash and explain any difference"); return; } onSubmit("close", { expectedRevision: drawer.revision, countedCashPaise: amount, varianceReason: variance.trim(), handoverNotes: notes.trim() }); }}><fieldset disabled={disabled} className={styles.form}><h3>Count and close drawer</h3><Input label="Actual closing cash counted" type="number" min="0" step="0.01" value={counted} onChange={event => setCounted(event.target.value)} /><Input label="Cash variance explanation" value={variance} maxLength={500} onChange={event => setVariance(event.target.value)} /><Input label="Drawer handover notes" value={notes} maxLength={1000} onChange={event => setNotes(event.target.value)} /><Button size="sm" type="submit">Close physical drawer</Button></fieldset></form>}
  </div>;
}
export function DrawerSummary({ drawer }: { drawer: CashierDrawer }) {
  const amount = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: drawer.currency }).format(paise / 100), totals = drawer.drawerTotals;
  return <section className={styles.card} aria-label="Drawer reconciliation"><h3>{drawer.organizationName} · {drawer.locationName}</h3><p>{drawer.drawerCode} · {drawer.cashierName} · {drawer.status} · Revision {drawer.revision}</p><p>Opened {new Date(drawer.startedAt).toLocaleString("en-IN", { timeZone: drawer.timezone })} ({drawer.timezone})</p><p>Opening float {amount(drawer.openingFloatPaise)} · Expected cash {amount(totals.expectedCashPaise)}</p>
    <table><caption>Actual receipts and movements ({drawer.currency})</caption><thead><tr><th>Method</th><th>Collections</th><th>Other inflows</th><th>Outflows</th></tr></thead><tbody>{(["cash", "upi", "card", "other"] as const).map(method => <tr key={method}><th>{method.toUpperCase()}</th><td>{amount(totals.incoming[method])}</td><td>{amount(totals.eventIncoming[method])}</td><td>{amount(totals.outgoing[method])}</td></tr>)}</tbody></table><p>{totals.receiptCount} receipt components · {totals.invoiceCount} invoices · {totals.eventCount} movements</p>
    {drawer.status === "closed" && <><p>Closed {new Date(drawer.endedAt!).toLocaleString("en-IN", { timeZone: drawer.timezone })} ({drawer.timezone}) by {drawer.closedByName}</p><p>Counted {amount(Math.round(drawer.actualCashCounted! * 100))} · Variance {amount(Math.round(drawer.cashVariance! * 100))}</p>{drawer.varianceReason && <p>Variance explanation: {drawer.varianceReason}</p>}{drawer.handoverNotes && <p>Handover: {drawer.handoverNotes}</p>}<p>Evidence {drawer.evidenceHash}</p></>}
  </section>;
}
