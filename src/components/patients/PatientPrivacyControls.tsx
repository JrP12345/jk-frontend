"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from '@/lib/authScope';
import { Alert, Button, Card, CardContent, Input, Select, Checkbox } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";

const purposes: Record<string, { label: string; notice: string }> = {
  COMMUNICATION_WHATSAPP: { label: "WhatsApp service messages", notice: "Allow this organization to send appointment and service messages to the recorded WhatsApp recipient." },
  COMMUNICATION_EMAIL: { label: "Email service messages", notice: "Allow this organization to send appointment and service messages to the recorded email recipient." },
  COMMUNICATION_PHONE: { label: "Service phone calls", notice: "Allow this organization to call the recorded recipient about appointments and services." },
  PREVENTIVE_HEALTH_RECALLS: { label: "Preventive care recalls", notice: "Allow this organization to contact the recorded recipient for preventive care recalls. The chosen channel also needs permission." },
  FEEDBACK_AND_SURVEYS: { label: "Feedback requests", notice: "Allow this organization to request feedback from the recorded recipient. The chosen channel also needs permission." },
  AI_CLINICAL_ASSISTANCE: { label: "AI clinical assistance", notice: "Allow this organization to use your clinical information for AI assistance in your care, subject to clinician review." },
};
interface Consent { revision: number; noticeVersion: string; purposes: { purpose: string; status: string; reviewRequired?: boolean }[] }
interface Privacy { revision: number; request: { status: string; retentionBasis?: string } | null; scope: string }
interface Rights { consent: boolean; privacy: boolean; export: boolean; consumer: boolean }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "The result could not be confirmed. Retry the same request, or close and reload before editing."; }

export function PatientPrivacyControls({ patientId }: { patientId: string }) {
  const user = useAuthStore(state => state.user);
  if (!user || user.role === "guest") return null;
  const consumer = ["patient", "family_member"].includes(user.role);
  const rights = { consumer, consent: consumer || hasAnyPermission(user, "RECORD_COMMUNICATION_CONSENT"),
    privacy: consumer || hasAnyPermission(user, "ADMINISTRATIVE_GOVERNANCE"), export: consumer || hasAnyPermission(user, "EXPORT_CRM") };
  if (!rights.consent && !rights.privacy && !rights.export) return null;
  return consumer ? <OrganizationChooser key={`${authScopeKey(user)}:${patientId}`} patientId={patientId} rights={rights} />
    : user.organization_id ? <PrivacyWorkspace key={`${authScopeKey(user)}:${patientId}`} patientId={patientId} organizationId={user.organization_id} rights={rights} /> : null;
}
function OrganizationChooser({ patientId, rights }: { patientId: string; rights: Rights }) {
  const [organizations, setOrganizations] = useState<{ id: string; name: string; consentAuthority?: boolean; dataRightsAuthority?: boolean }[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const response = await api.get("/dpdp/organizations", { params: { patientId, ...(next ? { cursor: next } : {}) }, signal: request.signal });
      if (!request.isCurrent()) return;
      const data = response.data.data;
      setOrganizations(current => next ? [...current, ...data.items] : data.items); setCursor(data.nextCursor);
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [patientId, beginRead]);
  useEffect(() => { void load(); }, [load]);
  const selected = organizations.find(row => row.id === organizationId);
  const scopedRights = { ...rights, consent: rights.consent && selected?.consentAuthority !== false, privacy: rights.privacy && selected?.dataRightsAuthority !== false, export: rights.export && selected?.dataRightsAuthority !== false };
  return <div className="space-y-3"><Card><CardContent className="space-y-3"><h2 className="font-semibold">Privacy and communication choices</h2>
    {error && <Alert variant="error">{error}</Alert>}
    <Select label="Organization for privacy choices" value={organizationId} disabled={loading} onChange={event => setOrganizationId(event.target.value)}
      options={organizations.map(org => ({ value: org.id, label: org.name }))} placeholder="Choose an organization" />
    {!loading && !error && organizations.length === 0 && <p>No associated organizations are available.</p>}
    <Button variant="outline" loading={loading} onClick={() => load()}>Reload organizations</Button>
    {cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More organizations</Button>}
  </CardContent></Card>{selected && <PrivacyWorkspace key={`${organizationId}:${scopedRights.consent}:${scopedRights.privacy}`} patientId={patientId} organizationId={organizationId} rights={scopedRights} />}</div>;
}
function PrivacyWorkspace({ patientId, organizationId, rights }: { patientId: string; organizationId: string; rights: Rights }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{ kind: "consent" | "request" | "review"; purpose?: string; status?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [nextCursors, setNextCursors] = useState<Record<string, string> | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const [consentResponse, privacyResponse] = await Promise.all([
        rights.consent ? api.get("/dpdp/consents", { params: { patientId, organizationId }, signal: request.signal }) : null,
        rights.privacy ? api.get("/dpdp/privacy-request", { params: { patientId, organizationId }, signal: request.signal }) : null,
      ]);
      if (!request.isCurrent()) return;
      setConsent(consentResponse?.data?.data || null); setPrivacy(privacyResponse?.data?.data || null);
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, patientId, organizationId, rights.consent, rights.privacy]);
  useEffect(() => { void load(); }, [load]);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function download(next = false) {
    if (exporting) return; setExporting(true); setError("");
    try {
      const response = await api.get("/dpdp/export", { params: { patientId, organizationId, ...(next && nextCursors ? {
        resources: Object.keys(nextCursors).join(","), ...Object.fromEntries(Object.entries(nextCursors).map(([name, value]) => [`${name}Cursor`, value])),
      } : {}) } });
      if (!active.current) return;
      const data = response.data.data;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `organization-patient-export-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url);
      const remaining = Object.fromEntries(Object.entries(data.metadata.nextCursors).filter(([, value]) => typeof value === "string")) as Record<string, string>;
      setNextCursors(Object.keys(remaining).length ? remaining : null);
      setExportStatus(data.metadata.truncated ? "Export page downloaded. More records remain; download the next page." : "Export page downloaded. No further records remain in this export.");
    } catch (failure) { if (active.current) setError(message(failure)); }
    finally { if (active.current) setExporting(false); }
  }
  return <Card><CardContent className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Organization privacy and consent</h2><Button variant="outline" size="sm" loading={loading} disabled={exporting} onClick={load}>Reload choices</Button></div>
    {error && <Alert variant="error">{error}</Alert>}
    <p className="text-sm text-text-muted">Choices apply to this organization. You can withdraw a granted purpose here. Unknown choices do not authorize optional communication.</p>
    {consent?.purposes.map(row => <div key={row.purpose} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div><p>{purposes[row.purpose]?.label || row.purpose}</p><p className="text-sm text-text-muted">{row.status}{row.reviewRequired ? " — evidence or recipient needs review" : ""}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || !!error} onClick={() => setAction({ kind: "consent", purpose: row.purpose, status: "GRANTED" })}>Record grant</Button><Button variant="outline" size="sm" disabled={loading || !!error} onClick={() => setAction({ kind: "consent", purpose: row.purpose, status: "WITHDRAWN" })}>Withdraw</Button></div></div>)}
    {privacy && <div className="space-y-2"><h3 className="font-medium">Privacy request: {privacy.request?.status || "none"}</h3><p className="text-sm text-text-muted">{privacy.scope}</p>{privacy.request?.retentionBasis && <p>Review basis: {privacy.request.retentionBasis}</p>}
      <Button variant="outline" disabled={loading || !!error || ["requested", "under_review"].includes(privacy.request?.status || "")} onClick={() => setAction({ kind: "request" })}>Request CRM erasure review</Button>
      {!rights.consumer && ["requested", "under_review"].includes(privacy.request?.status || "") && <Button variant="outline" disabled={loading || !!error} onClick={() => setAction({ kind: "review" })}>Review privacy request</Button>}</div>}
    {rights.export && <div className="space-y-2"><Button variant="outline" loading={exporting} disabled={loading || exporting} onClick={() => download()}>Download organization export</Button>{nextCursors && <Button variant="outline" disabled={exporting} onClick={() => download(true)}>Download next export page</Button>}<p role="status" className="text-sm text-text-muted">{exportStatus}</p></div>}
    {action && <PrivacyCommand patientId={patientId} organizationId={organizationId} action={action} consent={consent} privacy={privacy} consumer={rights.consumer}
      onClose={() => setAction(null)} onSaved={() => { setAction(null); void load(); }} />}
  </CardContent></Card>;
}
function PrivacyCommand({ patientId, organizationId, action, consent, privacy, consumer, onClose, onSaved }: {
  patientId: string; organizationId: string; action: { kind: "consent" | "request" | "review"; purpose?: string; status?: string };
  consent: Consent | null; privacy: Privacy | null; consumer: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("in_person_confirmation");
  const [decision, setDecision] = useState("under_review");
  const [basis, setBasis] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const submitted = useRef<Record<string, unknown> | null>(null);
  const title = action.kind === "consent" ? `${action.status === "GRANTED" ? "Grant" : "Withdraw"} ${purposes[action.purpose!]?.label}` : action.kind === "request" ? "Request CRM erasure review" : "Review privacy request";
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    submitted.current ||= { patientId, organizationId, clientRequestId, ...(action.kind === "consent" ? {
      expectedRevision: consent!.revision, method: consumer ? "portal_confirmation" : method, acknowledged: confirmed, noticeVersion: consent!.noticeVersion,
      note: reason.trim(), updates: [{ purpose: action.purpose, status: action.status }],
    } : action.kind === "request" ? { reason: reason.trim() } : { expectedRevision: privacy!.revision, decision, reason: reason.trim(), retentionBasis: basis.trim(), scopeConfirmed: confirmed }) };
    setLocked(true);
    try {
      if (action.kind === "request") await api.post("/dpdp/erasure", submitted.current);
      else await api.put(action.kind === "consent" ? "/dpdp/consents" : "/dpdp/privacy-request/review", submitted.current);
      onSaved();
    } catch (failure) { setError(message(failure)); } finally { setPending(false); }
  }
  const needsConfirmation = action.kind === "consent" && action.status === "GRANTED" || action.kind === "review" && decision === "fulfilled";
  const valid = (!needsConfirmation || confirmed) && (action.kind === "consent" && consumer || !!reason.trim()) && (action.kind !== "review" || !!basis.trim());
  return <Modal footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" form="patient-privacy-1" loading={pending} disabled={pending || !valid}>{error ? "Retry submitted request" : "Record choice"}</Button></div>} open title={title} busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}><form id="patient-privacy-1" onSubmit={save} className="space-y-3">
    {error && <Alert variant="error">{error} Close and reload to change the submitted details.</Alert>}
    <fieldset disabled={pending || locked} className="space-y-3">
      {action.kind === "consent" && <><p className="text-sm">{purposes[action.purpose!]?.notice} Withdrawal stops future optional use for this purpose; it does not erase retained records.</p>{!consumer && <Select label="Patient evidence method" value={method} onChange={event => setMethod(event.target.value)} options={[
        { value: "in_person_confirmation", label: "In-person confirmation" }, { value: "written_consent", label: "Written consent" }, { value: "verified_patient_request", label: "Verified patient request" },
      ]} />}</>}
      {action.kind === "review" && <><Select label="Review decision" value={decision} onChange={event => setDecision(event.target.value)} options={[
        { value: "under_review", label: "Continue review" }, { value: "retained", label: "Retain with recorded basis" }, { value: "rejected", label: "Reject with recorded reason" }, { value: "fulfilled", label: "Erase eligible organization CRM data" },
      ]} /><Input label="Record-specific retention basis" required value={basis} maxLength={200} onChange={event => setBasis(event.target.value)} /><p className="text-sm">{privacy?.scope}</p></>}
      <Input label={action.kind === "consent" ? "Patient instruction or evidence" : "Request or review reason"} required={action.kind !== "consent" || !consumer} value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
      {needsConfirmation && <Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)} label={(action.kind === "consent" ? "I confirm the stated purpose and the patient's explicit choice for this organization." : "I reviewed retention and confirm erasure of the eligible CRM scope shown above.")} />}
    </fieldset>
  </form></Modal>;
}
