import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PatientMessages } from '@/components/crm/PatientMessages';
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', email: 'staff@example.test', role: 'receptionist', organization_id: 'org', permissions: ['VIEW_CRM', 'COMMUNICATE_PATIENTS'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Clinic' }] : path.endsWith('/preview') ? { recipient: '919876543210', recipientHash: 'a'.repeat(64) } : { items: [], nextCursor: null } } }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { data: { status: 'pending' } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Reviewed patient messaging', () => {
  it('requires current recipient preview, sends its hash and reports queued state honestly', async () => {
    render(<PatientMessages patientId="patient" locationId="branch" />); expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Patient messages' })); await screen.findByText('No messages in this scope.');
    expect(screen.getByRole('button', { name: 'Queue reviewed message' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Review recipient and consent' })); await screen.findByText(/Recipient: 919876543210/);
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Queue reviewed message' }));
    await screen.findByText(/Message pending/);
    expect(api.post).toHaveBeenCalledWith('/crm/communications/messages', expect.objectContaining({ patientId: 'patient', locationId: 'branch', recipientHash: 'a'.repeat(64), subjectVerified: true, purpose: 'care_operations', channel: 'whatsapp' }));
  });
  it('invalidates review when purpose changes and preserves failed submissions for exact retry', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Queue unavailable' } } });
    render(<PatientMessages patientId="patient" locationId="branch" />); fireEvent.click(screen.getByRole('button', { name: 'Patient messages' })); await screen.findByText('No messages in this scope.');
    fireEvent.click(screen.getByRole('button', { name: 'Review recipient and consent' })); await screen.findByRole('checkbox'); fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('combobox', { name: 'Message purpose' })); fireEvent.click(await screen.findByRole('option', { name: 'Recommended care follow-up' })); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review recipient and consent' })); await screen.findByRole('checkbox'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Queue reviewed message' }));
    await screen.findByText('Queue unavailable'); expect(screen.getByRole('combobox', { name: 'Message purpose' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted message' })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
  });
  it('shows policy denial without offering a recipient or claiming a send', async () => {
    vi.mocked(api.get).mockImplementation(async path => {
      if (path.endsWith('/preview')) throw { response: { data: { message: 'Message blocked: review current consent' } } };
      return { data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Clinic' }] : { items: [], nextCursor: null } } };
    });
    render(<PatientMessages patientId="patient" locationId="branch" />); fireEvent.click(screen.getByRole('button', { name: 'Patient messages' })); await screen.findByText('No messages in this scope.');
    fireEvent.click(screen.getByRole('button', { name: 'Review recipient and consent' })); await screen.findByText(/Message blocked/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  });
});
