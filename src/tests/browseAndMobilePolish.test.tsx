import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentCalendarView } from "../components/clinical/AppointmentCalendarView";
import { localDateKey, todayRangeParams } from "../lib/date";
import BrowseClient from "../app/browse/BrowseClient";
import api from "../lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../components/MarketplaceNavbar", () => ({ default: () => null }));
vi.mock("../lib/geo/locationDetector", () => ({ detectUserLocation: async () => null, mapStateToLanguage: () => "en", findMatchingClinicCity: () => null }));
const { setLanguage } = vi.hoisted(() => ({ setLanguage: vi.fn() }));
vi.mock("../lib/i18n", () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, setLanguage }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Mobile calendar and browse loading", () => {
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
  it("sorts seeded clinics without another request", () => {
    const request = vi.spyOn(api, "get");
    const clinics = [{ id: "b", name: "Zeta Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", minFee: 500 }, { id: "a", name: "Alpha Clinic", city: "Surat", address: "", phone: "", email: "", description: "", image_url: "", timings: "", minFee: 100 }];
    render(<BrowseClient initialClinics={clinics} initialLoaded />);
    fireEvent.change(screen.getByLabelText("Sort clinics by"), { target: { value: "name" } });
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Alpha Clinic", "Zeta Clinic"]);
    expect(request).not.toHaveBeenCalled();
  });
  it("offers retry after a failed load instead of reporting an empty clinic directory", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ data: { data: [] } });
    render(<BrowseClient />);
    expect(await screen.findByText("We couldn't load clinics. Please try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("We couldn't load clinics. Please try again.")).not.toBeInTheDocument());
    expect(await screen.findByText("No Healthcare Facilities Found")).toBeInTheDocument();
  });
  it("uses the local day rather than the UTC date for today's boundaries", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 0, 15));
    expect(localDateKey()).toBe("2026-09-26");
    const params = new URLSearchParams(todayRangeParams());
    expect(new Date(params.get("startDate")!).getHours()).toBe(0);
    expect(new Date(params.get("endDate")!).getHours()).toBe(23);
  });
});
