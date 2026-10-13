import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { AppointmentLinkSummary } from "@/components/appointments/AppointmentLinkSummary";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("appointmentId=1234567890abcdef12345678") }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Canonical booking link", () => {
  it("loads the linked appointment through its scoped administrative view and preserves pending payment", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { id: "booking", status: "pending_payment", paymentStatus: "pending", tokenNumber: 7, appointmentTime: "2026-10-10T12:00:00Z", locationName: "Branch", doctorName: "Doctor" } } });
    render(<AppointmentLinkSummary />);
    expect(await screen.findByText(/Payment is still required before confirmation/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/appointments/1234567890abcdef12345678", expect.objectContaining({ params: { view: "administrative" } }));
  });
  it("shows an access/read failure without claiming an empty or confirmed booking", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("denied"));
    render(<AppointmentLinkSummary />);
    await waitFor(() => expect(screen.getByText(/could not be loaded in the current workspace/)).toBeInTheDocument());
    expect(screen.queryByText(/Booking:/)).not.toBeInTheDocument();
  });
});
