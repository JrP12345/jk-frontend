"use client";

import { useState } from "react";
import api from "@/lib/api";
import PrintButton from "@/components/ui/PrintButton";
import { printHtml } from "@/lib/printBrand";
import { Alert, Button, Card, Input, Textarea } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useUnsavedClinicalChanges } from "@/hooks/useUnsavedClinicalChanges";

interface Medicine { name: string; dosage: string; frequency: string; duration: string; instructions: string }
interface Props { appointmentId: string; encounterId?: string; doctorId: string; initialNotes?: string; completed?: boolean; onCompleted: (next: boolean) => Promise<void>; onFullEditor: (draft: { notes: string; symptoms: string; diagnosis: string; medicines: Medicine[] }) => void }

/** A focused composition of the existing appointment completion/Rx lifecycle. */
export function VisitCompletion({ appointmentId, encounterId, doctorId, initialNotes = "", completed: initiallyCompleted = false, onCompleted, onFullEditor }: Props) {
  const user = useAuthStore(state => state.user);
  const [notes, setNotes] = useState(initialNotes);
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [details, setDetails] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [override, setOverride] = useState("");
  const [findings, setFindings] = useState<Array<{ message?: string; description?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [error, setError] = useState("");
  const canComplete = hasAnyPermission(user, "MANAGE_CLINICAL_NOTES");
  const canPrescribe = user?.id === doctorId && canComplete;
  const dirty = !completed && (notes !== initialNotes || Boolean(symptoms || diagnosis || medicines.length));
  useUnsavedClinicalChanges(dirty);
  async function complete(next: boolean) {
    if (busy || completed) return;
    setBusy(true); setError("");
    try {
      await api.put(`/appointments/${appointmentId}/status`, {
        status: "completed", documentationMode: "optional", notes: notes.trim(), symptoms: symptoms.trim(), diagnosis: diagnosis.trim(),
        prescriptions: medicines, dispatchWhatsAppRx: false, ...(override.trim() ? { cdsOverrideReason: override.trim() } : {}),
      });
      setCompleted(true);
      await onCompleted(next);
    } catch (failure: unknown) {
      const response = (failure as { response?: { data?: { message?: string; findings?: typeof findings } } }).response?.data;
      setError(response?.message || "Completion could not be confirmed. Refresh the visit before retrying if the connection was lost.");
      if (response?.findings) setFindings(response.findings);
    } finally { setBusy(false); }
  }
  if (completed) return <Alert variant="success" title="Visit completed">The visit is in patient history. <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => onCompleted(true)}>Next patient</Button>{encounterId && medicines.length > 0 && <PrintButton documentName="prescription" onPrint={() => api.get<string>(`/encounters/${encounterId}/prescription/print`, { responseType: "text" }).then(response => printHtml(response.data))} />}</div></Alert>;
  return <Card className="p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Consultation</h2><Button variant="outline" disabled={busy} onClick={() => { onFullEditor({ notes, symptoms, diagnosis, medicines }); }}>Full clinical editor</Button></div>
    <p className="text-sm text-text-muted">Record what is useful for this visit. A note or medicine is optional.</p>
    {error && <Alert variant="error">{error}</Alert>}
    <fieldset disabled={busy || !canComplete} className="space-y-4">
      <Textarea label="Visit note (optional)" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="A short note, if needed" />
      <Button variant="ghost" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? "Hide complaint and diagnosis" : "Add complaint or diagnosis"}</Button>
      {details && <div className="grid gap-3 sm:grid-cols-2"><Input label="Complaint (optional)" value={symptoms} onChange={e => setSymptoms(e.target.value)} /><Input label="Diagnosis (optional)" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div>}
      {medicines.map((medicine, index) => <div key={index} className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Medicine {index + 1}</h3><Button variant="ghost" onClick={() => setMedicines(values => values.filter((_, position) => index !== position))}>Remove</Button></div>
        <div className="grid gap-3 sm:grid-cols-2">{(["name", "dosage", "frequency", "duration", "instructions"] as const).map(field => <Input key={field} label={field === "name" ? "Medicine name" : field[0].toUpperCase() + field.slice(1)} value={medicine[field]} required={field !== "instructions"} onChange={e => setMedicines(values => values.map((value, position) => position === index ? { ...value, [field]: e.target.value } : value))} />)}</div>
      </div>)}
      {canPrescribe && <Button variant="outline" onClick={() => setMedicines(values => [...values, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }])}>Add medicine</Button>}
      {findings.length > 0 && <Alert variant="warning" title="Prescription safety review"><ul className="list-disc pl-5">{findings.map((finding, index) => <li key={index}>{finding.message || finding.description || "Safety finding — review this prescription in the full clinical editor."}</li>)}</ul><Textarea label="Clinical override justification" value={override} onChange={e => setOverride(e.target.value)} /></Alert>}
    </fieldset>
    <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
      <Button variant="outline" loading={busy} disabled={!canComplete || busy || medicines.some(value => !value.name.trim() || !value.dosage.trim() || !value.frequency.trim() || !value.duration.trim())} onClick={() => complete(false)}>Complete visit</Button>
      <Button loading={busy} disabled={!canComplete || busy || medicines.some(value => !value.name.trim() || !value.dosage.trim() || !value.frequency.trim() || !value.duration.trim())} onClick={() => complete(true)}>Complete & next</Button>
    </div>
  </Card>;
}
