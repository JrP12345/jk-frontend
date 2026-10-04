"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, Spinner } from "@/components/ui";
import { useClinicStore } from "@/store/clinicStore";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { PatientService } from "@/services/patient.service";
import { clinicDateKey, clinicLocalTimeToIso } from "@/lib/clinicTime";
import { patientName, patientPhone, recordId, validSingleChoice, type WorkflowPatient } from "@/lib/clinicWorkflow";

export interface ClinicDoctorAssignment {
  id?: string; isActive?: boolean; fees?: number; bookingMode?: "sequential_queue" | "time_slot";
  doctorId: { id?: string; _id?: string; name?: string } | string;
}
interface Props { open: boolean; onClose: () => void; clinicId?: string; onBooked: (appointmentId: string) => void; onFullRegistration?: () => void }

export function PatientEntryModal({ open, onClose, clinicId: initialClinicId, onBooked, onFullRegistration }: Props) {
  // Remount for each entry session, retaining all successful writes during retries.
  return open ? <PatientEntryForm onClose={onClose} initialClinicId={initialClinicId} onBooked={onBooked} onFullRegistration={onFullRegistration} /> : null;
}

function PatientEntryForm({ onClose, initialClinicId, onBooked, onFullRegistration }: Omit<Props, "open" | "clinicId"> & { initialClinicId?: string }) {
  const { user } = useAuthStore();
  const { clinics, fetchClinics } = useClinicStore();
  const [clinicId, setClinicId] = useState(initialClinicId || "");
  const [assignments, setAssignments] = useState<ClinicDoctorAssignment[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [source, setSource] = useState("walk-in");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Array<{ time: string; available?: boolean; isBooked?: boolean; lockedByOther?: boolean }>>([]);
  const [slotMode, setSlotMode] = useState<"sequential_queue" | "time_slot" | null>(null);
  const [slotLoading, setSlotLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkflowPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<WorkflowPatient | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookedId, setBookedId] = useState("");
  const beginSearch = useLatestRead();
  const beginAssignments = useLatestRead();
  const beginSlots = useLatestRead();
  const clinic = clinics.find(value => value.id === clinicId);
  const timezone = clinic?.effectiveTimezone || clinic?.timezone || "Asia/Kolkata";
  const canRegister = hasAnyPermission(user, "MANAGE_PATIENTS");
  const canCheckIn = hasAnyPermission(user, "MANAGE_APPOINTMENTS");

  useEffect(() => { void fetchClinics(); }, [fetchClinics]);
  useEffect(() => { setClinicId(current => validSingleChoice(clinics, value => value.id, current)); }, [clinics]);
  useEffect(() => { setDate(clinicDateKey(new Date(), timezone)); }, [timezone, clinicId]);
  useEffect(() => {
    const request = beginAssignments();
    setAssignments([]); setDoctorId(""); setSlotMode(null);
    if (!clinicId) return;
    setAssignmentLoading(true);
    api.get(`/onboarding/doctors/assignments?clinicId=${encodeURIComponent(clinicId)}`, { signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const choices = (response.data?.data || []).filter((value: ClinicDoctorAssignment) => value.isActive !== false && recordId(value.doctorId));
      setAssignments(choices);
      setDoctorId(validSingleChoice(choices, (value: ClinicDoctorAssignment) => recordId(value.doctorId)));
    }).catch(() => { if (request.isCurrent()) setError("Doctors could not be loaded. Close and retry."); })
      .finally(() => { if (request.isCurrent()) setAssignmentLoading(false); });
  }, [beginAssignments, clinicId]);
  useEffect(() => {
    const request = beginSlots(); setSlots([]); setSlot(""); setSlotMode(null);
    if (!clinicId || !doctorId || !date) return;
    setSlotLoading(true);
    api.get(`/doctors/${doctorId}/slots`, { params: { clinicId, date }, signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const data = response.data?.data;
      if (data?.isHoliday) { setError("The doctor is unavailable on this day. Choose another day or doctor."); return; }
      setSlotMode(data?.bookingMode || "sequential_queue");
      setSlots((data?.slots || []).filter((value: { available?: boolean; isBooked?: boolean; lockedByOther?: boolean }) => value.available === true && !value.isBooked && !value.lockedByOther));
    }).catch(() => { if (request.isCurrent()) setError("Availability could not be loaded. Choose the doctor again to retry."); })
      .finally(() => { if (request.isCurrent()) setSlotLoading(false); });
  }, [beginSlots, clinicId, doctorId, date]);

  const search = useCallback(async () => {
    const request = beginSearch(); setSearching(true); setError("");
    try {
      const response = await api.get("/patients", { params: { search: query.trim(), limit: 10 }, signal: request.signal });
      if (request.isCurrent()) setResults(response.data?.data || []);
    } catch { if (request.isCurrent()) setError("Patient search failed. Retry before creating a new record."); }
    finally { if (request.isCurrent()) setSearching(false); }
  }, [beginSearch, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      let savedPatient = patient;
      if (!bookedId) {
        if (!clinicId || !doctorId || !slotMode) throw new Error("Select an available clinic and doctor.");
        if (!savedPatient) {
          if (!newPatient || !canRegister || !name.trim() || !phone.trim()) throw new Error("Select a patient or enter their name and phone number.");
          savedPatient = await PatientService.createPatient({ name: name.trim(), phone: phone.trim() });
          setPatient(savedPatient); setNewPatient(false);
        }
        const appointmentTime = slotMode === "time_slot"
          ? clinicLocalTimeToIso(date, slot, timezone)
          : date === clinicDateKey(new Date(), timezone) ? new Date().toISOString() : clinicLocalTimeToIso(date, "00:00", timezone);
        const response = await api.post("/appointments", { patientId: recordId(savedPatient!), clinicId, doctorId, appointmentTime, appointmentType: source });
        const created = response.data?.data;
        const id = recordId(created);
        if (!id) throw new Error("Booking response is missing a visit reference. Search today's appointments before retrying.");
        setBookedId(id);
        if (source === "walk-in" && date === clinicDateKey(new Date(), timezone) && canCheckIn && created.status !== "pending_payment") {
          await api.put(`/appointments/${id}/status`, { status: "checked-in" });
        }
        onBooked(id);
      } else {
        await api.put(`/appointments/${bookedId}/status`, { status: "checked-in" });
        onBooked(bookedId);
      }
    } catch (failure: unknown) {
      const details = failure as { message?: string; response?: { status?: number; data?: { message?: string; details?: { highConfidenceMatches?: WorkflowPatient[]; mediumConfidenceMatches?: WorkflowPatient[] } } } };
      const matches = details.response?.data?.details;
      if (matches) { setResults([...(matches.highConfidenceMatches || []), ...(matches.mediumConfidenceMatches || [])]); setNewPatient(false); }
      setError(details.response?.data?.message || details.message || "Entry failed. Search existing records before retrying if the response was lost.");
    } finally { setBusy(false); }
  }

  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Add patient" size="lg" busy={busy} closeOnOverlay={!busy}
    description="Search an existing patient or register essential details, then add the visit."
    footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>{bookedId && <Button variant="outline" disabled={busy} onClick={() => onBooked(bookedId)}>View booked visit</Button>}<Button form="patient-entry-form" type="submit" loading={busy} disabled={busy || assignmentLoading || slotLoading || (!bookedId && !slotMode)}>{bookedId ? "Retry arrival" : "Add visit"}</Button></div>}>
    <form id="patient-entry-form" onSubmit={submit} className="space-y-4">
      {error && <Alert variant="error">{error}{bookedId && " The visit is already booked. Retry arrival or view the visit; do not book it again."}</Alert>}
      <fieldset disabled={busy || Boolean(bookedId)} className="space-y-4 disabled:opacity-60">
        {patient ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"><div><p className="font-medium">{patientName(patient)}</p><p className="text-sm text-text-muted">{patientPhone(patient)} · {patient.mrn || "Registered patient"}</p></div><Button variant="ghost" onClick={() => setPatient(null)}>Change patient</Button></div> : <>
          <div className="flex items-end gap-2"><Input className="flex-1" label="Search name, phone or patient identifier" value={query} onChange={e => setQuery(e.target.value)} /><Button variant="outline" onClick={search} loading={searching} disabled={!query.trim() || searching}>Search</Button></div>
          <div className="space-y-1">{results.map(value => <Button key={recordId(value)} variant="outline" className="w-full justify-start whitespace-normal text-left" onClick={() => { setPatient(value); setNewPatient(false); }}>{patientName(value)} · {patientPhone(value)} {value.mrn && `· ${value.mrn}`}</Button>)}</div>
          {canRegister && <Button variant="ghost" onClick={() => setNewPatient(true)}>Register a new patient</Button>}
          {newPatient && <div className="grid gap-3 sm:grid-cols-2"><Input label="Patient name" value={name} onChange={e => setName(e.target.value)} required /><Input type="tel" label="Phone number" value={phone} onChange={e => setPhone(e.target.value)} required /></div>}
        </>}
        <div className="grid gap-3 sm:grid-cols-2">
          {clinics.length !== 1 ? <Select label="Clinic" value={clinicId} onChange={e => { setClinicId(e.target.value); setError(""); }} options={[{ value: "", label: "Select clinic" }, ...clinics.map(value => ({ value: value.id, label: value.name }))]} required /> : <p className="self-center text-sm text-text-muted">Clinic: {clinic?.name}</p>}
          {assignmentLoading ? <Spinner label="Loading doctors" /> : assignments.length !== 1 ? <Select label="Doctor" value={doctorId} onChange={e => { setDoctorId(e.target.value); setError(""); }} options={[{ value: "", label: "Select doctor" }, ...assignments.map(value => ({ value: recordId(value.doctorId), label: typeof value.doctorId === "object" ? value.doctorId.name || "Doctor" : "Doctor" }))]} required /> : <p className="self-center text-sm text-text-muted">Doctor: {typeof assignments[0].doctorId === "object" ? assignments[0].doctorId.name : "Assigned doctor"}</p>}
          <Select label="Visit source" value={source} onChange={e => setSource(e.target.value)} options={[{ value: "walk-in", label: "Walk-in (patient present)" }, { value: "reception", label: "Phone / desk booking" }]} />
          <Input type="date" label={`Visit date (${timezone})`} min={clinicDateKey(new Date(), timezone)} value={date} onChange={e => { setDate(e.target.value); setError(""); }} required />
          {slotMode === "time_slot" && <Select label="Available appointment time" value={slot} onChange={e => setSlot(e.target.value)} options={[{ value: "", label: "Choose time" }, ...slots.map(value => ({ value: value.time, label: value.time }))]} required />}
        </div>
        {slotLoading && <Spinner label="Checking availability" />}
        {slotMode === "sequential_queue" && <p className="text-xs text-text-muted">This doctor uses a token queue. Walk-ins are marked arrived; phone / desk bookings wait for arrival confirmation.</p>}
        {onFullRegistration && <Button variant="ghost" onClick={onFullRegistration}>Full registration and scheduling</Button>}
      </fieldset>
    </form>
  </Modal>;
}
