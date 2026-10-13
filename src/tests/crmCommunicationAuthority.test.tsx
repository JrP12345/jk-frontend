import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CallHistory } from '@/components/crm/CallHistory';
import { PatientMessages } from '@/components/crm/PatientMessages';
import { InboundMessages } from '@/components/crm/InboundMessages';
import { InquiryReplies } from '@/components/crm/InquiryReplies';

const marker = 'previous staff private record';
const cases = [
  { name: 'call history', view: <CallHistory patientId='patient' locationId='branch' />, opener: 'Call history', path: '/crm/communications/calls',
    row: { id: 'call', note: marker, outcome: 'contacted', actorName: 'Staff', communication: { direction: 'inbound', occurredAt: new Date().toISOString(), source: 'staff_reported' } } },
  { name: 'patient messages', view: <PatientMessages patientId='patient' locationId='branch' />, opener: 'Patient messages', path: '/crm/communications/messages',
    row: { id: 'message', channel: 'whatsapp', purpose: 'care_operations', status: 'failed', reason: marker, createdAt: new Date().toISOString() } },
  { name: 'incoming replies', view: <InboundMessages />, path: '/crm/communications/inbound',
    row: { id: 'reply', revision: 0, text: marker, type: 'text', contactHint: '3210', createdAt: new Date().toISOString() } },
  { name: 'reviewed inquiry replies', view: <InquiryReplies inquiryId='inquiry' />, opener: 'Reviewed replies', path: '/crm/communications/inbound',
    row: { id: 'reply', text: marker, type: 'text', contactHint: '3210', createdAt: new Date().toISOString() } },
];
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', email: 'staff@example.test', role: 'admin', organization_id: 'org',
    permissions: ['VIEW_CRM', 'COMMUNICATE_PATIENTS', 'MANAGE_CRM_INQUIRIES', 'ASSIGN_CRM_TASKS'] }, isAuthenticated: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(cases.flatMap(test => ['identity', 'permissions'].map(change => ({ ...test, change }))))
  ('$name discards private rows when $change changes within the same organization', async test => {
    const get = vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [] : { items: [test.row], nextCursor: null } } }));
    render(test.view);
    if (test.opener) fireEvent.click(screen.getByRole('button', { name: test.opener }));
    await screen.findByText(new RegExp(marker));
    const initialRead = get.mock.calls.find(([path]) => path === test.path);
    get.mockImplementation(() => new Promise(() => {}));
    act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, ...(test.change === 'identity'
      ? { id: 'other-staff' } : { permissions: ['VIEW_CRM', 'COMMUNICATE_PATIENTS'] }) } }));
    await waitFor(() => expect(screen.queryByText(new RegExp(marker))).not.toBeInTheDocument());
    expect(initialRead?.[1]?.signal?.aborted).toBe(true);
    expect(get.mock.calls.filter(([path]) => path === test.path)).toHaveLength(2);
  });
