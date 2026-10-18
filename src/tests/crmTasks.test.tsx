import { datePickerInput } from "./datePickerTestUtils";
﻿import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CrmTaskWorkspace } from '@/components/crm/CrmTaskWorkspace';
const task = { id: 'task', title: 'Contact inquiry caller', kind: 'crm_inquiry', status: 'todo', locationId: 'branch', assignedTo: 'staff', assigneeName: 'Staff', inquiryId: 'inquiry', dueDate: '2026-10-10T12:00:00Z', revision: 3, activities: [], nextActivityCursor: null };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: 'staff', name: 'Staff', email: 'staff@example.test', role: 'receptionist', organization_id: 'org', permissions: ['VIEW_CRM', 'MANAGE_CRM_TASKS', 'MANAGE_CRM_INQUIRIES'] }, isAuthenticated: true });
  vi.spyOn(api, 'get').mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Branch', effectiveTimezone: 'Asia/Kolkata' }] : path === '/crm/tasks/task' ? task : { items: [task], nextCursor: null } } }));
  vi.spyOn(api, 'patch').mockResolvedValue({ data: { data: {} } });
  vi.spyOn(api, 'post').mockResolvedValue({ data: { data: task } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Daily patient task workspace', () => {
  it('preserves an uncertain task booking through close and resume', async () => {
    const patientId = '1234567890abcdef12345678', bookTask = { ...task, kind: 'crm_callback', patientId };
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ['VIEW_CRM', 'MANAGE_CRM_TASKS', 'MANAGE_APPOINTMENTS'] } });
    const get = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation(async (path, config) => String(path).includes('/assignments')
      ? { data: { data: [{ doctorId: { id: 'doctor', name: 'Doctor' }, bookingMode: 'sequential_queue' }] } }
      : String(path).includes('/slots') ? { data: { data: { slots: [], isHoliday: false } } }
      : path === '/crm/tasks/task' ? { data: { data: bookTask } }
      : path === '/crm/tasks' ? { data: { data: { items: [bookTask], nextCursor: null } } } : get(path, config));
    vi.mocked(api.post).mockRejectedValue(new Error('response lost'));
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Arrange task booking' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /I verified the patient identity/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Convert to booking' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Convert to booking' }));
    await screen.findByText(/booking result could not be confirmed/);
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resume submitted booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted conversion' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[0][1]);
  });
  it('records an outcome and schedules the linked inquiry next action in branch time', async () => {
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Record task outcome' }));
    fireEvent.change(datePickerInput(screen.getByLabelText('Next task time (Asia/Kolkata)')), { target: { value: '2026-10-11T17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save task update' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/crm/tasks/task', expect.objectContaining({ expectedRevision: 3, action: 'complete', outcome: 'contacted', nextAction: { kind: 'contact', dueAt: '2026-10-11T12:00:00.000Z' } })));
    expect(vi.mocked(api.patch).mock.calls[0][1]).not.toHaveProperty('closeInquiry');
  });
  it('retains the exact failed task command and disables editing until retry or close', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Task changed. Reload before saving.' } } });
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Snooze task' }));
    fireEvent.change(screen.getByLabelText('Administrative outcome or reason'), { target: { value: 'Patient requested tomorrow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save task update' }));
    await screen.findByText(/Task changed/);
    expect(screen.getByLabelText('Administrative outcome or reason')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted task update' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.patch).mock.calls[0][1]).toEqual(vi.mocked(api.patch).mock.calls[1][1]);
  });
  it('claims an unassigned task for the current eligible user and hides manager-only assignment choices', async () => {
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [{ id: 'branch', name: 'Branch' }] : path === '/crm/tasks/task' ? { ...task, assignedTo: null } : { items: [task], nextCursor: null } } }));
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Claim task' }));
    expect(screen.queryByRole('combobox', { name: 'Task assignee' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Administrative outcome or reason'), { target: { value: 'Taking next action' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save task update' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/crm/tasks/task', expect.objectContaining({ action: 'assign', assignedTo: 'staff' })));
  });
  it('shows a failed queue distinctly and reloads the selected due filter', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    render(<CrmTaskWorkspace />);
    await screen.findByText(/task result could not be confirmed/);
    expect(screen.queryByText('No tasks match these filters.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload tasks' }));
    expect(await screen.findByRole('button', { name: 'Open task' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Task due filter' }));
    fireEvent.click(screen.getByRole('option', { name: 'Snoozed tasks' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/crm/tasks', expect.objectContaining({ params: expect.objectContaining({ due: 'snoozed' }) })));
  });
  it('shows diagnostic coordination without exposing a clinical link to desk-only authority', async () => {
    const diagnostic = { ...task, kind: 'crm_diagnostic', orderId: 'order-reference', title: 'Coordinate diagnostic handoff' };
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: path === '/crm/locations' ? [] : path === '/crm/tasks/task' ? diagnostic : { items: [diagnostic], nextCursor: null } } }));
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    expect(await screen.findByText(/Clinical results and escalation are reviewed/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open canonical diagnostic order' })).not.toBeInTheDocument();
    cleanup();
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ['VIEW_CRM', 'MANAGE_CRM_TASKS', 'VIEW_EHR'] } });
    render(<CrmTaskWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    expect(await screen.findByRole('link', { name: 'Open canonical diagnostic order' })).toHaveAttribute('href', '/dashboard/laboratory?orderId=order-reference');
  });
});
