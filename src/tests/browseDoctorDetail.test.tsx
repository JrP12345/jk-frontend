import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrowseDetailClient, { type ClinicDetail } from "../app/browse/[id]/BrowseDetailClient";
import api from "../lib/api";
import { ToastProvider } from "../components/ui/Toast";
import { useAuthStore } from "../store/authStore";

const route = vi.hoisted(() => ({ search: "doctorId=doctor-1" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.search),
}));
vi.mock("../components/MarketplaceNavbar", () => ({ default: () => null }));

const clinic: ClinicDetail = {
  id: "clinic-1", name: "Surat Clinic", city: "Surat", address: "", phone: "", email: "",
  description: "", image_url: "", timings: "", doctors: [
    { id: "doctor-1", name: "A very long doctor name Alpha", specialization: "General Medicine", qualification: "MBBS", experience_years: 5, fees: 300, timings: "", working_days: "", description: "", image_url: "", bookingMode: "time_slot" },
    { id: "doctor-2", name: "Beta", specialization: "Cardiology", qualification: "MD", experience_years: 9, fees: 500, timings: "", working_days: "", description: "", image_url: "", bookingMode: "time_slot" },
  ],
};

beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { route.search = "doctorId=doctor-1"; vi.restoreAllMocks(); useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }); });

describe("clinic detail and doctor booking links", () => {
  it("keeps the clinic page intact and links each doctor to a separate profile", () => {
    const view = render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getByRole("link", { name: "Back to clinics" })).toHaveAttribute("href", "/browse");
    expect(screen.getByText("Opening hours have not been listed. Contact the clinic to confirm them.")).toBeInTheDocument();
    expect(screen.queryByText("Hours unavailable")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View & share doctor profile" })[0]).toHaveAttribute("href", "/doctor/doctor-1?clinicId=clinic-1");
    route.search = "doctorId=doctor-2";
    view.rerender(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getAllByRole("link", { name: "View & share doctor profile" })[1]).toHaveAttribute("href", "/doctor/doctor-2?clinicId=clinic-1");
  });

  it("opens the existing booking flow for a deep-linked doctor and requests authoritative slots", async () => {
    route.search = "doctorId=doctor-1&openBooking=true";
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} /></ToastProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?clinicId=clinic-1&date=/), expect.anything()));
    expect(screen.getAllByText("Dr. A very long doctor name Alpha").length).toBeGreaterThan(1);
    const slot = await screen.findByRole("button", { name: "10:00 AM" });
    fireEvent.click(slot);
    expect(screen.getByText(/Selected:/)).toHaveTextContent("10:00 AM");
    const continueButton = screen.getByRole("button", { name: "Continue to Details" });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeInTheDocument();
  });

  it("books from the doctor page context without navigating to a clinic page", async () => {
    route.search = "";
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
    expect(screen.queryByRole("heading", { level: 1, name: "Surat Clinic" })).not.toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?clinicId=clinic-1&date=/), expect.anything()));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select Date & Time" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeEnabled();
  });

  it("checks later dates only when asked and selects an authoritative available slot", async () => {
    route.search = "";
    let slotRequests = 0;
    const request = vi.spyOn(api, "get").mockImplementation(async () => {
      slotRequests += 1;
      return { data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true, isLocked: slotRequests === 1 }] } } } as never;
    });
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
    const findNext = await screen.findByRole("button", { name: "Find next available appointment" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "10:00 AM" })).toBeDisabled();
    fireEvent.click(findNext);
    await waitFor(() => expect(screen.getByRole("button", { name: "10:00 AM" })).toBeEnabled());
    expect(screen.getByText(/Selected:/)).toHaveTextContent("10:00 AM");
    expect(screen.getByRole("button", { name: "Continue to Details" })).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("loads only the selected doctor's clinic context when server data is unavailable", async () => {
    route.search = "";
    const request = vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { data: clinic } })
      .mockResolvedValueOnce({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient id="clinic-1" bookingDoctorId="doctor-1" bookingOnly bookingName="Surat Clinic" /></ToastProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/clinics/clinic-1?doctorId=doctor-1", expect.anything()));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?clinicId=clinic-1&date=/), expect.anything()));
  });

  it("books for a linked family member from the inline doctor page", async () => {
    route.search = "";
    useAuthStore.setState({ user: { id: "patient-user", name: "Parent", email: "parent@example.com", role: "patient" }, isAuthenticated: true, isLoading: false });
    vi.spyOn(api, "get").mockImplementation(async (url) => url === "/family"
      ? { data: { data: [{ relationship: "child", patient: { id: "family-1", name: "Child" } }] } } as never
      : { data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } } as never);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { data: { _id: "appointment-1", status: "confirmed", paymentStatus: "pending", tokenNumber: 1 } } });
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "10:00 AM" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Details" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Who is this appointment for?" }));
    fireEvent.click(await screen.findByRole("option", { name: "Child (child)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ patientId: "family-1" })));
  });

  it("keeps a large clinic roster searchable without fetching availability", () => {
    route.search = "";
    const request = vi.spyOn(api, "get");
    const doctors = Array.from({ length: 15 }, (_, index) => ({ ...clinic.doctors[0], id: `doctor-${index}`, name: index === 14 ? "Unique Specialist" : `Doctor ${index}` }));
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={{ ...clinic, doctors }} /></ToastProvider>);
    expect(screen.getAllByRole("button", { name: "Check appointments" })).toHaveLength(12);
    fireEvent.change(screen.getByRole("textbox", { name: "Search doctors at this clinic" }), { target: { value: "Unique" } });
    expect(screen.getAllByRole("button", { name: "Check appointments" })).toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps the clinic usable when a stale doctor ID is in the URL", () => {
    route.search = "doctorId=former-doctor";
    render(<ToastProvider><BrowseDetailClient id="clinic-1" initialClinic={clinic} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getAllByRole("button", { name: "Check appointments" })).toHaveLength(2);
  });

  it("distinguishes a removed clinic from a temporary loading failure", async () => {
    vi.spyOn(api, "get").mockRejectedValue({ response: { status: 404 } });
    render(<ToastProvider><BrowseDetailClient id="removed-clinic" /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Clinic page unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse clinics" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
