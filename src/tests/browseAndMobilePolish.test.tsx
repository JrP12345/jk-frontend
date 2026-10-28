import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { AppointmentCalendarView } from "../components/clinical/AppointmentCalendarView";
import { localDateKey, todayRangeParams } from "../lib/date";
import BrowseClient from "../app/browse/BrowseClient";
import type { BrowseMapProps } from "../app/browse/BrowseMap";
import api from "../lib/api";

const routePush = vi.hoisted(() => vi.fn());
const detectLocation = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routePush }) }));
vi.mock("../lib/geo/locationDetector", async original => ({ ...await original<typeof import("../lib/geo/locationDetector")>(), detectUserLocation: detectLocation }));
vi.mock("../components/MarketplaceNavbar", () => ({ default: ({ searchSlot }: { searchSlot?: ReactNode }) => <header>{searchSlot}</header> }));
vi.mock("next/dynamic", () => ({ default: () => function MapFixture(props: BrowseMapProps) {
  return <section aria-label="Map of healthcare locations">{props.locations.map(location => <button key={location.id} onClick={() => props.onSelect(location.id)}>Pin {location.name}</button>)}<p>Selected {props.selectedId}</p><button onClick={() => props.onSearchArea([20, 70, 22, 74])}>Search this area</button></section>;
} }));

beforeEach(() => {
  detectLocation.mockResolvedValue(null);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); routePush.mockClear(); sessionStorage.clear(); });
const base = { city: "Surat", address: "Clinic Road", phone: "9876543210", email: "", description: "", image_url: "", timings: "", specialties: ["Cardiology"] };
const clinic = { ...base, id: "a", slug: "surat-clinic", name: "Surat Clinic", latitude: 21.17, longitude: 72.83 };
async function mount(props: ComponentProps<typeof BrowseClient> = {}) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<BrowseClient {...props} />); });
  return view;
}
function headings() { return within(screen.getByRole("list", { name: "Healthcare locations" })).getAllByRole("heading", { level: 2 }).map(node => node.textContent); }

describe("Responsive facility directory behavior", () => {
  it("uses an explicit navbar query instead of saved filters", async () => {
    sessionStorage.setItem("ekavyu_browse_discovery", JSON.stringify({ search: "old", city: "Old city", specialties: ["Cardiology"], sort: "rating", scrollY: 0 }));
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    await mount({ initialSearch: "family care" });
    expect(screen.getByRole("searchbox")).toHaveValue("family care");
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?search=family+care&sort=rating", expect.anything()));
    expect(screen.queryByText("Old city")).not.toBeInTheDocument();
  });
  it("ranks nearby results across cities and retains the origin on the next page", async () => {
    detectLocation.mockResolvedValue({ city: "Surat", state: "Gujarat", source: "ip", latitude: 21.17, longitude: 72.83 });
    const request = vi.spyOn(api, "get").mockResolvedValueOnce({ data: { data: [{ ...clinic, distanceKm: 5 }] }, headers: { "x-next-cursor": "next" } }).mockResolvedValueOnce({ data: { data: [{ ...clinic, id: "b", name: "Other town", distanceKm: 15 }] } });
    await mount({ initialLoaded: true });
    expect(await screen.findByText(/Within 10 km/)).toBeInTheDocument();
    expect(screen.getByText("Near Surat (approx.)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more locations" }));
    expect(await screen.findByText("Other town")).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith("/public/locations?sort=nearby&cursor=next&latitude=21.17&longitude=72.83", expect.anything());
  });
  it("recovers from a distance failure without losing selected specialties", async () => {
    detectLocation.mockResolvedValue({ source: "ip", city: "Surat", latitude: 21.17, longitude: 72.83 });
    sessionStorage.setItem("ekavyu_browse_discovery", JSON.stringify({ search: "heart", city: "Surat", specialties: ["Cardiology"], sort: "nearby", scrollY: 0 }));
    const request = vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Distance unavailable")).mockResolvedValue({ data: { data: [clinic] } });
    await mount({ initialLoaded: true, initialFilters: { cities: ["Surat"], specialties: ["Cardiology"] } });
    expect(await screen.findByText(/Distance sorting is temporarily unavailable/)).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith("/public/locations?search=heart&city=Surat&specialization=Cardiology&sort=rating", expect.anything());
    expect(screen.getByRole("checkbox", { name: "Cardiology" })).toBeChecked();
  });
  it("keeps multiple specialties and opening filters in the authoritative request", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    await mount({ initialLoaded: true, initialFilters: { cities: ["Surat"], specialties: ["Cardiology", "Dermatology"], specialtyCounts: { Cardiology: 2, Dermatology: 1 } } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiology" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Dermatology" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Open now" }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/public/locations?specialization=Cardiology&specialization=Dermatology&sort=rating&openNow=true", expect.anything()));
    expect(screen.getByRole("checkbox", { name: "Dermatology" })).toBeChecked();
    expect(screen.getAllByTitle("Facilities in the public directory").map(node => node.textContent)).toEqual(["2", "1"]);
    expect(await screen.findByText("No locations found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all", exact: true }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/public/locations?sort=rating", expect.anything()));
  });
  it("keeps city choices and the same filters in the mobile sheet", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    await mount({ initialLoaded: true, initialFilters: { cities: ["Surat", "Valsad"], specialties: ["Cardiology"] } });
    fireEvent.click(screen.getByRole("button", { name: "Filters", exact: true }));
    const dialog = screen.getByRole("dialog", { name: "Filter locations" });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Cardiology" }));
    fireEvent.click(within(dialog).getByRole("combobox", { name: "City" }));
    fireEvent.click(screen.getByRole("option", { name: "Valsad" }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/public/locations?city=Valsad&specialization=Cardiology&sort=rating", expect.anything()));
    fireEvent.click(within(dialog).getByRole("button", { name: "Show results" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("keeps rating and fee ranking without inventing displayed reviews", async () => {
    const rows = [{ ...clinic, name: "No feedback", rating: 5, reviewsCount: 0, minFee: 500 }, { ...clinic, id: "b", name: "Recorded feedback", rating: 4.2, reviewsCount: 8, minFee: 100 }];
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: rows } });
    await mount({ initialLoaded: true, initialLocations: rows });
    expect(headings()).toEqual(["Recorded feedback", "No feedback"]);
    expect(screen.queryByText("4.2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Lowest fee" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/public/locations?sort=fee_low", expect.anything()));
    expect(headings()).toEqual(["Recorded feedback", "No feedback"]);
  });
  it("loads cursor pages without replacing results or appending duplicates", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [clinic, { ...clinic, id: "b", name: "Second Clinic" }] } });
    await mount({ initialLoaded: true, initialLocations: [clinic], initialNextCursor: "next" });
    fireEvent.click(screen.getByRole("button", { name: "Load more locations" }));
    expect(await screen.findByText("Second Clinic")).toBeInTheDocument();
    expect(headings()).toEqual(["Surat Clinic", "Second Clinic"]);
  });
  it("restores discovery when returning from a facility", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [clinic] } });
    const first = await mount({ initialLoaded: true, initialLocations: [clinic] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "heart" } });
    const link = screen.getByRole("link", { name: "Surat Clinic" });
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    first.unmount();
    await mount({ initialLoaded: true, initialLocations: [clinic] });
    expect(screen.getByRole("searchbox")).toHaveValue("heart");
  });
  it("keeps facility navigation separate from clinician evaluation and directions", async () => {
    await mount({ initialLoaded: true, initialLocations: [{ ...clinic, facilityType: "hospital", onlineBookingAvailable: false, doctorsSummary: [{ id: "doc", name: "Asha", specialization: "Cardiology", fees: 500 }] }] });
    expect(screen.getByRole("link", { name: "View hospital" })).toHaveAttribute("href", "/browse/surat-clinic");
    expect(screen.getByRole("link", { name: /Call Surat Clinic/ })).toHaveAttribute("href", "tel:9876543210");
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.queryByText("₹500")).not.toBeInTheDocument();
  });
  it("switches views without a new directory request and keeps map selection state", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    await mount({ initialLoaded: true, initialLocations: [clinic, { ...clinic, id: "b", name: "Other Clinic" }] });
    fireEvent.click(within(screen.getByRole("group", { name: "Browse view" })).getByRole("button", { name: "Map" }));
    const map = screen.getByRole("region", { name: "Map of healthcare locations" });
    fireEvent.click(within(map).getByRole("button", { name: "Pin Other Clinic" }));
    expect(within(map).getByText("Selected b")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("group", { name: "Browse view" })).getByRole("button", { name: "List" }));
    expect(screen.queryByRole("region", { name: "Map of healthcare locations" })).not.toBeInTheDocument();
    expect(headings()).toHaveLength(2);
  });
  it("sends the searched map bounds to the server and clears them when ordinary filters change", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [clinic] } });
    await mount({ initialLoaded: true, initialLocations: [clinic], initialView: "map", initialFilters: { cities: ["Surat"], specialties: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Search this area" }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/public/locations?sort=nearby&latitude=21&longitude=72&bounds=20%2C70%2C22%2C74", expect.anything()));
    fireEvent.click(screen.getByRole("button", { name: "Clear map area" }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/public/locations?sort=rating", expect.anything()));
  });
  it("distinguishes a failed request from successful empty results and retries", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ data: { data: [] } });
    await mount();
    expect(await screen.findByText("We couldn't load locations")).toBeInTheDocument();
    expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No locations found")).toBeInTheDocument();
  });
  it("rejects malformed responses without removing the previous cards", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { invalid: true } } });
    await mount({ initialLoaded: true, initialLocations: [clinic] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "different" } });
    expect(await screen.findByText("Unable to update results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Surat Clinic" })).toBeInTheDocument();
    expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
  });
  it("does not start requests from the server loading shell", async () => {
    const request = vi.spyOn(api, "get");
    await mount({ loadingOnly: true });
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toBeDisabled();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("Mobile calendar date boundaries", () => {
  it("opens a daily agenda on phones", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<AppointmentCalendarView appointments={[]} />);
    expect(screen.getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No appointments scheduled for this day.")).toBeInTheDocument();
  });
  it("moves from January 31 to February without skipping a month", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 0, 31, 12));
    render(<AppointmentCalendarView appointments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "month" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("February 2026")).toBeInTheDocument();
    const cell = screen.getByText("1").parentElement!.parentElement!;
    expect(Array.from(cell.parentElement!.children).indexOf(cell)).toBe(13);
  });
  it("uses the local date for today's boundaries", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 0, 15));
    expect(localDateKey()).toBe("2026-09-26");
    const params = new URLSearchParams(todayRangeParams());
    expect(new Date(params.get("startDate")!).getHours()).toBe(0);
    expect(new Date(params.get("endDate")!).getHours()).toBe(23);
  });
});
