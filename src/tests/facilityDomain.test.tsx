import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { facilityTypeLabel, resolveLocationSelection } from "@/lib/facility";
import { useLocationStore } from "@/store/locationStore";
import api from "@/lib/api";
import BrowseClient, { type Location } from "@/app/browse/BrowseClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/browse" }));
vi.mock("@/components/MarketplaceNavbar", () => ({ default: () => <nav>Navigation</nav> }));

beforeEach(() => { vi.restoreAllMocks(); useLocationStore.getState().reset(); localStorage.clear(); });

describe("Physical facility metadata and selection", () => {
  it("does not guess clinic type for old, invalid or unclassified metadata", () => {
    expect(facilityTypeLabel("hospital")).toBe("Hospital");
    expect(facilityTypeLabel("diagnostic_center")).toBe("Diagnostic center");
    for (const value of [null, undefined, "Legacy Hospital", "unexpected_type"]) expect(facilityTypeLabel(value)).toBe("Healthcare facility");
  });

  it("automatically selects a single location and preserves all-location or specific multi-location context", async () => {
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat", facilityType: "hospital" }, { id: "diagnostics", name: "Diagnostics", city: "Valsad", facilityType: "diagnostic_center" }];
    const request = vi.spyOn(api, "get").mockResolvedValueOnce({ data: { data: [locations[0]] } });
    useLocationStore.getState().setActiveLocation("old-tenant-location");
    await useLocationStore.getState().fetchLocations();
    expect(useLocationStore.getState().activeLocationId).toBe("hospital");
    expect(localStorage.getItem("ekavyu_active_location_id")).toBe("hospital");
    request.mockResolvedValue({ data: { data: locations } });
    useLocationStore.getState().setActiveLocation("all");
    await useLocationStore.getState().fetchLocations(true);
    expect(useLocationStore.getState().activeLocationId).toBe("all");
    useLocationStore.getState().setActiveLocation("diagnostics");
    await useLocationStore.getState().fetchLocations(true);
    expect(useLocationStore.getState().activeLocationId).toBe("diagnostics");
    expect(resolveLocationSelection(locations, "foreign-location")).toBeNull();
    expect(resolveLocationSelection([], "hospital")).toBeNull();
  });

  it("renders hospitals and diagnostic centers correctly without repeating a sole-location parent", () => {
    const base = { address: "", phone: "", email: "", description: "", image_url: "", timings: "", onlineBookingAvailable: false, doctorCount: 0 };
    const locations: Location[] = [
      { ...base, id: "hospital", slug: "surat-hospital", name: "Surat Hospital", city: "Surat", facilityType: "hospital", organizationName: "Single-location organization", organizationLocationCount: 1 },
      { ...base, id: "diagnostics", slug: "valsad-diagnostics", name: "Valsad Diagnostics", city: "Valsad", facilityType: "diagnostic_center", organizationName: "Mixed healthcare group", organizationLocationCount: 2 },
    ];
    render(<BrowseClient initialLocations={locations} />);
    expect(screen.getByText("Hospital", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Diagnostic center", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 locations");
    expect(screen.queryByText("Single-location organization", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("Mixed healthcare group", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Surat Hospital" })).toHaveAttribute("href", "/browse/surat-hospital");
  });
});
