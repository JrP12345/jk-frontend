"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { listTransfers, readTransfer, readTransferLots, searchTransferProducts, submitTransfer, recoverTransfer, parseTransferReference, transferError,
  type PharmacyTransfer, type TransferAction, type TransferReference, type TransferProduct, type TransferLot } from "@/lib/pharmacyTransfers";

interface Props { locationId: string; locations: Array<{ id: string; name: string }>; canStart: boolean }
export function PharmacyTransfers(props: Props) {
  const user = useAuthStore(state => state.user);
  if (!user || ["patient", "family_member", "guest"].includes(user.role) || !hasAnyPermission(user, "PHARMACY_TRANSFER", "MANAGE_ORGANIZATION") || !hasAnyPermission(user, "PHARMACY_VIEW_COST", "MANAGE_MEDICINES")) return <Alert variant="warning" title="Transfer access required">Current transfer and acquisition-cost permissions are required at this branch.</Alert>;
  return <TransferSession key={`${authScopeKey(user)}:${props.locationId}`} {...props} />;
}
function TransferSession({ locationId, locations, canStart }: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-transfer:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { reference: parseTransferReference(sessionStorage.getItem(storageKey)), error: "" }; } catch (failure) { return { reference: null, error: transferError(failure) }; } });
  const [pending, setPending] = useState(initial.reference), [outcome, setOutcome] = useState<PharmacyTransfer | null>(null);
  const [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [canReview, setCanReview] = useState(false), [reviewing, setReviewing] = useState(false), [hasFrozen, setHasFrozen] = useState(false);
  const [rows, setRows] = useState<PharmacyTransfer[]>([]), [cursor, setCursor] = useState<string | null>(null), [selected, setSelected] = useState<PharmacyTransfer | null>(null);
  const [loading, setLoading] = useState(true), [reading, setReading] = useState(false);
  const [destination, setDestination] = useState(""), [sourceSearch, setSourceSearch] = useState(""), [destinationSearch, setDestinationSearch] = useState("");
  const [sourceProducts, setSourceProducts] = useState<TransferProduct[]>([]), [destinationProducts, setDestinationProducts] = useState<TransferProduct[]>([]);
  const [sourceProduct, setSourceProduct] = useState(""), [destinationProduct, setDestinationProduct] = useState(""), [lots, setLots] = useState<TransferLot[]>([]), [lotCursor, setLotCursor] = useState<string | null>(null), [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState(""), [transport, setTransport] = useState(""), [review, setReview] = useState("");
  const [stageQuantity, setStageQuantity] = useState(""), [disposition, setDisposition] = useState("saleable"), [stageReview, setStageReview] = useState("");
  const alive = useRef(true), lock = useRef(false), frozen = useRef<{ reference: TransferReference; input: object } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    listTransfers(locationId).then(page => { if (!cancelled) { setRows(page.items); setCursor(page.nextCursor); } }).catch(failure => { if (!cancelled) setError(transferError(failure)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locationId]);
  const clearPrivate = () => { setRows([]); setSelected(null); setSourceProducts([]); setDestinationProducts([]); setLots([]); };
  async function read<T>(work: () => Promise<T>, accept: (value: T) => void) {
    if (!current() || lock.current) return; lock.current = true; setReading(true); setError("");
    try { const result = await work(); if (current()) accept(result); }
    catch (failure) { if (current()) { if ((failure as { response?: { status?: number } })?.response?.status === 403) clearPrivate(); setError(transferError(failure)); } }
    finally { lock.current = false; if (current()) setReading(false); }
  }
  function history(older = false) { return read(() => listTransfers(locationId, older ? cursor || undefined : undefined), page => { setRows(page.items); setCursor(page.nextCursor); }); }
  function open(id: string, eventCursor?: string) { return read(() => readTransfer(locationId, id, eventCursor), row => { setSelected(row); setRows(previous => previous.some(item => item.id === row.id) ? previous.map(item => item.id === row.id ? row : item) : [row, ...previous].slice(0, 20)); setStageQuantity(""); setStageReview(""); setDisposition(row.sourceLocationId === locationId ? "return_to_source" : "saleable"); }); }
  function sourceLots(id: string, older = false) { setSourceProduct(id); setLotId(""); setLots([]); return read(() => readTransferLots(locationId, id, older ? lotCursor || undefined : undefined), page => { setLots(page.items); setLotCursor(page.nextCursor); }); }
  async function command(action: TransferAction, input: object, transferId?: string) {
    if (!current() || lock.current || outcome || initial.error) return; lock.current = true; setBusy(true); setError(""); setCanReview(false); setReviewing(false);
    try {
      const saved = parseTransferReference(sessionStorage.getItem(storageKey));
      if ((saved?.key || null) !== (pending?.key || null) || pending && (pending.action !== action || pending.transferId !== transferId)) throw new Error("Resolve the saved transfer stage before starting another command");
      const reference = pending || { key: crypto.randomUUID(), action, ...(transferId ? { transferId } : {}) };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(reference)); setPending(reference);
      const request = frozen.current || { reference, input: JSON.parse(JSON.stringify(input)) as object }; frozen.current = request; setHasFrozen(true);
      const result = await submitTransfer(locationId, request.reference, request.input); if (current()) setOutcome(result);
    } catch (failure) { if (current()) { setError(transferError(failure)); setCanReview([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!pending || lock.current || !current()) return; lock.current = true; setBusy(true); setError("");
    try { const result = await recoverTransfer(locationId, pending); if (current()) setOutcome(result); }
    catch (failure) { if (current()) setError(transferError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function acknowledge() {
    if (!outcome || !current() || lock.current) return;
    try {
      if (parseTransferReference(sessionStorage.getItem(storageKey))?.key !== outcome.requestKey) throw new Error("Transfer reference changed. Check the saved outcome");
      sessionStorage.removeItem(storageKey); const transferId = outcome.id; setPending(null); setOutcome(null); setReviewing(false); setCanReview(false); frozen.current = null; setHasFrozen(false);
      void open(transferId);
    } catch (failure) { setError(transferError(failure)); }
  }
  const locked = busy || reading || loading || Boolean(outcome || initial.error || pending && !reviewing), sourceBranch = selected?.sourceLocationId === locationId;
  const draftQuantity = Number(quantity), actualStageQuantity = Number(stageQuantity);
  const whole = (value: number) => Number.isSafeInteger(value) && value > 0;
  const stage = (action: TransferAction) => { if (selected) void command(action, { expectedRevision: selected.revision, reviewReference: stageReview.trim(), ...(["receive", "resolve"].includes(action) ? { quantity: actualStageQuantity, disposition } : {}) }, selected.id); };
  return <section aria-label="Pharmacy stock transfers" className="space-y-4">
    <p>Move an approved source batch between reviewed branches of the same legal issuer, state and GST registration. Use the actual delivery document reference. Separate GST registrations and interstate transfers need their own tax-document workflow.</p>
    {error && <Alert variant="error" title="Transfer requires attention">{error}</Alert>}
    {pending && <Alert variant="warning" title="Transfer stage reference"><p>{pending.action}: {pending.key}. Keep this reference until the outcome is confirmed.</p>
      <Button size="sm" variant="outline" disabled={busy || reading} onClick={() => void recover()}>Check transfer outcome</Button>
      {hasFrozen && !outcome && <Button size="sm" variant="outline" disabled={busy || reading} onClick={() => { const request = frozen.current; if (request) void command(request.reference.action, request.input, request.reference.transferId); }}>Retry same transfer stage</Button>}
      {canReview && !outcome && <Button size="sm" variant="outline" disabled={busy} onClick={() => { frozen.current = null; setHasFrozen(false); setCanReview(false); setReviewing(true); setError(""); }}>Review rejected stage</Button>}
    </Alert>}
    {outcome && <Alert variant="success" title="Transfer stage recorded"><p>{outcome.transportReference}: revision {outcome.revision}; dispatched {outcome.dispatchedQuantity}, received {outcome.receivedQuantity}, quarantined {outcome.quarantinedQuantity}, lost {outcome.lostQuantity}, returned {outcome.returnedQuantity}, in transit {outcome.inTransitQuantity}.</p><Button size="sm" onClick={acknowledge}>Acknowledge recorded transfer stage</Button></Alert>}
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={locked} onClick={() => void history()}>Refresh transfers</Button>{cursor && <Button size="sm" variant="outline" disabled={locked} onClick={() => void history(true)}>Older transfers</Button>}</div>
    {loading && <p role="status">Loading transfers...</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.id}><Button size="sm" variant="outline" disabled={locked} onClick={() => void open(row.id)}>{row.transportReference} · {row.status} · {row.quantity} {row.unit.baseUnit} · {row.sourceLocationId === locationId ? "Outgoing" : "Incoming"}</Button></li>)}</ul>
    {selected && <section aria-label="Selected stock transfer" className="space-y-3 rounded-xl border border-border p-3">
      <h3>{selected.transportReference}: {selected.sourceName}</h3><p>Batch {selected.lot.batchNumber}; expiry {new Date(selected.lot.expiryDate).toLocaleDateString("en-IN")}. Approved {selected.quantity} {selected.unit.baseUnit}; in transit {selected.inTransitQuantity}.</p>
      <p>Dispatched {selected.dispatchedQuantity}; saleable receipt {selected.receivedQuantity}; quarantine {selected.quarantinedQuantity}; loss {selected.lostQuantity}; returned {selected.returnedQuantity}.</p>
      <p>Acquisition basis: {selected.lot.costBasis.totalPaise} paise per {selected.lot.costBasis.receivedBaseUnits} base units. Each partial lot retains this exact fraction.</p>
      {selected.events && <><ol aria-label="Transfer stage history">{selected.events.map(event => <li key={event.id}>{event.action} · revision {event.revision} · {event.quantity} units {event.disposition || ""} · {event.reviewReference}</li>)}</ol>{selected.nextEventsCursor && <Button size="sm" variant="outline" disabled={locked} onClick={() => void open(selected.id, selected.nextEventsCursor!)}>Older transfer stages</Button>}</>}
      <fieldset disabled={locked} className="space-y-2"><Input label="Transfer stage review reference *" minLength={10} maxLength={300} value={stageReview} onChange={event => setStageReview(event.target.value)} />
        {sourceBranch && ["draft", "approved"].includes(selected.status) && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!canStart || stageReview.trim().length < 10} onClick={() => stage(selected.status === "draft" ? "approve" : "dispatch")}>{selected.status === "draft" ? "Approve both branches" : "Dispatch approved batch"}</Button><Button size="sm" variant="outline" disabled={stageReview.trim().length < 10} onClick={() => stage("cancel")}>Cancel unshipped transfer</Button></div>}
        {selected.status === "in_transit" && <><Input label="Physical stage quantity" type="number" min="1" max={selected.inTransitQuantity} step="1" value={stageQuantity} onChange={event => setStageQuantity(event.target.value)} />
          <Select label="Physical stock disposition" value={disposition} onChange={event => setDisposition(event.target.value)} options={sourceBranch ? [{ value: "return_to_source", label: "Returned to source quarantine" }, { value: "lost", label: "Reviewed in-transit loss (both branches)" }] : [{ value: "saleable", label: "Received saleable" }, { value: "quarantined", label: "Received into quarantine" }]} />
          <Button size="sm" disabled={!whole(actualStageQuantity) || actualStageQuantity > selected.inTransitQuantity || stageReview.trim().length < 10 || sourceBranch && !["lost", "return_to_source"].includes(disposition)} onClick={() => stage(sourceBranch ? "resolve" : "receive")}>Record physical stage</Button>
        </>}
      </fieldset>
    </section>}
    <form aria-label="New reviewed stock transfer" className="space-y-3 rounded-xl border border-border p-3" onSubmit={event => { event.preventDefault(); if (canStart && whole(draftQuantity) && draftQuantity <= (lots.find(lot => lot.id === lotId)?.quantity || 0)) void command("create", { destinationLocationId: destination, sourceMedicineId: sourceProduct, destinationMedicineId: destinationProduct, sourceBatchId: lotId, quantity: draftQuantity, transportReference: transport.trim(), reviewReference: review.trim() }); }}>
      <h3>Prepare a transfer</h3>{!canStart && <p>New transfer preparation, approval and dispatch require active pharmacy access at both branches. Existing dispatched goods remain available for authorized receipt or resolution.</p>}
      <fieldset disabled={locked || !canStart} className="space-y-3">
        <Select label="Destination branch" value={destination} options={[{ value: "", label: "Choose destination" }, ...locations.filter(location => location.id !== locationId).map(location => ({ value: location.id, label: location.name }))]} onChange={event => { setDestination(event.target.value); setDestinationProduct(""); setDestinationProducts([]); }} />
        <div className="flex flex-wrap gap-2"><Input label="Find source product" maxLength={100} value={sourceSearch} onChange={event => setSourceSearch(event.target.value)} /><Button type="button" size="sm" variant="outline" onClick={() => { setSourceProduct(""); setLots([]); setLotId(""); void read(() => searchTransferProducts(locationId, sourceSearch), setSourceProducts); }}>Search source products</Button></div>
        <Select label="Source product" value={sourceProduct} options={[{ value: "", label: "Choose source product" }, ...sourceProducts.map(product => ({ value: product.id, label: `${product.name} / ${product.identity}` }))]} onChange={event => { if (event.target.value) void sourceLots(event.target.value); else { setSourceProduct(""); setLots([]); setLotId(""); } }} />
        <Select label="Source batch" value={lotId} options={[{ value: "", label: "Choose actual batch" }, ...lots.map(lot => ({ value: lot.id, label: `${lot.batchNumber} / ${lot.quantity} / ${new Date(lot.expiryDate).toLocaleDateString("en-IN")}` }))]} onChange={event => setLotId(event.target.value)} />
        {lotCursor && <Button type="button" size="sm" variant="outline" onClick={() => void sourceLots(sourceProduct, true)}>Older source batches</Button>}
        <div className="flex flex-wrap gap-2"><Input label="Find destination product" maxLength={100} value={destinationSearch} onChange={event => setDestinationSearch(event.target.value)} /><Button type="button" size="sm" variant="outline" disabled={!destination} onClick={() => { setDestinationProduct(""); void read(() => searchTransferProducts(destination, destinationSearch), setDestinationProducts); }}>Search destination products</Button></div>
        <Select label="Destination product" value={destinationProduct} options={[{ value: "", label: "Confirm matching destination product" }, ...destinationProducts.map(product => ({ value: product.id, label: `${product.name} / ${product.identity}` }))]} onChange={event => setDestinationProduct(event.target.value)} />
        <Input label="Transfer base quantity" type="number" min="1" max={lots.find(lot => lot.id === lotId)?.quantity || 1_000_000} step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} />
        <Input label="Delivery document reference *" minLength={3} maxLength={120} required value={transport} onChange={event => setTransport(event.target.value)} />
        <Input label="Transfer preparation review reference *" minLength={10} maxLength={300} required value={review} onChange={event => setReview(event.target.value)} />
        <Button type="submit" size="sm" disabled={!destination || !sourceProduct || !destinationProduct || !lotId || !whole(draftQuantity) || draftQuantity > 1_000_000 || draftQuantity > (lots.find(lot => lot.id === lotId)?.quantity || 0) || review.trim().length < 10 || transport.trim().length < 3}>Prepare reviewed transfer</Button>
      </fieldset>
    </form>
  </section>;
}
