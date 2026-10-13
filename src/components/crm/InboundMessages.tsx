"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Card, CardContent, Input, Modal, Select, Checkbox } from '@/components/ui';
interface Message { id: string; revision: number; type: string; text: string; contactHint: string; createdAt: string }
interface Destination { id: string; callerName?: string; locationId: string; patientId?: string; status: string; createdAt: string }
const failureMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Reply review could not be confirmed. Retry the submitted review or reload.';
export function InboundMessages() {
  const user = useAuthStore(state => state.user);
  if (!user || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM') || !hasAnyPermission(user, 'COMMUNICATE_PATIENTS')) return <Alert variant="error">Authorized communication access is required.</Alert>;
  if (!user.organization_id && user.role !== 'root') return <Alert variant="warning">Select an organization workspace to review replies.</Alert>;
  return <Inbox key={authScopeKey(user)} root={user.role === 'root'} initialOrganization={user.organization_id || ''} canRoute={hasAnyPermission(user, 'MANAGE_CRM_INQUIRIES')} />;
}
function Inbox({ root, initialOrganization, canRoute }: { root: boolean; initialOrganization: string; canRoute: boolean }) {
  const [shared, setShared] = useState(root), [organizationId, setOrganizationId] = useState(initialOrganization), [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<Message[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [selected, setSelected] = useState<Message | null>(null), beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const read = beginRead(); setLoading(true); setError('');
    try {
      const [response, orgs] = await Promise.all([shared || organizationId ? api.get('/crm/communications/inbound', { params: { shared, ...(organizationId ? { organizationId } : {}), ...(next ? { cursor: next } : {}) }, signal: read.signal }) : null, root ? api.get('/organizations', { signal: read.signal }) : null]);
      if (!read.isCurrent()) return;
      setItems(current => next ? [...new Map([...current, ...response!.data.data.items].map((row: Message) => [row.id, row])).values()] : response?.data.data.items || []); setCursor(response?.data.data.nextCursor || null); if (orgs) setOrganizations(orgs.data.data);
    } catch (failure) { if (read.isCurrent()) setError(failureMessage(failure)); } finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, organizationId, root, shared]);
  useEffect(() => { void load(); }, [load]);
  return <Card><CardContent className="space-y-4"><h1 className="text-xl font-semibold">Communication replies</h1><p>Route each reply to an inquiry after reviewing its subject and branch. Contact hints do not establish patient identity. Create an inquiry through the existing capture flow when needed.</p>
    <Link className="text-accent underline" href="/dashboard/crm">Open inquiries</Link>
    {root && <><Select label="Reply inbox" value={shared ? 'shared' : 'organization'} onChange={event => setShared(event.target.value === 'shared')} options={[{ value: 'shared', label: 'Shared sender quarantine' }, { value: 'organization', label: 'Organization inbox' }]} /><Select label={shared ? 'Routing destination organization' : 'Inbox organization'} value={organizationId} onChange={event => setOrganizationId(event.target.value)} options={organizations.map(row => ({ value: row.id, label: row.name }))} placeholder="Choose organization" /></>}
    {error && <Alert variant="error">{error}</Alert>}<Button variant="outline" loading={loading} onClick={() => load()}>Reload replies</Button>{loading && <p role="status">Loading replies...</p>}
    {!loading && !items.length && <p>No replies awaiting review in this scope.</p>}{items.map(row => <div key={row.id} className="border border-border rounded-lg p-3 space-y-2"><p>Contact ending {row.contactHint} · {new Date(row.createdAt).toLocaleString()}</p><p className="whitespace-pre-wrap break-words">{row.text || `${row.type} message. Review through the authorized sender account.`}</p>{canRoute && <Button variant="outline" disabled={!organizationId} onClick={() => setSelected(row)}>Review reply destination</Button>}</div>)}
    {cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More replies</Button>}
    {selected && <Routing key={`${selected.id}:${organizationId}`} message={selected} organizationId={organizationId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(); }} />}
  </CardContent></Card>;
}
function Routing({ message, organizationId, onClose, onSaved }: { message: Message; organizationId: string; onClose: () => void; onSaved: () => void }) {
  const [inquiries, setInquiries] = useState<Destination[]>([]), [cursor, setCursor] = useState<string | null>(null), [inquiryId, setInquiryId] = useState(''), [reason, setReason] = useState(''), [verified, setVerified] = useState(false), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState('');
  const user = useAuthStore(state => state.user);
  const submitted = useRef<Record<string, unknown> | null>(null), requestId = useRef(crypto.randomUUID()), beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const read = beginRead(); setLoading(true); setError('');
    try { const response = await api.get('/crm/inquiries', { params: { organizationId, owner: hasAnyPermission(user, 'ASSIGN_CRM_TASKS') ? 'team' : 'mine', status: 'active', ...(next ? { cursor: next } : {}) }, signal: read.signal }); if (read.isCurrent()) { setInquiries(current => next ? [...current, ...response.data.data.items] : response.data.data.items); setCursor(response.data.data.nextCursor); } }
    catch (failure) { if (read.isCurrent()) setError(failureMessage(failure)); } finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, organizationId, user]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError('');
    submitted.current ??= { organizationId, inquiryId, reason: reason.trim(), subjectVerified: verified, expectedRevision: message.revision, clientRequestId: requestId.current }; setLocked(true);
    try { await api.post(`/crm/communications/inbound/${message.id}/route`, submitted.current); onSaved(); } catch (failure) { setError(failureMessage(failure)); } finally { setPending(false); }
  }
  const destination = inquiries.find(row => row.id === inquiryId);
  return <Modal open title="Review reply destination" size="lg" busy={pending} closeOnOverlay={!pending} onClose={() => { if (!pending) onClose(); }}><form onSubmit={save} className="space-y-3">
    <p>Review the destination inquiry before routing. This does not identify a patient from their phone or grant communication consent.</p>{error && <Alert variant="error">{error}</Alert>}
    <Button variant="outline" loading={loading} disabled={locked} onClick={() => load()}>Reload eligible inquiries</Button>{cursor && <Button variant="outline" disabled={locked || loading} onClick={() => load(cursor)}>More destination inquiries</Button>}
    <fieldset disabled={pending || locked} className="space-y-3"><Select label="Destination inquiry" value={inquiryId} onChange={event => { setInquiryId(event.target.value); setVerified(false); }} options={inquiries.map(row => ({ value: row.id, label: `${row.callerName || 'Anonymous caller'} · ${new Date(row.createdAt).toLocaleDateString()} · ${row.status.replaceAll('_', ' ')}` }))} placeholder="Choose inquiry" />
    {destination && <Link className="text-accent underline" href={`/dashboard/crm?inquiryId=${destination.id}`} target="_blank" rel="noopener noreferrer">Review selected inquiry and branch</Link>}
    <Input label="Routing reason" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /><Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I reviewed this reply, destination organization, inquiry and branch." /></fieldset>
    <Button type="submit" loading={pending} disabled={!verified || !destination || !reason.trim() || loading}>{locked ? 'Retry submitted routing' : 'Route reviewed reply'}</Button>
  </form></Modal>;
}
