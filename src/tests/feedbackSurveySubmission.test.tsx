import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Feedback from '@/app/(dashboard)/dashboard/feedback/page';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { hasRoutePermission } from '@/lib/routePermissions';

const stats = { totalResponses: 0, averageCsatRating: null, netPromoterScore: null, sources: [], definition: 'Reported respondents only.' };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.history.replaceState({}, '', '/dashboard/feedback');
  useAuthStore.setState({ user: { id: 'staff', name: 'Recorder', email: 'recorder@example.test', role: 'admin', organization_id: 'org', permissions: ['VIEW_CRM', 'MANAGE_CRM_TASKS', 'VIEW_CRM_ANALYTICS'] }, isAuthenticated: true });
  useLocationStore.setState({ activeLocationId: 'clinic' });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: String(path) === '/feedback/eligible-visits' ? { items: [{ id: 'completed-visit', appointmentTime: '2026-10-09T10:00:00Z', locationId: 'clinic' }], nextCursor: null } : String(path) === '/feedback/stats' ? stats : [] }, headers: {} }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function openSurvey() {
  fireEvent.click(screen.getByRole('button', { name: 'Record reported feedback' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Select completed visit' })).toHaveTextContent('completed-visit'));
}
it('uses the minimal completed-visit endpoint and records an attributable staff survey with a stable key', async () => {
  let finish!: (result: unknown) => void;
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<Feedback />); await openSurvey();
  expect(api.get).toHaveBeenCalledWith('/feedback/eligible-visits', expect.objectContaining({ params: { locationId: 'clinic' } }));
  expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/appointments/), expect.anything());
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Net Promoter Score' }), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/feedback', expect.objectContaining({ clientRequestId: expect.any(String), appointmentId: 'completed-visit', rating: 5, npsScore: 7, comments: '', aspectRatings: { waitTime: 5, doctorAttitude: 5, cleanliness: 5 } })));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'Overall rating' })).toBeDisabled();
  await act(async () => { finish({ data: { success: true } }); });
  expect(await screen.findByText('Staff-reported feedback was recorded.')).toBeInTheDocument();
});
it('keeps an uncertain submission frozen and retries exactly the same survey', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('response lost'));
  render(<Feedback />); await openSurvey();
  fireEvent.change(screen.getByRole('textbox', { name: 'Feedback comments' }), { target: { value: 'Service concern' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('submitted details are locked');
  expect(screen.getByRole('textbox', { name: 'Feedback comments' })).toBeDisabled();
  expect(screen.getByRole('alert').parentElement).toHaveFocus();
  const submitted = vi.mocked(api.post).mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Resume submitted feedback' }));
  expect(screen.getByRole('textbox', { name: 'Feedback comments' })).toHaveValue('Service concern');
  fireEvent.click(screen.getByRole('button', { name: 'Retry submitted feedback' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(submitted);
});
it('shows unavailable scores and separates actual patient, staff and unknown submission sources', async () => {
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path) === '/feedback/stats' ? { ...stats, totalResponses: 3, sources: ['patient_submitted', 'staff_reported', 'unknown'].map(source => ({ source, total: 1, averageRating: 3, nps: -100 })) } : [] }, headers: {} }));
  render(<Feedback />);
  expect(await screen.findByText(/Average rating: Unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/patient submitted: 1/)).toBeInTheDocument(); expect(screen.getByText(/staff reported: 1/)).toBeInTheDocument(); expect(screen.getByText(/unknown: 1/)).toBeInTheDocument();
});
it('shows a report failure as an error and allows a focused retry', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('report unavailable'));
  render(<Feedback />); expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText(/0 recorded responses/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry feedback load' }));
  expect(await screen.findByText(/0 recorded responses/)).toBeInTheDocument();
});
it('allows self surveys without making staff report requests; denies family and unrelated clinical roles', async () => {
  useAuthStore.setState({ user: { id: 'self', role: 'patient', name: 'Self', email: 'self@example.test', permissions: [] } });
  const view = render(<Feedback />);
  expect(screen.getByRole('button', { name: 'Share visit feedback' })).toBeInTheDocument(); expect(api.get).toHaveBeenCalledWith('/feedback/mine', expect.anything());
  act(() => useAuthStore.setState({ user: { id: 'relative', role: 'family_member', name: 'Relative', email: 'relative@example.test', permissions: [] } }));
  expect(screen.getByRole('alert')).toHaveTextContent('authorized patient or staff');
  expect(vi.mocked(api.get).mock.calls.every(([path]) => path === '/feedback/mine')).toBe(true); view.unmount();
  expect(hasRoutePermission('/dashboard/feedback', 'patient')).toBe(true);
  expect(hasRoutePermission('/dashboard/feedback', 'family_member')).toBe(false);
  expect(hasRoutePermission('/dashboard/feedback', 'nurse', ['VIEW_EHR'])).toBe(false);
  expect(hasRoutePermission('/dashboard/crm/overview', 'receptionist', ['VIEW_CRM'])).toBe(false);
});
it('does not render a stale report when the selected organization changes', async () => {
  let finish!: (result: unknown) => void;
  vi.mocked(api.get).mockImplementation(path => String(path) === '/feedback/stats' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: { data: [] }, headers: {} }));
  render(<Feedback />); await waitFor(() => expect(finish).toBeDefined()); const previous = finish;
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: 'new-org' } }));
  await act(async () => { previous({ data: { data: { ...stats, totalResponses: 999 } } }); });
  expect(screen.queryByText(/999 recorded responses/)).not.toBeInTheDocument();
});
