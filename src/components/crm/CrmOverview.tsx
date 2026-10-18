"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCw } from "lucide-react";
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { CrmWorkspaceLayout, CrmFilterPanel } from "./CrmWorkspaceLayout";
import styles from "./CrmWorkspace.module.css";
import { Alert, Button, Card, CardContent, DatePicker, Select, Table } from '@/components/ui';

interface Report {
  asOf: string; startDate: string; endDate: string;
  branches: { locationId: string; name: string; timezone: string }[];
  inquiries: { total: number; converted: number; unreconciled: number; active: number; closed: number; conversionPercent: number | null; responseCount: number; averageFirstReportedCallMinutes: number | null; sources: { source: string; evidence: string; total: number; converted: number }[] };
  tasks: { total: number; overdue: number; unassigned: number; snoozed: number; kinds: { kind: string; assigned: boolean; total: number; overdue: number }[]; workload: { staffId: string; name: string; total: number }[]; workloadCapped: boolean };
  appointments: { total: number; states: Record<string, number>; resolvedAttendance: number; noShowPercent: number | null; returningCompletedVisits: number; completedVisits: number };
  communications: { states: { channel: string; status: string; total: number }[]; costExplanation: string };
  definitions: Record<string, string>;
}
export function CrmOverview() {
  const user = useAuthStore(state => state.user);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM') || !hasAnyPermission(user, 'VIEW_CRM_ANALYTICS')) return <Alert variant='error'>An authorized staff analytics workspace is required.</Alert>;
  return <Overview key={authScopeKey(user)} />;
}
function Overview() {
  const [report, setReport] = useState<Report | null>(null), [branches, setBranches] = useState<Report['branches']>([]);
  const [filters, setFilters] = useState({ locationId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError(''); setReport(null);
    try {
      const response = await api.get('/crm/analytics', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), signal: request.signal });
      if (!request.isCurrent()) return;
      const data: Report = response.data.data; setReport(data);
      if (!filters.locationId) setBranches(data.branches);
    } catch (failure) { if (request.isCurrent()) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || 'The operational report could not be loaded. Retry the same filters.'); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, filters]);
  useEffect(() => { void load(); }, [load]);
  return <CrmWorkspaceLayout active="overview" title="Patient relationship overview" description="Operational counts for your authorized branches.">
    <section aria-label="Report filters" className={styles.panel}><form onSubmit={event => { event.preventDefault(); void load(); }}>
      <CrmFilterPanel activeCount={Number(!!filters.locationId) + Number(!!filters.startDate) + Number(!!filters.endDate)} search={<p className="text-sm font-medium">Report filters</p>} actions={<Button type="submit" variant="outline" className={styles.iconAction} aria-label="Reload report" title="Reload report" loading={loading}><RotateCw className="h-4 w-4" /></Button>}>
      <Select label='Report branch' value={filters.locationId} onChange={event => setFilters({ ...filters, locationId: event.target.value })} options={[{ value: '', label: 'All authorized branches' }, ...branches.map(branch => ({ value: branch.locationId, label: branch.name }))]} />
      <DatePicker label='Report start date' value={filters.startDate} onChange={startDate => setFilters({ ...filters, startDate })} />
      <DatePicker label='Report end date' value={filters.endDate} onChange={endDate => setFilters({ ...filters, endDate })} />
      </CrmFilterPanel>
    </form><p className='px-4 py-3 text-xs text-text-secondary'>Up to 31 inclusive calendar days, using each branch’s timezone. Empty dates use the latest 30 days.</p></section>
    {loading && <p role='status'>Loading scoped operational report…</p>}{error && <Alert variant='error'>{error}</Alert>}
    {report && <>
      <p className='text-sm'>{report.startDate} through {report.endDate}. Current state as of {new Date(report.asOf).toLocaleString()}.</p>
      {report.branches.length === 0 && <Alert variant='warning'>There are no active authorized branches in this report.</Alert>}
      <div className={styles.metricGrid}>
        <Metric title='Captured inquiries' value={report.inquiries.total} detail={`${report.inquiries.converted} recorded bookings · ${report.inquiries.conversionPercent === null ? 'No conversion denominator' : `${report.inquiries.conversionPercent}% conversion`}`} />
        <Metric title='Unfinished work' value={report.tasks.total} detail={`${report.tasks.overdue} due or overdue · ${report.tasks.unassigned} unassigned · ${report.tasks.snoozed} snoozed`} />
        <Metric title='Scheduled visit records' value={report.appointments.total} detail={`${report.appointments.completedVisits} completed · ${report.appointments.returningCompletedVisits} returning completed visits`} />
        <Metric title='Recorded no-show rate' value={report.appointments.noShowPercent === null ? 'Unavailable' : `${report.appointments.noShowPercent}%`} detail={`${report.appointments.resolvedAttendance} completed or recorded no-show visits`} />
      </div>
      {!!report.inquiries.unreconciled && <Alert variant='warning'>{report.inquiries.unreconciled} converted inquiries need booking-link reconciliation and are excluded from successful conversion.</Alert>}
      <Card><CardContent className="pt-0"><h2 className='text-lg font-semibold'>Staff workload</h2><p className='my-2 text-sm'>Current unfinished tasks in the selected branches, ordered by task count. Counts do not measure staff performance.</p>{!report.tasks.workload.length && <p>No assigned unfinished work.</p>}{report.tasks.workload.map(row => <p key={row.staffId} className='border-t border-border py-2 text-sm'>{row.name}: {row.total}</p>)}{report.tasks.workloadCapped && <p className='mt-2 text-sm'>Showing the first 20 owners. Select a branch or use the daily task queue for the remaining work.</p>}</CardContent></Card>
      <Card><CardContent className="space-y-3 pt-0"><h2 className='text-lg font-semibold'>Inquiry sources</h2><p className='text-sm'>{report.definitions.inquiries} Source labels are unknown or staff-reported.</p>
        {!report.inquiries.sources.length ? <p>No inquiries were captured during this period.</p> : <Table
          caption='Captured inquiry sources and recorded conversions' density='compact' variant='flat' fitContent
          searchable={false} showColumnVisibility={false} pagination={false} mobileCardView={false}
          data={report.inquiries.sources.map(row => ({ ...row, id: `${row.source}:${row.evidence}` }))}
          columns={[
            { header: 'Source', render: row => row.source.replaceAll('_', ' ') },
            { header: 'Evidence', render: row => row.evidence.replaceAll('_', ' ') },
            { header: 'Captured', accessor: 'total' }, { header: 'Booked', accessor: 'converted' },
          ]}
        />}
        <p className='text-sm'>First reported outbound call: {report.inquiries.averageFirstReportedCallMinutes === null ? 'Unavailable' : `${report.inquiries.averageFirstReportedCallMinutes} minutes on average`} ({report.inquiries.responseCount} inquiries with a report). {report.definitions.response}</p>
      </CardContent></Card>
      <div className={styles.reportGrid}><Card><CardContent className="pt-0"><h2 className='text-lg font-semibold'>Current work queue</h2><p className='my-2 text-sm'>{report.definitions.tasks}</p>{!report.tasks.kinds.length && <p>No unfinished tasks.</p>}{report.tasks.kinds.map(row => <p key={`${row.kind}:${row.assigned}`} className='border-t border-border py-2 text-sm'>{row.kind.replace(/^crm_/, '').replaceAll('_', ' ')} · {row.assigned ? 'Assigned' : 'Unassigned'}: {row.total}, due or overdue: {row.overdue}</p>)}<Link className='text-accent underline' href='/dashboard/crm/tasks'>Open daily tasks</Link></CardContent></Card>
        <Card><CardContent className="pt-0"><h2 className='text-lg font-semibold'>Visit states</h2><p className='my-2 text-sm'>{report.definitions.appointments}</p>{!Object.keys(report.appointments.states).length && <p>No visits scheduled in this period.</p>}{Object.entries(report.appointments.states).map(([status, count]) => <p key={status} className='border-t border-border py-2 text-sm'>{status.replaceAll('_', ' ')}: {count}</p>)}<p className='mt-2 text-sm'>{report.definitions.returning}</p></CardContent></Card></div>
      <Card><CardContent className="pt-0"><h2 className='text-lg font-semibold'>Communication states</h2><p className='my-2 text-sm'>{report.definitions.communications}</p>{!report.communications.states.length && <p>No queued patient messages in this period.</p>}{report.communications.states.map(row => <p key={`${row.channel}:${row.status}`} className='border-t border-border py-2 text-sm'>{row.channel} · {row.status}: {row.total}</p>)}<p className='mt-2 text-sm text-text-muted'>{report.communications.costExplanation}</p></CardContent></Card>
      <p className='text-sm text-text-muted'>Branch dates: {report.branches.map(branch => `${branch.name} (${branch.timezone})`).join(', ') || 'None'}.</p>
    </>}
  </CrmWorkspaceLayout>;
}
function Metric({ title, value, detail }: { title: string; value: number | string; detail: string }) { return <Card><CardContent className="pt-0"><h2 className='text-sm font-medium'>{title}</h2><p className='my-2 text-2xl font-semibold'>{value}</p><p className='text-sm text-text-muted'>{detail}</p></CardContent></Card>; }
