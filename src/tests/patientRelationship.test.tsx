import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PatientRelationshipPanel } from '@/components/patients/PatientRelationshipPanel';
const relationship = { revision: 4, locationId: 'branch', ownerId: 'staff', ownerName: 'Owner', preferences: { language: 'Hindi', preferredChannel: 'phone', doNotContact: false }, contact: { availability: 'reachable', recipientType: 'patient' }, canEdit: true };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', email: 'staff@example.test', role: 'receptionist', organization_id: 'org', permissions: ['VIEW_CRM', 'MANAGE_PATIENTS'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Branch' }] : String(path).endsWith('/family-recipients') ? { items: [], nextCursor: null } : { relationship, activities: [], inquiries: [], nextActivityCursor: null, nextInquiryCursor: null } } }));
  vi.spyOn(api, 'patch').mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Patient relationship panel', () => {
  it('records preferences separately from consent and preserves the displayed revision', async () => {
    render(<PatientRelationshipPanel patientId='patient' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit relationship preferences' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save relationship preferences' })).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Do not contact in this organization'));
    fireEvent.click(screen.getByRole('button', { name: 'Save relationship preferences' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/crm/patients/patient/relationship', expect.objectContaining({ expectedRevision: 4, locationId: 'branch', preferences: { language: 'Hindi', preferredChannel: 'phone', doNotContact: true } })));
    expect(vi.mocked(api.patch).mock.calls[0][1]).not.toHaveProperty('ownerId');
  });
  it('locks failed submissions and retries the same request without claiming success', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Patient relationship changed' } } });
    render(<PatientRelationshipPanel patientId='patient' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit relationship preferences' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save relationship preferences' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save relationship preferences' }));
    await screen.findByText(/Patient relationship changed/);
    expect(screen.getByLabelText('Preferred language')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted preferences' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.patch).mock.calls[0][1]).toEqual(vi.mocked(api.patch).mock.calls[1][1]);
  });
  it('pages only the selected timeline resource and does not reset the loaded inquiry list', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { relationship, activities: [{ id: 'one', kind: 'call_recorded', actorName: 'Owner', createdAt: '2026-10-10' }], inquiries: [{ id: 'inq', callerName: 'Returning caller', status: 'open', source: 'unknown' }], nextActivityCursor: 'cursor', nextInquiryCursor: null } } });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { relationship, activities: [{ id: 'two', kind: 'preferences_updated', actorName: 'Owner', createdAt: '2026-10-10' }], inquiries: [], nextActivityCursor: null, nextInquiryCursor: null } } });
    render(<PatientRelationshipPanel patientId='patient' />);
    fireEvent.click(await screen.findByRole('button', { name: 'More administrative activity' }));
    expect(await screen.findByText(/preferences updated/)).toBeInTheDocument();
    expect(screen.getByText(/Returning caller:/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith('/crm/patients/patient/relationship', expect.objectContaining({ params: { activityCursor: 'cursor' } }));
  });
  it('keeps another branch relationship read-only and denies consumers', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { relationship: { ...relationship, canEdit: false }, activities: [], inquiries: [] } } });
    render(<PatientRelationshipPanel patientId='patient' />);
    await screen.findByText(/relationship is managed by another branch/);
    expect(screen.queryByRole('button', { name: 'Edit relationship preferences' })).not.toBeInTheDocument();
    cleanup(); vi.mocked(api.get).mockClear();
    useAuthStore.setState(state => ({ user: { ...state.user!, role: 'patient' } }));
    render(<PatientRelationshipPanel patientId='patient' />);
    expect(api.get).not.toHaveBeenCalled();
  });
});
