"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from '@/lib/authScope';
import { Alert, Button, Card, CardContent, Input, Modal, Select, Checkbox } from "@/components/ui";

interface Contact { phone: string; email: string; availability: "unknown" | "reachable" | "unreachable" | "invalid"; revision: number }
interface Claim { id: string; accountName: string; requestedAt: string }
export function PatientIdentityControls({ patientId }: { patientId: string }) {
  const user = useAuthStore(state => state.user);
  if (!user || ["patient", "family_member", "guest"].includes(user.role)) return null;
  const canCorrect = hasAnyPermission(user, "MANAGE_PATIENTS");
  const canReview = hasAnyPermission(user, "REVIEW_PATIENT_IDENTITY");
  return canCorrect || canReview ? <IdentityWorkspace key={`${authScopeKey(user)}:${patientId}`} patientId={patientId} canCorrect={canCorrect} canReview={canReview} /> : null;
}
function IdentityWorkspace({ patientId, canCorrect, canReview }: { patientId: string; canCorrect: boolean; canReview: boolean }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState<Claim | null>(null);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setLoadError("");
    try {
      const [contactResponse, claimsResponse] = await Promise.all([
        canCorrect ? api.get(`/patients/${patientId}/contact`, { signal: request.signal }) : null,
        canReview ? api.get(`/patients/${patientId}/identity-claims`, { signal: request.signal }) : null,
      ]);
      if (!request.isCurrent()) return;
      setContact(contactResponse?.data?.data || null); setClaims(claimsResponse?.data?.data?.items || []); setNextCursor(claimsResponse?.data?.data?.nextCursor || null);
    } catch (error) {
      if (request.isCurrent()) setLoadError((error as { response?: { data?: { message?: string } } }).response?.data?.message || "Organization contact and identity reviews could not be loaded.");
    } finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, canCorrect, canReview, patientId]);
  useEffect(() => { void load(); }, [load]);
  async function loadMore() {
    if (!nextCursor || loading) return;
    const request = beginRead(); setLoading(true); setLoadError("");
    try {
      const response = await api.get(`/patients/${patientId}/identity-claims`, { params: { cursor: nextCursor }, signal: request.signal });
      if (!request.isCurrent()) return;
      setClaims(current => [...new Map([...current, ...(response.data?.data?.items || [])].map(claim => [claim.id, claim])).values()]);
      setNextCursor(response.data?.data?.nextCursor || null);
    } catch (error) { if (request.isCurrent()) setLoadError(failureMessage(error)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }
  return <Card><CardContent className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Organization contact and identity</h2><Button variant="outline" size="sm" loading={loading} onClick={load}>Reload</Button></div>
    {loadError && <Alert variant="error">{loadError}</Alert>}
    {contact && <div className="flex flex-wrap items-center justify-between gap-3"><div><p>{contact.phone || "No phone"} · {contact.email || "No email"}</p><p className="text-sm text-text-muted">Contact status: {contact.availability}. Communication permission is recorded separately.</p></div><Button variant="outline" disabled={loading || Boolean(loadError)} onClick={() => setEditing(true)}>Correct organization contact</Button></div>}
    {canReview && <div className="space-y-2"><h3 className="text-sm font-medium">Pending identity claims</h3>{!loading && !loadError && claims.length === 0 && <p className="text-sm text-text-muted">No pending identity claims.</p>}{claims.map(claim => <div key={claim.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><p>{claim.accountName} · {new Date(claim.requestedAt).toLocaleDateString()}</p><Button variant="outline" size="sm" disabled={loading || Boolean(loadError)} onClick={() => setReviewing(claim)}>Review identity claim</Button></div>)}</div>}
    {nextCursor && <Button variant="outline" loading={loading} onClick={loadMore}>Load more identity claims</Button>}
    {editing && contact && <ContactEditor patientId={patientId} initial={contact} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} />}
    {reviewing && <ClaimReviewer patientId={patientId} claim={reviewing} onClose={() => setReviewing(null)} onSaved={() => { setReviewing(null); void load(); }} />}
  </CardContent></Card>;
}
function failureMessage(error: unknown) {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "The update could not be confirmed. Retry the same details, or close and reload before editing.";
}
function ContactEditor({ patientId, initial, onClose, onSaved }: { patientId: string; initial: Contact; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [reason, setReason] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { await api.patch(`/patients/${patientId}/contact`, { phone: form.phone.trim(), email: form.email.trim(), availability: form.availability,
      expectedRevision: initial.revision, reason: reason.trim(), clientRequestId }); onSaved(); }
    catch (failure) { setError(failureMessage(failure)); } finally { setPending(false); }
  }
  return <Modal open title="Correct organization contact" description="These details apply to this organization. The patient's login account keeps its verified contact." busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={save} className="space-y-3">{error && <Alert variant="error">{error}</Alert>}<fieldset disabled={pending} className="space-y-3">
      <Input label="Organization contact phone" type="tel" value={form.phone} maxLength={30} onChange={event => setForm({ ...form, phone: event.target.value })} />
      <Input label="Organization contact email" type="email" value={form.email} maxLength={200} onChange={event => setForm({ ...form, email: event.target.value })} />
      <Select label="Contact availability" value={form.availability} onChange={event => setForm({ ...form, availability: event.target.value as Contact["availability"] })} options={["unknown", "reachable", "unreachable", "invalid"].map(value => ({ value, label: value }))} />
      <Input label="Correction reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} required />
    </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" loading={pending} disabled={pending || !reason.trim()}>Save contact correction</Button></div></form>
  </Modal>;
}
function ClaimReviewer({ patientId, claim, onClose, onSaved }: { patientId: string; claim: Claim; onClose: () => void; onSaved: () => void }) {
  const [decision, setDecision] = useState("reject");
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { await api.post(`/patients/${patientId}/identity-claims/${claim.id}/review`, { decision, identityVerified: verified, reason: reason.trim(), clientRequestId }); onSaved(); }
    catch (failure) { setError(failureMessage(failure)); } finally { setPending(false); }
  }
  return <Modal open title="Review patient identity" description={`Verify that ${claim.accountName} is the person in this patient record. Shared contact possession alone is insufficient.`} busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={save} className="space-y-3">{error && <Alert variant="error">{error}</Alert>}<fieldset disabled={pending} className="space-y-3">
      <Select label="Identity review decision" value={decision} onChange={event => setDecision(event.target.value)} options={[{ value: "reject", label: "Reject claim" }, { value: "approve", label: "Approve verified identity" }]} />
      {decision === "approve" && <Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I verified the person and their authority to claim this record." />}
      <Input label="Identity review reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} required />
    </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" loading={pending} disabled={pending || !reason.trim() || (decision === "approve" && !verified)}>Record identity review</Button></div></form>
  </Modal>;
}
