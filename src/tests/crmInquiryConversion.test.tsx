import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { InquiryConversion } from "@/components/crm/InquiryConversion";
import type { Inquiry } from "@/types/crm";

const patientId = "1234567890abcdef12345678", doctorId = "abcdef123456789012345678";
const inquiry = { id: "inquiry", locationId: "branch", patientId, callerName: "Caller", phone: "9876543210", email: "", revision: 2 } as Inquiry;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "staff", name: "Staff", email: "staff@example.test", role: "receptionist", organization_id: "org", permissions: ["VIEW_CRM", "MANAGE_APPOINTMENTS", "MANAGE_PATIENTS"] }, isAuthenticated: true });
  vi.spyOn(api, "get").mockImplementation(async path => ({ data: { data: String(path).includes("assignments") ? [{ doctorId: { id: doctorId, name: "Doctor" }, bookingMode: "sequential_queue", paymentRequired: true }] : { slots: [], isHoliday: false } } }));
  vi.spyOn(api, "post").mockResolvedValue({ data: { data: { appointment: { id: "booking", status: "pending_payment", paymentStatus: "pending", tokenNumber: 2 } } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function ready() {
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/doctors/${doctorId}/slots`, expect.anything()));
  fireEvent.change(screen.getByLabelText("Booking time (Asia/Kolkata)"), { target: { value: "2026-10-10T17:30" } });
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Convert to booking" })).toBeEnabled());
}
describe("Inquiry conversion", () => {
  it("books the fixed canonical task patient through the task endpoint", async () => {
    const onConverted = vi.fn();
    render(<InquiryConversion task={{ id: 'task', locationId: 'branch', patientId, revision: 4 }} timezone="Asia/Kolkata" onClose={vi.fn()} onConverted={onConverted} />);
    expect(screen.getByLabelText('Canonical patient reference')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Find existing patient by name or contact')).not.toBeInTheDocument();
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Convert to booking' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/crm/tasks/task/convert', expect.objectContaining({ patientId, expectedRevision: 4, identityVerified: true })));
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('patientDetails');
  });
  it("requires explicit identity review, uses branch time and returns a payment-pending result", async () => {
    const onConverted = vi.fn();
    render(<InquiryConversion inquiry={inquiry} timezone="Asia/Kolkata" onClose={vi.fn()} onConverted={onConverted} />);
    expect(screen.getByRole("button", { name: "Convert to booking" })).toBeDisabled();
    await ready();
    expect(screen.getByText(/recorded booking will remain payment pending/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Convert to booking" }));
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(expect.objectContaining({ appointment: expect.objectContaining({ status: "pending_payment" }) })));
    expect(api.post).toHaveBeenCalledWith("/crm/inquiries/inquiry/convert", expect.objectContaining({ expectedRevision: 2, patientId, doctorId, identityVerified: true, appointmentTime: "2026-10-10T12:00:00.000Z" }));
  });
  it("locks submitted identity and time on a lost response and retries the same command", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("lost response"));
    render(<InquiryConversion inquiry={inquiry} timezone="Asia/Kolkata" onClose={vi.fn()} onConverted={vi.fn()} />);
    await ready(); fireEvent.click(screen.getByRole("button", { name: "Convert to booking" }));
    await screen.findByText(/booking result could not be confirmed/);
    expect(screen.getByText(/booking result could not be confirmed/).closest('[role="alert"]')?.parentElement).toHaveFocus();
    expect(screen.getByLabelText("Canonical patient reference")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry submitted conversion" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[0][1]);
  });
  it('restores an immutable submitted command even when current availability has changed', async () => {
    const command = { clientRequestId: 'original-key', expectedRevision: 2, patientId, doctorId, appointmentTime: '2026-10-10T12:00:00.000Z', identityVerified: true };
    vi.mocked(api.get).mockRejectedValue(new Error('availability unavailable'));
    render(<InquiryConversion inquiry={inquiry} timezone='Asia/Kolkata' initialCommand={command} onClose={vi.fn()} onConverted={vi.fn()} />);
    expect(screen.getByLabelText('Booking time (Asia/Kolkata)')).toHaveValue('2026-10-10T17:30');
    expect(screen.getByLabelText('Canonical patient reference')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted conversion' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/crm/inquiries/inquiry/convert', command));
  });
  it("reserves a canonical time slot once and preserves its lock across a conversion retry", async () => {
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes("assignments") ? [{ doctorId: { id: doctorId, name: "Doctor" }, bookingMode: "time_slot" }] : { slots: [{ time: "17:30", available: true }], isHoliday: false } } }));
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { lockId: "canonical-lock" } } }).mockRejectedValueOnce(new Error("lost response"));
    render(<InquiryConversion inquiry={inquiry} timezone="Asia/Kolkata" onClose={vi.fn()} onConverted={vi.fn()} />);
    await screen.findByRole("combobox", { name: "Available consultation slot" });
    fireEvent.change(screen.getByLabelText("Booking time (Asia/Kolkata)"), { target: { value: "2026-10-10T17:30" } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Available consultation slot" })).toBeEnabled());
    fireEvent.click(screen.getByRole("combobox", { name: "Available consultation slot" }));
    fireEvent.click(await screen.findByRole("option", { name: "17:30" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Convert to booking" }));
    await screen.findByText(/booking result could not be confirmed/);
    fireEvent.click(screen.getByRole("button", { name: "Retry submitted conversion" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(["/appointments/lock-slot", { locationId: "branch", doctorId, slotTime: "2026-10-10T12:00:00.000Z" }]);
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[2][1]);
    expect(vi.mocked(api.post).mock.calls[1][1]).toMatchObject({ lockId: "canonical-lock" });
  });
});
