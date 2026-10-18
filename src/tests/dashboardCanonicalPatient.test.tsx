import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardAppointmentsQueue } from '@/components/dashboard/DashboardAppointmentsQueue';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
describe('Canonical patient in the operational roster', () => {
  it('shows loading before declaring the roster empty', () => {
    render(<DashboardAppointmentsQueue appointments={[]} loading user={{ role: 'admin', permissions: ['VIEW_APPOINTMENTS'] }} canViewOpsDashboard onUpdateStatus={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading appointments' })).toBeInTheDocument();
    expect(screen.queryByText('No Active Bookings')).not.toBeInTheDocument();
  });
  it('identifies a minimum-registration patient without requiring a login account', () => {
    render(<DashboardAppointmentsQueue appointments={[{ id: 'visit', appointmentTime: new Date().toISOString(), patientId: { id: 'canonical-patient', name: 'Minimum registered person' }, doctorId: { name: 'Clinician' }, status: 'pending_payment', tokenNumber: 1 }]} loading={false} user={{ role: 'admin', permissions: ['VIEW_APPOINTMENTS'] }} canViewOpsDashboard onUpdateStatus={vi.fn()} />);
    expect(screen.getAllByText('Minimum registered person').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Patient Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Self')).not.toBeInTheDocument();
  });
  it('retains the recorded account-backed patient name in the patient roster', () => {
    render(<DashboardAppointmentsQueue appointments={[{ id: 'visit', appointmentTime: new Date().toISOString(), patientId: { id: 'canonical-patient', userId: { name: 'Recorded patient' } }, doctorId: { name: 'Clinician' }, status: 'confirmed', tokenNumber: 1 }]} loading={false} user={{ role: 'patient', permissions: [] }} canViewOpsDashboard={false} onUpdateStatus={vi.fn()} />);
    expect(screen.getAllByText('Recorded patient').length).toBeGreaterThanOrEqual(2);
  });
});
