"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Input, QuantityInput, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { externalPrescriptions, readExternalPrescription, readExternalPrescriptionBill, cancelExternalPrescription, type ExternalPrescription, type ExternalPrescriptionSummary } from "@/lib/pharmacyExternalPrescriptions";
import { issueCounter, quoteCounter, recoverCounter, type CounterQuote, type CounterIssueInput, type CounterResult } from "@/lib/pharmacyCounter";
import { createSaleJournal } from "@/lib/pharmacyCommandJournal";
import { prepareIssuedCheckoutPayment } from "@/lib/pharmacyPayment";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { pickupError } from "@/lib/pharmacyPickup";
import type { CollectionMethod, CounterInvoice } from "@/lib/pharmacyCollections";
import { PharmacyExternalPrescriptionEditor } from "./PharmacyExternalPrescriptionEditor";
import { PharmacySavedBillPrint } from "./PharmacySavedBillPrint";
import { PharmacyCollections } from "./PharmacyCollections";

interface Props { locationId: string; inventoryMode?: "tracked" | "billing_only"; canSupply: boolean; canCollect: boolean; canOpenTill: boolean; canViewSales: boolean }
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
type Command = { key: string; input: CounterIssueInput };

export function PharmacyExternalPrescriptions(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <PrescriptionSession key={`${scope}:${props.locationId}:${props.inventoryMode || "tracked"}:${props.canSupply}:${props.canCollect}`} {...props} scope={scope} />;
}
function PrescriptionSession({ scope, locationId, inventoryMode = "tracked", canSupply, canCollect, canOpenTill, canViewSales }: Props & { scope: string }) {
  const [rows, setRows] = useState<ExternalPrescriptionSummary[]>([]), [selected, setSelected] = useState<ExternalPrescription | null>(null), [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [opening, setOpening] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [listError, setListError] = useState("");
  const [editing, setEditing] = useState(false), [quote, setQuote] = useState<CounterQuote | null>(null), [cursor, setCursor] = useState<string>(), [next, setNext] = useState<string | null>(null);
  const [method, setMethod] = useState<CollectionMethod>("cash"), [tender, setTender] = useState(""), [reference, setReference] = useState(""), [received, setReceived] = useState(false);
  const [pending, setPending] = useState<string | null>(null), [ready, setReady] = useState(false), [outcome, setOutcome] = useState<CounterResult | null>(null), [printTarget, setPrintTarget] = useState<{ id: string; document?: CounterInvoice } | null>(null), [invoice, setInvoice] = useState("");
  const [now, setNow] = useState(() => Date.now()), [retryable, setRetryable] = useState(false);
  const [journal] = useState(() => createSaleJournal(scope, locationId, "external-prescription-sale"));
  const begin = useLatestRead(), detail = useLatestRead(), lock = useRef(false), alive = useRef(true), frozen = useRef<Command | null>(null);
  const quantityFields = useRef(new Map<string, HTMLInputElement>()), cashField = useRef<HTMLInputElement>(null), referenceField = useRef<HTMLInputElement>(null), saveButton = useRef<HTMLButtonElement>(null);
  const storageKey = `ekavyu-pharmacy-external-operation:${scope}:${locationId}`;
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    const read = begin(); setLoading(true); setListError("");
    try { const page = await externalPrescriptions(locationId, cursor, read.signal); if (read.isCurrent() && current()) { setRows(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (read.isCurrent() && current()) setListError(pickupError(failure)); }
    finally { if (read.isCurrent() && current()) setLoading(false); }
  }, [begin, locationId, cursor, current]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    void journal.load().then(saved => {
      if (!current()) return;
      const backup = sessionStorage.getItem(storageKey);
      if (saved.value && !saved.value.input.externalPrescription || backup && !/^[a-zA-Z0-9_-]{8,100}$/.test(backup) || saved.value && backup && saved.value.key !== backup) throw Error("Saved prescription operation needs review before another bill.");
      frozen.current = saved.value; setRetryable(Boolean(saved.value)); setPending(backup || saved.value?.key || null); setReady(true);
    }).catch(failure => { if (current()) setError(pickupError(failure)); });
  }, [journal, storageKey, current]);
  function choose(row: ExternalPrescription) { setSelected(row); setQuantities(Object.fromEntries(row.lines.map(line => [line.medicineId, "0"]))); setQuote(null); setReceived(false); setReference(""); setTender(""); }
  async function open(id: string) {
    if (lock.current || pending || !current()) return;
    const read = detail(); setOpening(true); setError(""); setQuote(null); setSelected(null);
    try { const row = await readExternalPrescription(locationId, id, read.signal); if (read.isCurrent() && current()) choose(row); }
    catch (failure) { if (read.isCurrent() && current()) setError(pickupError(failure)); }
    finally { if (read.isCurrent() && current()) setOpening(false); }
  }
  async function prepare() {
    if (!selected || !canSupply || lock.current || pending || !ready || !current()) return;
    if (selected.status !== "approved" || Date.parse(selected.validUntil) < Date.now()) { setError("Reload a current approved prescription before preparing supply."); return; }
    lock.current = true; setBusy(true); setError(""); setQuote(null); setReceived(false);
    try {
      if (selected.lines.some(line => !/^\d+$/.test(quantities[line.medicineId] || "") || Number(quantities[line.medicineId]) > line.quantity - line.supplied)) throw Error("Enter whole quantities within the remaining prescription allowance.");
      const lines = selected.lines.filter(line => Number(quantities[line.medicineId]) > 0).map(line => ({ lineId: crypto.randomUUID(), medicineId: line.medicineId, quantity: Number(quantities[line.medicineId]), expectedUnitVersion: line.expectedUnitVersion, discountPaise: 0 }));
      if (!lines.length) throw Error("Select a quantity to supply for at least one medicine.");
      const result = await quoteCounter({ locationId, expectedInventoryMode: inventoryMode, externalPrescription: { id: selected.id, revision: selected.revision }, invoiceDiscountPaise: 0, roundOffPaise: 0, lines });
      if (current()) { setQuote(result); setTender(String(result.calculation.totals.payablePaise / 100)); }
    } catch (failure) { if (current()) setError(pickupError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function accept(result: CounterResult) {
    await journal.save(null); sessionStorage.removeItem(storageKey); frozen.current = null;
    if (!current()) return;
    setPending(null); setRetryable(false); setOutcome(result); setQuote(null); setReceived(false); setReference("");
    void load(); if (selected) { const row = await readExternalPrescription(locationId, selected.id); if (current()) choose(row); }
  }
  async function save(retry = false) {
    if (lock.current || !canSupply || !ready || !current() || !retry && (!quote || pending)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!retry) {
        const total = quote!.calculation.totals.payablePaise;
        const payment = canCollect && total > 0 && received ? prepareIssuedCheckoutPayment(locationId, total, { method, tender: method === "cash" ? tender : "0", referenceNumber: reference, expectedTotalPaise: total }) : null;
        if (canCollect && total > 0 && !payment) throw Error("Confirm actual receipt and check the cash or verified transaction reference before saving.");
        const command: Command = { key: crypto.randomUUID(), input: { ...quote!.issueInput, includeDocument: true, ...(payment ? { payment } : {}) } };
        sessionStorage.setItem(storageKey, command.key); frozen.current = command; setPending(command.key); setRetryable(true); await journal.save(command);
      }
      if (!frozen.current) throw Error("Only the operation reference is available. Check its saved result before another bill.");
      const result = await issueCounter(frozen.current.input, frozen.current.key);
      if (current()) await accept(result);
    } catch (failure) {
      if (current()) {
        const status = (failure as { response?: { status?: number } })?.response?.status;
        if (frozen.current && status && [400, 402, 403, 404, 409, 428].includes(status)) { await journal.save(null); sessionStorage.removeItem(storageKey); frozen.current = null; setPending(null); setRetryable(false); setQuote(null); setReceived(false); }
        setError(pickupError(failure));
      }
    } finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!pending || lock.current || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await recoverCounter(locationId, pending, true); if (current()) await accept(result); }
    catch (failure) { if (current()) setError(pickupError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function cancel() {
    if (!selected || busy || pending || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try { const row = await cancelExternalPrescription(selected); if (current()) { choose(row); void load(); } }
    catch (failure) { if (current()) { setQuote(null); setError(pickupError(failure)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function printBill(id: string) {
    if (lock.current || pending || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try { const document = await readExternalPrescriptionBill(locationId, id); if (current()) setPrintTarget({ id, document }); }
    catch (failure) { if (current()) setError(pickupError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  const available = selected?.status === "approved" && Date.parse(selected.validUntil) >= now;
  const cashReceived = parseReceiptPaise(tender), cashChange = quote && cashReceived !== null && cashReceived >= quote.calculation.totals.payablePaise ? cashReceived - quote.calculation.totals.payablePaise : null;
  const blocked = busy || Boolean(pending) || !ready || opening;
  useEffect(() => {
    if (!selected || opening || !ready || !canSupply || selected.status !== "approved") return;
    const first = selected.lines.find(line => line.quantity > line.supplied); if (first) quantityFields.current.get(first.medicineId)?.focus();
  }, [selected, opening, ready, canSupply]);
  useEffect(() => {
    if (!quote || blocked) return;
    if (canCollect && quote.calculation.totals.payablePaise > 0) (method === "cash" ? cashField : referenceField).current?.focus();
    else saveButton.current?.focus();
  }, [quote, blocked, canCollect, method]);
  return <div className="space-y-4" onKeyDown={event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing || printTarget || invoice || blocked || !available || !canSupply) return;
    if (event.key === "F8") { event.preventDefault(); void prepare(); }
    if (event.key === "F10") { event.preventDefault(); if (quote && (!canCollect || quote.calculation.totals.payablePaise === 0 || received)) void save(); }
  }}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Outside prescriptions</h2><p className="mt-1 text-sm text-text-secondary">Review a prescription brought to this pharmacy. Track each supply and its remaining quantity without creating a clinic visit.</p></div>{canSupply && <Button disabled={blocked} onClick={() => { setEditing(true); setError(""); }}>Review new prescription</Button>}</header>
    {error && <Alert variant="error" title="Prescription needs attention">{error}</Alert>}
    {pending && <Alert variant="warning" title="Check the pending supply before another bill"><p>Reference: {pending}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={busy} onClick={() => { void recover(); }}>Check saved result</Button>{retryable && canSupply && <Button size="sm" disabled={busy} onClick={() => { void save(true); }}>Retry same supply</Button>}</div></Alert>}
    {outcome && <div role="status" className="flex flex-wrap items-center gap-3 rounded-control border border-border px-3 py-2 text-sm"><strong>{outcome.invoiceNumber} · {money(outcome.totalPaise)} · {outcome.status === "paid" ? "Paid" : "Awaiting collection"}</strong><Button size="sm" variant="outline" onClick={() => setPrintTarget({ id: outcome.invoiceId, document: outcome.document })}>Print saved bill</Button>{canViewSales && <Button size="sm" variant="outline" onClick={() => setInvoice(outcome.invoiceId)}>View bill / collect</Button>}<Button size="sm" variant="ghost" onClick={() => setOutcome(null)}>Dismiss</Button></div>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <Card contentClassName="gap-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Prescription history</h3><Button size="sm" variant="ghost" loading={loading} onClick={() => { void load(); }}>Refresh</Button></div>
        {listError && <Alert variant="error" title="History unavailable">{listError}</Alert>}{loading && <p role="status" className="text-sm">Loading prescriptions…</p>}{!loading && !listError && !rows.length && <p className="text-sm text-text-secondary">No outside prescriptions recorded at this branch.</p>}
        <ul className="divide-y divide-border">{rows.map(row => <li key={row.id} className="py-3"><Button variant="ghost" fullWidth aria-label={`Open prescription ${row.reference} for ${row.patientName}`} className="justify-start text-left" disabled={blocked} onClick={() => { void open(row.id); }}><span className="min-w-0"><span className="block break-words font-semibold">{row.reference}</span><span className="mt-1 block text-xs text-text-secondary">{row.patientName} · {row.status === "approved" && Date.parse(row.validUntil) < now ? "Expired" : row.status}</span></span></Button></li>)}</ul>
        <div className="flex gap-2">{cursor && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(undefined)}>Newest</Button>}{next && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(next)}>Older</Button>}</div>
      </Card>
      <Card contentClassName="gap-4 min-h-80">
        {opening ? <p role="status">Loading prescription evidence…</p> : !selected ? <p className="text-sm text-text-secondary">Open an existing prescription or record a new pharmacist review.</p> : <>
          <header className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{selected.reference}</h3><p className="text-sm text-text-secondary">{selected.patientName} · Supply deadline {new Date(selected.validUntil).toLocaleDateString("en-IN")}</p></div><Badge>{!available && selected.status === "approved" ? "Expired" : selected.status}</Badge></header>
          <details className="rounded-control border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Patient, prescriber and retained source</summary><div className="mt-3 space-y-2"><p>{selected.patientName} · {selected.patientAddress} {selected.patientPhone}</p><p>{selected.prescriberName} · {selected.prescriberRegistration} · {selected.prescriberCouncil}</p><p>{selected.prescriberAddress}</p><p>Prescriber evidence: {selected.prescriberReviewReference}</p><p>Signed prescription: {selected.sourceReference} · {selected.issuedOn}</p></div></details>
          <div className="min-w-0 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-text-secondary"><tr><th className="p-2">Medicine / directions</th><th className="p-2">Permitted</th><th className="p-2">Supplied</th><th className="p-2">Remaining</th>{canSupply && available && <th className="p-2">Supply now</th>}</tr></thead><tbody>{selected.lines.map(line => <tr key={line.medicineId} className="border-b border-border"><td className="p-2"><strong>{line.name}</strong><p className="mt-1 max-w-md text-xs text-text-secondary">{line.instructions} · {line.baseUnit}</p></td><td className="p-2 tabular-nums">{line.quantity}</td><td className="p-2 tabular-nums">{line.supplied}</td><td className="p-2 tabular-nums">{line.quantity - line.supplied}</td>{canSupply && available && <td className="p-2"><QuantityInput ref={element => { if (element) quantityFields.current.set(line.medicineId, element); else quantityFields.current.delete(line.medicineId); }} onKeyDown={event => { if (event.key !== "Enter" || blocked) return; event.preventDefault(); const next = selected.lines.slice(selected.lines.indexOf(line) + 1).find(row => row.quantity > row.supplied); if (next) quantityFields.current.get(next.medicineId)?.focus(); else void prepare(); }} variant="compact" label={`Supply ${line.name}`} value={quantities[line.medicineId] || "0"} min={0} max={line.quantity - line.supplied} disabled={blocked} onValueChange={quantity => { setQuantities(current => ({ ...current, [line.medicineId]: quantity })); setQuote(null); setReceived(false); }} /></td>}</tr>)}</tbody></table></div>
          {canSupply && available && <div className="flex flex-wrap gap-2"><Button variant="outline" loading={busy} disabled={Boolean(pending) || !ready} onClick={() => { void prepare(); }}>Prepare bill for selected quantities</Button><Button variant="ghost" disabled={blocked} onClick={() => { void open(selected.id); }}>Reload remaining quantities</Button></div>}
          {quote && <div className="space-y-3 rounded-control border border-border p-4"><h4 className="font-semibold">Current bill · {money(quote.calculation.totals.payablePaise)}</h4><p className="text-xs text-text-secondary">GST {money(quote.calculation.totals.cgstPaise + quote.calculation.totals.sgstPaise)} · Stock and prices are checked again when saved.</p><ul className="space-y-1 text-xs text-text-secondary">{quote.lines.map(line => <li key={line.lineId}>{line.description} · {line.quantity} {line.unitSnapshot.baseUnit} · {line.batches.map(lot => `${lot.batchNumber} (${lot.quantity}), exp ${lot.expiryValue}`).join("; ")}</li>)}</ul>
            {canCollect && quote.calculation.totals.payablePaise > 0 && <fieldset disabled={blocked} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Select label="Payment method" value={method} options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "card", label: "Card" }]} onChange={event => { setMethod(event.target.value as CollectionMethod); setReceived(false); setReference(""); }} />{method === "cash" ? <Input ref={cashField} label="Cash received (INR)" value={tender} type="number" min="0" step="0.01" onChange={event => { setTender(event.target.value); setReceived(false); }} /> : <Input ref={referenceField} label="Verified transaction reference" value={reference} maxLength={200} onChange={event => { setReference(event.target.value); setReceived(false); }} />}</div>{method === "cash" && cashChange !== null && <p className="text-sm font-medium text-accent">Change to return: {money(cashChange)}</p>}<Checkbox label="I confirmed this payment was actually received." checked={received} onChange={event => setReceived(event.target.checked)} /></fieldset>}
            {!canCollect && <p className="text-sm text-text-secondary">This creates an unpaid bill. An authorized cashier must collect payment before handover.</p>}
            <Button ref={saveButton} loading={busy} disabled={Boolean(pending) || canCollect && quote.calculation.totals.payablePaise > 0 && !received} onClick={() => { void save(); }}>{canCollect ? "Save supply and payment" : "Issue bill for collection"}</Button>
          </div>}
          <p className="text-xs text-text-secondary">Enter: next quantity / prepare bill. F8: prepare bill. F10: save after payment confirmation.</p>
          <div className="space-y-2"><h4 className="font-semibold">Supplies and linked bills</h4>{!selected.supplies.length && <p className="text-sm text-text-secondary">No supplies yet.</p>}<ul className="divide-y divide-border">{selected.supplies.map(supply => <li key={supply.invoiceId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div><p className="font-medium">{supply.invoiceNumber}</p><p>{new Date(supply.suppliedAt).toLocaleString("en-IN")}</p><p className="text-xs text-text-secondary">{supply.lines.map(line => `${selected.lines.find(item => item.medicineId === line.medicineId)?.name}: ${line.quantity}`).join(" · ")}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={blocked} onClick={() => { void printBill(supply.invoiceId); }}>Print bill</Button>{canViewSales && <Button size="sm" variant="outline" disabled={blocked} onClick={() => setInvoice(supply.invoiceId)}>View saved bill</Button>}</div></li>)}</ul></div>
          <p className="text-xs text-text-secondary">Record each supply on the original prescription as required. Returns do not restore its permitted quantity. This record tracks supplies at this branch.</p>
          {selected.status === "approved" && <details className="text-sm"><summary className="cursor-pointer text-text-secondary">Close remaining allowance</summary><p className="my-2 text-xs text-text-secondary">Cancelling preserves previous supplies and bills. Correct billed items through Returns.</p><Button size="sm" variant="outline" disabled={blocked} onClick={() => { void cancel(); }}>Cancel remaining prescription allowance</Button></details>}
        </>}
      </Card>
    </div>
    {editing && canSupply && <PharmacyExternalPrescriptionEditor locationId={locationId} onClose={() => setEditing(false)} onSaved={row => { setEditing(false); choose(row); void load(); }} />}
    {printTarget && <PharmacySavedBillPrint key={printTarget.id} invoiceId={printTarget.id} locationId={locationId} savedDocument={printTarget.document} onClose={() => setPrintTarget(null)} />}
    {invoice && canViewSales && <PharmacyCollections locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={invoice} focusOnly onInvoiceClose={() => setInvoice("")} />}
  </div>;
}
