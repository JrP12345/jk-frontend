"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Select } from '@/components/ui';
import type { OrganizationRecord } from '@/services/organization.service';

export function RootCrmWorkspace() {
  const switchOrg = useAuthStore(state => state.switchOrg);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const beginRead = useLatestRead();
  const router = useRouter();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError('');
    try {
      const response = await api.get('/organizations', { signal: request.signal });
      if (request.isCurrent()) setOrganizations((response.data.data as OrganizationRecord[]).filter(org => org.isActive !== false && org.status !== 'inactive'));
    } catch { if (request.isCurrent()) setError('Organizations could not be loaded. Retry.'); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead]);
  useEffect(() => { void load(); }, [load]);
  return <div className='space-y-4'>
    <h1 className='text-2xl font-semibold'>Patient relationships</h1>
    <p>Choose an organization to open its patient-support CRM. Each workspace contains only that organization's inquiries and tasks.</p>
    {error && <Alert variant='error'>{error}</Alert>}
    <Select label='CRM organization' value={organizationId} disabled={loading || busy}
      options={organizations.map(org => ({ value: org.id, label: org.name }))} placeholder='Choose organization'
      onChange={event => setOrganizationId(event.target.value)} />
    <div className='flex flex-wrap gap-3'>
      <Button disabled={!organizationId || loading || busy} loading={busy} onClick={async () => {
        if (busy) return; setBusy(true); setError('');
        try {
          await switchOrg(organizationId);
          const current = useAuthStore.getState().user;
          if (current?.role === 'root' && current.organization_id === organizationId) router.replace('/dashboard/crm');
        } catch { /* The auth store clears uncertain authority; sign-in handles recovery. */ }
      }}>Open organization CRM</Button>
      <Button variant='outline' disabled={busy} loading={loading} onClick={() => void load()}>Reload organizations</Button>
      <Link href='/dashboard/organizations' className='text-accent underline'>Manage organizations</Link>
    </div>
    {!loading && !error && !organizations.length && <p>Create an organization and a branch before capturing inquiries.</p>}
  </div>;
}
