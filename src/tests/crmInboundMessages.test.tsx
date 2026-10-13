import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { InboundMessages } from '@/components/crm/InboundMessages';
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', email: 'staff@example.test', role: 'admin', organization_id: 'org', permissions: ['VIEW_CRM', 'COMMUNICATE_PATIENTS', 'MANAGE_CRM_INQUIRIES', 'ASSIGN_CRM_TASKS'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/organizations' ? [{ id: 'org', name: 'Clinic' }] : path === '/crm/inquiries' ? { items: [{ id: 'inquiry', callerName: 'Reviewed caller', locationId: 'branch', status: 'open', createdAt: new Date().toISOString() }], nextCursor: null } : { items: [{ id: 'reply', revision: 2, type: 'text', text: 'Service question', contactHint: '3210', createdAt: new Date().toISOString() }], nextCursor: null } } }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Explicit reply review interface', () => {
  it('requires destination review and restores exact routing after an uncertain result', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Review unavailable' } } });
    render(<InboundMessages />); fireEvent.click(await screen.findByRole('button', { name: 'Review reply destination' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload eligible inquiries' })).not.toHaveAttribute('aria-busy', 'true'));
    fireEvent.click(screen.getByRole('combobox', { name: 'Destination inquiry' })); fireEvent.click(await screen.findByRole('option', { name: /Reviewed caller/ }));
    expect(screen.getByRole('button', { name: 'Route reviewed reply' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Routing reason'), { target: { value: 'Caller reviewed with inquiry owner' } }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Route reviewed reply' }));
    await screen.findByText('Review unavailable'); expect(screen.getByRole('combobox', { name: 'Destination inquiry' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted routing' })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]); expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ inquiryId: 'inquiry', organizationId: 'org', subjectVerified: true, expectedRevision: 2 });
  });
  it('requires root to choose a destination organization for shared quarantine', async () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, role: 'root', organization_id: undefined } }));
    render(<InboundMessages />); expect(await screen.findByRole('button', { name: 'Review reply destination' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Routing destination organization')); fireEvent.click(await screen.findByRole('option', { name: 'Clinic' })); await waitFor(() => expect(screen.getByRole('button', { name: 'Review reply destination' })).toBeEnabled());
    expect(api.get).toHaveBeenCalledWith('/crm/communications/inbound', expect.objectContaining({ params: { shared: true } }));
  });
});
