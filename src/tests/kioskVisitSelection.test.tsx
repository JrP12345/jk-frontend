import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Kiosk from "@/app/check-in/page";

const fixture = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), toast: vi.fn(), fetchClinics: vi.fn(),
  user: { id: "staff", role: "root", permissions: [] } as any,
}));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/clinicStore", () => ({ useClinicStore: () => ({
  clinics: [{ id: "clinic", name: "Fixture clinic" }], activeClinicId: "clinic", fetchClinics: fixture.fetchClinics,
}) }));
vi.mock("@/components/ui", async importOriginal => ({
  ...await importOriginal<typeof import("@/components/ui")>(),
  useToast: () => ({ toast: fixture.toast }), ModeSwitcher: () => null,
}));
afterEach(() => { cleanup(); fixture.get.mockReset(); fixture.post.mockReset(); fixture.user = { id: "staff", role: "root", permissions: [] }; });

describe("Staff kiosk visit selection", () => {
  it("scopes a phone lookup to today's clinic and waits for staff to select the matching visit", async () => {
    fixture.get.mockResolvedValue({ headers: { "x-total-pages": "1" }, data: { data: [
      { id: "first", tokenNumber: 1, status: "confirmed", clinicId: "clinic", doctorId: { name: "One" }, patientId: { name: "Alex One" }, appointmentTime: new Date().toISOString() },
      { id: "second", tokenNumber: 2, status: "confirmed", clinicId: "clinic", doctorId: { name: "Two" }, patientId: { name: "Alex Two" }, appointmentTime: new Date().toISOString() },
    ] } });
    fixture.post.mockResolvedValue({ data: { data: { patientName: "Alex Two", tokenNumber: 2, doctorName: "Two", clinicName: "Fixture clinic", status: "checked-in" } } });
    render(<Kiosk />);
    fireEvent.click(screen.getByRole("button", { name: "By Phone Number" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 9876543210"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /Find today/ }));
    await screen.findByRole("button", { name: /Token #2/ });
    expect(fixture.get.mock.calls[0][0]).toMatch(/clinicId=clinic&date=\d{4}-\d{2}-\d{2}/);
    expect(fixture.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Token #2/ }));
    await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/check-in/qr", { appointmentId: "second", clinicId: "clinic", tokenNumber: 2 }));
  });

  it("shows staff sign-in guidance instead of a working kiosk form to anonymous patients", () => {
    fixture.user = null;
    render(<Kiosk />);
    expect(screen.getByRole("link", { name: "Staff sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "By Phone Number" })).not.toBeInTheDocument();
    expect(fixture.get).not.toHaveBeenCalled();
  });
});
