import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Analytics from "@/app/(dashboard)/dashboard/analytics/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ executive: vi.fn(), optional: vi.fn(), allowed: true, user: { id: "viewer" } }));
vi.mock("@/services/analytics.service", () => ({ AnalyticsService: { getExecutiveAnalytics: fixture.executive, getQualityMetrics: fixture.optional, getNabhKpis: fixture.optional } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/lib/permissions", () => ({ canViewAnalytics: () => fixture.allowed }));
afterEach(() => { cleanup(); vi.clearAllMocks(); fixture.allowed = true; });
it("offers recovery after a failed report instead of claiming no data", async () => {
  fixture.optional.mockResolvedValue(null);
  fixture.executive.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(null);
  render(<ToastProvider><Analytics /></ToastProvider>);
  expect(await screen.findByText("Reports could not be loaded")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(fixture.executive).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("No analytics data available for your organization.")).toBeInTheDocument();
});
it("does not fetch reports for an account without analytics access", () => {
  fixture.allowed = false;
  render(<ToastProvider><Analytics /></ToastProvider>);
  expect(screen.getByText("Analytics access required")).toBeInTheDocument();
  expect(fixture.executive).not.toHaveBeenCalled();
});
