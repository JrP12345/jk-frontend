"use client";
import { CallHistory } from "./CallHistory";
import { RootCrmWorkspace } from './RootCrmWorkspace';
import { InquiryReplies } from './InquiryReplies';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useCrmDefaultHours } from '@/hooks/useCrmDefaultHours';
import { locationLocalDateTimeInput, locationLocalTimeToIso } from "@/lib/locationTime";
import type { Inquiry, InquiryActivity, CrmLocation } from "@/types/crm";
import { InquiryConversion, type ConversionCommand } from "./InquiryConversion";
import { authScopeKey } from '@/lib/authScope';
import { Alert, Badge, Button, Card, CardContent, Input, Modal, Select, Textarea, Checkbox } from "@/components/ui";

const sourceOptions = ["unknown", "phone", "walk_in", "whatsapp", "website", "referral"].map(value => ({ value, label: value === "unknown" ? "Unknown source" : value.replaceAll("_", " ") }));
const actionOptions = [{ value: "review", label: "Review inquiry" }, { value: "contact", label: "Contact caller" }, { value: "book", label: "Arrange booking" }];
const closeOptions = ["resolved", "not_proceeding", "unreachable", "duplicate_inquiry", "other"].map(value => ({ value, label: value.replaceAll("_", " ") }));
function failureMessage(error: unknown) { if (error instanceof CrmBranchScopeError) return error.message; return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "The inquiry result could not be confirmed. Retry the same request, or reload before editing."; }
function timezone(location?: CrmLocation) { return location?.effectiveTimezone || location?.timezone || "Asia/Kolkata"; }

export function InquiryWorkspace() {
  const user = useAuthStore(state => state.user);
  if (!user || ["patient", "family_member", "guest"].includes(user.role) || !hasAnyPermission(user, "VIEW_CRM")) return <Alert variant="error">An authorized staff CRM workspace is required.</Alert>;
  if (!user.organization_id && user.role === 'root') return <RootCrmWorkspace />;
  if (!user.organization_id) return <Alert variant="warning">Select an organization workspace to work with inquiries.</Alert>;
  return <Workspace key={authScopeKey(user)} canManage={hasAnyPermission(user, "MANAGE_CRM_INQUIRIES")} />;
}
function Workspace({ canManage }: { canManage: boolean }) {
  const user = useAuthStore(state => state.user)!;
  const [items, setItems] = useState<Inquiry[]>([]), [locations, setLocations] = useState<CrmLocation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [filters, setFilters] = useState({ owner: "mine", status: "active", locationId: "", search: "", overdue: "false" });
  const [search, setSearch] = useState("");
  const [capturing, setCapturing] = useState(false), [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversion, setConversion] = useState<{ source: Inquiry; command?: ConversionCommand; open: boolean } | null>(null);
  const [conversionMessage, setConversionMessage] = useState('');
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("inquiryId");
    if (id && /^[a-fA-F0-9]{24}$/.test(id)) setSelectedId(id);
  }, []);
  const beginRead = useLatestRead();
  const load = useCallback(async (cursor?: string) => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const [list, branches] = await Promise.all([api.get("/crm/inquiries", { params: { ...filters, ...(cursor ? { cursor } : {}) }, signal: request.signal }),
        getCrmLocations(request.signal)]);
      if (!request.isCurrent()) return;
      setItems(current => cursor ? [...new Map([...current, ...list.data.data.items].map((row: Inquiry) => [row.id, row])).values()] : list.data.data.items);
      setNextCursor(list.data.data.nextCursor); setLocations(branches);
    } catch (failure) { if (request.isCurrent()) setError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, filters]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Patient relationships</h1><p className="text-sm text-text-muted">Capture an inquiry without creating a patient account. Track an owner and the next action.</p></div>{canManage && <Button disabled={loading || !!error || !locations.length} onClick={() => setCapturing(true)}>Capture inquiry</Button>}</div>
    <nav aria-label="Patient relationship workflows" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
    <Link href="/dashboard/crm/tasks" className="inline-block py-2 text-accent underline">Daily patient tasks</Link><Link className="py-2 text-accent underline" href="/dashboard/crm/communications">Communication replies</Link>
    {hasAnyPermission(user, 'VIEW_CRM_ANALYTICS') && <Link className='text-accent underline' href='/dashboard/crm/overview'>Operational overview</Link>}
    {hasAnyPermission(user, 'MANAGE_CRM_SETTINGS') && <Link className='text-accent underline' href='/dashboard/crm/settings'>Workflow settings</Link>}
    </nav>
    <Card><CardContent className="space-y-3"><form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setFilters({ ...filters, search: search.trim() }); }}>
      <Input label="Search caller or service" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} />
      <Select label="Inquiry ownership" value={filters.owner} onChange={event => setFilters({ ...filters, owner: event.target.value })} options={[{ value: "mine", label: "My inquiries" }, { value: "team", label: "Team inquiries" }, { value: "unassigned", label: "Unassigned" }]} />
      <Select label="Inquiry status" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} options={[{ value: "active", label: "Open and in progress" }, { value: "closed", label: "Closed" }, { value: "converted", label: "Converted to booking" }, { value: "all", label: "All statuses" }]} />
      <Select label="Inquiry branch" value={filters.locationId} onChange={event => setFilters({ ...filters, locationId: event.target.value })} options={[{ value: "", label: "All authorized branches" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} />
      <Checkbox checked={filters.overdue === "true"} onChange={event => setFilters({ ...filters, overdue: String(event.target.checked) })} label="Due or overdue" />
      <Button type="submit" variant="outline" disabled={loading}>Search inquiries</Button><Button variant="outline" loading={loading} onClick={() => load()}>Reload inquiries</Button>
    </form>{error && <Alert variant="error">{error}</Alert>}{loading && <p role="status">Loading authorized inquiries…</p>}
      {!loading && !error && items.length === 0 && <p>No inquiries match these filters.</p>}
      {!error && items.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="font-medium">{row.callerName || "Anonymous caller"} <Badge variant="neutral">{row.status.replaceAll("_", " ")}</Badge></p><p className="text-sm">{row.phone || row.email || "No contact provided"} · {row.requestedService || row.reasonForContact.replaceAll("_", " ")}</p><p className="text-sm text-text-muted">{locations.find(location => location.id === row.locationId)?.name || "Authorized branch"} · {row.nextAction.kind}: {new Date(row.nextAction.dueAt).toLocaleString(undefined, { timeZone: timezone(locations.find(location => location.id === row.locationId)) })} ({timezone(locations.find(location => location.id === row.locationId))})</p></div><Button variant="outline" disabled={loading} onClick={() => setSelectedId(row.id)}>Open inquiry</Button></div>)}
      {nextCursor && !error && <Button variant="outline" loading={loading} onClick={() => load(nextCursor)}>Load more inquiries</Button>}
    </CardContent></Card>
    {capturing && <InquiryEditor locations={locations} onClose={() => setCapturing(false)} onSaved={id => { setCapturing(false); setSelectedId(id); void load(); }} />}
    {conversionMessage && <Alert variant='success'>{conversionMessage}</Alert>}
    {conversion?.command && !conversion.open && !selectedId && <Button onClick={() => setConversion({ ...conversion, open: true })}>Resume submitted booking</Button>}
    {selectedId && !conversion?.open && <InquiryDetail key={selectedId} id={selectedId} locations={locations} canManage={canManage} onClose={() => setSelectedId(null)} onChanged={() => load()}
      resumeBooking={!!conversion?.command} onBook={source => setConversion(current => current?.command ? { ...current, open: true } : { source, open: true })} />}
    {conversion?.open && <InquiryConversion inquiry={conversion.source} timezone={timezone(locations.find(location => location.id === conversion.source.locationId))} initialCommand={conversion.command}
      onSubmitted={command => setConversion(current => current && { ...current, command: command || undefined })}
      onClose={() => setConversion(current => current?.command ? { ...current, open: false } : null)}
      onConverted={result => { setConversion(null); setConversionMessage(result.appointment.status === 'pending_payment' ? 'Booking recorded; payment remains pending.' : `Booking restored or recorded with status ${result.appointment.status}.`); void load(); }} />}
  </div>;
}
function InquiryDetail({ id, locations, canManage, resumeBooking, onBook, onClose, onChanged }: { id: string; locations: CrmLocation[]; canManage: boolean; resumeBooking: boolean; onBook: (source: Inquiry) => void; onClose: () => void; onChanged: () => void }) {
  const user = useAuthStore(state => state.user);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null), [activities, setActivities] = useState<InquiryActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const response = await api.get(`/crm/inquiries/${id}`, { params: next ? { activityCursor: next } : {}, signal: request.signal });
      if (!request.isCurrent()) return;
      setInquiry(response.data.data.inquiry); setActivities(current => next ? [...current, ...response.data.data.activities] : response.data.data.activities); setCursor(response.data.data.nextActivityCursor);
    } catch (failure) { if (request.isCurrent()) setError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [id, beginRead]);
  useEffect(() => { void load(); }, [load]);
  if (editing && inquiry) return <InquiryEditor key={inquiry.revision} initial={inquiry} locations={locations} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); onChanged(); }} />;
  return <Modal open title="Inquiry details" size="lg" onClose={onClose}><div className="space-y-4">
    {error && <Alert variant="error">{error}</Alert>}<Button variant="outline" size="sm" loading={loading} onClick={() => load()}>Reload inquiry</Button>
    {resumeBooking && inquiry && <Button onClick={() => onBook(inquiry)}>Resume submitted booking</Button>}
    {inquiry && !error && <><div><h2 className="font-semibold">{inquiry.callerName || "Anonymous caller"}</h2><p>{inquiry.phone || inquiry.email || "No contact provided"}</p><p>Status: {inquiry.status.replaceAll("_", " ")}. Source: {inquiry.source.replaceAll("_", " ")} ({inquiry.sourceEvidence.replaceAll("_", " ")}).</p><p>Owner: {inquiry.ownerName || (inquiry.ownerId ? "Assigned staff member" : "Unassigned")}.</p><p>Next action: {inquiry.nextAction.kind}.</p>{inquiry.closeReason && <p>Close outcome: {inquiry.closeReason.replaceAll("_", " ")}</p>}</div>
      <div className="flex flex-wrap gap-2">{canManage && inquiry.status !== "converted" && <Button disabled={loading} onClick={() => setEditing(true)}>Update inquiry</Button>}{canManage && hasAnyPermission(user, "MANAGE_APPOINTMENTS") && ["open", "in_progress"].includes(inquiry.status) && <Button disabled={loading} onClick={() => onBook(inquiry)}>Convert inquiry to booking</Button>}{inquiry.patientId && <Link href={`/dashboard/patients/${inquiry.patientId}`} className="text-accent underline">Open canonical patient</Link>}{inquiry.appointmentId && <Link href={`/dashboard/appointments?appointmentId=${inquiry.appointmentId}`} className="text-accent underline">Open booking</Link>}</div>
      <CallHistory inquiryId={inquiry.id} locationId={inquiry.locationId} />
      <InquiryReplies inquiryId={inquiry.id} />
      <h3 className="font-medium">Administrative activity</h3>{activities.map(activity => <div key={activity.id} className="rounded-lg border border-border p-3"><p>{activity.kind.replaceAll("_", " ")} · {activity.actorName}</p><p className="text-sm text-text-muted">{new Date(activity.createdAt).toLocaleString()}</p>{activity.note && <p className="whitespace-pre-wrap break-words text-sm">{activity.note}</p>}</div>)}{cursor && <Button variant="outline" loading={loading} onClick={() => load(cursor)}>More inquiry activity</Button>}
    </>}
  </div></Modal>;
}
function InquiryEditor({ initial, locations, onClose, onSaved }: { initial?: Inquiry; locations: CrmLocation[]; onClose: () => void; onSaved: (id: string) => void }) {
  const user = useAuthStore(state => state.user)!;
  const [locationId, setLocationId] = useState(initial?.locationId || (locations.length === 1 ? locations[0].id : ""));
  const [ownerId, setOwnerId] = useState(initial ? initial.ownerId || "" : user.role === "root" ? "" : user.id);
  const [form, setForm] = useState({ callerName: initial?.callerName || "", phone: initial?.phone || "", email: initial?.email || "", source: initial?.source || "unknown",
    reasonForContact: initial?.reasonForContact || "unknown", requestedService: initial?.requestedService || "", patientId: initial?.patientId || "", note: "", status: initial?.status || "open", closeReason: initial?.closeReason || "resolved", duplicateInquiryId: initial?.duplicateInquiryId || "" });
  const [action, setAction] = useState(initial?.nextAction.kind || "review");
  const zone = timezone(locations.find(location => location.id === locationId));
  const [due, setDue] = useState(() => locationLocalDateTimeInput(initial ? new Date(initial.nextAction.dueAt) : new Date(Date.now() + 3600000), zone));
  const defaultHours = useCrmDefaultHours('inquiry', !initial), dueEdited = useRef(false);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]), [assigneeError, setAssigneeError] = useState(""), [assigneeLoading, setAssigneeLoading] = useState(false);
  const [assigneeCursor, setAssigneeCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [locked, setLocked] = useState(false);
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const submitted = useRef<Record<string, unknown> | null>(null);
  const errorSummary = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!error || pending) return;
    errorSummary.current?.focus();
    errorSummary.current?.scrollIntoView({ block: "nearest" });
  }, [error, pending]);
  useEffect(() => {
    if (!initial && defaultHours.hours !== null && !dueEdited.current && !locked) setDue(locationLocalDateTimeInput(new Date(Date.now() + defaultHours.hours * 3600000), zone));
  }, [defaultHours.hours, initial, locked, zone]);
  const beginRead = useLatestRead();
  const loadAssignees = useCallback(async (cursor?: string) => {
    if (!locationId) return;
    const request = beginRead(); setAssigneeLoading(true); setAssigneeError("");
    try {
      const response = await api.get("/crm/assignees", { params: { locationId, purpose: "inquiry", ...(cursor ? { cursor } : {}) }, signal: request.signal });
      if (!request.isCurrent()) return; setAssignees(current => cursor ? [...new Map([...current, ...response.data.data.items].map(actor => [actor.id, actor])).values()] : response.data.data.items);
      setAssigneeCursor(response.data.data.nextCursor || null);
    } catch (failure) { if (request.isCurrent()) setAssigneeError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setAssigneeLoading(false); }
  }, [locationId, beginRead]);
  useEffect(() => { void loadAssignees(); }, [loadAssignees]);
  function changeBranch(id: string) {
    try { const [date, time] = due.split("T"); const instant = locationLocalTimeToIso(date, time, zone); setDue(locationLocalDateTimeInput(new Date(instant), timezone(locations.find(location => location.id === id)))); }
    catch { setDue(""); }
    setLocationId(id);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try {
      if (!submitted.current) {
        const [date, time] = due.split("T");
        submitted.current = { locationId, ownerId: ownerId || null, callerName: form.callerName.trim(), phone: form.phone.trim(), email: form.email.trim(), source: form.source,
          reasonForContact: form.reasonForContact, requestedService: form.requestedService.trim(), ...(form.patientId ? { patientId: form.patientId.trim() } : {}), note: form.note.trim(),
          nextAction: { kind: action, dueAt: locationLocalTimeToIso(date, time, zone) }, clientRequestId, ...(initial ? { expectedRevision: initial.revision, status: form.status,
            ...(form.status === "closed" ? { closeReason: form.closeReason, ...(form.closeReason === "duplicate_inquiry" ? { duplicateInquiryId: form.duplicateInquiryId } : {}) } : {}) } : {}) };
        setLocked(true);
      }
      const response = initial ? await api.patch(`/crm/inquiries/${initial.id}`, submitted.current) : await api.post("/crm/inquiries", submitted.current);
      onSaved(initial ? response.data.data.inquiry.id : response.data.data.id);
    } catch (failure) { setError(failureMessage(failure)); } finally { setPending(false); }
  }
  return <Modal open title={initial ? "Update inquiry" : "Capture inquiry"} size="lg" busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}><form onSubmit={save} className="space-y-4">
    <p className="text-sm text-text-muted">Contact details are matching hints. Do not add diagnoses or clinical notes here. An inquiry does not grant communication consent.</p>
    {error && <div ref={errorSummary} tabIndex={-1}><Alert variant="error">{error} Retry keeps the same submitted details. Close and reload to edit them.</Alert></div>}
    {defaultHours.error && <Alert variant='warning'>{defaultHours.error}</Alert>}
    {assigneeError && <Alert variant="error">{assigneeError}<Button variant="outline" size="sm" onClick={() => loadAssignees()}>Reload assignees</Button></Alert>}
    {assigneeCursor && <Button variant="outline" disabled={locked || pending} loading={assigneeLoading} onClick={() => loadAssignees(assigneeCursor)}>More eligible assignees</Button>}
    <fieldset disabled={pending || locked} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Select label="Capture branch" value={locationId} onChange={event => changeBranch(event.target.value)} options={locations.map(location => ({ value: location.id, label: location.name }))} placeholder="Choose a branch" />
      <Select label="Inquiry owner" value={ownerId} disabled={assigneeLoading || !locationId} onChange={event => setOwnerId(event.target.value)} options={[{ value: "", label: "Unassigned", disabled: !hasAnyPermission(user, "ASSIGN_CRM_TASKS") && !!ownerId }, ...assignees.map(actor => ({ value: actor.id, label: actor.name })), ...(ownerId && !assignees.some(actor => actor.id === ownerId) ? [{ value: ownerId, label: "Current owner — verify branch eligibility", disabled: true }] : [])]} /></div>
      <Input label="Caller name (optional)" value={form.callerName} maxLength={120} onChange={event => setForm({ ...form, callerName: event.target.value })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Indian contact phone (optional)" type="tel" value={form.phone} maxLength={30} onChange={event => setForm({ ...form, phone: event.target.value })} /><Input label="Contact email (optional)" type="email" value={form.email} maxLength={200} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
      <Select label="Reported inquiry source" value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} options={sourceOptions} />
      <Select label="Reason for contact" value={form.reasonForContact} onChange={event => setForm({ ...form, reasonForContact: event.target.value })} options={["unknown", "booking", "reschedule", "cancellation", "service_question", "other"].map(value => ({ value, label: value.replaceAll("_", " ") }))} />
      <Input label="Requested service (optional)" value={form.requestedService} maxLength={100} onChange={event => setForm({ ...form, requestedService: event.target.value })} />
      <Input label="Existing patient reference (optional)" hint="Choose the canonical patient after checking identity. Shared contact alone is not proof." value={form.patientId} maxLength={24} onChange={event => setForm({ ...form, patientId: event.target.value })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Select label="Next inquiry action" value={action} onChange={event => setAction(event.target.value as typeof action)} options={actionOptions} /><Input label={`Next action due (${zone})`} type="datetime-local" required value={due} onChange={event => { dueEdited.current = true; setDue(event.target.value); }} /></div>
      {initial && <Select label="Progress status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as typeof form.status })} options={[{ value: "open", label: "Open / reopen" }, { value: "in_progress", label: "In progress" }, { value: "closed", label: "Close inquiry" }]} />}
      {initial && form.status === "closed" && <><Select label="Close outcome" value={form.closeReason} onChange={event => setForm({ ...form, closeReason: event.target.value })} options={closeOptions} />{form.closeReason === "duplicate_inquiry" && <Input label="Duplicate inquiry reference" value={form.duplicateInquiryId} required maxLength={24} onChange={event => setForm({ ...form, duplicateInquiryId: event.target.value })} />}</>}
      <Textarea label="Administrative note (optional)" maxLength={1000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} />
    </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" loading={pending} disabled={pending || !locationId || !due || assigneeLoading || !!assigneeError}>{error && locked ? "Retry submitted inquiry" : initial ? "Save inquiry update" : "Save inquiry"}</Button></div>
  </form></Modal>;
}
