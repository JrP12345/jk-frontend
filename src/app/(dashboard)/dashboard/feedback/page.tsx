"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { hasAnyPermission } from '@/lib/permissions';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Card, CardContent, Input, Modal, Select, Textarea } from '@/components/ui';

interface FeedbackItem { id: string; appointmentId: string; rating: number; npsScore: number; source: string; comments?: string; createdAt: string }
interface Visit { id: string; appointmentTime: string; locationId: string }
interface Stats { totalResponses: number; averageCsatRating: number | null; netPromoterScore: number | null; sources: { source: string; total: number; averageRating: number; nps: number }[]; definition: string }
interface Command { clientRequestId: string; appointmentId: string; rating: number; npsScore: number; comments: string; aspectRatings: { waitTime: number; doctorAttitude: number; cleanliness: number } }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'The result could not be confirmed. Retry the submitted request.'; }

export default function Feedback() {
  const user = useAuthStore(state => state.user), { activeLocationId } = useLocationStore();
  const patient = user?.role === 'patient';
  if (!user || ['guest', 'family_member'].includes(user.role) || (!patient && (!user.organization_id || !hasAnyPermission(user, 'VIEW_CRM') || !hasAnyPermission(user, 'MANAGE_CRM_TASKS', 'VIEW_CRM_ANALYTICS', 'VIEW_ANALYTICS')))) return <Alert variant='error'>An authorized patient or staff feedback workspace is required.</Alert>;
  return <FeedbackWorkspace key={`${user.id}:${user.organization_id || 'self'}:${user.role}:${[...(user.permissions || [])].sort().join(',')}:${activeLocationId || 'all'}`} patient={patient} locationId={activeLocationId || ''} />;
}
function FeedbackWorkspace({ patient, locationId }: { patient: boolean; locationId: string }) {
  const user = useAuthStore(state => state.user)!;
  const canRecord = patient || hasAnyPermission(user, 'MANAGE_CRM_TASKS'), canReport = !patient && hasAnyPermission(user, 'VIEW_CRM_ANALYTICS', 'VIEW_ANALYTICS');
  const [stats, setStats] = useState<Stats | null>(null), [items, setItems] = useState<FeedbackItem[]>([]), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<FeedbackItem | null>(null), [detailError, setDetailError] = useState(''), [detailId, setDetailId] = useState(''), [detailLoading, setDetailLoading] = useState(false);
  const beginRead = useLatestRead(), beginDetail = useLatestRead(), beginVisits = useLatestRead();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError(''); setStats(null); setItems([]);
    if (!canReport && !patient) { setLoading(false); return; }
    try {
      const params = { ...(locationId ? { locationId } : {}), page, limit: 20 };
      if (patient) {
        const own = await api.get('/feedback/mine', { params: { page, limit: 20 }, signal: request.signal });
        if (request.isCurrent()) { setItems(own.data.data); setHasMore(Number(own.headers?.['x-total-pages'] || 1) > page); }
        return;
      }
      const [report, list] = await Promise.all([api.get('/feedback/stats', { params, signal: request.signal }), api.get('/feedback', { params, signal: request.signal })]);
      if (!request.isCurrent()) return;
      setStats(report.data.data); setItems(list.data.data); setHasMore(Number(list.headers?.['x-total-pages'] || 1) > page);
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, canReport, locationId, page, patient]);
  useEffect(() => { void load(); }, [load]);
  const readDetail = useCallback(async (id: string) => {
    const request = beginDetail(); setDetailId(id); setDetail(null); setDetailError(''); setDetailLoading(true);
    try { const response = await api.get(`/feedback/visit/${id}`, { signal: request.signal }); if (request.isCurrent()) setDetail(response.data.data); }
    catch (failure) { if (request.isCurrent()) setDetailError(message(failure)); }
    finally { if (request.isCurrent()) setDetailLoading(false); }
  }, [beginDetail]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('appointmentId'); if (id && /^[a-fA-F0-9]{24}$/.test(id)) void readDetail(id); }, [readDetail]);
  const [open, setOpen] = useState(false), [visits, setVisits] = useState<Visit[]>([]), [cursor, setCursor] = useState<string | null>(null), [visitsLoading, setVisitsLoading] = useState(false), [visitsError, setVisitsError] = useState('');
  const [form, setForm] = useState({ appointmentId: '', rating: 5, npsScore: 10, comments: '', waitTime: 5, doctorAttitude: 5, cleanliness: 5 });
  const [command, setCommand] = useState<Command | null>(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState('');
  const errorSummary = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (open && saveError && !saving) { errorSummary.current?.focus(); errorSummary.current?.scrollIntoView({ block: 'nearest' }); } }, [open, saveError, saving]);
  const loadVisits = useCallback(async (nextCursor?: string) => {
    const request = beginVisits(); setVisitsLoading(true); setVisitsError('');
    try {
      const response = await api.get('/feedback/eligible-visits', { params: { ...(locationId ? { locationId } : {}), ...(nextCursor ? { cursor: nextCursor } : {}) }, signal: request.signal });
      if (!request.isCurrent()) return;
      const data = response.data.data; setVisits(old => nextCursor ? [...old, ...data.items] : data.items); setCursor(data.nextCursor);
      if (!nextCursor) setForm(old => ({ ...old, appointmentId: data.items[0]?.id || '' }));
    } catch (failure) { if (request.isCurrent()) setVisitsError(message(failure)); }
    finally { if (request.isCurrent()) setVisitsLoading(false); }
  }, [beginVisits, locationId]);
  const start = () => { setOpen(true); if (command) return; setSaveError(''); setVisits([]); setForm({ appointmentId: '', rating: 5, npsScore: 10, comments: '', waitTime: 5, doctorAttitude: 5, cleanliness: 5 }); void loadVisits(); };
  const save = async () => {
    if (saving || (!command && !form.appointmentId)) return;
    const payload = command || { clientRequestId: crypto.randomUUID(), appointmentId: form.appointmentId, rating: form.rating, npsScore: form.npsScore, comments: form.comments.trim(), aspectRatings: { waitTime: form.waitTime, doctorAttitude: form.doctorAttitude, cleanliness: form.cleanliness } };
    setCommand(payload); setSaving(true); setSaveError('');
    try {
      await api.post('/feedback', payload);
      if (!mounted.current) return;
      setOpen(false); setCommand(null); setNotice(patient ? 'Your feedback was recorded.' : 'Staff-reported feedback was recorded.'); void load();
    } catch (failure) { if (mounted.current) { setSaveError(message(failure)); const status = (failure as { response?: { status?: number } }).response?.status; if (status && [400, 403, 404, 422].includes(status)) setCommand(null); } }
    finally { if (mounted.current) setSaving(false); }
  };
  return <div className='space-y-5'>
    <div className='flex flex-wrap items-center justify-between gap-3'><div><h1 className='text-2xl font-semibold'>Visit feedback</h1><p className='text-sm text-text-muted'>{patient ? 'Share feedback about your completed visits.' : 'Review recorded surveys and service recovery in your authorized branches.'}</p></div>{canRecord && <Button onClick={start}>{command ? 'Resume submitted feedback' : patient ? 'Share visit feedback' : 'Record reported feedback'}</Button>}</div>
    {!patient && <Link href='/dashboard/crm/tasks?kind=crm_feedback' className='text-accent underline'>Open feedback recovery tasks</Link>}
    {notice && <p role='status'>{notice}</p>}{loading && <p role='status'>Loading feedback…</p>}{error && <Alert variant='error'>{error}<Button onClick={() => void load()}>Retry feedback load</Button></Alert>}
    {stats && <Card><CardContent><p>{stats.totalResponses} recorded responses · Average rating: {stats.averageCsatRating === null ? 'Unavailable' : `${stats.averageCsatRating}/5`} · NPS: {stats.netPromoterScore === null ? 'Unavailable' : stats.netPromoterScore}</p><p className='mt-2 text-sm'>{stats.definition}</p>{stats.sources.map(source => <p key={source.source} className='mt-2 text-sm'>{source.source.replaceAll('_', ' ')}: {source.total} responses · {source.averageRating}/5 · NPS {source.nps}</p>)}</CardContent></Card>}
    {!loading && !error && (canReport || patient) && <>
      {!items.length && <p>No feedback on this page.</p>}{items.map(item => <Card key={item.id}><CardContent><p className='break-all'>Visit {item.appointmentId}</p><p className='my-2 text-sm'>{item.source.replaceAll('_', ' ')} · Rating {item.rating}/5 · NPS {item.npsScore} · {new Date(item.createdAt).toLocaleString()}</p><Button onClick={() => void readDetail(item.appointmentId)}>Review feedback</Button></CardContent></Card>)}<div className='flex gap-3'><Button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous feedback page</Button><Button disabled={!hasMore || loading} onClick={() => setPage(page + 1)}>Next feedback page</Button></div></>}
    {detailId && <Card><CardContent><h2 className='text-lg font-semibold'>Selected visit feedback</h2>{detailLoading && <p role='status'>Loading selected feedback…</p>}{detailError && <Alert variant='error'>{detailError}<Button onClick={() => void readDetail(detailId)}>Retry selected feedback</Button></Alert>}{detail && <><p>{detail.source.replaceAll('_', ' ')} · Rating {detail.rating}/5 · NPS {detail.npsScore}</p><p className='mt-3 whitespace-pre-wrap break-words'>{detail.comments || 'No comments were provided.'}</p><p className='mt-3 text-sm'>Use the existing recovery task to record review and its outcome. Any contact requires current recipient and purpose authorization.</p></>}</CardContent></Card>}
    <Modal open={open} onClose={() => { if (!saving) setOpen(false); }} title={patient ? 'Share visit feedback' : 'Record reported feedback'} busy={saving} footer={<><Button variant='secondary' disabled={saving} onClick={() => setOpen(false)}>{command && !saving ? 'Close and keep request' : 'Cancel'}</Button><Button type='submit' form='visit-feedback' loading={saving} disabled={!command && (!form.appointmentId || visitsLoading)}>{command ? 'Retry submitted feedback' : 'Save feedback'}</Button></>}>
      <form id='visit-feedback' className='space-y-4' onSubmit={event => { event.preventDefault(); void save(); }}>
        <p className='text-sm'>{patient ? 'This survey is recorded as your own submission.' : 'This is recorded as a staff report, with you as the recorder. Do not describe it as a patient account submission.'} Low ratings create a staff review task; sending a message requires a separate authorized action.</p>
        {saveError && <div ref={errorSummary} tabIndex={-1}><Alert variant='error'>{saveError} {command ? 'The submitted details are locked so a retry cannot create a different survey. Closing keeps this request available to resume.' : 'The request was rejected. Check the visit and ratings before submitting again.'}</Alert></div>}
        {visitsError && <Alert variant='error'>{visitsError}<Button type='button' disabled={!!command} onClick={() => void loadVisits()}>Retry visit load</Button></Alert>}
        {visitsLoading && <p role='status'>Loading completed visits…</p>}
        <fieldset disabled={saving || !!command} className='min-w-0 space-y-3'>
          <Select label='Select completed visit' value={form.appointmentId} onChange={event => setForm({ ...form, appointmentId: event.target.value })} required options={[{ value: '', label: 'Choose a completed visit' }, ...visits.map(visit => ({ value: visit.id, label: `${visit.id} · ${new Date(visit.appointmentTime).toLocaleString()}` }))]} />
          {!visitsLoading && !visits.length && !visitsError && <p>No completed visits without feedback are available in this scope.</p>}
          {cursor && <Button type='button' disabled={visitsLoading} onClick={() => void loadVisits(cursor)}>Load more completed visits</Button>}
          <div className='grid gap-3 sm:grid-cols-2'><Input label='Overall rating' type='number' min={1} max={5} step={1} required value={form.rating} onChange={event => setForm({ ...form, rating: Number(event.target.value) })} /><Input label='Net Promoter Score' type='number' min={0} max={10} step={1} required value={form.npsScore} onChange={event => setForm({ ...form, npsScore: Number(event.target.value) })} /></div>
          <div className='grid gap-3 sm:grid-cols-3'>{(['waitTime', 'doctorAttitude', 'cleanliness'] as const).map(key => <Input key={key} label={key === 'waitTime' ? 'Wait time rating' : key === 'doctorAttitude' ? 'Doctor attitude rating' : 'Cleanliness rating'} type='number' min={1} max={5} step={1} required value={form[key]} onChange={event => setForm({ ...form, [key]: Number(event.target.value) })} />)}</div>
          <Textarea label='Feedback comments' maxLength={2000} rows={4} value={form.comments} onChange={event => setForm({ ...form, comments: event.target.value })} />
        </fieldset>
      </form>
    </Modal>
  </div>;
}
