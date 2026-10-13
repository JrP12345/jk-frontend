"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { Alert, Button, Card, CardContent, Input, Modal, Select, Checkbox } from "@/components/ui";
import type { CrmLocation, InquiryActivity } from "@/types/crm";
import { CallHistory } from '@/components/crm/CallHistory';
import { PatientMessages } from '@/components/crm/PatientMessages';
import { authScopeKey } from '@/lib/authScope';
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import { FamilyAuthorityPanel } from './FamilyAuthorityPanel';
interface Relationship { revision: number; locationId: string | null; ownerId: string | null; ownerName: string; preferences: { language?: string; preferredChannel?: string; doNotContact?: boolean }; contact: { availability: string; recipientType: string; familyRelationshipId?: string }; canEdit: boolean }
interface Activity extends InquiryActivity { inquiryId?: string; appointmentId?: string; taskId?: string }
interface InquiryLink { id: string; callerName: string; status: string; source: string; createdAt: string }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Patient relationship could not be loaded or saved. Retry the submitted request or reload before editing."; }
export function PatientRelationshipPanel({ patientId }: { patientId: string }) {
  const user = useAuthStore(state => state.user);
  if (!user?.organization_id || ["patient", "family_member", "guest"].includes(user.role) || !hasAnyPermission(user, "VIEW_CRM")) return null;
  return <Panel key={`${authScopeKey(user)}:${patientId}`} patientId={patientId} canEdit={hasAnyPermission(user, "MANAGE_PATIENTS")} canAssign={hasAnyPermission(user, "ASSIGN_CRM_TASKS")} />;
}
function Panel({ patientId, canEdit, canAssign }: { patientId: string; canEdit: boolean; canAssign: boolean }) {
  const [relationship, setRelationship] = useState<Relationship | null>(null), [activities, setActivities] = useState<Activity[]>([]), [inquiries, setInquiries] = useState<InquiryLink[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [inquiryCursor, setInquiryCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [editing, setEditing] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async (kind?: "activity" | "inquiry", next?: string) => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const response = await api.get(`/crm/patients/${patientId}/relationship`, { params: { ...(kind === "activity" && next ? { activityCursor: next } : {}), ...(kind === "inquiry" && next ? { inquiryCursor: next } : {}) }, signal: request.signal });
      if (!request.isCurrent()) return;
      const data = response.data.data;
      setRelationship(data.relationship);
      if (!kind || kind === "activity") { setActivities(current => kind ? [...new Map([...current, ...data.activities].map((row: Activity) => [row.id, row])).values()] : data.activities); setCursor(data.nextActivityCursor); }
      if (!kind || kind === "inquiry") { setInquiries(current => kind ? [...new Map([...current, ...data.inquiries].map((row: InquiryLink) => [row.id, row])).values()] : data.inquiries); setInquiryCursor(data.nextInquiryCursor); }
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, patientId]);
  useEffect(() => { void load(); }, [load]);
  return <Card><CardContent className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Organization relationship</h2><Button variant="outline" loading={loading} onClick={() => load()}>Reload relationship</Button></div>
    {error && <Alert variant="error">{error}</Alert>}{loading && <p role="status">Loading patient relationship...</p>}
    {relationship && !error && <><p>Owner: {relationship.ownerName || (relationship.ownerId ? "Assigned staff member" : "Unassigned")}.</p><p>Language: {relationship.preferences.language || "Not recorded"}. Preferred channel: {relationship.preferences.preferredChannel || "Not recorded"}. Contact status: {relationship.contact.availability}.</p>
      {relationship.preferences.doNotContact && <Alert variant="warning">Do not contact is recorded for this organization.</Alert>}<p className="text-sm text-text-muted">Preferences do not grant communication consent. Record channel choices separately in privacy and communication controls.</p>
      {canEdit && relationship.canEdit && <Button variant="outline" disabled={loading} onClick={() => setEditing(true)}>Edit relationship preferences</Button>}
      {!relationship.canEdit && <p className="text-sm text-text-muted">This relationship is managed by another branch. Only activity in your authorized branches is shown.</p>}
      <CallHistory patientId={patientId} locationId={relationship.canEdit ? relationship.locationId || undefined : undefined} />
      <PatientMessages patientId={patientId} locationId={relationship.canEdit ? relationship.locationId || undefined : undefined} />
      {relationship.canEdit && <FamilyAuthorityPanel patientId={patientId} />}
      <h3 className="font-medium">Returning caller inquiries</h3>{!inquiries.length && <p>No linked inquiries in the current scope.</p>}{inquiries.map(row => <div key={row.id} className="border border-border rounded-lg p-3"><p>{row.callerName || "Anonymous caller"}: {row.status.replaceAll("_", " ")} · {row.source.replaceAll("_", " ")}</p><Link className="text-accent underline" href={`/dashboard/crm?inquiryId=${row.id}`}>Open inquiry</Link></div>)}{inquiryCursor && <Button variant="outline" disabled={loading} onClick={() => load("inquiry", inquiryCursor)}>More linked inquiries</Button>}
      <h3 className="font-medium">Administrative timeline</h3>{!activities.length && <p>No administrative activity has been recorded in this scope.</p>}{activities.map(row => <div key={row.id} className="border border-border rounded-lg p-3 space-y-1"><p>{row.kind.replaceAll("_", " ")} · {row.actorName}</p><p className="text-sm text-text-muted">{new Date(row.createdAt).toLocaleString()}</p>{row.note && <p className="whitespace-pre-wrap break-words">{row.note}</p>}{row.appointmentId && <Link className="text-accent underline" href={`/dashboard/appointments?appointmentId=${row.appointmentId}`}>Open booking</Link>}</div>)}{cursor && <Button variant="outline" disabled={loading} onClick={() => load("activity", cursor)}>More administrative activity</Button>}
    </>}{editing && relationship && <RelationshipEditor patientId={patientId} initial={relationship} canAssign={canAssign} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} />}
  </CardContent></Card>;
}
function RelationshipEditor({ patientId, initial, canAssign, onClose, onSaved }: { patientId: string; initial: Relationship; canAssign: boolean; onClose: () => void; onSaved: () => void }) {
  const [locationId, setLocationId] = useState(initial.locationId || ""), [ownerId, setOwnerId] = useState(initial.ownerId || "");
  const [locations, setLocations] = useState<CrmLocation[]>([]), [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState(initial.contact.recipientType || 'patient'), [familyId, setFamilyId] = useState(initial.contact.familyRelationshipId || '');
  const [families, setFamilies] = useState<{ id: string; name: string; relationship: string }[]>([]), [familyCursor, setFamilyCursor] = useState<string | null>(null);
  const [choicesReady, setChoicesReady] = useState(false);
  const [language, setLanguage] = useState(initial.preferences.language || ""), [channel, setChannel] = useState(initial.preferences.preferredChannel || "none"), [doNotContact, setDoNotContact] = useState(initial.preferences.doNotContact || false);
  const [availability, setAvailability] = useState(initial.contact.availability), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID()), submitted = useRef<Record<string, unknown> | null>(null), beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const [branches, ownerResponse, familyResponse] = await Promise.all([getCrmLocations(request.signal), canAssign && locationId ? api.get("/crm/assignees", { params: { locationId, purpose: "relationship", ...(next ? { cursor: next } : {}) }, signal: request.signal }) : null, api.get(`/crm/patients/${patientId}/family-recipients`, { signal: request.signal })]);
      if (!request.isCurrent()) return;
      setLocations(branches); if (!locationId && branches.length === 1) setLocationId(branches[0].id);
      setFamilies(familyResponse.data.data.items); setFamilyCursor(familyResponse.data.data.nextCursor); setChoicesReady(true);
      setAssignees(current => next ? [...current, ...ownerResponse!.data.data.items] : ownerResponse?.data.data.items || []); setCursor(ownerResponse?.data.data.nextCursor || null);
    } catch (failure) { if (request.isCurrent()) { setChoicesReady(false); setError(failure instanceof CrmBranchScopeError ? failure.message : message(failure)); } }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, canAssign, locationId, patientId]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending || !choicesReady) return; setPending(true); setError("");
    submitted.current ??= { clientRequestId, expectedRevision: initial.revision, locationId, ...(canAssign ? { ownerId: ownerId || null } : {}), recipientType, ...(recipientType === 'family' ? { familyRelationshipId: familyId } : {}), preferences: { language: language.trim(), preferredChannel: channel, doNotContact }, availability };
    setLocked(true);
    try { await api.patch(`/crm/patients/${patientId}/relationship`, submitted.current); onSaved(); } catch (failure) { setError(message(failure)); } finally { setPending(false); }
  }
  return <Modal open title="Relationship preferences" busy={pending} onClose={onClose}><form onSubmit={save} className="space-y-4">{error && <Alert variant="error">{error} Close and reload to change submitted details.</Alert>}
    <fieldset disabled={locked || pending} className="space-y-3"><Select label="Relationship branch" disabled={loading || (!canAssign && !!initial.locationId)} value={locationId} onChange={event => { setLocationId(event.target.value); setOwnerId(""); }} options={locations.map(row => ({ value: row.id, label: row.name }))} />
      {canAssign && <><Select label="Relationship owner" disabled={loading} value={ownerId} onChange={event => setOwnerId(event.target.value)} options={[{ value: "", label: "Unassigned" }, ...(ownerId && !assignees.some(row => row.id === ownerId) ? [{ value: ownerId, label: initial.ownerName || "Current owner" }] : []), ...assignees.map(row => ({ value: row.id, label: row.name }))]} />{cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More relationship owners</Button>}</>}
      <Input label="Preferred language" maxLength={40} value={language} onChange={event => setLanguage(event.target.value)} /><Select label="Preferred communication channel" value={channel} onChange={event => setChannel(event.target.value)} options={["none", "phone", "whatsapp", "email"].map(value => ({ value, label: value === "none" ? "No preference recorded" : value }))} />
      <Select label="Communication recipient" value={recipientType} onChange={event => setRecipientType(event.target.value)} options={[{ value: 'patient', label: 'Patient organization contact' }, { value: 'family', label: 'Reviewed family recipient' }]} />
      {recipientType === 'family' && <><Select label="Reviewed family recipient" value={familyId} onChange={event => setFamilyId(event.target.value)} options={[{ value: '', label: 'Select reviewed recipient' }, ...families.map(row => ({ value: row.id, label: `${row.name} (${row.relationship})` }))]} />{familyCursor && <Button variant="outline" disabled={loading} onClick={async () => {
        const request = beginRead(); setLoading(true);
        try { const response = await api.get(`/crm/patients/${patientId}/family-recipients`, { params: { cursor: familyCursor }, signal: request.signal }); if (request.isCurrent()) { setFamilies(rows => [...new Map([...rows, ...response.data.data.items].map(row => [row.id, row])).values()]); setFamilyCursor(response.data.data.nextCursor); } }
        catch (failure) { if (request.isCurrent()) setError(message(failure)); } finally { if (request.isCurrent()) setLoading(false); }
      }}>More family recipients</Button>}<p className="text-sm text-text-muted">Family communication authority and fresh channel consent are required. Preferences alone grant neither.</p></>}
      <Select label="Contact availability" value={availability} onChange={event => setAvailability(event.target.value)} options={["unknown", "reachable", "unreachable", "invalid"].map(value => ({ value, label: value }))} /><Checkbox checked={doNotContact} onChange={event => setDoNotContact(event.target.checked)} label="Do not contact in this organization" />
    </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending || locked} loading={loading} onClick={() => load()}>Reload choices</Button><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" disabled={pending || loading || !choicesReady || !locationId || (recipientType === 'family' && !familyId)} loading={pending}>{locked && error ? "Retry submitted preferences" : "Save relationship preferences"}</Button></div></form></Modal>;
}
