import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardOverview from "@/app/(dashboard)/dashboard/page";
import PlatformOwnerDashboard from "@/components/dashboard/PlatformOwnerDashboard";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { platformDashboardFixture } from "./fixtures/platformDashboard";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("@/components/dashboard", () => ({
  DashboardStatCards: () => <div>Clinic operational metrics</div>, DashboardAnalytics: () => null,
  DashboardAppointmentsQueue: () => null, DashboardQuickActions: () => null,
  DashboardFollowUpAlerts: () => null, DashboardClinicFacilities: () => null,
}));
let client: QueryClient;
function mount(view = <DashboardOverview />) {
  return render(<QueryClientProvider client={client}><ToastProvider>{view}</ToastProvider></QueryClientProvider>);
}
const response = (data = platformDashboardFixture) => ({ data: { data } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60000 } } });
  useAuthStore.setState({ user: { id: "root", name: "Owner", email: "owner@example.test", role: "root" } });
  vi.mocked(api.get).mockResolvedValue(response());
});
afterEach(() => { client.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Platform owner dashboard", () => {
  it("makes one aggregate request and never loads clinic collections or the member hierarchy", async () => {
    mount();
    const collections = await screen.findByRole("region", { name: "Subscription collections" });
    await within(collections).findByText("₹1,180");
    expect(within(collections).getByText(/100.0% vs the same period/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/admin/dashboard", expect.objectContaining({ params: { range: "30D" }, signal: expect.any(AbortSignal) }));
    expect(screen.queryByText("Clinic operational metrics")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Login as/ })).not.toBeInTheDocument();
  });
  it("uses selected-organization navigation and existing management actions", async () => {
    mount();
    await screen.findByRole("heading", { name: "Organization activity" });
    expect(screen.getAllByRole("link", { name: "Willow Clinic" })[0]).toHaveAttribute("href", "/dashboard/organizations?organizationId=org-paid&section=overview");
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/organizations?create=1");
    fireEvent.click(screen.getByRole("button", { name: "Plans & billing" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/admin/billing");
    expect(screen.getByRole("link", { name: /Trials end within/ })).toHaveAttribute("href", "/dashboard/admin/billing");
  });
  it("keeps currencies separate and switches metrics without fetching again", async () => {
    mount();
    const card = await screen.findByRole("region", { name: "Subscription collections" });
    fireEvent.click(within(card).getByRole("combobox", { name: "Collections currency" }));
    fireEvent.click(await screen.findByRole("option", { name: "USD" }));
    expect(within(card).getByText("$10")).toBeInTheDocument();
    expect(within(card).queryByText("₹1,190")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Trend metric" }));
    fireEvent.click(await screen.findByRole("option", { name: "Bookings" }));
    expect(screen.getByRole("heading", { name: "Booking trend" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
  it("shows one structural skeleton and an honest retry state instead of false zero revenue", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(api.get).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    mount();
    expect(screen.getAllByRole("status", { name: "Loading platform overview" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Subscription collections" })).not.toBeInTheDocument();
    await act(async () => reject(new Error("Offline")));
    await screen.findByText("Platform overview could not be loaded");
    expect(screen.queryByText("₹0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("region", { name: "Subscription collections" });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it("retains the last successful snapshot when a refresh fails", async () => {
    mount();
    const card = await screen.findByRole("region", { name: "Subscription collections" });
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Offline"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh platform overview" }));
    await screen.findByText("Refresh could not be completed");
    expect(within(card).getByText("₹1,180")).toBeVisible();
    expect(screen.queryByRole("status", { name: "Loading platform overview" })).not.toBeInTheDocument();
  });
  it("retains data through range changes, labels the pending snapshot, and reuses cached ranges", async () => {
    mount();
    const card = await screen.findByRole("region", { name: "Subscription collections" });
    let complete!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    expect(within(card).getByText("₹1,180")).toBeVisible();
    expect(screen.getByText("Updating overview…")).toBeInTheDocument();
    expect(screen.getByText(/over 30 days/)).toBeInTheDocument();
    await act(async () => complete(response({ ...platformDashboardFixture, range: "7D", trend: platformDashboardFixture.trend.slice(-7) })));
    await screen.findByText(/over 7 days/);
    expect(api.get).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "30D" }));
    await screen.findByText(/over 30 days/);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it("does not let a superseded range request replace the current range", async () => {
    mount();
    await screen.findByRole("region", { name: "Subscription collections" });
    let finishOld!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "90D" }));
    const oldSignal = vi.mocked(api.get).mock.calls[1][1]?.signal;
    vi.mocked(api.get).mockResolvedValueOnce(response({ ...platformDashboardFixture, range: "7D", trend: platformDashboardFixture.trend.slice(-7) }));
    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    await screen.findByText(/over 7 days/);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => finishOld(response({ ...platformDashboardFixture, range: "90D" })));
    expect(screen.getByText(/over 7 days/)).toBeInTheDocument();
    expect(screen.queryByText(/over 90 days/)).not.toBeInTheDocument();
  });
  it("provides a compact zero-collections state and calm health without a blank chart", async () => {
    vi.mocked(api.get).mockResolvedValue(response({ ...platformDashboardFixture, money: { currencies: [{ currency: "INR", month: 0, previous: 0 }], undatedCaptures: 0 }, attention: [], trend: [], organizationActivity: { mostActive: [], leastActive: [] }, recentActivity: [] }));
    mount();
    await screen.findByText("No subscription collections in this period");
    expect(screen.getByText("No collections in either period")).toBeInTheDocument();
    expect(screen.getByText("No immediate follow-ups")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add your first organization" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Organization activity order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View booking trend" }));
    expect(screen.getByText("No bookings created in this period")).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN|100%/)).not.toBeInTheDocument();
  });
  it("does not expose platform metrics in an impersonated workspace", async () => {
    useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org-paid", impersonatedBy: { id: "root", name: "Owner", email: "owner@example.test", originalRole: "root" } } });
    mount(<PlatformOwnerDashboard />);
    expect(screen.queryByRole("heading", { name: "Ekavyu overview" })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
  it("keeps the existing patient dashboard separate from platform data", async () => {
    useAuthStore.setState({ user: { id: "patient", name: "Patient", email: "patient@example.test", role: "patient" } });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    mount();
    await screen.findByText("Clinic operational metrics");
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/appointments/patient/me"));
    expect(vi.mocked(api.get).mock.calls.some(([path]) => path === "/admin/dashboard")).toBe(false);
  });
});
