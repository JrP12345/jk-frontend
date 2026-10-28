import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrowseDetailClient, { type LocationDetail } from "../app/browse/[slug]/BrowseDetailClient";
import api from "../lib/api";
import { ToastProvider } from "../components/ui/Toast";
import { useAuthStore } from "../store/authStore";

const route = vi.hoisted(() => ({ search: "doctor=doctor-1" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.search),
}));
vi.mock("../components/MarketplaceNavbar", () => ({ default: () => null }));

const location: LocationDetail = {
  id: "clinic-1", slug: "clinic-1", name: "Surat Clinic", city: "Surat", address: "", phone: "", email: "",
  description: "", image_url: "", timings: "", doctors: [
    { id: "doctor-1", slug: "doctor-1", name: "A very long doctor name Alpha", specialization: "General Medicine", qualification: "MBBS", experience_years: 5, fees: 300, timings: "", working_days: "", description: "", image_url: "", bookingMode: "time_slot" },
    { id: "doctor-2", slug: "doctor-2", name: "Beta", specialization: "Cardiology", qualification: "MD", experience_years: 9, fees: 500, timings: "", working_days: "", description: "", image_url: "", bookingMode: "time_slot" },
  ],
};

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  // Availability fixtures include today's 10:00 slot. Keep it in the future
  // regardless of when the suite runs; async browser timers remain real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T03:00:00.000Z"));
});
afterEach(() => { route.search = "doctor=doctor-1"; vi.useRealTimers(); vi.restoreAllMocks(); useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }); });

describe("clinic detail and doctor booking links", () => {
  it("keeps contact actions connected and copies the saved address", async () => {
    route.search = "";
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    try {
      render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, address: "204, Test Road", phone: "+91 98765 43210", email: "hello@example.test" }} /></ToastProvider>);
      expect(screen.getByRole("link", { name: "Call", exact: true })).toHaveAttribute("href", "tel:+919876543210");
      expect(screen.getByRole("link", { name: "hello@example.test" })).toHaveAttribute("href", "mailto:hello@example.test");
      expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("https://wa.me/919876543210?text="));
      fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("204, Test Road"));
      expect(await screen.findByText("Contact detail copied.")).toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); }
  });

  it("shows saved split and overnight hours without inventing missing days", () => {
    route.search = "";
    const timings = JSON.stringify({ Monday: [{ start: "09:00", end: "13:00" }, { start: "17:00", end: "20:00" }], Friday: [{ start: "22:00", end: "02:00" }] });
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, facilityType: "clinic", timings }} /></ToastProvider>);
    expect(screen.getByRole("region", { name: "Clinic opening hours" })).toBeVisible();
    expect(screen.getByText("9:00 AM – 1:00 PM, 5:00 PM – 8:00 PM")).toBeVisible();
    expect(screen.getByText("10:00 PM – 2:00 AM (next day)")).toBeVisible();
    expect(screen.getAllByText("Not listed")).toHaveLength(5);
  });

  it("keeps one directions action when no map has been configured", () => {
    route.search = "";
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, address: "Test Road" }} /></ToastProvider>);
    expect(screen.getAllByRole("link", { name: "Get directions to Surat Clinic in Google Maps" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Open Google Maps/ })).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("keeps next-date actions on the existing authoritative booking flow", async () => {
    route.search = "";
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    const closed = { ...location, doctors: location.doctors.map((doctor, index) => ({ ...doctor, isOnlineBookingClosed: index === 0 })) };
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={closed} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Find next date" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?locationId=clinic-1&date=/), expect.anything()));
    expect(screen.getByRole("dialog", { name: /Select Date/ })).toBeInTheDocument();
  });

  it("renders only an explicitly saved safe map as a lazy iframe", () => {
    route.search = "";
    const url = "https://www.google.com/maps/embed?pb=!1m18!2m3!1d0";
    const view = render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, googleMapsEmbedUrl: url }} /></ToastProvider>);
    expect(screen.getByTitle("Map of Surat Clinic")).toHaveAttribute("src", url);
    expect(screen.getByTitle("Map of Surat Clinic")).toHaveAttribute("loading", "lazy");
    view.rerender(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, googleMapsEmbedUrl: "https://evil.test/map" }} /></ToastProvider>);
    expect(screen.queryByTitle("Map of Surat Clinic")).not.toBeInTheDocument();
  });
  it("uses readable provider links and hides affiliation for one location", () => {
    route.search = "";
    const request = vi.spyOn(api, "get");
    const linked = { ...location, slug: "surat-clinic-link", amenities: ["Parking"], organizationLocationCount: 1, organization: { id: "org", name: "Care Organization" }, doctors: location.doctors.map((doctor, index) => ({ ...doctor, slug: `doctor-${index}-link` })) };
    const view = render(<ToastProvider><BrowseDetailClient slug={linked.slug} initialLocation={linked} /></ToastProvider>);
    expect(screen.getAllByRole("link", { name: /Dr\./ })[0]).toHaveAttribute("href", "/doctor/doctor-0-link?location=surat-clinic-link");
    expect(screen.queryByText(/Part of|Branch of/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Facilities & photos", { selector: "summary" }));
    expect(screen.getByText("Amenities (1)")).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    view.rerender(<ToastProvider><BrowseDetailClient slug={linked.slug} initialLocation={{ ...linked, organizationLocationCount: 2 }} /></ToastProvider>);
    expect(screen.getAllByText(/Part of|Branch of/).length).toBeGreaterThan(0);
  });

  it("uses resolved location IDs for availability when the page URL contains a slug", async () => {
    route.search = "doctor=doctor-1&openBooking=true";
    const linked = { ...location, slug: "surat-clinic-link" };
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient slug={linked.slug} initialLocation={linked} /></ToastProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?locationId=clinic-1&date=/), expect.anything()));
    expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  });
  it("keeps the clinic page intact and links each doctor to a separate profile", () => {
    const view = render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getByRole("heading", { level: 1 }).closest("section")).toHaveAccessibleName("Surat Clinic");
    expect(screen.getByRole("link", { name: "Browse locations" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About Surat Clinic" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Opening hours" })).toBeVisible();
    expect(screen.getByText("Opening hours have not been listed. Contact reception to confirm them.")).toBeInTheDocument();
    expect(screen.getByText("Hours unavailable")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Dr\./ })[0]).toHaveAttribute("href", "/doctor/doctor-1?location=clinic-1");
    route.search = "doctor=doctor-2";
    view.rerender(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getAllByRole("link", { name: /Dr\./ })[1]).toHaveAttribute("href", "/doctor/doctor-2?location=clinic-1");
  });

  it("opens the existing booking flow for a deep-linked doctor and requests authoritative slots", async () => {
    route.search = "doctor=doctor-1&openBooking=true";
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} /></ToastProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?locationId=clinic-1&date=/), expect.anything()));
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
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
    expect(screen.queryByRole("heading", { level: 1, name: "Surat Clinic" })).not.toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?locationId=clinic-1&date=/), expect.anything()));
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
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
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
      .mockResolvedValueOnce({ data: { data: location } })
      .mockResolvedValueOnce({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" bookingDoctorId="doctor-1" bookingOnly bookingName="Surat Clinic" /></ToastProvider>);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations/clinic-1", expect.anything()));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-1\/slots\?locationId=clinic-1&date=/), expect.anything()));
  });

  it("books for a linked family member from the inline doctor page", async () => {
    route.search = "";
    useAuthStore.setState({ user: { id: "patient-user", name: "Parent", email: "parent@example.com", role: "patient" }, isAuthenticated: true, isLoading: false });
    vi.spyOn(api, "get").mockImplementation(async (url) => url === "/family"
      ? { data: { data: [{ relationship: "child", patient: { id: "family-1", name: "Child" } }] } } as never
      : { data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } } as never);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { data: { _id: "appointment-1", status: "confirmed", paymentStatus: "pending", tokenNumber: 1 } } });
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} bookingDoctorId="doctor-1" bookingOnly /></ToastProvider>);
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
    const doctors = Array.from({ length: 15 }, (_, index) => ({ ...location.doctors[0], id: `doctor-${index}`, name: index === 14 ? "Unique Specialist" : `Doctor ${index}` }));
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, doctors }} /></ToastProvider>);
    expect(screen.getAllByRole("button", { name: "Book now" })).toHaveLength(12);
    fireEvent.change(screen.getByRole("textbox", { name: "Search doctors at this location" }), { target: { value: "Unique" } });
    expect(screen.getAllByRole("button", { name: "Book now" })).toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps the clinic usable when a stale doctor ID is in the URL", () => {
    route.search = "doctor=former-doctor";
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} /></ToastProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surat Clinic");
    expect(screen.getAllByRole("button", { name: "Book now" })).toHaveLength(2);
  });

  it("distinguishes a removed clinic from a temporary loading failure", async () => {
    vi.spyOn(api, "get").mockRejectedValue({ response: { status: 404 } });
    render(<ToastProvider><BrowseDetailClient slug="removed-clinic" /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Location page unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse locations" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("opens the selected doctor's authoritative booking flow from a redesigned row", async () => {
    route.search = "";
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] } } });
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={location} /></ToastProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Book now" })[1]);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/public\/doctors\/doctor-2\/slots\?locationId=clinic-1&date=/), expect.anything()));
    expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  });

  it("does not promise booking, facilities or reviews when the public data does not support them", () => {
    route.search = "";
    render(<ToastProvider><BrowseDetailClient slug="clinic-1" initialLocation={{ ...location, onlineBookingAvailable: false, bookingStatus: "contact_location" }} /></ToastProvider>);
    expect(screen.queryByRole("tab", { name: "Facilities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Reviews" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book now" })).not.toBeInTheDocument();
    screen.getAllByRole("button", { name: "Contact reception" }).forEach(button => expect(button).toBeDisabled());
  });
});
