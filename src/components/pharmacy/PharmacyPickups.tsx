"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, Package, RotateCw, ScanLine } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Modal, Select, Stepper, cn } from "@/components/ui";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import { PharmacyDetailLoadingState } from "./PharmacyDetailLoader";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { pickupStatusLabels, pickupTokenFromScan, type StaffPickup } from "@/lib/publicPharmacy";
import { changePickup, pickupError, readPickupQueue, readStaffPickupAttachment, scanPickupTicket, type PickupTransition } from "@/lib/pharmacyPickup";
import { PharmacyCollections } from "./PharmacyCollections";
import { PharmacyPickupAttachmentsView } from "./PharmacyPickupAttachmentsView";

interface Props { onPrepare?: (pickup: StaffPickup) => void; onResolveBill?: (invoiceId: string) => void; locationId: string; canPrepare: boolean; canCollect: boolean; canOpenTill: boolean }
const statusVariant = (status: StaffPickup["status"]) => status === "requested" ? "warning" : status === "ready" ? "primary" : status === "collected" ? "success" : "neutral";
function PickupStatusBadge({ status, compact = false }: { status: StaffPickup["status"]; compact?: boolean }) {
  return <Badge className="max-w-full" dot title={pickupStatusLabels[status]} variant={statusVariant(status)}><span className="whitespace-normal">{compact && status === "requested" ? "Waiting" : pickupStatusLabels[status]}</span></Badge>;
}
function previewTicketLabel(ticket: string) {
  try {
    const token = pickupTokenFromScan(ticket);
    return /^[a-f0-9]{64}$/i.test(token) ? "Scanned pickup ticket" : token;
  } catch {
    return ticket.trim() || "Pickup ticket";
  }
}
export function PharmacyPickups(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <PickupSession key={`${scope}:${props.locationId}`} {...props} scope={scope} />;
}
function PickupSession({ locationId, scope, onPrepare, onResolveBill, canPrepare, canCollect, canOpenTill }: Props & { scope: string }) {
  const [rows, setRows] = useState<StaffPickup[]>([]), [selected, setSelected] = useState<StaffPickup | null>(null);
  const [status, setStatus] = useState(""), [cursor, setCursor] = useState<string | undefined>(), [next, setNext] = useState<string | null>(null);
  const [scan, setScan] = useState(""), [invoiceNumber, setInvoiceNumber] = useState(""), [invoice, setInvoice] = useState("");
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [queueError, setQueueError] = useState("");
  const [pending, setPending] = useState(false), [notice, setNotice] = useState("");
  const mobile = useMobileViewport();
  const [detailOpen, setDetailOpen] = useState(false), [linking, setLinking] = useState(false);
  const [detailPreview, setDetailPreview] = useState<Pick<StaffPickup, "reference" | "customerName" | "phone" | "status" | "expiresAt"> | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
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
  function closeDetail() {
    detail();
    setDetailLoading(false);
    setDetailOpen(false);
    setDetailPreview(null);
    setError("");
  }
  async function open(ticket: string, preview?: StaffPickup) {
    if (lock.current || pending || !current()) return;
    const read = detail(); setError(""); setNotice("");
    setSelected(null);
    setDetailPreview(preview || { reference: previewTicketLabel(ticket), customerName: "", phone: "", status: "requested", expiresAt: "" });
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const row = await scanPickupTicket(locationId, pickupTokenFromScan(ticket));
      if (read.isCurrent() && current()) { setSelected(row); setDetailPreview(null); setInvoiceNumber(row.invoiceNumber || ""); setLinking(false); }
    }
    catch (failure) { if (read.isCurrent() && current()) setError(pickupError(failure)); }
    finally { if (read.isCurrent() && current()) setDetailLoading(false); }
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
  const sheetOpen = mobile && detailOpen && !invoice;
  const headerRow = selected || detailPreview;
  const feedback = <>{error && <Alert variant="error" title="Pickup needs attention">{error}{pending && <Button loading={busy} size="xs" onClick={() => { if (frozen.current) void transition(frozen.current.input.action); }}>Check / retry same operation</Button>}</Alert>}{notice && <p role="status" className="text-xs text-accent">{notice}</p>}</>;
  const detailHeader = headerRow && <div className="min-w-0 space-y-1.5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{headerRow.reference}</h3>{(selected || headerRow.customerName) && <Badge className="max-w-full" variant={statusVariant(headerRow.status)}><span className="whitespace-normal">{pickupStatusLabels[headerRow.status]}</span></Badge>}</div>{headerRow.customerName && <p className="break-words text-xs text-text-secondary">{headerRow.customerName}{headerRow.phone ? ` · ${headerRow.phone}` : ""}</p>}{headerRow.expiresAt && <p className="text-[11px] text-text-secondary">Valid until {new Date(headerRow.expiresAt).toLocaleString()}</p>}</div>;
  const detailBody = (selected || detailLoading || detailOpen) && <div className="space-y-4">
    {feedback}
    {detailLoading && !selected ? <PharmacyDetailLoadingState label="Loading parcel details..." /> : selected && <>
    {!["cancelled", "expired"].includes(selected.status) && <Stepper steps={[{ label: "Requested" }, { label: "Prepare bill" }, { label: "Link bill" }, { label: "Handover" }]} currentStep={selected.status === "collected" ? 4 : selected.status === "ready" ? 3 : linking ? 2 : 1} />}
    <section aria-label="Requested medicines">
      <h4 className="border-b border-border/60 pb-2 text-xs font-semibold text-text-secondary">Requested medicines ({selected.items.length})</h4>
      {selected.items.length > 0 ? <ul className="divide-y divide-border/60">{selected.items.map(item => <li key={item.medicineId} className="flex items-start justify-between gap-4 py-2.5 text-xs"><span className="min-w-0">{item.name} {item.strength}</span><strong className="shrink-0 font-semibold tabular-nums">{item.quantity} {item.baseUnit}</strong></li>)}</ul> : <p className="py-2 text-xs text-text-secondary">No pre-selected catalogue medicines. Check written instructions or uploaded files below and add matching medicines in Counter.</p>}
    </section>
    {selected.notes && <section aria-label="Customer description" className="rounded-xl border border-border/70 bg-surface-alt/50 p-3"><h4 className="text-xs font-semibold text-text-secondary">Written request / instructions</h4><p className="mt-1 whitespace-pre-wrap break-words text-xs text-text">{selected.notes}</p></section>}
    {selected.attachments && selected.attachments.length > 0 && <section aria-label="Uploaded prescription or notes" className="space-y-2"><h4 className="text-xs font-semibold text-text-secondary">Uploaded images / PDF ({selected.attachments.length})</h4><PharmacyPickupAttachmentsView attachments={selected.attachments} fetchBlob={(attachmentId, download, signal) => readStaffPickupAttachment(locationId, selected.id, attachmentId, download, signal)} /></section>}
    {selected.invoiceNumber && <p className="border-t border-border/60 pt-3 text-xs text-text-secondary">Linked bill: <strong className="font-medium text-text">{selected.invoiceNumber}</strong></p>}
    {canPrepare && selected.status === "requested" && linking && <form aria-label="Link saved parcel bill" className="space-y-2 border-t border-border/60 pt-3" onSubmit={event => { event.preventDefault(); if (!busy && !pending && invoiceNumber.trim()) void transition("ready"); }}><Input size="sm" label="Saved counter bill number" placeholder="Bill for these exact quantities" value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} disabled={busy || pending} maxLength={100} /><div className="flex justify-end"><Button size="xs" type="submit" loading={busy} disabled={pending || !invoiceNumber.trim()}>Mark parcel ready</Button></div></form>}
    {canPrepare && selected.status === "ready" && <p className="text-xs text-text-secondary">Check the parcel against this list. Handover is allowed once the linked bill is fully paid.</p>}
    </>}
  </div>;
  const detailActions = selected && (selected.invoiceId || canPrepare && ["requested", "ready", "expired"].includes(selected.status)) ? <div className="w-full space-y-3"><div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
    {selected.invoiceId && <Button size="xs" variant="outline" disabled={busy || pending} onClick={() => setInvoice(selected.invoiceId!)}>View bill / record payment</Button>}
    {canPrepare && selected.status === "requested" && <>{onPrepare && <Button size="xs" disabled={busy || pending} onClick={() => { setDetailOpen(false); onPrepare(selected); }}>Prepare parcel bill</Button>}<Button size="xs" variant="outline" disabled={busy || pending} aria-expanded={linking} onClick={() => setLinking(value => !value)}>Link a bill already prepared</Button></>}
    {canPrepare && selected.status === "ready" && <Button size="xs" loading={busy} disabled={pending} onClick={() => { void transition("collect"); }}>Confirm parcel handed over</Button>}
    {selected.invoiceId && onResolveBill && ["cancelled", "expired"].includes(selected.status) && <Button size="xs" variant="outline" disabled={busy || pending} onClick={() => { setDetailOpen(false); onResolveBill(selected.invoiceId!); }}>Resolve parcel bill / returned goods</Button>}
    {canPrepare && ["requested", "ready", "expired"].includes(selected.status) && <Button size="xs" variant="outline" className="text-error-text sm:ml-auto" disabled={busy || pending} onClick={() => { void transition("cancel"); }}>Cancel pickup request</Button>}
  </div>{canPrepare && ["requested", "ready", "expired"].includes(selected.status) && <p className="text-[11px] leading-relaxed text-text-secondary">Cancelling a request does not cancel its bill or return stock. Handle a billed return through the existing Returns flow.</p>}</div> : undefined;

  return <section className="space-y-3" aria-label="Medicine pickup workspace">
    <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold">Medicine pickups</h2><p className="mt-1 hidden max-w-2xl text-xs text-text-secondary md:block">Prepare the requested medicines in Counter sale, link the saved bill, then scan the customer's QR at handover.</p></div><Button size="xs" variant="outline" aria-label="Refresh queue" title="Refresh queue" onClick={() => { void load(); }} loading={loading} icon={<RotateCw size={14} aria-hidden="true" />}><span className="hidden md:inline">Refresh queue</span></Button></header>
    <Card padding="sm" className="rounded-xl shadow-none"><form onSubmit={event => { event.preventDefault(); void open(scan); }} className="flex items-center gap-2"><Input size="sm" aria-label="Scan pickup QR or enter ticket reference" placeholder="Ticket link or PK reference" icon={<ScanLine size={15} aria-hidden="true" />} value={scan} maxLength={500} onChange={event => setScan(event.target.value)} containerClassName="min-w-0 flex-1" disabled={busy || pending} /><Button size="xs" type="button" variant="outline" aria-label="Scan QR with camera" title="Scan QR with camera" disabled={busy || pending} onClick={() => setScanDialogOpen(true)}><Camera size={15} aria-hidden="true" /></Button><Button size="xs" type="submit" aria-label="Find parcel" title="Find parcel" disabled={busy || pending || !scan.trim()}><span className="md:hidden"><ScanLine size={16} aria-hidden="true" /></span><span className="hidden md:inline">Find parcel</span></Button></form></Card>
    {(!detailOpen || mobile && !sheetOpen) && feedback}
    <div className="grid items-start gap-3 md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)] xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.5fr)]">
      <Card padding="none" className="rounded-xl shadow-none"><div className="flex items-center justify-between gap-3 border-b border-border/70 p-3"><h3 className="shrink-0 text-xs font-semibold">Pickup queue <span className="font-normal text-text-secondary">{rows.length}{next ? "+" : ""}</span></h3><Select size="sm" aria-label="Pickup queue" value={status} onChange={event => { setStatus(event.target.value); setCursor(undefined); }} options={[{ value: "", label: "Active requests" }, { value: "requested", label: "Requested" }, { value: "ready", label: "Ready" }, { value: "collected", label: "Collected" }, { value: "cancelled", label: "Cancelled" }]} /></div>
        {queueError && <div className="p-3"><Alert variant="error" title="Queue unavailable">{queueError}</Alert></div>}
        {!loading && !queueError && !rows.length && <p className="px-3 py-8 text-center text-xs text-text-secondary">No pickups in this view.</p>}
        {loading && <p role="status" className="p-3 text-xs text-text-secondary">Loading pickups...</p>}
        <ul className="max-h-[60dvh] divide-y divide-border/60 overflow-y-auto overscroll-contain">{rows.map(row => {
          const summaryParts = [row.items.length ? `${row.items.length} medicines` : "", row.notes ? "note" : "", row.attachments?.length ? `${row.attachments.length} ${row.attachments.length === 1 ? "file" : "files"}` : ""].filter(Boolean);
          return <li key={row.id}><button type="button" aria-label={`Open parcel ${row.reference}`} aria-pressed={selected?.id === row.id || (detailLoading && detailPreview?.reference === row.reference)} disabled={busy || pending} onClick={() => { void open(row.reference, row); }} className={cn("flex min-h-20 w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring disabled:opacity-50", (selected?.id === row.id || (detailLoading && detailPreview?.reference === row.reference)) && "bg-selected")}><span className="min-w-0 space-y-1"><strong className="block text-xs font-semibold">{row.reference}</strong><span className="block truncate text-[11px] text-text-secondary">{row.customerName} · {summaryParts.join(" · ") || "0 medicines"}</span><PickupStatusBadge status={row.status} compact /></span><ChevronRight size={15} className="shrink-0 text-text-secondary" aria-hidden="true" /></button></li>;
        })}</ul>
        {(cursor || next) && <div className="flex justify-between gap-2 border-t border-border/60 p-3">{cursor && <Button size="xs" variant="outline" disabled={busy || pending || loading} onClick={() => setCursor(undefined)}>Newest pickups</Button>}{next && <Button size="xs" variant="outline" disabled={busy || pending || loading} onClick={() => setCursor(next)}>Older pickups</Button>}</div>}
      </Card>
      {!mobile && (selected || detailLoading || detailOpen ? <Card padding="none" className="rounded-xl shadow-none">{detailHeader && <header className="border-b border-border/70 p-4">{detailHeader}</header>}<div className="p-4">{detailBody}</div>{selected && detailActions && <footer className="border-t border-border/70 p-3">{detailActions}</footer>}</Card> : <Card padding="lg" className="rounded-xl shadow-none"><div className="flex min-h-44 flex-col items-center justify-center gap-2 text-center text-text-secondary"><Package size={24} aria-hidden="true" /><p className="text-sm font-medium">Choose a pickup request</p><p className="text-xs">Open a request or scan a ticket to see its parcel.</p></div></Card>)}
    </div>
    {mobile && detailOpen && <Modal open={sheetOpen} busy={busy} title={selected?.reference || detailPreview?.reference || "Loading parcel"} ariaLabel={selected?.reference || (detailPreview?.reference ? `Opening ${detailPreview.reference}` : "Loading parcel")} header={detailHeader} presentation="sheet" size="md" onClose={closeDetail} footer={selected ? detailActions : undefined}>{detailBody}</Modal>}
    {invoice && <PharmacyCollections locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={invoice} focusOnly onInvoiceClose={() => { const currentPickup = selected; setInvoice(""); if (currentPickup) void open(currentPickup.reference, currentPickup); }} />}
    <PharmacyBarcodeScanDialog
      open={scanDialogOpen}
      title="Scan pickup QR or ticket code"
      onClose={() => setScanDialogOpen(false)}
      onDetected={code => {
        setScan(code);
        void open(code);
      }}
    />
  </section>;
}
