"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { pickupStatusLabels, pickupTokenFromScan, type StaffPickup } from "@/lib/publicPharmacy";
import { changePickup, pickupError, readPickupQueue, scanPickupTicket, type PickupTransition } from "@/lib/pharmacyPickup";
import { PharmacyCollections } from "./PharmacyCollections";

interface Props { locationId: string; canPrepare: boolean; canCollect: boolean; canOpenTill: boolean }
export function PharmacyPickups(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <PickupSession key={`${scope}:${props.locationId}`} {...props} scope={scope} />;
}
function PickupSession({ locationId, scope, canPrepare, canCollect, canOpenTill }: Props & { scope: string }) {
  const [rows, setRows] = useState<StaffPickup[]>([]), [selected, setSelected] = useState<StaffPickup | null>(null);
  const [status, setStatus] = useState(""), [cursor, setCursor] = useState<string | undefined>(), [next, setNext] = useState<string | null>(null);
  const [scan, setScan] = useState(""), [invoiceNumber, setInvoiceNumber] = useState(""), [invoice, setInvoice] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [queueError, setQueueError] = useState("");
  const [pending, setPending] = useState(false), [notice, setNotice] = useState("");
  const begin = useLatestRead(), detail = useLatestRead(), lock = useRef(false), alive = useRef(true);
  const frozen = useRef<{ id: string; input: PickupTransition; key: string } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    const read = begin(); setLoading(true); setQueueError("");
    try { const page = await readPickupQueue(locationId, status, cursor, read.signal); if (read.isCurrent()) { setRows(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (read.isCurrent()) setQueueError(pickupError(failure)); }
    finally { if (read.isCurrent()) setLoading(false); }
  }, [begin, locationId, status, cursor]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) { setRows([]); void load(); } }); return () => { active = false; }; }, [load]);
  async function open(ticket: string) {
    if (lock.current || pending || !current()) return;
    const read = detail(); setError(""); setNotice("");
    try { const row = await scanPickupTicket(locationId, pickupTokenFromScan(ticket)); if (read.isCurrent() && current()) { setSelected(row); setInvoiceNumber(row.invoiceNumber || ""); } }
    catch (failure) { if (read.isCurrent() && current()) setError(pickupError(failure)); }
  }
  async function transition(action: PickupTransition["action"]) {
    if (!selected || !canPrepare || lock.current || !current()) return;
    detail(); lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      frozen.current ||= { id: selected.id, key: crypto.randomUUID(), input: { locationId, action, expectedRevision: selected.revision, ...(action === "ready" ? { invoiceNumber: invoiceNumber.trim() } : {}) } };
      const command = frozen.current, row = await changePickup(command.id, command.input, command.key);
      if (current()) { setSelected(row); setPending(false); frozen.current = null; setNotice(`Pickup ${row.reference}: ${pickupStatusLabels[row.status]}`); void load(); }
    } catch (failure) {
      if (current()) { const code = (failure as { response?: { status?: number } })?.response?.status; setError(pickupError(failure)); const uncertain = !code || code >= 500; setPending(uncertain); if (!uncertain) frozen.current = null; }
    } finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <div className="space-y-5">
    <header><h2 className="text-lg font-semibold">Medicine pickups</h2><p className="mt-1 text-sm text-text-secondary">Prepare the requested medicines using Counter sale, then link that saved bill to the parcel. Scan the customer's QR at handover.</p></header>
    <form onSubmit={event => { event.preventDefault(); void open(scan); }} className="flex flex-wrap items-end gap-3"><Input label="Scan pickup QR or enter ticket reference" placeholder="Ticket link or PK reference" value={scan} maxLength={500} onChange={event => setScan(event.target.value)} containerClassName="min-w-0 flex-1 basis-72" disabled={busy || pending} /><Button type="submit" disabled={busy || pending || !scan.trim()}>Find parcel</Button></form>
    {error && <Alert variant="error" title="Pickup needs attention">{error}{pending && <Button loading={busy} size="sm" onClick={() => { if (frozen.current) void transition(frozen.current.input.action); }}>Check / retry same operation</Button>}</Alert>}
    {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card contentClassName="gap-4"><div className="flex flex-wrap items-end justify-between gap-3"><Select label="Pickup queue" value={status} onChange={event => { setStatus(event.target.value); setCursor(undefined); }} options={[{ value: "", label: "Active requests" }, { value: "requested", label: "Requested" }, { value: "ready", label: "Ready" }, { value: "collected", label: "Collected" }, { value: "cancelled", label: "Cancelled" }]} /><Button size="sm" variant="outline" onClick={() => { void load(); }} loading={loading}>Refresh queue</Button></div>
        {queueError && <Alert variant="error" title="Queue unavailable">{queueError}</Alert>}
        {!loading && !queueError && !rows.length && <p className="text-sm text-text-secondary">No pickups in this view.</p>}
        {loading && <p role="status" className="text-sm">Loading pickups...</p>}
        <ul className="divide-y divide-border">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{row.reference} · {row.customerName}</p><p className="mt-1 text-xs text-text-secondary">{row.items.length} medicines · {pickupStatusLabels[row.status]}</p></div><Button size="sm" variant="outline" disabled={busy || pending} onClick={() => { void open(row.reference); }}>Open parcel</Button></li>)}</ul>
        <div className="flex gap-2">{cursor && <Button size="sm" variant="outline" onClick={() => setCursor(undefined)}>Newest pickups</Button>}{next && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(next)}>Older pickups</Button>}</div>
      </Card>
      {selected ? <Card contentClassName="gap-4"><header className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{selected.reference}</h3><Badge>{pickupStatusLabels[selected.status]}</Badge></header><p className="text-sm">{selected.customerName} · {selected.phone}</p><p className="text-xs text-text-secondary">Valid until {new Date(selected.expiresAt).toLocaleString()}</p>
        <ul className="divide-y divide-border">{selected.items.map(item => <li key={item.medicineId} className="flex justify-between gap-3 py-3 text-sm"><span>{item.name} {item.strength}</span><strong>{item.quantity} {item.baseUnit}</strong></li>)}</ul>
        {selected.invoiceNumber && <p className="text-sm">Linked bill: {selected.invoiceNumber}</p>}
        {selected.invoiceId && <Button variant="outline" onClick={() => setInvoice(selected.invoiceId!)}>View bill / record payment</Button>}
        {canPrepare && selected.status === "requested" && <><Input label="Saved counter bill number" placeholder="Issue the bill for these exact quantities first" value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} disabled={busy || pending} maxLength={100} /><Button loading={busy} disabled={pending || !invoiceNumber.trim()} onClick={() => { void transition("ready"); }}>Mark parcel ready</Button></>}
        {canPrepare && selected.status === "ready" && <><p className="text-sm text-text-secondary">Check the parcel against this list. Handover is allowed once the linked bill is fully paid.</p><Button loading={busy} disabled={pending} onClick={() => { void transition("collect"); }}>Confirm parcel handed over</Button></>}
        {canPrepare && ["requested", "ready", "expired"].includes(selected.status) && <><Button variant="outline" disabled={busy || pending} onClick={() => { void transition("cancel"); }}>Cancel pickup request</Button><p className="text-xs text-text-secondary">Cancelling a request does not cancel its bill or return stock. Handle a billed return through the existing Returns flow.</p></>}
      </Card> : <Card><p className="text-sm text-text-secondary">Open a request or scan a ticket to see its parcel.</p></Card>}
    </div>
    {invoice && <PharmacyCollections locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={invoice} focusOnly onInvoiceClose={() => { setInvoice(""); if (selected) void open(selected.reference); }} />}
  </div>;
}
