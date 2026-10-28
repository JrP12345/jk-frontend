import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardOverview from "@/app/(dashboard)/dashboard/page";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
const fixture = vi.hoisted(() => ({ get: vi.fn(), locations: [{ id: "branch", name: "Granted branch" }], fetchLocations: vi.fn().mockResolvedValue([{ id: "branch", name: "Granted branch" }]) }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: Object.assign(() => fixture, { getState: () => ({ reset: vi.fn() }) }) }));
vi.mock("@/components/dashboard", () => ({
  DashboardStatCards: (props: unknown) => <output data-testid="statistics">{JSON.stringify(props)}</output>,
  DashboardAnalytics: (props: unknown) => <output data-testid="charts">{JSON.stringify(props)}</output>,
  DashboardAppointmentsQueue: () => null, DashboardQuickActions: () => null, DashboardFollowUpAlerts: () => null, DashboardLocations: () => null,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); useAuthStore.setState({ user: null }); });
describe("Dashboard authoritative role loading", () => {
  it("loads family visits and partial invoice counts without calling staff summaries", async () => {
    useAuthStore.setState({ user: { id: "family", name: "Family", email: "family@example.test", role: "family_member", permissions: ["VIEW_APPOINTMENTS", "VIEW_EHR", "VIEW_BILLING"] } });
    fixture.get.mockImplementation(async (path: string) => ({ data: { data: [] }, headers: { "x-total-count": path.includes("status=partially_paid") ? "3" : path.includes("status=unpaid") ? "7" : "120" } }));
    render(<ToastProvider><DashboardOverview /></ToastProvider>);
    await waitFor(() => expect(screen.getByTestId("statistics")).toHaveTextContent('"unpaidBills":10'));
    expect(screen.getByTestId("statistics")).toHaveTextContent('"appointmentsCount":120');
    expect(fixture.get).toHaveBeenCalledTimes(3);
    expect(fixture.get.mock.calls.some(([path]) => path.includes("daily-summary") || path.includes("/staff"))).toBe(false);
    expect(screen.queryByTestId("charts")).not.toBeInTheDocument();
  });
  it("uses aggregate trends and never requests unauthorized staff or invoice data for nurses", async () => {
    useAuthStore.setState({ user: { id: "nurse", name: "Nurse", email: "nurse@example.test", role: "nurse", organization_id: "org", permissions: ["VIEW_APPOINTMENTS", "VIEW_LOCATIONS", "VIEW_EHR"] } });
    const day = new Date();
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    fixture.get.mockResolvedValue({ data: { data: { appointments: 230, completed: 130, pending: 100, financialVisible: false,
      trends: { days: [{ day: key, status: "completed", count: 130 }], locations: [] }, recentAppointments: [] } } });
    render(<ToastProvider><DashboardOverview /></ToastProvider>);
    await waitFor(() => expect(screen.getByTestId("statistics")).toHaveTextContent('"appointments":230'));
    expect(screen.getByTestId("statistics")).toHaveTextContent('"financialVisible":false');
    expect(screen.getByTestId("charts")).toHaveTextContent('"completed":130');
    expect(fixture.get).toHaveBeenCalledTimes(1);
    expect(fixture.get.mock.calls[0][0]).toContain("trendDays=7");
  });
  it("loads a custom receptionist dashboard without requesting location or staff management data", async () => {
    useAuthStore.setState({ user: { id: "desk", name: "Receptionist", email: "desk@example.test", role: "receptionist", organization_id: "org", permissions: ["VIEW_PATIENTS", "MANAGE_APPOINTMENTS", "MANAGE_QUEUE", "VIEW_BILLING", "MANAGE_BILLING", "MANAGE_ORDERS", "MANAGE_MEDICINES", "VIEW_APPOINTMENTS", "MANAGE_PATIENTS"] } });
    fixture.get.mockImplementation(async (path: string) => {
      if (path.includes("daily-summary")) return { data: { data: { locationCount: 1, appointments: 4, completed: 1, pending: 3, financialVisible: true, collections: 150, outstanding: 50, recentAppointments: [] } } };
      if (path.startsWith("/invoices")) return { data: { data: [] } };
      throw new Error("Unauthorized management read: " + path);
    });
    render(<ToastProvider><DashboardOverview /></ToastProvider>);
    await waitFor(() => expect(screen.getByTestId("statistics")).toHaveTextContent('"appointments":4'));
    expect(screen.getByTestId("statistics")).toHaveTextContent('"locations":1');
    expect(screen.getByTestId("charts")).toHaveTextContent('"showLocationActivity":false');
    expect(fixture.fetchLocations).not.toHaveBeenCalled();
    expect(fixture.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
