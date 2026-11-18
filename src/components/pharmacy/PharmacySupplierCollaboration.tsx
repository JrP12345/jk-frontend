"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { createPharmacyLocalClient } from "@/lib/pharmacyDrafts";
import { orderError, type PurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
import { downloadSupplierDocument, fileDocument, readCollaboration, sendCollaboration, startSupplierDownload, supplierResponseLink, type CollaborationCommand, type SupplierCollaboration } from "@/lib/pharmacySupplierCollaboration";
import styles from "./PharmacyWorkspace.module.css";

export function PharmacySupplierCollaboration({ order, canManage, onClose }: { order: PurchaseOrder; canManage: boolean; onClose: () => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CollaborationSession key={`${scope}:${order.id}`} order={order} canManage={canManage} onClose={onClose} scope={scope} />;
}
function CollaborationSession({ order, canManage, onClose, scope }: { order: PurchaseOrder; canManage: boolean; onClose: () => void; scope: string }) {
  const [data, setData] = useState<SupplierCollaboration | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [durable, setDurable] = useState(true), [pending, setPending] = useState<CollaborationCommand | null>(null), [rejected, setRejected] = useState(false);
  const [hours, setHours] = useState("72"), [link, setLink] = useState(""), [confirmed, setConfirmed] = useState(false), [file, setFile] = useState<File | null>(null), [kind, setKind] = useState("invoice"), [visible, setVisible] = useState(false), [info, setInfo] = useState("");
  const read = useLatestRead(), alive = useRef(true), lock = useRef(false);
  const [journal] = useState(() => createPharmacyLocalClient<CollaborationCommand | null>(scope, order.locationId, `supplier-order:${order.id}`, raw => {
    if (raw === null) return null; const row = raw as CollaborationCommand;
    if (!row || !/^[a-zA-Z0-9_-]{8,100}$/.test(row.key) || !["supplier-link", "supplier-email", "documents"].includes(row.kind) || row.input?.locationId !== order.locationId || JSON.stringify(raw).length > 6 * 1024 * 1024) throw new Error("Original supplier request needs review"); return row;
  }));
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  async function load() { const request = read(); try { const saved = await readCollaboration(order.id, order.locationId, request.signal); if (request.isCurrent() && current()) setData(saved); } catch (failure) { if (request.isCurrent() && current()) setError(orderError(failure)); } }
  useEffect(() => { alive.current = true; void journal.load().then(saved => { if (current()) { setPending(saved.value); setDurable(saved.durable); setReady(true); } }).catch(failure => { if (current()) setError(orderError(failure)); }); void Promise.resolve().then(() => { if (current()) void load(); }); return () => { alive.current = false; read(); }; // Sessions are keyed to the authenticated branch/order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function execute(command: CollaborationCommand) {
    if (lock.current || !canManage || !current() || !ready) return; lock.current = true; setBusy(true); setError(""); setInfo(""); setRejected(false);
    try {
      const frozen = JSON.parse(JSON.stringify(command)) as CollaborationCommand, stored = await journal.save(frozen); if (!current()) return; setPending(frozen); setDurable(stored.durable);
      const result = await sendCollaboration(order.id, frozen); if (!current()) return;
      if (command.kind === "supplier-link") setLink(result.token ? supplierResponseLink(result.token, "publicLinkOrigin" in result ? result.publicLinkOrigin : undefined) : "");
      await journal.save(null); if (!current()) return; setPending(null); setConfirmed(false); setFile(null); setInfo(command.kind === "documents" ? "Document retained for review. No purchase or stock was posted." : command.kind === "supplier-email" ? "Email queued. Check its delivery state below." : result.token ? "New supplier link created. Previous links no longer work." : "Supplier link revoked."); await load();
    } catch (failure) { if (current()) { setError(orderError(failure)); setRejected([400, 403, 404, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  const send = (commandKind: CollaborationCommand["kind"], fields: Record<string, unknown>) => execute({ key: crypto.randomUUID(), kind: commandKind, input: { locationId: order.locationId, ...fields } });
  async function upload() { if (!file || lock.current) return; try { const upload = await fileDocument(file); if (current()) await send("documents", { ...upload, kind, supplierVisible: visible, confirmed: true }); } catch (failure) { if (current()) setError(orderError(failure)); } }
  async function download(documentId: string) { try { const saved = await downloadSupplierDocument(order.id, order.locationId, documentId); if (current()) startSupplierDownload(saved); } catch (failure) { if (current()) setError(orderError(failure)); } }
  const disabled = busy || !ready || Boolean(pending), closed = ["draft", "cancelled", "closed"].includes(order.state);
  return <Modal open title={`Supplier link and documents ${order.reference}`} onClose={onClose} busy={busy} size="lg" bodyClassName={styles.dialog}>
    <p>Only this order is shared. Anyone holding its private link can respond and upload files until it expires or is revoked. Supplier balances, other orders and internal documents remain private.</p>
    {error && <Alert variant="error" title="Supplier request needs attention">{error}</Alert>}{info && <Alert variant="info" title="Supplier order updated">{info}</Alert>}
    {!durable && <Alert variant="warning" title="Recovery is memory only">Keep this tab open until the original request is resolved.</Alert>}
    {pending && <Alert variant="warning" title="Original supplier request retained"><p>Reference {pending.key}. Retry the same details to check the saved result.</p><Button size="sm" disabled={busy || !canManage} onClick={() => { void execute(pending); }}>Retry original supplier request</Button>{rejected && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void journal.save(null).then(() => { if (current()) { setPending(null); setRejected(false); setError(""); void load(); } }).catch(failure => { if (current()) setError(orderError(failure)); }); }}>Review rejected supplier request</Button>}</Alert>}
    <Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>Refresh supplier delivery and documents</Button>
    {!data ? <p role="status">Loading supplier collaboration…</p> : <>
      <p>{data.access?.active ? `Response link expires ${new Date(data.access.expiresAt).toLocaleString("en-IN")}` : "No active supplier response link."}</p>
      {!data.publicLinkOrigin && <Alert variant="warning" title="Public supplier address is not configured">Development links may only work inside your local environment. Set the deployed public HTTPS address before sharing with remote suppliers.</Alert>}
      {data.email && <p role="status">Latest email: {data.email.status}. Queued {new Date(data.email.queuedAt).toLocaleString("en-IN")}. Queued or accepted does not mean the supplier has read the order.</p>}
      {canManage && <fieldset className={styles.form} disabled={disabled}>
        {closed && <p>Record an actual sent order before creating a supplier response link. Cancelled/closed orders cannot issue links.</p>}
        <Input label="Supplier link lifetime (hours)" type="number" min={1} max={168} value={hours} onChange={event => setHours(event.target.value)} />
        <Checkbox label="I verified the intended supplier and understand that this link grants access to this order" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        <div className={styles.actions}><Button size="sm" disabled={!confirmed || closed} onClick={() => { void send("supplier-link", { expectedRevision: data.revision, action: "issue", expiresInHours: Number(hours), confirmed: true }); }}>Create / replace supplier link</Button><Button size="sm" variant="outline" disabled={!confirmed || !data.access?.active} onClick={() => { void send("supplier-link", { expectedRevision: data.revision, action: "revoke", confirmed: true }); }}>Revoke supplier link</Button></div>
        {link && <><Input label="Private supplier response link" value={link} readOnly /><div className={styles.actions}><Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(link).then(() => { if (current()) setInfo("Supplier link copied."); }).catch(() => { if (current()) setError("Copy the link from the field above."); }); }}>Copy supplier link</Button><a href={`https://wa.me/?text=${encodeURIComponent(`Purchase order ${order.reference}: ${link}`)}`} target="_blank" rel="noopener noreferrer">Share using WhatsApp</a></div></>}
        <Button size="sm" variant="outline" disabled={!confirmed || !data.access?.active || !data.emailAvailable} onClick={() => { void send("supplier-email", { expectedRevision: data.revision, confirmed: true }); }}>Email link to current supplier address</Button>
        {!data.emailAvailable && <p>Email delivery needs server SMTP configuration, a public HTTPS APP_URL and the existing outbound worker. Use the private link manually meanwhile.</p>}
        <h3>Attach supplier evidence</h3><p>PDF or image, up to 4 MB, at most 25 files per order. Attaching an invoice never imports or posts it automatically.</p>
        <Select label="Supplier document kind" value={kind} onChange={event => setKind(event.target.value)} options={[{ value: "invoice", label: "Supplier invoice" }, { value: "credit_note", label: "Credit note" }, { value: "statement", label: "Statement" }, { value: "dispatch", label: "Dispatch document" }, { value: "other", label: "Other document" }]} />
        <Input label="Supplier document file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} />
        <Checkbox label="Share this attachment with the supplier holding this order link" checked={visible} onChange={event => setVisible(event.target.checked)} />
        <Button size="sm" disabled={!file || !data.storageAvailable} onClick={() => { void upload(); }}>Upload supplier document for review</Button>{!data.storageAvailable && <p>Private document storage needs the existing R2 credentials before uploads are available.</p>}
      </fieldset>}
      <h3>Retained order documents</h3>{!data.documents.length && <p>No documents attached.</p>}{data.documents.map(doc => <article key={doc.id} className={styles.card}><div className={styles.identity}><strong>{doc.name}</strong><small>{doc.kind.replaceAll("_", " ")} · {doc.source === "supplier_link" ? "Supplier link upload; verify before posting" : doc.supplierVisible ? "Shared with supplier" : "Internal document"} · {Math.ceil(doc.size / 1024)} KB</small></div><Button size="sm" variant="outline" onClick={() => { void download(doc.id); }}>Download {doc.name}</Button></article>)}
    </>}
  </Modal>;
}
