"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { locationLocalDateTimeInput, locationLocalTimeToIso } from "@/lib/locationTime";
import { recordId, patientName, patientPhone, type WorkflowPatient } from "@/lib/locationWorkflow";
import type { Inquiry } from "@/types/crm";
import { Alert, Button, Input, Modal, Select, Checkbox, DatePicker } from "@/components/ui";

interface Assignment { doctorId: { id?: string; _id?: string; name?: string } | string; isActive?: boolean; bookingMode?: string; paymentRequired?: boolean; fees?: number }
interface ConversionResult { appointment: { id: string; status: string; paymentStatus: string; tokenNumber: number } }
export type ConversionCommand = Record<string, unknown>;
function failureMessage(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "The booking result could not be confirmed. Retry the submitted conversion before creating another booking."; }

type BookingSource = { inquiry: Inquiry; task?: never } | { task: { id: string; locationId: string; patientId?: string; revision: number }; inquiry?: never };
export function InquiryConversion({ inquiry, task, timezone, initialCommand, onSubmitted, onClose, onConverted }: BookingSource & { timezone: string; initialCommand?: ConversionCommand; onSubmitted?: (command: ConversionCommand | null) => void; onClose: () => void; onConverted: (result: ConversionResult) => void }) {
  const source = (inquiry || task)!;
  const restoredPatient = initialCommand?.patientDetails as { name?: string; phone?: string; email?: string; distinctPersonReason?: string } | undefined;
  const user = useAuthStore(state => state.user);
  const [assignments, setAssignments] = useState<Assignment[]>([]), [doctorId, setDoctorId] = useState(String(initialCommand?.doctorId || ''));
  const [appointmentLocal, setAppointmentLocal] = useState(() => locationLocalDateTimeInput(initialCommand?.appointmentTime ? new Date(String(initialCommand.appointmentTime)) : new Date(Date.now() + 3600000), timezone));
  const [slots, setSlots] = useState<string[]>([]), [slot, setSlot] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(true), [availabilityLoading, setAvailabilityLoading] = useState(false), [availabilityReady, setAvailabilityReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState(restoredPatient ? 'new' : 'existing'), [patientId, setPatientId] = useState(String(initialCommand?.patientId || source.patientId || ''));
  const [query, setQuery] = useState(""), [matches, setMatches] = useState<WorkflowPatient[]>([]), [searching, setSearching] = useState(false);
  const [name, setName] = useState(restoredPatient?.name || inquiry?.callerName || ''), [phone, setPhone] = useState(restoredPatient?.phone || inquiry?.phone || ''), [email, setEmail] = useState(restoredPatient?.email || inquiry?.email || '');
  const [distinctReason, setDistinctReason] = useState(restoredPatient?.distinctPersonReason || ''), [identityReason, setIdentityReason] = useState(String(initialCommand?.identityReviewReason || '')), [identityVerified, setIdentityVerified] = useState(!!initialCommand);
  const [pending, setPending] = useState(false), [locked, setLocked] = useState(!!initialCommand), [error, setError] = useState(initialCommand ? "Recover the submitted booking before arranging another visit." : "");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const submitted = useRef<ConversionCommand | null>(initialCommand || null);
  const busy = useRef(false), mounted = useRef(true), errorSummary = useRef<HTMLDivElement | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (error && !pending) { errorSummary.current?.focus(); errorSummary.current?.scrollIntoView({ block: "nearest" }); } }, [error, pending]);
  const reservation = useRef<{ lockId: string; doctorId: string; slotTime: string } | null>(null);
  const beginDoctors = useLatestRead(), beginAvailability = useLatestRead(), beginSearch = useLatestRead();
  const assignment = assignments.find(row => recordId(row.doctorId) === doctorId);
  const slotMode = assignment?.bookingMode === "time_slot";
  const date = appointmentLocal.split("T")[0];
  const loadDoctors = useCallback(async () => {
    const request = beginDoctors(); setAssignmentLoading(true); setLoadError("");
    try {
      const response = await api.get(`/onboarding/doctors/assignments?locationId=${encodeURIComponent(source.locationId)}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const choices = response.data.data.filter((row: Assignment) => row.isActive !== false && recordId(row.doctorId));
      setAssignments(choices); setDoctorId(current => choices.some((row: Assignment) => recordId(row.doctorId) === current) ? current : choices.length === 1 ? recordId(choices[0].doctorId) : "");
    } catch (failure) { if (request.isCurrent()) setLoadError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setAssignmentLoading(false); }
  }, [beginDoctors, source.locationId]);
  useEffect(() => { void loadDoctors(); }, [loadDoctors]);
  const loadAvailability = useCallback(async () => {
    const request = beginAvailability(); setSlots([]); setSlot(""); setAvailabilityReady(false); setAvailabilityLoading(true);
    if (!doctorId || !date) { setAvailabilityLoading(false); return; }
    try {
      const response = await api.get(`/doctors/${doctorId}/slots`, { params: { locationId: source.locationId, date }, signal: request.signal });
      if (!request.isCurrent()) return;
      if (response.data.data.isHoliday) { setLoadError("The doctor is unavailable on this day. Choose another doctor or day."); return; }
      setSlots((response.data.data.slots || []).filter((row: { time: string; available?: boolean; isBooked?: boolean; lockedByOther?: boolean }) => row.available === true && !row.isBooked && !row.lockedByOther).map((row: { time: string }) => row.time));
      setAvailabilityReady(true); setLoadError("");
    } catch (failure) { if (request.isCurrent()) setLoadError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setAvailabilityLoading(false); }
  }, [beginAvailability, doctorId, date, source.locationId]);
  useEffect(() => { void loadAvailability(); }, [loadAvailability]);
  async function search() {
    const request = beginSearch(); setSearching(true); setError("");
    try {
      const response = await api.get("/patients", { params: { search: query.trim(), limit: 10 }, signal: request.signal });
      if (request.isCurrent()) setMatches(response.data.data);
    } catch (failure) { if (request.isCurrent()) setError(failureMessage(failure)); }
    finally { if (request.isCurrent()) setSearching(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setError("");
    try {
      if (!submitted.current) {
        const chosenTime = slotMode ? slot : appointmentLocal.split("T")[1];
        const appointmentTime = locationLocalTimeToIso(date, chosenTime, timezone);
        if (slotMode) {
          const response = await api.post("/appointments/lock-slot", { locationId: source.locationId, doctorId, slotTime: appointmentTime });
          if (!mounted.current) return;
          reservation.current = { lockId: response.data.data.lockId, doctorId, slotTime: appointmentTime };
          if (!reservation.current.lockId) throw new Error("The time could not be reserved. Reload availability.");
        }
        submitted.current = { clientRequestId, expectedRevision: source.revision, doctorId, appointmentTime, identityVerified: true,
          ...(reservation.current ? { lockId: reservation.current.lockId } : {}),
          ...(mode === "new" ? { patientDetails: { name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(email.trim() ? { email: email.trim() } : {}), ...(distinctReason.trim() ? { distinctPersonReason: distinctReason.trim() } : {}) } }
            : { patientId: patientId.trim() }), ...(identityReason.trim() ? { identityReviewReason: identityReason.trim() } : {}) };
        setLocked(true);
        onSubmitted?.(submitted.current);
      }
      if (!mounted.current) return;
      const response = await api.post(`/crm/${inquiry ? "inquiries" : "tasks"}/${source.id}/convert`, submitted.current);
      reservation.current = null;
      if (mounted.current) onConverted(response.data.data);
    } catch (failure) {
      if (mounted.current) {
        setError(failureMessage(failure));
        const status = (failure as { response?: { status?: number } }).response?.status;
        if (status && [400, 403, 404, 422].includes(status)) { submitted.current = null; setLocked(false); onSubmitted?.(null); }
      }
    } finally { busy.current = false; if (mounted.current) setPending(false); }
  }
  async function close() {
    if (busy.current) return;
    // Unknown conversion outcomes must be recovered using the same command;
    // an abandoned reservation otherwise expires under the canonical lock policy.
    if (reservation.current && !submitted.current) await api.delete("/appointments/lock-slot", { data: { locationId: source.locationId, ...reservation.current } }).catch(() => {});
    onClose();
  }
  const canSubmit = locked || (doctorId && availabilityReady && !assignmentLoading && !availabilityLoading && (!slotMode || slot) && identityVerified &&
    (mode === "new" ? name.trim() && (phone.trim() || email.trim()) : /^[a-fA-F0-9]{24}$/.test(patientId)));
  return <Modal open title={inquiry ? "Convert inquiry to booking" : "Arrange patient task booking"} size="lg" busy={pending} closeOnOverlay={!pending} onClose={close}><form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-text-muted">Booking uses the source branch and the existing appointment workflow. Payment requirements are preserved.</p>
    {loadError && <Alert variant="error">{loadError}</Alert>}{error && <div ref={errorSummary} tabIndex={-1}><Alert variant="error">{error} {locked ? 'Retry keeps the original identity, time and request. Closing keeps the submitted booking available to resume.' : 'Check the rejected details before submitting again.'}</Alert></div>}
    <fieldset disabled={pending || locked} className="min-w-0 space-y-3">
      <Select label="Booking doctor" value={doctorId} disabled={assignmentLoading} onChange={event => setDoctorId(event.target.value)} options={assignments.map(row => ({ value: recordId(row.doctorId), label: typeof row.doctorId === "object" ? row.doctorId.name || "Assigned doctor" : "Assigned doctor" }))} />
      <Button variant="outline" loading={assignmentLoading} onClick={loadDoctors}>Reload booking doctors</Button>
      <DatePicker label={`Booking time (${timezone})`} mode="datetime" required value={appointmentLocal} onChange={value => setAppointmentLocal(value)} />
      {slotMode && <Select label="Available consultation slot" value={slot} disabled={availabilityLoading} onChange={event => setSlot(event.target.value)} options={slots.map(value => ({ value, label: value }))} />}
      <Button variant="outline" loading={availabilityLoading} onClick={loadAvailability}>Reload booking availability</Button>
      {assignment?.paymentRequired && <Alert variant="warning">This doctor requires payment. The recorded booking will remain payment pending until the canonical payment workflow confirms it.</Alert>}
      <Select label="Patient selection" value={mode} onChange={event => { setMode(event.target.value); setIdentityVerified(false); }} options={[{ value: "existing", label: "Use verified existing patient" }, ...(inquiry && !inquiry.patientId && hasAnyPermission(user, "MANAGE_PATIENTS") ? [{ value: "new", label: "Register a new person with minimum details" }] : [])]} />
      {mode === "existing" ? <><Input label="Canonical patient reference" value={patientId} readOnly={!!task} maxLength={24} required onChange={event => { setPatientId(event.target.value); setIdentityVerified(false); }} />
        {inquiry && hasAnyPermission(user, "VIEW_PATIENTS", "MANAGE_PATIENTS") && <><Input label="Find existing patient by name or contact" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} /><Button variant="outline" loading={searching} disabled={!query.trim()} onClick={search}>Find existing patients</Button>
          {matches.map(patient => <Button key={recordId(patient)} variant="outline" onClick={() => { setPatientId(recordId(patient)); setIdentityVerified(false); }}>{patientName(patient)} · {patientPhone(patient) || "No phone"} — select after identity review</Button>)}</>}
        {inquiry?.patientId && patientId !== inquiry.patientId && <Input label="Patient reference correction reason" required maxLength={500} value={identityReason} onChange={event => setIdentityReason(event.target.value)} />}</>
        : <><Input label="New patient name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /><Input label="New patient Indian phone" type="tel" maxLength={30} value={phone} onChange={event => setPhone(event.target.value)} /><Input label="New patient email" type="email" maxLength={200} value={email} onChange={event => setEmail(event.target.value)} /><Input label="Distinct person review reason (if contacts are shared)" maxLength={500} value={distinctReason} onChange={event => setDistinctReason(event.target.value)} /></>}
      <Checkbox checked={identityVerified} onChange={event => setIdentityVerified(event.target.checked)} label="I verified the patient identity and booking authority. A shared contact alone is not proof." />
    </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={close}>Close</Button><Button type="submit" loading={pending} disabled={pending || !canSubmit}>{locked && error ? "Retry submitted conversion" : "Convert to booking"}</Button></div>
  </form></Modal>;
}
