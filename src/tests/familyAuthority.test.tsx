import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { FamilyAuthorityPanel } from '@/components/patients/FamilyAuthorityPanel';

const family = { id: 'family', name: 'Verified guardian', relationship: 'guardian', available: true, revision: 2, grants: { communication: false, consent: false, dataRights: false }, reviewedAt: null };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'reviewer', role: 'admin', name: 'Reviewer', email: 'reviewer@example.test', organization_id: 'org', permissions: ['VIEW_CRM', 'ADMINISTRATIVE_GOVERNANCE', 'REVIEW_PATIENT_IDENTITY'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { items: [family], nextCursor: null } } });
  vi.spyOn(api, 'put').mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function openReview() {
  fireEvent.click(await screen.findByRole('button', { name: 'Review authority for Verified guardian' }));
  fireEvent.click(screen.getByLabelText('Receive organization service communications'));
  fireEvent.change(screen.getByLabelText('Verified delegation basis'), { target: { value: 'Reviewed the guardian’s independent identity and documented delegation.' } });
  expect(screen.getByRole('button', { name: 'Save reviewed family authority' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /I independently verified/ }));
}
describe('Organization family review', () => {
  it('records each purpose separately with explicit evidence and the displayed revision', async () => {
    render(<FamilyAuthorityPanel patientId="patient" />); await openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed family authority' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/crm/patients/patient/family-authorizations/family', expect.objectContaining({ expectedRevision: 2, identityVerified: true, grants: { communication: true, consent: false, dataRights: false } })));
  });
  it('freezes an uncertain review and restores the same command after closing', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Committed response lost'));
    render(<FamilyAuthorityPanel patientId="patient" />); await openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed family authority' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Verified delegation basis')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume submitted family review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted family review' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual(vi.mocked(api.put).mock.calls[1][1]);
  });
  it('requires a fresh review after a conflict without overwriting the newer grant', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Family authority changed. Reload before reviewing.' } } });
    render(<FamilyAuthorityPanel patientId="patient" />); await openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed family authority' }));
    await screen.findByText('Family authority changed. Reload before reviewing.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume submitted family review' })).not.toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(1);
    vi.mocked(api.get).mockResolvedValue({ data: { data: { items: [{ ...family, revision: 3 }], nextCursor: null } } });
    fireEvent.click(screen.getByRole('button', { name: 'Reload family authority' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
  it('clears private review state when the effective reviewer changes in the same organization', async () => {
    render(<FamilyAuthorityPanel patientId="patient" />); await openReview();
    act(() => useAuthStore.setState(state => ({ user: { ...state.user!, id: 'other-reviewer' } })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
  it('does not expose reviews to a consumer or a reviewer without both permissions', () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, permissions: ['REVIEW_PATIENT_IDENTITY'] } }));
    const view = render(<FamilyAuthorityPanel patientId="patient" />);
    expect(view.container).toBeEmptyDOMElement(); expect(api.get).not.toHaveBeenCalled();
    act(() => useAuthStore.setState(state => ({ user: { ...state.user!, role: 'patient', permissions: ['ADMINISTRATIVE_GOVERNANCE', 'REVIEW_PATIENT_IDENTITY'] } })));
    expect(view.container).toBeEmptyDOMElement(); expect(api.get).not.toHaveBeenCalled();
  });
});
