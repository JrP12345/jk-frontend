import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentCalendarView } from "../components/clinical/AppointmentCalendarView";
import { localDateKey, todayRangeParams } from "../lib/date";
import BrowseClient from "../app/browse/BrowseClient";
import api from "../lib/api";

const routePush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routePush }) }));
vi.mock("../components/MarketplaceNavbar", () => ({ default: () => null }));
const detectLocation = vi.hoisted(() => vi.fn());
vi.mock("../lib/geo/locationDetector", async importOriginal => ({ ...await importOriginal<typeof import("../lib/geo/locationDetector")>(), detectUserLocation: detectLocation }));

beforeEach(() => {
  detectLocation.mockResolvedValue(null);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // jsdom does not implement the browser scrolling API used by Select.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); routePush.mockClear(); sessionStorage.clear(); });

describe("Mobile calendar and browse loading", () => {
  it("prioritizes nearby locations across cities and keeps the same origin on subsequent pages", async () => {
    detectLocation.mockResolvedValue({ city: "Surat", state: "Gujarat", source: "ip", latitude: 21.17, longitude: 72.83 });
    const base = { address: "", phone: "", email: "", description: "", image_url: "", timings: "" };
    const near = { ...base, id: "near", name: "Nearby across town", city: "Other town", distanceKm: 5, rating: 2 };
    const further = { ...base, id: "further", name: "Next distance band", city: "Surat", distanceKm: 15, rating: 5 };
    const request = vi.spyOn(api, "get").mockResolvedValueOnce({ data: { data: [near] }, headers: { "x-next-cursor": "near-page" } })
      .mockResolvedValueOnce({ data: { data: [further] }, headers: { "x-next-cursor": "" } });
    render(<BrowseClient initialLoaded />);
    expect(await screen.findByText("Within 10 km (approx.)")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(1, "/public/locations?sort=nearby&latitude=21.17&longitude=72.83", expect.anything());
    expect(screen.getByRole("combobox", { name: "Filter by location" })).toHaveTextContent("All Cities");
    expect(screen.getByText("Approximate area:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more locations" }));
    expect(await screen.findByText("Within 20 km (approx.)")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(2, "/public/locations?sort=nearby&cursor=near-page&latitude=21.17&longitude=72.83", expect.anything());
    expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual([near.name, further.name]);
  });

  it("opens a readable daily agenda on phones", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<AppointmentCalendarView appointments={[]} />);
    expect(screen.getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No appointments scheduled for this day.")).toBeInTheDocument();
  });
  it("moves from January 31 to February without skipping a month and aligns February to its weekday", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 0, 31, 12));
    render(<AppointmentCalendarView appointments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "month" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("February 2026")).toBeInTheDocument();
    const first = screen.getByText("1");
    const cell = first.parentElement!.parentElement!;
    expect(Array.from(cell.parentElement!.children).indexOf(cell)).toBe(13);
  });
  it("offers only rating and fee sorts and requests fee ranking across the directory", async () => {
    const locations = [{ id: "b", name: "Zeta Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", minFee: 500 }, { id: "a", name: "Alpha Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", minFee: 100 }];
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [locations[1], locations[0]] } });
    render(<BrowseClient initialLocations={locations} initialLoaded />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort locations by" }));
    expect(await screen.findByRole("option", { name: "Top rated" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /featured|name|city/i })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Lowest fee" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Alpha Clinic", "Zeta Clinic"]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?sort=fee_low", expect.anything()));
  });
  it("uses actual specialties and keeps full-directory cities/care choices after empty filtering", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    render(<BrowseClient initialLoaded initialLocations={[{ id: "a", name: "Existing Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", specialties: ["General Physician / Consultant"] }]} initialFilters={{ cities: ["Surat", "Valsad"], specialties: ["Cardiology", "General Physician / Consultant"] }} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by specialty" }));
    expect(screen.queryByRole("option", { name: "Pediatrics" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Cardiology" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?specialization=Cardiology&sort=rating", expect.anything()));
    expect(await screen.findByText("No locations found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by specialty" }));
    expect(screen.getByRole("option", { name: "General Physician / Consultant" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by location" }));
    expect(await screen.findByRole("option", { name: "Valsad" })).toBeInTheDocument();
  });
  it("defaults to real ratings with unrated locations last", () => {
    const base = { city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "" };
    render(<BrowseClient initialLoaded initialLocations={[
      { ...base, id: "none", name: "Unrated", rating: null },
      { ...base, id: "low", name: "Lower Rated", rating: 3 },
      { ...base, id: "high", name: "Higher Rated", rating: 4.8 },
    ]} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Higher Rated", "Lower Rated", "Unrated"]);
  });
  it("loads the next cursor page without replacing locations already shown", async () => {
    const base = { city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "" };
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [{ ...base, id: "b", name: "Second Clinic" }] }, headers: { "x-next-cursor": "" } });
    render(<BrowseClient initialLoaded initialNextCursor="next-page" initialLocations={[{ ...base, id: "a", name: "First Clinic" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more locations" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?sort=rating&cursor=next-page", expect.anything()));
    expect(screen.getByRole("link", { name: "First Clinic" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Second Clinic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more locations" })).not.toBeInTheDocument();
  });
  it("restores discovery after opening a clinic and returning", async () => {
    const location = { id: "a", name: "Surat Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "" };
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [location] } });
    const first = render(<BrowseClient initialLoaded initialLocations={[location]} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search by doctor, location name, or specialty" }), { target: { value: "heart" } });
    fireEvent.click(screen.getByRole("group"));
    first.unmount();
    render(<BrowseClient initialLoaded initialLocations={[location]} />);
    expect(screen.getByRole("textbox", { name: "Search by doctor, location name, or specialty" })).toHaveValue("heart");
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?search=heart&sort=rating", expect.anything()));
  });
  it("links directly to a single doctor's booking page without navigating through the clinic card", () => {
    const location = { id: "clinic-1", slug: "clinic-1", name: "Surat Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", doctorCount: 1, doctorsSummary: [{ id: "doctor-1", slug: "doctor-1", name: "Rajesh", specialization: "General Medicine", fees: 300 }] };
    render(<BrowseClient initialLoaded initialLocations={[location]} />);
    const doctorLink = screen.getByRole("link", { name: /Rajesh/ });
    expect(doctorLink).toHaveAttribute("href", "/doctor/doctor-1?location=clinic-1");
    doctorLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(doctorLink);
    expect(routePush).not.toHaveBeenCalled();
    const bookingLink = screen.getByRole("link", { name: "Book Appointment" });
    expect(bookingLink).toHaveAttribute("href", "/doctor/doctor-1?location=clinic-1&openBooking=true");
    bookingLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(bookingLink);
    expect(routePush).not.toHaveBeenCalled();
  });
  it("routes paused and doctorless locations to their contact page without promising an appointment", () => {
    const base = { city: "Surat", address: "Clinic Road", phone: "9876543210", email: "", description: "", image_url: "", timings: "" };
    render(<BrowseClient initialLoaded initialLocations={[
      { ...base, id: "paused", slug: "paused", name: "Paused Clinic", doctorCount: 1, bookingStatus: "contact_location", onlineBookingAvailable: false, doctorsSummary: [{ id: "doctor-1", slug: "doctor-1", name: "Rajesh", specialization: "Medicine", fees: 300 }] },
      { ...base, id: "empty", slug: "empty", name: "New Clinic", doctorCount: 0, bookingStatus: "no_doctors", onlineBookingAvailable: true, doctorsSummary: [] },
    ]} />);
    expect(screen.getByRole("link", { name: "Call reception about appointments" })).toHaveAttribute("href", "tel:9876543210");
    expect(screen.getByRole("link", { name: "View location" })).toHaveAttribute("href", "/browse/empty");
  });
  it("offers retry after a failed load instead of reporting an empty clinic directory", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ data: { data: [] } });
    render(<BrowseClient />);
    expect(await screen.findByText("We couldn't load locations")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Sort locations by" })).not.toBeInTheDocument();
    expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("We couldn't load locations")).not.toBeInTheDocument());
    expect(await screen.findByText("No locations found")).toBeInTheDocument();
  });
  it("rejects a malformed response instead of displaying a successful empty result", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { unexpected: true } } });
    render(<BrowseClient />);
    expect(await screen.findByText("We couldn't load locations")).toBeInTheDocument();
    expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
  });
  it("keeps previous locations visible when a filtered refresh fails", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("Offline"));
    render(<BrowseClient initialLoaded initialLocations={[{ id: "a", name: "Existing Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "" }]} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search by doctor, location name, or specialty" }), { target: { value: "new query" } });
    expect(await screen.findByText("Unable to update results")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Existing Clinic" })).toBeInTheDocument();
    expect(screen.getByText("Previous locations shown. Results could not be updated.")).toBeInTheDocument();
    expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
  });
  it("uses the local day rather than the UTC date for today's boundaries", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 0, 15));
    expect(localDateKey()).toBe("2026-09-26");
    const params = new URLSearchParams(todayRangeParams());
    expect(new Date(params.get("startDate")!).getHours()).toBe(0);
    expect(new Date(params.get("endDate")!).getHours()).toBe(23);
  });
});
