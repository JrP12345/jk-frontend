"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from "next/link";
import { Building2, Inbox, CheckCheck, ArrowRight, RotateCw } from "lucide-react";
import { CrmWorkspaceLayout } from "./CrmWorkspaceLayout";
import styles from "./CrmWorkspace.module.css";
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Card, Select } from '@/components/ui';
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
  return <CrmWorkspaceLayout active="inquiries" title="Patient relationships" description="Manage inquiries and coordinate patient follow-up across your practices.">
    <div className={styles.chooser}><Card><div className="space-y-5">
    <div className={styles.chooserIntro}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-accent"><Building2 className="h-5 w-5" /></span><div><h2>Open an organization workspace</h2><p>Choose the practice you want to support. Each workspace contains its own inquiries, tasks and authorized branches.</p></div></div>
    {error && <Alert variant='error'>{error}</Alert>}
    <Select label='CRM organization' value={organizationId} disabled={loading || busy}
      options={organizations.map(org => ({ value: org.id, label: org.name }))} placeholder='Choose organization'
      onChange={event => setOrganizationId(event.target.value)} />
    <div className={styles.formActions}>
      <Button disabled={!organizationId || loading || busy} loading={busy} onClick={async () => {
        if (busy) return; setBusy(true); setError('');
        try {
          await switchOrg(organizationId);
          const current = useAuthStore.getState().user;
          if (current?.role === 'root' && current.organization_id === organizationId) router.replace('/dashboard/crm');
        } catch { /* The auth store clears uncertain authority; sign-in handles recovery. */ }
      }}>Open organization CRM<ArrowRight className="h-4 w-4 shrink-0" /></Button>
      <Button variant="outline" aria-label="Reload organizations" title="Reload organizations" disabled={busy} loading={loading} onClick={() => void load()}><RotateCw className="h-4 w-4" />Reload</Button>

    </div>
    {!loading && !error && !organizations.length && <p>Create an organization and a branch before capturing inquiries.</p>}
    <div className="border-t border-border pt-4 text-sm"><Link href="/dashboard/organizations" className="inline-flex min-h-11 items-center gap-1 font-medium text-accent">Manage organizations<ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </div></Card><Card><h2 className="mb-4 text-sm font-semibold">Inside each workspace</h2><div className={styles.chooserLinks}>
      <div><Inbox className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><div><h3 className="text-sm font-medium">Inquiries</h3><p className="mt-1 text-xs text-text-secondary">Capture requests and track the next action.</p></div></div>
      <div><CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><div><h3 className="text-sm font-medium">Daily tasks</h3><p className="mt-1 text-xs text-text-secondary">Coordinate callbacks and follow-up work.</p></div></div>
      <div><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><div><h3 className="text-sm font-medium">Branch context</h3><p className="mt-1 text-xs text-text-secondary">Work within authorized practice locations.</p></div></div>
    </div></Card></div>
  </CrmWorkspaceLayout>;
}
