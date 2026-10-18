import { datePickerInput } from "./datePickerTestUtils";
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CrmOverview } from '@/components/crm/CrmOverview';
import { CrmSettings } from '@/components/crm/CrmSettings';
import { InquiryWorkspace } from '@/components/crm/InquiryWorkspace';
import { locationLocalDateTimeInput } from '@/lib/locationTime';

const settings = { revision: 3, automationEnabled: false, campaignsEnabled: false, defaultInquiryHours: 4, defaultTaskHours: 12, reminderStartHour: 8, reminderEndHour: 20, feedbackRecoveryRating: 2, entitlementActive: true, organizationWideAccess: true };
const report = { asOf: '2026-10-09T18:30:00Z', startDate: '2026-10-01', endDate: '2026-10-09', branches: [{ locationId: 'branch', name: 'Visible branch', timezone: 'Asia/Kolkata' }], inquiries: { total: 0, converted: 0, unreconciled: 0, active: 0, closed: 0, conversionPercent: null, responseCount: 0, averageFirstReportedCallMinutes: null, sources: [] }, tasks: { total: 0, overdue: 0, unassigned: 0, snoozed: 0, kinds: [], workload: [], workloadCapped: false }, appointments: { total: 0, states: {}, resolvedAttendance: 0, noShowPercent: null, returningCompletedVisits: 0, completedVisits: 0 }, communications: { states: [{ channel: 'whatsapp', status: 'accepted', total: 2 }], costExplanation: 'Provider costs unavailable.' }, definitions: { inquiries: 'Canonical conversion cohort.', tasks: 'Current unfinished work.', appointments: 'Recorded attendance only.', communications: 'Acceptance is not delivery.', response: 'Staff reports only.', returning: 'Authorized branches only.' } };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'manager', name: 'Manager', email: 'manager@example.test', role: 'admin', organization_id: 'org', permissions: ['VIEW_CRM', 'VIEW_CRM_ANALYTICS', 'MANAGE_CRM_SETTINGS', 'MANAGE_CRM_INQUIRIES'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: String(path) === '/crm/settings' ? settings : report } }));
  vi.spyOn(api, 'patch').mockResolvedValue({ data: { data: { ...settings, revision: 4 } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('CRM operational reports and settings', () => {
  it('clears edited settings when the effective operator changes in the same organization', async () => {
    render(<CrmSettings />);
    const input = await screen.findByLabelText('New inquiry next action (hours)');
    fireEvent.change(input, { target: { value: '17' } });
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, id: 'other-manager' } }));
    expect(screen.queryByLabelText('New inquiry next action (hours)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save workflow settings/ })).not.toBeInTheDocument();
  });
  it('clears a private report on a same-organization permission change and rechecks it', async () => {
    render(<CrmOverview />);
    await screen.findByText('Provider costs unavailable.');
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ['VIEW_CRM', 'VIEW_CRM_ANALYTICS'] } }));
    expect(screen.queryByText('Provider costs unavailable.')).not.toBeInTheDocument();
  });
  it('shows an empty denominator, actual acceptance and unavailable costs without inventing delivery', async () => {
    render(<CrmOverview />);
    expect(await screen.findByText(/No conversion denominator/)).toBeInTheDocument();
    expect(screen.getByText('whatsapp · accepted: 2')).toBeInTheDocument();
    expect(screen.getByText('Provider costs unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/delivered: 2/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload report' })).toBeEnabled();
  });
  it('distinguishes a failed report from zero and reloads safely', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('outage')); render(<CrmOverview />);
    await screen.findByText(/operational report could not be loaded/);
    expect(screen.queryByText('No inquiries were captured during this period.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload report' }));
    expect(await screen.findByText('No inquiries were captured during this period.')).toBeInTheDocument();
  });
  it('blocks analytics without permission and discards an earlier workspace response', async () => {
    const original = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...original, permissions: ['VIEW_CRM'] } }); const denied = render(<CrmOverview />);
    expect(screen.getByText(/authorized staff analytics workspace/)).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled(); denied.unmount();
    useAuthStore.setState({ user: original }); let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(done => { resolve = done; })); render(<CrmOverview />);
    await act(async () => { useAuthStore.setState({ user: { ...original, organization_id: 'other-org' } }); });
    await screen.findByText('No inquiries were captured during this period.');
    await act(async () => { resolve({ data: { data: { ...report, inquiries: { ...report.inquiries, total: 999 } } } }); });
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
  it('freezes a submitted settings command after an uncertain response and retries exactly', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Unknown settings result' } } });
    render(<CrmSettings />); await screen.findByLabelText('New inquiry next action (hours)');
    fireEvent.change(screen.getByLabelText('New inquiry next action (hours)'), { target: { value: '8' } });
    fireEvent.click(screen.getByLabelText('Enable daily in-app reminders for assigned staff tasks'));
    fireEvent.click(screen.getByRole('button', { name: 'Save workflow settings' })); await screen.findByText('Unknown settings result');
    expect(screen.getByLabelText('New inquiry next action (hours)')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted settings' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.patch).mock.calls[0][1]).toEqual(vi.mocked(api.patch).mock.calls[1][1]);
    expect(vi.mocked(api.patch).mock.calls[0][1]).toMatchObject({ expectedRevision: 3, defaultInquiryHours: 8, automationEnabled: true });
    expect(screen.queryByRole('checkbox', { name: /campaign/i })).not.toBeInTheDocument();
  });
  it('shows branch-restricted and expired settings truthfully', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...settings, entitlementActive: false, organizationWideAccess: false } } });
    render(<CrmSettings />); await screen.findByLabelText('New inquiry next action (hours)');
    expect(screen.getByText(/require reviewed access to all branches/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save workflow settings' })).toBeDisabled();
    expect(screen.getByLabelText('Enable daily in-app reminders for assigned staff tasks')).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
  });
  it('initializes a new inquiry from its saved default and preserves staff changes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-09T10:00:00Z').getTime());
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path) === '/crm/settings' ? settings : String(path) === '/crm/locations' ? [{ id: 'branch', name: 'Visible branch', effectiveTimezone: 'Asia/Kolkata' }] : String(path) === '/crm/assignees' ? { items: [{ id: 'manager', name: 'Manager' }], nextCursor: null } : { items: [], nextCursor: null } } }));
    render(<InquiryWorkspace />); fireEvent.click(await screen.findByRole('button', { name: 'Capture inquiry' }));
    const due = datePickerInput(await screen.findByLabelText('Next action due (Asia/Kolkata)'));
    await waitFor(() => expect(due).toHaveValue(locationLocalDateTimeInput(new Date('2026-10-09T14:00:00Z'), 'Asia/Kolkata')));
    fireEvent.change(due, { target: { value: '2026-10-10T17:30' } });
    expect(due).toHaveValue('2026-10-10T17:30');
  });
});
