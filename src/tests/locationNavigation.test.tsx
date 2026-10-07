import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/components/clinical/OfflineStatusBanner", () => ({ OfflineStatusBanner: () => null }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@test", role: "admin", organization_id: "organization" }, isLoading: false, isAuthenticated: true, isLoggingOut: false });
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

  it.each(["root", "admin"] as const)("keeps the %s dashboard usable after sixteen idle minutes", async (role) => {
    vi.useFakeTimers();
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat" }];
    useLocationStore.setState({ locations, activeLocationId: "hospital", isLoaded: true, fetchLocations: vi.fn(async () => locations) });
    useAuthStore.setState({ user: { id: role, name: "Account", email: "account@test", role, ...(role === "admin" ? { organization_id: "organization" } : {}) } });
    const continueWork = vi.fn();
    render(<ThemeProvider><ToastProvider><DashboardLayout><button onClick={continueWork}>Continue work</button></DashboardLayout></ToastProvider></ThemeProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(16 * 60 * 1000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue work" }));
    expect(continueWork).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getAllByRole("menuitem").map(item => item.textContent?.trim())).toEqual(["Profile & Settings", "Account security", "Sign out"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Account security" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/security");
  });

  it("continues to hide dashboard content and require sign-in without a session", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    render(<ThemeProvider><ToastProvider><DashboardLayout><p>Private workspace content</p></DashboardLayout></ToastProvider></ThemeProvider>);
    expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });
});
