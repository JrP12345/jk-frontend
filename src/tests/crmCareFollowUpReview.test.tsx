import { datePickerInput } from "./datePickerTestUtils";
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { CareFollowUpReview } from '@/components/crm/CareFollowUpReview';
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); vi.spyOn(api, 'post').mockResolvedValue({ data: { data: {} } }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Care follow-up review', () => {
  it('requires recorded evidence and converts clarified branch time without creating a booking', async () => {
    const saved = vi.fn();
    render(<CareFollowUpReview task={{ id: 'task', revision: 3, followUpReview: 'ambiguous' }} timezone='Asia/Kolkata' onClose={vi.fn()} onSaved={saved} />);
    expect(screen.getByRole('button', { name: 'Save follow-up review' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Administrative review evidence'), { target: { value: 'Patient reviewed clinician timing' } });
    fireEvent.change(datePickerInput(screen.getByLabelText('Clarified follow-up date (Asia/Kolkata)')), { target: { value: '2026-10-11T17:30' } });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Save follow-up review' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/crm/tasks/task/review-follow-up', expect.objectContaining({ expectedRevision: 3, decision: 'recommendation', dueAt: '2026-10-11T12:00:00.000Z', identityVerified: true })));
    expect(saved).toHaveBeenCalledOnce();
  });
  it('retains a lost legacy review response as the exact command without a fabricated payment status', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('lost response'));
    render(<CareFollowUpReview task={{ id: 'legacy', revision: 0, followUpReview: 'legacy' }} timezone='Asia/Kolkata' onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/Cancel an unwanted active booking/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Administrative review evidence'), { target: { value: 'Patient reviewed existing booking' } });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Save follow-up review' }));
    await screen.findByText(/review result could not be confirmed/);
    expect(screen.getByLabelText('Administrative review evidence')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted follow-up review' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('paymentStatus');
  });
});
