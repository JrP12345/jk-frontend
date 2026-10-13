"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { authScopeKey } from '@/lib/authScope';
import { hasAnyPermission } from '@/lib/permissions';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Input, Modal, Checkbox } from '@/components/ui';

interface Grants { communication: boolean; consent: boolean; dataRights: boolean }
interface Family { id: string; name: string; relationship: string; available: boolean; revision: number; grants: Grants; reviewedAt: string | null }
interface Command { family: Family; clientRequestId: string; expectedRevision: number; identityVerified: boolean; reason: string; grants: Grants }
const labels: Record<keyof Grants, string> = { communication: 'Receive organization service communications', consent: 'Record organization consent choices', dataRights: 'Request organization data export or erasure review' };
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Family authority could not be confirmed. Retry the same submitted review.'; }
export function FamilyAuthorityPanel({ patientId }: { patientId: string }) {
  const user = useAuthStore(state => state.user);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || user.impersonatedBy || !hasAnyPermission(user, 'ADMINISTRATIVE_GOVERNANCE') || !hasAnyPermission(user, 'REVIEW_PATIENT_IDENTITY')) return null;
  return <Workspace key={`${authScopeKey(user)}:${patientId}`} patientId={patientId} />;
}
function Workspace({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<Family[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState<Family | null>(null), [submitted, setSubmitted] = useState<Command | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const busyRef = useRef(false), mounted = useRef(true), beginRead = useLatestRead();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (next?: string) => {
    const request = beginRead(); setLoading(true); setError('');
    try {
      const response = await api.get(`/crm/patients/${patientId}/family-authorizations`, { params: next ? { cursor: next } : {}, signal: request.signal });
      if (request.isCurrent()) { setRows(current => next ? [...new Map([...current, ...response.data.data.items].map((row: Family) => [row.id, row])).values()] : response.data.data.items); setCursor(response.data.data.nextCursor); }
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, patientId]);
  useEffect(() => { void load(); }, [load]);
  async function save(command: Command) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setSubmitted(command); setError('');
    const { family, ...payload } = command;
    try {
      await api.put(`/crm/patients/${patientId}/family-authorizations/${family.id}`, payload);
      if (!mounted.current) return;
      setSubmitted(null); setOpen(false); setSelected(null); void load();
    } catch (failure) {
      if (!mounted.current) return;
      setError(message(failure));
      const status = (failure as { response?: { status?: number } }).response?.status;
      if ([400, 403, 404, 409, 422].includes(status || 0)) { setSubmitted(null); setSelected(null); setOpen(false); }
    }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Organization family authority"><h3 className="font-medium">Organization family authority</h3>
    <p className="text-sm text-text-muted">Review each purpose independently using verified delegation evidence. Family booking access alone grants none of these purposes.</p>
    {!open && error && <Alert variant="error">{error}</Alert>}{loading && <p role="status">Loading family authority…</p>}
    {!loading && !rows.length && !error && <p>No active family relationships to review.</p>}
    {submitted && !open && <Button onClick={() => { setSelected(submitted.family); setOpen(true); }}>Resume submitted family review</Button>}
    {rows.map(row => <div key={row.id} className="rounded-lg border border-border p-3 space-y-2"><p>{row.name} ({row.relationship})</p><p className="text-sm">{Object.entries(labels).map(([key, label]) => `${label}: ${row.grants[key as keyof Grants] ? 'authorized' : 'not authorized'}`).join('. ')}</p><Button variant="outline" disabled={busy || !!submitted || !row.available} onClick={() => { setSelected(row); setOpen(true); }}>Review authority for {row.name}</Button></div>)}
    <Button variant="outline" disabled={busy || !!submitted} loading={loading} onClick={() => load()}>Reload family authority</Button>{cursor && <Button variant="outline" disabled={busy || !!submitted || loading} onClick={() => load(cursor)}>More family relationships</Button>}
    {open && selected && <Review key={selected.id} family={selected} submitted={submitted} error={error} busy={busy} onClose={() => setOpen(false)} onSave={save} />}
  </section>;
}
function Review({ family, submitted, error, busy, onClose, onSave }: { family: Family; submitted: Command | null; error: string; busy: boolean; onClose: () => void; onSave: (command: Command) => Promise<void> }) {
  const [grants, setGrants] = useState(submitted?.grants || family.grants), [reason, setReason] = useState(submitted?.reason || ''), [verified, setVerified] = useState(submitted?.identityVerified || false);
  const [clientRequestId] = useState(() => submitted?.clientRequestId || crypto.randomUUID());
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  return <Modal open title={`Family authority · ${family.name}`} busy={busy} onClose={onClose} description="Applies only to the current organization. Review identity, delegation basis and each purpose separately."><form className="space-y-4" onSubmit={event => { event.preventDefault(); void onSave(submitted || { family, clientRequestId, expectedRevision: family.revision, grants, reason: reason.trim(), identityVerified: verified }); }}>
    {error && <p role="alert" tabIndex={-1} ref={errorRef} className="text-danger">{error}</p>}
    <fieldset disabled={busy || !!submitted} className="min-w-0 space-y-3">{Object.entries(labels).map(([key, label]) => <Checkbox checked={grants[key as keyof Grants]} onChange={event => setGrants(current => ({ ...current, [key]: event.target.checked }))} label={(label)} key={key} />)}
      <Input label="Verified delegation basis" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required />
      <Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I independently verified this person’s identity and authority for the selected purposes." />
    </fieldset><p className="text-sm text-text-muted">Changing a grant requires fresh consent evidence before related communication. Data erasure requests still require an organization retention review.</p>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button type="submit" loading={busy} disabled={busy || !verified || !reason.trim()}>{submitted ? 'Retry submitted family review' : 'Save reviewed family authority'}</Button></div>
  </form></Modal>;
}
