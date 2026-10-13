import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SOAPNoteEditor } from '@/components/clinical/SOAPNoteEditor';
import api from '@/lib/api';
import { ToastProvider } from '@/components/ui';

vi.mock('@/components/clinical/PreviousVisitsSidebar', () => ({ PreviousVisitsSidebar: () => null }));
vi.mock('@/components/clinical/UnifiedDocumentModal', () => ({ UnifiedDocumentModal: () => null }));
afterEach(() => { vi.restoreAllMocks(); });

describe('Shared clinical fields', () => {
  it('keeps signed clinical notes disabled and displays only recorded findings', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
    render(<ToastProvider><SOAPNoteEditor patientId='patient' locationId='branch' encounterId='encounter'
      initialNoteId='note' initialNoteData={{ status: 'signed', subjective: { chiefComplaint: 'Recorded complaint' },
        objective: { physicalExamination: 'Recorded examination' }, assessment: { diagnoses: [] }, plan: {} }} /></ToastProvider>);
    expect(screen.getByRole('textbox', { name: 'Chief Complaint *' })).toHaveValue('Recorded complaint');
    expect(screen.getByRole('textbox', { name: 'Chief Complaint *' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Physical Examination Notes' })).toHaveValue('Recorded examination');
    expect(screen.getByRole('textbox', { name: 'Physical Examination Notes' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Temp (°F)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Medication dosage' })).toBeDisabled();
  });
  it('retains editable draft values and fractional-temperature validation', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
    render(<ToastProvider><SOAPNoteEditor patientId='patient' locationId='branch' encounterId='encounter' /></ToastProvider>);
    const complaint = screen.getByRole('textbox', { name: 'Chief Complaint *' });
    fireEvent.change(complaint, { target: { value: 'Reviewed complaint' } });
    expect(complaint).toHaveValue('Reviewed complaint');
    const temperature = screen.getByRole('spinbutton', { name: 'Temp (°F)' });
    expect(temperature).toHaveAttribute('step', '0.1');
    fireEvent.change(temperature, { target: { value: '98.6' } });
    expect(temperature).toHaveValue(98.6);
  });
});
