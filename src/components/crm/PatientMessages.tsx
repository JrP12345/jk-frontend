"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Modal, Select, Checkbox } from '@/components/ui';
interface Message { id: string; channel: string; purpose: string; status: string; reason?: string; createdAt: string }
const failureMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Message result could not be confirmed. Retry the submitted request or reload.';
export function PatientMessages({ patientId, locationId }: { patientId: string; locationId?: string }) {
  const user = useAuthStore(state => state.user), [open, setOpen] = useState(false);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM')) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}>Patient messages</Button>{open && <Messages key={`${authScopeKey(user)}:${patientId}:${locationId || ""}`} patientId={patientId} initialBranch={locationId} canSend={hasAnyPermission(user, 'COMMUNICATE_PATIENTS')} onClose={() => setOpen(false)} />}</>;
}
function Messages({ patientId, initialBranch, canSend, onClose }: { patientId: string; initialBranch?: string; canSend: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Message[]>([]), [cursor, setCursor] = useState<string | null>(null), [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState(initialBranch || ''), [channel, setChannel] = useState('whatsapp'), [purpose, setPurpose] = useState('care_operations');
  const [preview, setPreview] = useState<{ recipient: string; recipientHash: string } | null>(null), [verified, setVerified] = useState(false), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const submitted = useRef<Record<string, unknown> | null>(null), requestId = useRef(crypto.randomUUID()), beginRead = useLatestRead(), beginPreview = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const read = beginRead(); setLoading(true); setError('');
    try {
      const [response, branches] = await Promise.all([api.get('/crm/communications/messages', { params: { patientId, ...(next ? { cursor: next } : {}) }, signal: read.signal }), canSend ? getCrmLocations(read.signal) : null]);
      if (!read.isCurrent()) return;
      setItems(current => next ? [...new Map([...current, ...response.data.data.items].map((row: Message) => [row.id, row])).values()] : response.data.data.items); setCursor(response.data.data.nextCursor);
      if (branches) { setLocations(branches); if (branches.length === 1) setLocationId(current => current || branches[0].id); }
    } catch (failure) { if (read.isCurrent()) setError(failureMessage(failure)); } finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, canSend, patientId]);
  useEffect(() => { void load(); }, [load]);
  async function reviewRecipient() {
    const read = beginPreview(); setPending(true); setPreview(null); setVerified(false); setError('');
    try { const response = await api.get('/crm/communications/messages/preview', { params: { patientId, locationId, channel, purpose }, signal: read.signal }); if (read.isCurrent()) setPreview(response.data.data); }
    catch (failure) { if (read.isCurrent()) setError(failureMessage(failure)); } finally { if (read.isCurrent()) setPending(false); }
  }
  function resetPreview() { setPreview(null); setVerified(false); }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (pending || !preview) return; setPending(true); setError('');
    submitted.current ??= { patientId, locationId, channel, purpose, subjectVerified: verified, recipientHash: preview.recipientHash, clientRequestId: requestId.current }; setLocked(true);
    try { const response = await api.post('/crm/communications/messages', submitted.current); setResult(`Message ${response.data.data.status.replaceAll('_', ' ')}. Delivery is confirmed only by provider receipts.`); await load(); }
    catch (failure) { setError(failureMessage(failure)); } finally { setPending(false); }
  }
  return <Modal open title="Patient messages" size="lg" busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}><div className="space-y-4">
    <p>Review the canonical patient and current recipient. Each channel and purpose needs recorded consent. Messages use a minimal clinic contact request.</p>
    {error && <Alert variant="error">{error}</Alert>}{result && <Alert variant="info">{result}</Alert>}
    <Button variant="outline" loading={loading} onClick={() => load()}>Reload message states</Button>{loading && <p role="status">Loading messages...</p>}
    {!loading && !items.length && <p>No messages in this scope.</p>}{items.map(row => <div key={row.id} className="border border-border rounded-lg p-3"><p>{row.channel} · {row.purpose.replaceAll('_', ' ')} · {row.status.replaceAll('_', ' ')}</p><p>{new Date(row.createdAt).toLocaleString()}</p>{row.reason && <p>Review needed: {row.reason.replaceAll('_', ' ').toLowerCase()}</p>}</div>)}
    {cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More messages</Button>}
    {canSend && !result && <form onSubmit={send} className="space-y-3"><fieldset disabled={pending || locked} className="space-y-3">
      <Select label="Message branch" value={locationId} onChange={event => { setLocationId(event.target.value); resetPreview(); }} options={locations.map(row => ({ value: row.id, label: row.name }))} placeholder="Choose branch" />
      <Select label="Message channel" value={channel} onChange={event => { setChannel(event.target.value); resetPreview(); }} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }]} />
      <Select label="Message purpose" value={purpose} onChange={event => { setPurpose(event.target.value); resetPreview(); }} options={[{ value: 'care_operations', label: 'Service request' }, { value: 'care_followup', label: 'Recommended care follow-up' }, { value: 'feedback', label: 'Feedback request' }]} />
      <Button variant="outline" disabled={!locationId || loading} onClick={reviewRecipient}>Review recipient and consent</Button>
      {preview && <><p>Recipient: {preview.recipient}. Message: Please contact {locations.find(row => row.id === locationId)?.name || 'your clinic'} about {purpose === 'care_followup' ? 'a recommended care follow-up' : purpose === 'feedback' ? 'your feedback' : 'your service request'}.</p><Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I reviewed the canonical patient and this recipient." /></>}
    </fieldset><Button type="submit" loading={pending} disabled={!preview || !verified || loading}>{locked ? 'Retry submitted message' : 'Queue reviewed message'}</Button></form>}
  </div></Modal>;
}
