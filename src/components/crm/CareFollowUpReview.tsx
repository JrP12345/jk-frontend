"use client";
import { useRef, useState } from 'react';
import api from '@/lib/api';
import { locationLocalDateTimeInput, locationLocalTimeToIso } from '@/lib/locationTime';
import { Alert, Button, Input, Modal, Select, Textarea, Checkbox } from '@/components/ui';
export function CareFollowUpReview({ task, timezone, onClose, onSaved }: { task: { id: string; revision: number; followUpReview?: 'ambiguous' | 'legacy' }; timezone: string; onClose: () => void; onSaved: () => void }) {
  const [decision, setDecision] = useState(task.followUpReview === 'legacy' ? 'confirm_existing' : 'recommendation'), [reason, setReason] = useState(''), [verified, setVerified] = useState(false);
  const [due, setDue] = useState(() => locationLocalDateTimeInput(new Date(Date.now() + 86400000), timezone));
  const [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState('');
  const [clientRequestId] = useState(() => crypto.randomUUID()), submitted = useRef<Record<string, unknown> | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError('');
    try {
      submitted.current ??= { clientRequestId, expectedRevision: task.revision, decision, identityVerified: verified, reason: reason.trim(), ...(decision === 'recommendation' ? { dueAt: locationLocalTimeToIso(due.split('T')[0], due.split('T')[1], timezone) } : {}) };
      setLocked(true); await api.post(`/crm/tasks/${task.id}/review-follow-up`, submitted.current); onSaved();
    } catch (failure) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || 'The review result could not be confirmed. Retry the same submitted review.'); } finally { setPending(false); }
  }
  return <Modal open title='Review care follow-up' busy={pending} onClose={onClose}><form onSubmit={save} className='space-y-4'>
    <p>Record the patient&apos;s booking authority and clarified clinician timing. Creating a recommendation schedules staff work. A legacy booking retains its payment and appointment status after review.</p>
    {task.followUpReview === 'legacy' && <Alert variant='warning'>Open the existing booking before reviewing it. Cancel an unwanted active booking through its appointment workflow before recording a new recommendation or decline.</Alert>}
    {error && <Alert variant='error'>{error} Close and reload to change submitted details.</Alert>}
    <fieldset disabled={pending || locked} className='space-y-3'>
      <Select label='Follow-up review decision' value={decision} onChange={event => setDecision(event.target.value)} options={[...(task.followUpReview === 'legacy' ? [{ value: 'confirm_existing', label: 'Patient reviewed the existing booking' }] : []), { value: 'recommendation', label: 'Record clarified recommendation timing' }, { value: 'declined', label: 'Patient declined follow-up' }]} />
      {decision === 'recommendation' && <Input label={`Clarified follow-up date (${timezone})`} type='datetime-local' required value={due} onChange={event => setDue(event.target.value)} />}
      <Textarea label='Administrative review evidence' required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
      <Checkbox checked={verified} onChange={event => setVerified(event.target.checked)} label="I reviewed the patient identity, booking authority and timing or existing booking with the patient." />
    </fieldset><div className='flex justify-end gap-2'><Button variant='outline' disabled={pending} onClick={onClose}>Close</Button><Button type='submit' loading={pending} disabled={pending || !verified || !reason.trim()}>{locked && error ? 'Retry submitted follow-up review' : 'Save follow-up review'}</Button></div>
  </form></Modal>;
}
