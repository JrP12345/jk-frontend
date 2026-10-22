import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import api from "@/lib/api";
import DashboardLayout from "@/app/(dashboard)/layout";
import { useLocationStore } from "@/store/locationStore";
import { useAuthStore } from "@/store/authStore";
import { ThemeProvider, ToastProvider } from "@/components/ui";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => router.pathname }));
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
  useAuthStore.setState({ authError: null });
  router.pathname = "/dashboard";
  vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@test", role: "admin", organization_id: "organization", permissions: ["VIEW_LOCATIONS"] }, isLoading: false, isAuthenticated: true, isLoggingOut: false });
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Dashboard location navigation", () => {
  it("hides private children during an outage and re-verifies the session before recovery", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, authError: "Session verification is unavailable." });
    const mounted = vi.fn();
    function PrivateChild() { mounted(); return <p>Verified workspace</p>; }
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><PrivateChild /></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to verify your session");
    expect(mounted).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { user: { id: "patient", name: "Patient", email: "patient@test", role: "patient" } } } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Verified workspace")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(useAuthStore.getState().authError).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("does not mount a clinical child in an independent pharmacy workspace", async () => {
    router.pathname = "/dashboard/patients";
    useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "organization", workspaceProfile: "pharmacy", permissions: ["MANAGE_ORGANIZATION"] } });
    const mounted = vi.fn(); function ClinicalChild() { mounted(); return <p>Clinical child</p>; }
    render(<QueryClientProvider client={new QueryClient()}><ThemeProvider><ToastProvider><DashboardLayout><ClinicalChild /></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.getByText("Opening pharmacy workspace...")).toHaveAttribute("role", "status"); expect(mounted).not.toHaveBeenCalled(); await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });
  it("shows pharmacy navigation for a pharmacy cashier without general clinical access", () => {
    useAuthStore.setState({ user: { id: "cashier", name: "Cashier", email: "cashier@example.test", role: "pharmacy_cashier", organization_id: "organization", permissions: ["PHARMACY_VIEW_STOCK", "VIEW_LOCATIONS"] } });
    render(<QueryClientProvider client={new QueryClient()}><ThemeProvider><ToastProvider><DashboardLayout><p>Stock workspace</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.getAllByRole("link", { name: "Pharmacy Inventory" })[0]).toHaveAttribute("href", "/dashboard/pharmacy");
    expect(screen.queryByRole("link", { name: "Patients" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Billing" })).not.toBeInTheDocument();
  });
  it('shows a patient relationship entry in the platform root menu', () => {
    useAuthStore.setState({ user: { id: 'root', name: 'Root', email: 'root@example.test', role: 'root' } });
    render(<QueryClientProvider client={new QueryClient()}><ThemeProvider><ToastProvider><DashboardLayout><p>Platform</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.getAllByRole('link', { name: 'Patient relationships' })[0]).toHaveAttribute('href', '/dashboard/crm');
  });
  it("keeps CRM-only work usable without requesting facility administration data", async () => {
    const fetchLocations = vi.fn(async () => []);
    useLocationStore.setState({ locations: [{ id: "branch", name: "Previous branch", city: "Pune" }, { id: "second", name: "Second branch", city: "Pune" }], activeLocationId: null, fetchLocations });
    useAuthStore.setState({ user: { id: "desk", name: "Desk", email: "desk@example.test", role: "crm_desk", organization_id: "organization", permissions: ["VIEW_CRM", "MANAGE_CRM_TASKS"] } });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><p>CRM work</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("CRM work")).toBeInTheDocument();
    expect(fetchLocations).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox", { name: "Active location" })).not.toBeInTheDocument();
  });
  it("hides the location switcher for a single facility while rendering the workspace", async () => {
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat" }];
    useLocationStore.setState({ locations: locations, activeLocationId: "hospital", isLoaded: true, fetchLocations: vi.fn(async () => locations) });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><p>Workspace content</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Active location" })).not.toBeInTheDocument();
  });

  it("preserves an all-location selection through the layout effect", async () => {
    const locations = [{ id: "hospital", name: "Hospital", city: "Surat" }, { id: "diagnostics", name: "Diagnostics", city: "Valsad" }];
    useLocationStore.setState({ locations: locations, activeLocationId: "hospital", isLoaded: true, fetchLocations: vi.fn(async () => locations) });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><p>Workspace content</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
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
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><button onClick={continueWork}>Continue work</button></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(16 * 60 * 1000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue work" }));
    expect(continueWork).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Account menu:/ }));
    expect(screen.getAllByRole("menuitem").map(item => item.textContent?.trim())).toEqual(["Profile & Settings", "Account security", "Sign out"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Account security" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/security");
  });

  it("continues to hide dashboard content and require sign-in without a session", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider><DashboardLayout><p>Private workspace content</p></DashboardLayout></ToastProvider></ThemeProvider></QueryClientProvider>);
    expect(screen.queryByText("Private workspace content")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });
});
