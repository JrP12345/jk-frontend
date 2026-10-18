import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConsultationsPage from '@/app/(dashboard)/dashboard/consultations/page';
import { ToastProvider } from '@/components/ui';

const fixture = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: { get: fixture.get, put: fixture.put } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'doctor', role: 'doctor', organization_id: 'org', permissions: ['MANAGE_CLINICAL_NOTES', 'MANAGE_APPOINTMENTS'] } }) }));
vi.mock('@/store/locationStore', () => ({ useLocationStore: () => ({ activeLocationId: 'branch' }) }));
vi.mock('@/hooks/useWorkflowPreferences', () => ({ useWorkflowPreferences: () => ({ preferences: { registration: 'full', consultation: 'full' }, loading: false }) }));
afterEach(() => { vi.clearAllMocks(); });

describe('Consultation arrival confirmation', () => {
  it('leaves the visit unchanged on cancel and preserves ordered arrival/start writes on confirmation', async () => {
    fixture.get.mockImplementation(async path => ({ data: { data: String(path).startsWith('/appointments')
      ? [{ id: 'visit', tokenNumber: 8, status: 'confirmed', appointmentTime: new Date().toISOString(),
        patientId: { id: 'patient', name: 'Recorded patient' }, doctorId: { id: 'doctor', name: 'Recorded doctor' } }]
      : String(path).includes('/staff') ? { doctors: [] }
      : String(path).includes('/daily-summary') ? { appointments: 1, byStatus: { confirmed: 1 } } : [] } }));
    fixture.put.mockResolvedValue({ data: { data: {} } });
    render(<ToastProvider><ConsultationsPage /></ToastProvider>);
    fireEvent.click(await screen.findByRole('tab', { name: /^All/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start consultation' }));
    await screen.findByRole('dialog', { name: 'Confirm patient arrival' });
    expect(fixture.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(fixture.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start consultation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark arrival and start' }));
    await waitFor(() => expect(fixture.push).toHaveBeenCalledWith('/dashboard/consultations/visit'));
    expect(fixture.put.mock.calls).toEqual([
      ['/appointments/visit/status', { status: 'checked-in' }],
      ['/appointments/visit/status', { status: 'in-consultation' }],
    ]);
  });
});
