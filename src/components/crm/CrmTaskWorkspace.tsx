"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, RotateCw, CheckCheck } from "lucide-react";
import { CrmWorkspaceLayout, CrmFilterPanel } from "./CrmWorkspaceLayout";
import styles from "./CrmWorkspace.module.css";
import { getCrmLocations, CrmBranchScopeError } from '@/lib/crmLocations';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { useLatestRead } from '@/hooks/useLatestRead';
import { useCrmDefaultHours } from '@/hooks/useCrmDefaultHours';
import { locationLocalDateTimeInput, locationLocalTimeToIso } from '@/lib/locationTime';
import type { CrmLocation, InquiryActivity } from '@/types/crm';
import { Alert, Badge, Button, EmptyState, Input, Modal, Select, Textarea, Checkbox, DatePicker } from '@/components/ui';
import { InquiryConversion, type ConversionCommand } from './InquiryConversion';
import { authScopeKey } from '@/lib/authScope';
import { CareFollowUpReview } from './CareFollowUpReview';
interface Task { id: string; title: string; kind: string; status: string; priority: string; locationId: string; assignedTo: string | null; assigneeName: string; patientId?: string; inquiryId?: string; appointmentId?: string; orderId?: string; resultAppointmentId?: string; dueDate?: string; snoozedUntil?: string; outcome?: string; revision: number; needsAssignment?: boolean; followUpReview?: 'ambiguous' | 'legacy' }
function message(error: unknown) { if (error instanceof CrmBranchScopeError) return error.message; return (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'The task result could not be confirmed. Retry the submitted request or reload before editing.'; }
function zone(locations: CrmLocation[], id: string) { const branch = locations.find(row => row.id === id); return branch?.effectiveTimezone || branch?.timezone || 'Asia/Kolkata'; }
export function CrmTaskWorkspace() {
  const user = useAuthStore(state => state.user);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM')) return <Alert variant='error'>An authorized staff CRM workspace is required.</Alert>;
  return <Workspace key={authScopeKey(user)} />;
}
function Workspace() {
  const user = useAuthStore(state => state.user)!;
  const [filters, setFilters] = useState({ owner: 'mine', status: 'active', due: 'all', locationId: '' });
  const [items, setItems] = useState<Task[]>([]), [locations, setLocations] = useState<CrmLocation[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [creating, setCreating] = useState(false), [selected, setSelected] = useState<string | null>(null);
  const [conversion, setConversion] = useState<{ source: Task; command?: ConversionCommand; open: boolean } | null>(null);
  const beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const request = beginRead(); setLoading(true); setError('');
    try { const [tasks, branches] = await Promise.all([api.get('/crm/tasks', { params: { ...filters, ...(next ? { cursor: next } : {}) }, signal: request.signal }), getCrmLocations(request.signal)]);
      if (!request.isCurrent()) return;
      setItems(current => next ? [...new Map([...current, ...tasks.data.data.items].map((row: Task) => [row.id, row])).values()] : tasks.data.data.items); setLocations(branches); setCursor(tasks.data.data.nextCursor);
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); } finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, filters]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('taskId'); if (id && /^[a-fA-F0-9]{24}$/.test(id)) setSelected(id); }, []);
  const canManage = hasAnyPermission(user, 'MANAGE_CRM_TASKS');
  const activeFilters = Number(filters.owner !== 'mine') + Number(filters.status !== 'active') + Number(filters.due !== 'all') + Number(!!filters.locationId);
  return <CrmWorkspaceLayout active="tasks" title="Daily patient tasks" description="Review the next action, record an outcome and plan the next step." action={canManage && <Button aria-label="Create patient task" disabled={loading || !!error || !locations.length} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /><span className={styles.shortActionLabel}>Create</span><span className={styles.fullActionLabel}>Create patient task</span></Button>}>
    <section aria-label="Patient task queue" className={styles.panel}>
      <CrmFilterPanel activeCount={activeFilters} search={<p className="text-sm font-medium">Task filters</p>} actions={<Button variant="outline" className={styles.iconAction} aria-label="Reload tasks" title="Reload tasks" loading={loading} onClick={() => load()}><RotateCw className="h-4 w-4" /></Button>}>
        <Select label='Task ownership' value={filters.owner} onChange={event => setFilters({ ...filters, owner: event.target.value })} options={[{ value: 'mine', label: 'My tasks' }, { value: 'team', label: 'Team tasks' }, { value: 'unassigned', label: 'Unassigned tasks' }]} />
        <Select label='Task progress' value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} options={[{ value: 'active', label: 'Unfinished tasks' }, { value: 'completed', label: 'Completed tasks' }, { value: 'all', label: 'All tasks' }]} />
        <Select label='Task due filter' value={filters.due} onChange={event => setFilters({ ...filters, due: event.target.value })} options={[{ value: 'all', label: 'All due times' }, { value: 'due', label: 'Due or overdue' }, { value: 'snoozed', label: 'Snoozed tasks' }]} />
        <Select label='Task branch filter' value={filters.locationId} onChange={event => setFilters({ ...filters, locationId: event.target.value })} options={[{ value: '', label: 'All authorized branches' }, ...locations.map(row => ({ value: row.id, label: row.name }))]} />
      </CrmFilterPanel>
      <div className={styles.queueContent}>
        <div className={styles.queueHeading}><h2>Task queue</h2>{!error && !loading && <span>{items.length} loaded{cursor ? " / More available" : ""}</span>}</div>
        {error && <Alert variant='error'>{error}</Alert>}{loading && <p role='status' className="py-4 text-sm text-text-secondary">Loading scoped tasks...</p>}
        {!loading && !error && !items.length && <EmptyState icon={<CheckCheck />} title="No tasks match these filters." description="Adjust the owner, progress, due time or branch to find other tasks." />}
        {!error && <ul className={styles.recordList}>{items.map(task => <li key={task.id} className={styles.record}><div className={styles.recordBody}>
          <div className={styles.recordTitle}><h3>{task.title}</h3><Badge variant={task.status === "completed" ? "success" : "neutral"}>{task.status.replaceAll('_', ' ')}</Badge></div>
          <p className={styles.recordContact}>{task.assigneeName || (task.assignedTo ? 'Assigned staff member' : 'Unassigned')}</p><p className={styles.recordMeta}>{locations.find(row => row.id === task.locationId)?.name || 'Authorized branch'}</p>
          <p className={styles.recordMeta}>{task.dueDate ? new Date(task.dueDate).toLocaleString(undefined, { timeZone: zone(locations, task.locationId) }) : 'No due time'} ({zone(locations, task.locationId)}){task.snoozedUntil && ' / Snoozed'}</p>{task.outcome && <p className={styles.recordMeta}>Last outcome: {task.outcome.replaceAll('_', ' ')}</p>}
        </div><Button variant='outline' disabled={loading} onClick={() => setSelected(task.id)}>Open task</Button></li>)}</ul>}
        {cursor && !error && <div className={styles.recordFooter}><span>More tasks are available.</span><Button variant='outline' disabled={loading} onClick={() => load(cursor)}>More tasks</Button></div>}
      </div>
    </section>{creating && <TaskCapture locations={locations} onClose={() => setCreating(false)} onSaved={id => { setCreating(false); setSelected(id); void load(); }} />}
    {conversion?.command && !conversion.open && !selected && <Button onClick={() => setConversion({ ...conversion, open: true })}>Resume submitted booking</Button>}
    {selected && !conversion?.open && <TaskDetail key={selected} id={selected} locations={locations} onClose={() => setSelected(null)} onChanged={() => load()}
      resumeBooking={!!conversion?.command} onBook={source => setConversion(current => current?.command ? { ...current, open: true } : { source, open: true })} />}
    {conversion?.open && <InquiryConversion task={conversion.source} timezone={zone(locations, conversion.source.locationId)} initialCommand={conversion.command}
      onSubmitted={command => setConversion(current => current && { ...current, command: command || undefined })}
      onClose={() => setConversion(current => current?.command ? { ...current, open: false } : null)}
      onConverted={() => { setConversion(null); void load(); }} />}
  </CrmWorkspaceLayout>;
}
function TaskDetail({ id, locations, resumeBooking, onBook, onClose, onChanged }: { id: string; locations: CrmLocation[]; resumeBooking: boolean; onBook: (source: Task) => void; onClose: () => void; onChanged: () => void }) {
  const user = useAuthStore(state => state.user)!;
  const [task, setTask] = useState<Task | null>(null), [activities, setActivities] = useState<InquiryActivity[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [action, setAction] = useState<string | null>(null);
  const beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => { const request = beginRead(); setLoading(true); setError('');
    try { const response = await api.get(`/crm/tasks/${id}`, { params: next ? { activityCursor: next } : {}, signal: request.signal }); if (!request.isCurrent()) return;
      setTask(response.data.data); setActivities(current => next ? [...current, ...response.data.data.activities] : response.data.data.activities); setCursor(response.data.data.nextActivityCursor);
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); } finally { if (request.isCurrent()) setLoading(false); }
  }, [id, beginRead]);
  useEffect(() => { void load(); }, [load]);
  const manage = hasAnyPermission(user, 'MANAGE_CRM_TASKS'), assign = hasAnyPermission(user, 'ASSIGN_CRM_TASKS'), owns = task?.assignedTo === user.id;
  if (action === 'review-follow-up' && task) return <CareFollowUpReview task={task} timezone={zone(locations, task.locationId)} onClose={() => setAction(null)} onSaved={() => { setAction(null); void load(); onChanged(); }} />;
  if (action && task) return <TaskCommand task={task} action={action} locations={locations} onClose={() => setAction(null)} onSaved={() => { setAction(null); void load(); onChanged(); }} />;
  return <Modal open title='Patient relationship task' onClose={onClose}><div className='space-y-4'>{error && <Alert variant='error'>{error}</Alert>}<Button variant='outline' loading={loading} onClick={() => load()}>Reload task details</Button>
    {resumeBooking && task && <Button onClick={() => onBook(task)}>Resume submitted booking</Button>}
    {task && !error && <><h2 className='font-semibold'>{task.title}</h2><p>Status: {task.status.replaceAll('_', ' ')}. Owner: {task.assigneeName || (task.assignedTo ? 'Assigned staff member' : 'Unassigned')}.</p>{task.outcome && <p>Last recorded outcome: {task.outcome.replaceAll('_', ' ')}</p>}
      <div className='flex flex-wrap gap-2'>{manage && (owns || assign) && task.status !== 'completed' && <><Button disabled={loading} onClick={() => setAction('start')}>Start task</Button>{!task.followUpReview && <Button variant='outline' disabled={loading} onClick={() => setAction('complete')}>Record task outcome</Button>}<Button variant='outline' disabled={loading} onClick={() => setAction('snooze')}>Snooze task</Button></>}
        {manage && (owns || assign) && task.patientId && task.kind !== 'crm_inquiry' && task.status !== 'completed' && hasAnyPermission(user, 'MANAGE_APPOINTMENTS') && (task.followUpReview ? <Button disabled={loading} onClick={() => setAction('review-follow-up')}>Review care follow-up</Button> : <Button disabled={loading} onClick={() => onBook(task)}>Arrange task booking</Button>)}
        {task.resultAppointmentId && <Link href={`/dashboard/appointments?appointmentId=${task.resultAppointmentId}`} className='text-accent underline'>Open arranged booking</Link>}
        {task.kind === 'crm_feedback' && task.appointmentId && <Link href={`/dashboard/feedback?appointmentId=${task.appointmentId}`} className='text-accent underline'>Review visit feedback</Link>}
        {task.kind === 'crm_diagnostic' && task.orderId && hasAnyPermission(user, 'MANAGE_ORDERS', 'VIEW_EHR') && <Link href={`/dashboard/laboratory?orderId=${task.orderId}`} className='text-accent underline'>Open canonical diagnostic order</Link>}
        {task.kind === 'crm_diagnostic' && <p className='text-sm text-text-muted'>Coordinate with clinical staff. Clinical results and escalation are reviewed in the laboratory workflow.</p>}
        {manage && (assign || !task.assignedTo) && <Button variant='outline' disabled={loading} onClick={() => setAction('assign')}>{assign ? 'Assign task' : 'Claim task'}</Button>}
        {manage && (owns || assign) && task.status === 'completed' && task.kind !== 'crm_inquiry' && <Button variant='outline' disabled={loading} onClick={() => setAction('reopen')}>Reopen task</Button>}
        {task.inquiryId && <Link href={`/dashboard/crm?inquiryId=${task.inquiryId}`} className='text-accent underline'>Open inquiry</Link>}{task.patientId && hasAnyPermission(user, 'VIEW_PATIENTS') && <Link href={`/dashboard/patients/${task.patientId}`} className='text-accent underline'>Open canonical patient</Link>}{task.appointmentId && hasAnyPermission(user, 'VIEW_APPOINTMENTS') && <Link href={`/dashboard/appointments?appointmentId=${task.appointmentId}`} className='text-accent underline'>Open booking</Link>}
      </div><h3 className='font-medium'>Task activity</h3>{activities.map(row => <div key={row.id} className='border border-border rounded-lg p-3'><p>{row.kind.replaceAll('_', ' ')} · {row.actorName}</p>{row.outcome && <p>{row.outcome.replaceAll('_', ' ')}</p>}{row.note && <p className='whitespace-pre-wrap break-words'>{row.note}</p>}</div>)}{cursor && <Button variant='outline' disabled={loading} onClick={() => load(cursor)}>More task activity</Button>}
    </>}
  </div></Modal>;
}
function TaskCommand({ task, action, locations, onClose, onSaved }: { task: Task; action: string; locations: CrmLocation[]; onClose: () => void; onSaved: () => void }) {
  const user = useAuthStore(state => state.user)!;
  const timezone = zone(locations, task.locationId), manager = hasAnyPermission(user, 'ASSIGN_CRM_TASKS');
  const [reason, setReason] = useState(''), [outcome, setOutcome] = useState('contacted'), [closeInquiry, setCloseInquiry] = useState(false), [closeReason, setCloseReason] = useState('resolved'), [nextAction, setNextAction] = useState('contact');
  const [due, setDue] = useState(() => locationLocalDateTimeInput(new Date(Date.now() + 86400000), timezone)), [owner, setOwner] = useState(manager ? task.assignedTo || '' : user.id);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(action === 'assign' && manager);
  const [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState(''), [clientRequestId] = useState(() => crypto.randomUUID());
  const submitted = useRef<Record<string, unknown> | null>(null), beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => { if (action !== 'assign' || !manager) return; const request = beginRead(); setLoading(true); setError('');
    try { const response = await api.get('/crm/assignees', { params: { locationId: task.locationId, purpose: 'task', ...(next ? { cursor: next } : {}) }, signal: request.signal }); if (request.isCurrent()) { setAssignees(current => next ? [...current, ...response.data.data.items] : response.data.data.items); setCursor(response.data.data.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setError(message(failure)); } finally { if (request.isCurrent()) setLoading(false); }
  }, [action, manager, beginRead, task.locationId]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent) { event.preventDefault(); if (pending) return; setPending(true); setError('');
    try {
      if (!submitted.current) {
        const nextDue = ['snooze', 'reopen'].includes(action) || (action === 'complete' && task.inquiryId && !closeInquiry) ? locationLocalTimeToIso(due.split('T')[0], due.split('T')[1], timezone) : undefined;
        submitted.current = { clientRequestId, expectedRevision: task.revision, action, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(action === 'assign' ? { assignedTo: owner || null } : {}), ...(action === 'snooze' ? { snoozedUntil: nextDue } : {}), ...(action === 'reopen' ? { dueDate: nextDue } : {}),
          ...(action === 'complete' ? { outcome, ...(task.inquiryId ? closeInquiry ? { closeInquiry: true, closeReason } : { nextAction: { kind: nextAction, dueAt: nextDue } } : {}) } : {}) };
        setLocked(true);
      }
      await api.patch(`/crm/tasks/${task.id}`, submitted.current); onSaved();
    } catch (failure) { setError(message(failure)); } finally { setPending(false); }
  }
  const hasDue = ['snooze', 'reopen'].includes(action) || (action === 'complete' && task.inquiryId && !closeInquiry);
  return <Modal open title='Update patient task' busy={pending} onClose={onClose}><form onSubmit={save} className='space-y-4'>{error && <Alert variant='error'>{error} Close and reload to change submitted details.</Alert>}
    <p className='text-sm text-text-muted'>Record administrative outcomes only. Keep clinical advice in the encounter.</p><fieldset disabled={locked || pending} className='space-y-3'>
      {action === 'assign' && manager && <><Select label='Task assignee' value={owner} disabled={loading} onChange={event => setOwner(event.target.value)} options={[{ value: '', label: 'Unassigned' }, ...(owner && !assignees.some(row => row.id === owner) ? [{ value: owner, label: task.assigneeName || 'Current owner' }] : []), ...assignees.map(row => ({ value: row.id, label: row.name }))]} />{cursor && <Button variant='outline' disabled={loading} onClick={() => load(cursor)}>More task assignees</Button>}<Button variant='outline' loading={loading} onClick={() => load()}>Reload task assignees</Button></>}
      {action === 'complete' && <><Select label='Task outcome' value={outcome} onChange={event => setOutcome(event.target.value)} options={['contacted', 'unreachable', 'invalid_contact', 'no_response', 'declined', 'resolved', 'other'].map(value => ({ value, label: value.replaceAll('_', ' ') }))} />
        {task.inquiryId && <>{hasAnyPermission(user, 'MANAGE_CRM_INQUIRIES') && <Checkbox checked={closeInquiry} onChange={event => setCloseInquiry(event.target.checked)} label="Close the linked inquiry after this outcome" />}
          {closeInquiry ? <Select label='Linked inquiry close outcome' value={closeReason} onChange={event => setCloseReason(event.target.value)} options={['resolved', 'not_proceeding', 'unreachable', 'other'].map(value => ({ value, label: value.replaceAll('_', ' ') }))} /> : <Select label='Next inquiry action' value={nextAction} onChange={event => setNextAction(event.target.value)} options={[{ value: 'contact', label: 'Contact caller again' }, { value: 'review', label: 'Review inquiry' }, { value: 'book', label: 'Arrange booking' }]} />}</>}
      </>}{hasDue && <DatePicker label={`Next task time (${timezone})`} mode="datetime" required value={due} onChange={value => setDue(value)} />}
      <Textarea label='Administrative outcome or reason' required={['assign', 'snooze', 'reopen'].includes(action) || outcome === 'other' || (closeInquiry && closeReason === 'other')} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
    </fieldset><div className={styles.formActions}><Button variant='outline' disabled={pending} onClick={onClose}>Close</Button><Button type='submit' loading={pending} disabled={pending || loading}>{locked && error ? 'Retry submitted task update' : 'Save task update'}</Button></div></form></Modal>;
}
function TaskCapture({ locations, onClose, onSaved }: { locations: CrmLocation[]; onClose: () => void; onSaved: (id: string) => void }) {
  const user = useAuthStore(state => state.user)!;
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0].id : ''), [patientId, setPatientId] = useState(''), [kind, setKind] = useState('crm_callback'), [note, setNote] = useState('');
  const timezone = zone(locations, locationId), [due, setDue] = useState(() => locationLocalDateTimeInput(new Date(Date.now() + 86400000), timezone));
  const defaultHours = useCrmDefaultHours('task'), dueEdited = useRef(false);
  const [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState(''), [clientRequestId] = useState(() => crypto.randomUUID()), submitted = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (defaultHours.hours !== null && !dueEdited.current && !locked) setDue(locationLocalDateTimeInput(new Date(Date.now() + defaultHours.hours * 3600000), timezone));
  }, [defaultHours.hours, locked, timezone]);
  function changeBranch(id: string) {
    try { const [date, time] = due.split('T'); setDue(locationLocalDateTimeInput(new Date(locationLocalTimeToIso(date, time, timezone)), zone(locations, id))); }
    catch { setDue(''); }
    setLocationId(id);
  }
  async function save(event: React.FormEvent) { event.preventDefault(); if (pending) return; setPending(true); setError('');
    try { submitted.current ??= { clientRequestId, locationId, kind, ...(user.role === 'root' ? { assignedTo: null } : {}), dueDate: locationLocalTimeToIso(due.split('T')[0], due.split('T')[1], timezone), ...(patientId.trim() ? { patientId: patientId.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) }; setLocked(true);
      const response = await api.post('/crm/tasks', submitted.current); onSaved(response.data.data.id);
    } catch (failure) { setError(message(failure)); } finally { setPending(false); }
  }
  return <Modal open title='Create patient relationship task' busy={pending} onClose={onClose}><form onSubmit={save} className='space-y-4'>{error && <Alert variant='error'>{error} Close and reload to change submitted details.</Alert>}<p className='text-sm text-text-muted'>{user.role === 'root' ? 'Assign this task to eligible organization staff after creation.' : 'The task is assigned to you.'} Record administrative details only; clinical instructions belong in the encounter.</p><fieldset disabled={locked || pending} className='space-y-3'>
    <Select label='New task branch' value={locationId} onChange={event => changeBranch(event.target.value)} options={locations.map(row => ({ value: row.id, label: row.name }))} /><Select label='New task kind' value={kind} onChange={event => setKind(event.target.value)} options={[{ value: 'crm_callback', label: 'Patient callback' }, { value: 'crm_review', label: 'Administrative review' }]} /><Input label='Existing patient reference (optional)' maxLength={24} value={patientId} onChange={event => setPatientId(event.target.value)} />
    {defaultHours.error && <Alert variant='warning'>{defaultHours.error}</Alert>}
    <DatePicker label={`Task due (${timezone})`} mode="datetime" required value={due} onChange={value => { dueEdited.current = true; setDue(value); }} /><Textarea label='Administrative task instruction' maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
    </fieldset><div className={styles.formActions}><Button variant='outline' disabled={pending} onClick={onClose}>Close</Button><Button type='submit' loading={pending} disabled={pending || !locationId}>{locked && error ? 'Retry submitted patient task' : 'Create task'}</Button></div></form></Modal>;
}
