"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Input, Modal, Select, Checkbox } from '@/components/ui';
interface Call { id: string; outcome: string; note?: string; actorName: string; communication: { direction: string; occurredAt: string; source: string } }
type Subject = { patientId: string; inquiryId?: never; locationId?: string } | { inquiryId: string; patientId?: never; locationId: string };
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Call history could not be confirmed. Retry the submitted record or reload.';
export function CallHistory(subject: Subject) {
  const user = useAuthStore(state => state.user), [open, setOpen] = useState(false);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM')) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}>Call history</Button>{open && <History key={`${authScopeKey(user)}:${subject.patientId || subject.inquiryId}:${subject.locationId || ""}`} subject={subject} canRecord={hasAnyPermission(user, 'COMMUNICATE_PATIENTS')} onClose={() => setOpen(false)} />}</>;
}
function History({ subject, canRecord, onClose }: { subject: Subject; canRecord: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Call[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [direction, setDirection] = useState('inbound'), [outcome, setOutcome] = useState('contacted'), [occurredAt, setOccurredAt] = useState(() => new Date().toISOString()), [note, setNote] = useState(''), [verified, setVerified] = useState(false), [branch, setBranch] = useState(subject.locationId || '');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]), [pending, setPending] = useState(false), [locked, setLocked] = useState(false);
  const submitted = useRef<Record<string, unknown> | null>(null), requestId = useRef(crypto.randomUUID()), beginRead = useLatestRead();
  const patientId = subject.patientId, inquiryId = subject.inquiryId;
  const load = useCallback(async (next?: string) => {
    const read = beginRead(); setLoading(true); setError('');
    try {
      const [response, branches] = await Promise.all([api.get('/crm/communications/calls', { params: { ...(patientId ? { patientId } : { inquiryId }), ...(next ? { cursor: next } : {}) }, signal: read.signal }), canRecord && patientId ? getCrmLocations(read.signal) : null]);
      if (!read.isCurrent()) return;
      setItems(current => next ? [...new Map([...current, ...response.data.data.items].map((row: Call) => [row.id, row])).values()] : response.data.data.items); setCursor(response.data.data.nextCursor);
      if (branches) { setLocations(branches); if (branches.length === 1) setBranch(current => current || branches[0].id); }
    } catch (failure) { if (read.isCurrent()) setError(errorMessage(failure)); }
    finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, canRecord, patientId, inquiryId]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError('');
    try {
      const date = new Date(occurredAt); if (!Number.isFinite(date.getTime())) throw new Error('Invalid call time');
      submitted.current ??= { ...(patientId ? { patientId } : { inquiryId }), locationId: branch, clientRequestId: requestId.current, direction, outcome, occurredAt: date.toISOString(), note: note.trim(), subjectVerified: verified };
      setLocked(true); await api.post('/crm/communications/calls', submitted.current); setSaved(true); await load();
    } catch (failure) { setError(errorMessage(failure)); } finally { setPending(false); }
  }
  return <Modal open title="Call history" size="lg" busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}><div className="space-y-4">
    <p>Calls are reported by staff. This records a call you handled; it does not place a call or grant consent. Keep clinical details out of these notes.</p>
    {error && <Alert variant="error">{error}</Alert>}{saved && <Alert variant="success">Staff-reported call saved or restored.</Alert>}
    <Button variant="outline" loading={loading} onClick={() => load()}>Reload calls</Button>
    {loading && <p role="status">Loading calls...</p>}{!loading && !items.length && <p>No call records in this scope.</p>}
    {items.map(row => <div key={row.id} className="rounded-lg border border-border p-3"><p>{row.communication?.direction} call: {row.outcome.replaceAll('_', ' ')} · {row.actorName}</p><p>Staff reported · {new Date(row.communication?.occurredAt).toLocaleString()}</p>{row.note && <p className="whitespace-pre-wrap break-words">{row.note}</p>}</div>)}
    {cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More calls</Button>}
    {canRecord && !saved && <form onSubmit={save} className="space-y-3"><fieldset disabled={pending || locked} className="space-y-3">
      {patientId && <Select label="Call handling branch" value={branch} onChange={event => setBranch(event.target.value)} options={locations.map(row => ({ value: row.id, label: row.name }))} placeholder="Choose branch" />}
      <Select label="Call direction" value={direction} onChange={event => setDirection(event.target.value)} options={[{ value: 'inbound', label: 'Inbound' }, { value: 'outbound', label: 'Outbound' }]} />
      <Select label="Call outcome" value={outcome} onChange={event => setOutcome(event.target.value)} options={['contacted', 'no_answer', 'unreachable', 'invalid_contact', 'declined', 'other'].map(value => ({ value, label: value.replaceAll('_', ' ') }))} />
      <Input label="Call time (include timezone)" required value={occurredAt} onChange={event => setOccurredAt(event.target.value)} />
      <Input label="Administrative call note" maxLength={1000} value={note} onChange={event => setNote(event.target.value)} required={outcome === 'other'} />
      <Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I reviewed the selected patient or inquiry. Shared contact details alone do not identify a patient." />
    </fieldset><Button type="submit" loading={pending} disabled={!verified || !branch || loading}>{locked ? 'Retry submitted call record' : 'Save staff-reported call'}</Button></form>}
  </div></Modal>;
}
