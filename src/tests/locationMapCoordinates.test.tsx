import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LocationManagement from "../components/organization/LocationManagement";
import { ToastProvider } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { parseLocationCoordinates } from "../lib/geo/locationCoordinates";
import api from "../lib/api";

const fixtures = vi.hoisted(() => ({ fetchLocations: vi.fn(), location: { id: "clinic-1", name: "Existing clinic", city: "Valsad", latitude: 0, longitude: -73 } }));
vi.mock("../hooks/useOrganizationLocations", () => ({ useOrganizationLocations: () => ({ locations: [fixtures.location], fetchLocations: fixtures.fetchLocations, isLoading: false, error: null }) }));
vi.mock("../components/dashboard/LocationQrPosterModal", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "root", name: "Root", email: "root@example.test", role: "root" }, isAuthenticated: true, isLoading: false });
  fixtures.fetchLocations.mockResolvedValue([fixtures.location]);
  vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
  vi.spyOn(api, "put").mockResolvedValue({ data: { success: true } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Clinic map pin configuration", () => {
  it("validates coordinate pairs without replacing missing pins with zero", () => {
    expect(parseLocationCoordinates(" ")).toEqual({ latitude: null, longitude: null });
    expect(parseLocationCoordinates("0, -73")).toEqual({ latitude: 0, longitude: -73 });
    expect(parseLocationCoordinates("-90, 180")).toEqual({ latitude: -90, longitude: 180 });
    for (const input of ["20", ",", "91, 0", "0, -181", "NaN, 4", "20, 70, 5"]) expect(parseLocationCoordinates(input)).toBeNull();
  });

  it("preserves a saved pin, rejects invalid edits, and saves valid coordinates to the selected organization", async () => {
    render(<ToastProvider><LocationManagement organizationId="org-1" embedded /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Location" });
    const coordinates = within(dialog).getByRole("textbox", { name: "Map coordinates (optional)" });
    expect(coordinates).toHaveValue("0, -73");
    fireEvent.change(coordinates, { target: { value: "91, 0" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByText(/Enter valid latitude, longitude/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(coordinates, { target: { value: "20.5992, 72.9342" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/onboarding/locations/clinic-1?organizationId=org-1", expect.objectContaining({ latitude: 20.5992, longitude: 72.9342 })));
    expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty("mapCoordinates");
  });

  it("allows an owner to clear a pin explicitly", async () => {
    render(<ToastProvider><LocationManagement organizationId="org-1" embedded /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Location" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Map coordinates (optional)" }), { target: { value: "" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/onboarding/locations/clinic-1?organizationId=org-1", expect.objectContaining({ latitude: null, longitude: null })));
  });
});
