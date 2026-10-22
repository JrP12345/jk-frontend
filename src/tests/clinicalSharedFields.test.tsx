import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SOAPNoteEditor } from '@/components/clinical/SOAPNoteEditor';
import api from '@/lib/api';
import { ToastProvider } from '@/components/ui';

vi.mock('@/components/clinical/PreviousVisitsSidebar', () => ({ PreviousVisitsSidebar: () => null }));
vi.mock('@/components/clinical/UnifiedDocumentModal', () => ({ UnifiedDocumentModal: () => null }));
afterEach(() => { vi.restoreAllMocks(); });

describe('Shared clinical fields', () => {
  it('retains explicit prescriber quantity and base unit when a sealed note is displayed', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
    render(<ToastProvider><SOAPNoteEditor patientId='patient' locationId='branch' encounterId='encounter' initialNoteId='note'
      initialNoteData={{ status: 'signed', plan: { prescriptionIds: [{ medicineName: 'Reviewed medicine', dosage: 'As prescribed', duration: '30 days', authorizedQuantity: 30, authorizedBaseUnit: 'tablet' }] } }} /></ToastProvider>);
    expect(screen.getByRole('spinbutton', { name: 'Authorized quantity for Reviewed medicine' })).toHaveValue(30);
    expect(screen.getByRole('spinbutton', { name: 'Authorized quantity for Reviewed medicine' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Base unit for Reviewed medicine' })).toHaveTextContent('tablet');
    expect(screen.getByRole('combobox', { name: 'Base unit for Reviewed medicine' })).toBeDisabled();
  });
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
  it('bounds autocomplete queries without truncating the clinician’s medication text', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
    render(<ToastProvider><SOAPNoteEditor patientId='patient' locationId='branch' encounterId='encounter' /></ToastProvider>);
    const description = 'Long formulation '.repeat(10);
    const input = screen.getByRole('textbox', { name: 'Search medication catalog' });
    fireEvent.change(input, { target: { value: description } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/medicines?search=${encodeURIComponent(description.trim().slice(0, 100))}`));
    expect(input).toHaveValue(description);
  });
});
