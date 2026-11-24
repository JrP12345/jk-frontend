import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyDailyOverview } from "@/components/pharmacy/PharmacyDailyOverview";
import { dailyOverviewFixture } from "./fixtures/pharmacyDailyOverview";
import { validateDailyOverview, type PharmacyDailyOverviewData } from "@/lib/pharmacyDailyOverview";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
import { datePickerInput } from "./datePickerTestUtils";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "b".repeat(24), response = (data: unknown) => ({ data: { data } });
const props = () => ({ locationId, canViewStock: true, canViewDrawer: true, onStock: vi.fn(), onDrawer: vi.fn(), onReport: vi.fn() });
const mount = (extra = {}) => { const callbacks = { ...props(), ...extra }; return { ...render(<ToastProvider><PharmacyDailyOverview {...callbacks} /></ToastProvider>), callbacks }; };
beforeEach(() => {
  api.get.mockReset().mockResolvedValue(response(dailyOverviewFixture())); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", organization_id: "org", role: "admin", permissions: ["PHARMACY_VIEW_REPORTS"] } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("shows sales, actual payment methods, original credit, contribution and current dues as different figures", async () => {
  const view = mount(); await screen.findByText(/Business day 2026-11-22/); fireEvent.click(screen.getByText("Dues, card payments, returns and expiry"));
  for (const [name, amount] of [["Sales issued", "50.00"], ["Cash collected", "20.00"], ["UPI collected", "15.00"], ["Card collected", "10.00"], ["Customer credit created", "12.00"], ["Gross contribution", "40.00"], ["Customer dues now", "25.00"], ["Supplier dues now", "100.00"]]) expect(within(screen.getByRole("article", { name })).getByText(new RegExp(amount.replace(".", "\\.")))).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("article", { name: "Sales issued" })).getByText("Details and source")); fireEvent.click(screen.getByRole("button", { name: "Review sales issued source" })); expect(view.callbacks.onReport).toHaveBeenCalledWith("sales", "2026-11-22");
  fireEvent.click(screen.getByRole("button", { name: "Review stock & expiry" })); expect(view.callbacks.onStock).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Review cash drawer" })); expect(view.callbacks.onDrawer).toHaveBeenCalledOnce();
  expect(api.get.mock.calls[0][0]).toBe(`/pharmacy/daily-overview?locationId=${locationId}`);
});
it("does not query while editing a date and applies only a verified matching business day", async () => {
  mount(); await screen.findByText(/Business day 2026-11-22/);
  fireEvent.change(datePickerInput(screen.getByLabelText("Overview business day")), { target: { value: "2026-11-21" } }); expect(api.get).toHaveBeenCalledOnce();
  const yesterday = dailyOverviewFixture(); yesterday.date = "2026-11-21"; yesterday.period = { start: "2026-11-20T18:30:00.000Z", end: "2026-11-21T18:29:59.999Z" }; api.get.mockResolvedValueOnce(response(yesterday));
  fireEvent.click(screen.getByRole("button", { name: "Load day" })); await screen.findByText(/Business day 2026-11-21/); expect(api.get.mock.calls[1][0]).toContain("date=2026-11-21");
  fireEvent.click(screen.getByRole("button", { name: "Today", exact: true })); await screen.findByText(/Business day 2026-11-22/); expect(api.get.mock.calls[2][0]).not.toContain("date=");
});
it("retains a clearly stale snapshot on network failure but clears it when authority is rejected", async () => {
  mount(); await screen.findByText(/Business day 2026-11-22/); api.get.mockRejectedValueOnce(Error("Network unavailable")); fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
  await screen.findByText(/Showing the last successful snapshot/); expect(within(screen.getByRole("article", { name: "Sales issued" })).getByText(/50\.00/)).toBeInTheDocument();
  api.get.mockRejectedValueOnce({ response: { status: 403 } }); fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
  await waitFor(() => expect(screen.queryByText(/Business day 2026-11-22/)).not.toBeInTheDocument()); expect(screen.queryByText(/50\.00/)).not.toBeInTheDocument();
});
it("shows unknown cost/credit, denied sections and offline/provider exceptions without inventing zero totals", async () => {
  const data = dailyOverviewFixture(); data.coverage.offlineSession = "expired"; data.paymentReview = 1;
  data.sections.margin.values = { ...data.sections.margin.values, costPaise: null, contributionPaise: null, unknownBills: 1 };
  data.sections.newCredit.values = { amountPaise: null, bills: null, unknownBills: 1 };
  data.sections.supplierDues = { state: "restricted", values: null, items: [], note: "Purchase permission required" };
  api.get.mockResolvedValue(response(data)); mount(); await screen.findByText("Local counter still needs reconciliation"); fireEvent.click(screen.getByText("Dues, card payments, returns and expiry"));
  expect(within(screen.getByRole("article", { name: "Gross contribution" })).getByText("Unknown")).toBeInTheDocument(); expect(within(screen.getByRole("article", { name: "Customer credit created" })).getByText("Unknown")).toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: "Supplier dues now" })).getAllByText("Access required").length).toBeGreaterThan(0); expect(screen.getByText(/Pending captures are not added/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Review supplier dues now source" })).not.toBeInTheDocument();
});
it("discards a late response after a branch or identity change", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementationOnce(() => new Promise(done => { finish = done; })).mockResolvedValueOnce(response({ ...dailyOverviewFixture("c".repeat(24)), date: "2026-11-21", asOf: "2026-11-21T16:30:00.000Z", period: { start: "2026-11-20T18:30:00.000Z", end: "2026-11-21T16:30:00.000Z" } }));
  const callbacks = props(), view = render(<ToastProvider><PharmacyDailyOverview {...callbacks} /></ToastProvider>);
  view.rerender(<ToastProvider><PharmacyDailyOverview {...callbacks} locationId={"c".repeat(24)} /></ToastProvider>);
  await screen.findByText(/Business day 2026-11-21/); await act(async () => { finish(response(dailyOverviewFixture())); }); expect(screen.queryByText(/Business day 2026-11-22/)).not.toBeInTheDocument();
  await act(async () => { useAuthStore.setState({ user: { ...useAuthStore.getState().user!, id: "another-owner" } }); });
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
});
it("keeps a failed complete source unavailable and distinguishes billing-only inventory", async () => {
  const data = dailyOverviewFixture(); data.sections.sales = { state: "unavailable", values: null, note: "Source exceeds safe read budget", items: [] }; data.sections.stock = { state: "not_tracked", values: null, note: "Billing-only branch", items: [] };
  api.get.mockResolvedValue(response(data)); mount({ canViewStock: false }); await screen.findByText(/Business day 2026-11-22/);
  expect(within(screen.getByRole("article", { name: "Sales issued" })).getAllByText(/Unavailable/).length).toBeGreaterThan(0); expect(within(screen.getByRole("article", { name: "Low physical stock" })).getByText("Not tracked")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Review stock & expiry" })).not.toBeInTheDocument();
});
it.each([
  (data: PharmacyDailyOverviewData) => { data.currency = "USD" as "INR"; },
  (data: PharmacyDailyOverviewData) => { data.locationId = "another-branch"; },
  (data: PharmacyDailyOverviewData) => { data.period.end = "2026-11-23T00:00:00.000Z"; },
  (data: PharmacyDailyOverviewData) => { data.timezone = undefined as unknown as string; },
  (data: PharmacyDailyOverviewData) => { data.date = "2026-11-21"; },
  (data: PharmacyDailyOverviewData) => { data.sections.stock.values!.days = 90; },
  (data: PharmacyDailyOverviewData) => { data.sections.collections.values!.cashPaise = 100; },
  (data: PharmacyDailyOverviewData) => { data.sections.margin.values!.contributionPaise = 0; },
  (data: PharmacyDailyOverviewData) => { data.sections.sales.values!.grossSalesPaise = null; },
  (data: PharmacyDailyOverviewData) => { data.sections.sales.values!.bills = 0.5; },
  (data: PharmacyDailyOverviewData) => { data.sections.supplierDues.state = "restricted"; },
  (data: PharmacyDailyOverviewData) => { delete (data.sections as Partial<PharmacyDailyOverviewData["sections"]>).returns; },
])("rejects malformed or financially inconsistent overview payload %#", change => {
  const data = dailyOverviewFixture(); change(data); expect(() => validateDailyOverview(data, locationId)).toThrow(/could not be verified/);
});
it("rejects a server response for a different requested day", () => { expect(() => validateDailyOverview(dailyOverviewFixture(), locationId, "2026-11-21")).toThrow(); });
