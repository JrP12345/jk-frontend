"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from "lucide-react";
import { CrmWorkspaceLayout } from "./CrmWorkspaceLayout";
import styles from "./CrmWorkspace.module.css";
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Card, CardContent, Input, Checkbox } from '@/components/ui';

interface Settings {
  revision: number; automationEnabled: boolean; campaignsEnabled: false;
  defaultInquiryHours: number; defaultTaskHours: number; reminderStartHour: number; reminderEndHour: number; feedbackRecoveryRating: number;
  entitlementActive: boolean; organizationWideAccess: boolean;
}
export function CrmSettings() {
  const user = useAuthStore(state => state.user);
  if (!user?.organization_id || ['patient', 'family_member', 'guest'].includes(user.role) || !hasAnyPermission(user, 'VIEW_CRM') || !hasAnyPermission(user, 'MANAGE_CRM_SETTINGS')) return <Alert variant='error'>An authorized organization settings workspace is required.</Alert>;
  return <SettingsForm key={authScopeKey(user)} />;
}
function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null), [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [locked, setLocked] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const submitted = useRef<Record<string, unknown> | null>(null), beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError(''); setSuccess(''); setSettings(null); setForm(null);
    try {
      const response = await api.get('/crm/settings', { signal: request.signal });
      if (!request.isCurrent()) return; setSettings(response.data.data); setForm(response.data.data); submitted.current = null; setLocked(false);
    } catch (failure) { if (request.isCurrent()) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || 'Workflow settings could not be loaded. Retry.'); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!settings || !form) return;
    if (!locked && form.reminderStartHour >= form.reminderEndHour) { setError('The reminder window must end after it starts.'); return; }
    submitted.current ??= { clientRequestId: crypto.randomUUID(), expectedRevision: settings.revision, automationEnabled: form.automationEnabled,
      defaultInquiryHours: form.defaultInquiryHours, defaultTaskHours: form.defaultTaskHours, reminderStartHour: form.reminderStartHour, reminderEndHour: form.reminderEndHour, feedbackRecoveryRating: form.feedbackRecoveryRating };
    setLocked(true); setPending(true); setError(''); setSuccess('');
    try {
      const response = await api.patch('/crm/settings', submitted.current);
      setSettings(response.data.data); setForm(response.data.data); setLocked(false); submitted.current = null;
      setSuccess('Workflow settings saved. Staff choose and verify each next action; campaigns remain disabled.');
    } catch (failure) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || 'The settings result could not be confirmed. Retry the submitted request or reload.'); }
    finally { setPending(false); }
  }
  const numeric = (field: 'defaultInquiryHours' | 'defaultTaskHours' | 'reminderStartHour' | 'reminderEndHour' | 'feedbackRecoveryRating', value: string) => setForm(current => current ? { ...current, [field]: value === '' ? NaN : Number(value) } : current);
  return <CrmWorkspaceLayout active="settings" title="Patient relationship settings" description="Organization defaults for follow-up work and staff reminders." action={<Button variant="outline" className={styles.iconAction} aria-label="Reload workflow settings" title="Reload workflow settings" disabled={pending} loading={loading} onClick={() => load()}><RotateCw className="h-4 w-4" /></Button>}>
    {error && <Alert variant='error'>{error}</Alert>}{success && <Alert variant='success'>{success}</Alert>}{loading && <p role='status'>Loading workflow settings…</p>}
    {settings && form && <>
      {!settings.organizationWideAccess && <Alert variant='warning'>Organization settings require reviewed access to all branches.</Alert>}
      {!settings.entitlementActive && <Alert variant='warning'>Staff reminders require an active subscription. Existing work stays available for review; reminders can be disabled here.</Alert>}
      <Card><CardContent className="pt-0"><form className='space-y-4' onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={locked || pending || !settings.organizationWideAccess} className='space-y-4'>
          <legend className='mb-3 font-semibold'>Workflow defaults</legend>
          <div className={styles.formGrid}><Input label='New inquiry next action (hours)' type='number' min={1} max={168} step={1} required value={Number.isNaN(form.defaultInquiryHours) ? '' : form.defaultInquiryHours} onChange={event => numeric('defaultInquiryHours', event.target.value)} /><Input label='New callback task (hours)' type='number' min={1} max={168} step={1} required value={Number.isNaN(form.defaultTaskHours) ? '' : form.defaultTaskHours} onChange={event => numeric('defaultTaskHours', event.target.value)} /></div>
          <p className='text-sm text-text-muted'>These initialize new forms. Staff verify or change the due time. Inquiry ownership starts with its creator; staff can explicitly choose an eligible owner or leave it unassigned.</p>
          <Checkbox checked={form.automationEnabled} disabled={!settings.entitlementActive && !form.automationEnabled} onChange={event => setForm({ ...form, automationEnabled: event.target.checked })} label="Enable daily in-app reminders for assigned staff tasks" />
          <div className={styles.formGrid}><Input label='Staff reminder window starts (hour)' type='number' min={0} max={23} step={1} required value={Number.isNaN(form.reminderStartHour) ? '' : form.reminderStartHour} onChange={event => numeric('reminderStartHour', event.target.value)} /><Input label='Staff reminder window ends (hour)' type='number' min={1} max={24} step={1} required value={Number.isNaN(form.reminderEndHour) ? '' : form.reminderEndHour} onChange={event => numeric('reminderEndHour', event.target.value)} /></div>
          <p className='text-sm text-text-muted'>Each branch uses its local timezone. The end hour is exclusive. Reminders contain administrative task links and do not message patients.</p>
          <Input label='Feedback rating requiring service review (1–3)' type='number' min={1} max={3} step={1} required value={Number.isNaN(form.feedbackRecoveryRating) ? '' : form.feedbackRecoveryRating} onChange={event => numeric('feedbackRecoveryRating', event.target.value)} />
          <p className='text-sm text-text-muted'>New feedback at or below this rating creates staff review work. It does not automatically contact the patient.</p>
        </fieldset>
        <Button type='submit' disabled={loading || !settings.organizationWideAccess} loading={pending}>{locked ? 'Retry submitted settings' : 'Save workflow settings'}</Button>
      </form></CardContent></Card>
      <Card><CardContent className="pt-0"><h2 className='font-semibold'>Campaigns disabled</h2><p className='mt-2 text-sm'>Promotional campaigns and automatic patient recalls are outside this release. A clinical recommendation creates staff follow-up work; it does not confirm a new booking.</p></CardContent></Card>
    </>}
  </CrmWorkspaceLayout>;
}
