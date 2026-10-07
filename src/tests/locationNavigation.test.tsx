import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "@/app/(dashboard)/layout";
import { useLocationStore } from "@/store/locationStore";
import { useAuthStore } from "@/store/authStore";
import { ThemeProvider, ToastProvider } from "@/components/ui";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dashboard" }));
vi.mock("@/store/moduleStore", () => {
  const state = { isLoaded: true, fetchModules: vi.fn(), isModuleEnabled: () => true, reset: vi.fn() };
  return { useModuleStore: Object.assign(() => state, { getState: () => state }) };
});
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "full", consultation: "full" }, loading: false }) }));
vi.mock("@/hooks/useTrafficTracker", () => ({ useTrafficTracker: vi.fn() }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/auth/ClinicalScreenLock", () => ({ ClinicalScreenLock: () => null }));
vi.mock("@/components/clinical/OfflineStatusBanner", () => ({ OfflineStatusBanner: () => null }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@test", role: "admin", organization_id: "organization" }, isLoading: false, isAuthenticated: true });
});

describe("Dashboard location navigation", () => {
  it("hides the location switcher for a single facility while rendering the workspace", async () => {
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat" }];
    useLocationStore.setState({ locations: locations, activeLocationId: "hospital", isLoaded: true, fetchLocations: vi.fn(async () => locations) });
    render(<ThemeProvider><ToastProvider><DashboardLayout><p>Workspace content</p></DashboardLayout></ToastProvider></ThemeProvider>);
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Active location" })).not.toBeInTheDocument();
  });

  it("preserves an all-location selection through the layout effect", async () => {
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat" }, { id: "diagnostics", name: "Diagnostics", city: "Valsad" }];
    useLocationStore.setState({ locations: locations, activeLocationId: "hospital", isLoaded: true, fetchLocations: vi.fn(async () => locations) });
    render(<ThemeProvider><ToastProvider><DashboardLayout><p>Workspace content</p></DashboardLayout></ToastProvider></ThemeProvider>);
    const switcher = screen.getAllByRole("combobox", { name: "Active location" })[0];
    fireEvent.click(switcher);
    fireEvent.click(screen.getByRole("option", { name: "All locations" }));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(useLocationStore.getState().activeLocationId).toBe("all"));
    expect(switcher).toHaveTextContent("All locations");
  });
});
