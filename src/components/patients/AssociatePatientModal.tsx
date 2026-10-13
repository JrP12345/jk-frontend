"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, Checkbox } from "@/components/ui";
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import { useAuthStore } from '@/store/authStore';
import { authScopeKey } from '@/lib/authScope';

export function AssociatePatientModal({ onClose, onAssociated }: { onClose: () => void; onAssociated: (patientId: string) => void }) {
  const user = useAuthStore(state => state.user);
  return <AssociationForm key={authScopeKey(user)} onClose={onClose} onAssociated={onAssociated} />;
}
function AssociationForm({ onClose, onAssociated }: { onClose: () => void; onAssociated: (patientId: string) => void }) {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationId, setLocationId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCrmLocations(controller.signal, '/patients/association-locations').then(values => {
      if (controller.signal.aborted) return;
      setLocations(values);
      if (values.length === 1) setLocationId(values[0].id);
      setError("");
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof CrmBranchScopeError ? failure.message : "Locations could not be loaded. Retry before proceeding."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  async function associate(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { const response = await api.post(`/patients/${patientId.trim()}/associate`, { locationId, verificationMethod: "in_person", identityVerified: verified, reason: reason.trim(), clientRequestId }); onAssociated(response.data.data.id); }
    catch (failure) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Association could not be confirmed. Retry the same details before creating another patient."); }
    finally { setPending(false); }
  }
  return <Modal open title="Use an existing patient record" description="Use the patient record reference provided by the patient. Verify the person in person before associating their canonical identity with this organization." onClose={() => { if (!pending) onClose(); }} busy={pending} closeOnOverlay={!pending}>
    <form onSubmit={associate} className="space-y-3">{error && <Alert variant="error">{error}</Alert>}{locations.length === 0 && !loading && <Button variant="outline" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Reload locations</Button>}
      <fieldset disabled={pending || loading} className="space-y-3"><Input label="Existing patient record reference" value={patientId} onChange={event => setPatientId(event.target.value)} pattern="[a-fA-F0-9]{24}" required />
        <Select label="Association location" value={locationId} onChange={event => setLocationId(event.target.value)} options={[{ value: "", label: "Select location" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} required />
        <Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I independently verified the patient identity and their authority to use this record." />
        <Input label="Identity verification reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required />
      </fieldset><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button><Button type="submit" loading={pending} disabled={pending || loading || !locationId || !verified || !reason.trim() || !/^[a-fA-F0-9]{24}$/.test(patientId.trim())}>Associate existing patient</Button></div>
    </form>
  </Modal>;
}
