import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { ToastProvider } from '@/components/ui/Toast';
import DisruptionTriageModal, { type TriageAppointment } from '@/components/dashboard/DisruptionTriageModal';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Disruption attendance review', () => {
  it('preserves recorded attendance and treats missing history as unknown rather than reading notes', async () => {
    const base = { locationId: 'branch', doctorId: 'doctor', appointmentTime: '2026-10-12T11:00:00Z', appointmentType: 'reception', status: 'disruption_triage', tokenNumber: 1, queuePosition: 1 };
    const rows: TriageAppointment[] = [
      { ...base, id: 'waiting', disruptionOriginalStatus: 'checked-in', patientId: { id: 'patient-one', name: 'Present canonical patient' } },
      { ...base, id: 'remote', disruptionOriginalStatus: 'confirmed', notes: 'Earlier checked-in visit discussed', patientId: { id: 'patient-two', name: 'Unarrived canonical patient' } },
      { ...base, id: 'legacy', notes: 'checked-in [TRIAGE: Doctor unavailable - awaiting reception action]', patientId: { id: 'patient-three', name: 'Legacy canonical patient' } },
    ];
    render(<ToastProvider><DisruptionTriageModal open onClose={vi.fn()} locationId="branch" date="2026-10-12" triageAppointments={rows} onActionComplete={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByRole('button', { name: /Waiting in Location \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remote \/ Pending \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Presence needs review for 1 visit/)).toBeInTheDocument();
    expect(screen.getByText('Legacy canonical patient')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Waiting in Location/ }));
    await waitFor(() => expect(screen.getByText('Present canonical patient')).toBeInTheDocument());
    expect(screen.queryByText('Unarrived canonical patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy canonical patient')).not.toBeInTheDocument();
    vi.spyOn(api, 'post').mockResolvedValue({ data: { data: { status: 'cancelled', paymentStatus: 'pending' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel / payment review' }));
    expect(screen.getByText(/Review the existing invoice and refund status/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/doctor-overrides/triage/cancel', expect.objectContaining({ appointmentId: 'waiting' })));
    expect(await screen.findByText('Appointment cancellation recorded')).toBeInTheDocument();
    expect(screen.queryByText(/Full refund processed/)).not.toBeInTheDocument();
  });
});
