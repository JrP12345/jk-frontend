import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CallHistory } from '@/components/crm/CallHistory';
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', role: 'receptionist', email: 'staff@example.test', organization_id: 'org', permissions: ['VIEW_CRM', 'COMMUNICATE_PATIENTS'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Branch' }] : { items: [], nextCursor: null } } }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Call history controls', () => {
  it('loads on opening, requires explicit subject review and preserves a failed submission for retry', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Audit unavailable' } } });
    render(<CallHistory patientId="patient" locationId="branch" />);
    expect(api.get).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Call history' }));
    await screen.findByText('No call records in this scope.');
    expect(screen.getByRole('button', { name: 'Save staff-reported call' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Save staff-reported call' }));
    await screen.findByText('Audit unavailable'); expect(screen.getByLabelText('Administrative call note')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted call record' }));
    await screen.findByText('Staff-reported call saved or restored.');
    expect(api.post).toHaveBeenCalledTimes(2); expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ patientId: 'patient', subjectVerified: true, locationId: 'branch', direction: 'inbound' });
  });
  it('records an anonymous inquiry without adding a patient subject', async () => {
    render(<CallHistory inquiryId="inquiry" locationId="branch" />); fireEvent.click(screen.getByRole('button', { name: 'Call history' }));
    await screen.findByText('No call records in this scope.'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Save staff-reported call' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ inquiryId: 'inquiry' }); expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('patientId');
  });
  it('offers read-only history without communicate permission and hides controls from consumers', async () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, permissions: ['VIEW_CRM'] } }));
    render(<CallHistory patientId="patient" />); fireEvent.click(screen.getByRole('button', { name: 'Call history' }));
    await screen.findByText('No call records in this scope.'); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    cleanup(); useAuthStore.setState(state => ({ user: { ...state.user!, role: 'patient' } }));
    render(<CallHistory patientId="patient" />); expect(screen.queryByRole('button', { name: 'Call history' })).not.toBeInTheDocument();
  });
});
