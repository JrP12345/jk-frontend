import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyCounterOverview, PharmacyCounterRecentBills, useCounterOverview } from "@/components/pharmacy/PharmacyCounterOverview";
import { readCounterOverview, type CounterOverview } from "@/lib/pharmacyCounterOverview";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const snapshot: CounterOverview = { locationId: "branch", currency: "INR", timezone: "Asia/Kolkata", date: "2026-11-12", asOf: "2026-11-12T10:00:00Z", salesPaise: 12345, bills: 7, drawer: { active: true, cashPaise: 500000 }, stock: { low: 3, expiring: 1, expired: 1, days: 90 }, recent: [{ id: "a".repeat(24), invoiceNumber: "I00012627/000007", totalPaise: 1500, issuedAt: "2026-11-12T09:55:00Z", status: "paid" }] };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => { api.get.mockReset().mockResolvedValue(response(snapshot)); });
function View({ revision = "" }: { revision?: string }) { const state = useCounterOverview("branch", revision); return <><PharmacyCounterOverview state={state} held={2} /><PharmacyCounterRecentBills state={state} onOpen={openBill} /></>; }
const openBill = vi.fn();
it("limits recent bills to five compact number-and-amount chips and opens full history", () => {
  const history = vi.fn();
  const recent = Array.from({ length: 8 }, (_, index) => ({ ...snapshot.recent[0], id: String(index), invoiceNumber: `BILL-${index}` }));
  render(<PharmacyCounterRecentBills state={{ data: { ...snapshot, recent }, error: false, loading: false, reload: vi.fn() }} onOpen={openBill} onHistory={history} />);
  expect(screen.getAllByRole("button", { name: /^View recent bill/ })).toHaveLength(5);
  expect(screen.getByRole("button", { name: "View recent bill BILL-0" })).toHaveTextContent("BILL-0(₹15.00)");
  expect(screen.queryByRole("button", { name: "View recent bill BILL-5" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View bill history" }));
  expect(history).toHaveBeenCalledOnce();
});
it("uses authoritative totals rather than summing the recent page, and opens a deliberate read-only bill", async () => {
  render(<View />);
  const summary = screen.getByRole("region", { name: "Counter summary" });
  await waitFor(() => expect(summary).toHaveTextContent("123.45"));
  expect(summary).toHaveTextContent("7"); expect(summary).toHaveTextContent("5,000"); expect(summary).toHaveTextContent("1 / 2"); expect(summary).toHaveTextContent("3 low · 1 expiring · 1 expired");
  fireEvent.click(screen.getByRole("button", { name: `View recent bill ${snapshot.recent[0].invoiceNumber}` }));
  expect(openBill).toHaveBeenCalledWith(snapshot.recent[0].id);
  expect(api.get).toHaveBeenCalledTimes(1);
});
it("retains the last snapshot on refresh failure and does not turn unknown or restricted values into zeros", async () => {
  const view = render(<View />); await screen.findByRole("button", { name: `View recent bill ${snapshot.recent[0].invoiceNumber}` });
  api.get.mockRejectedValueOnce(Error("offline")); view.rerender(<View revision="saved" />);
  await screen.findByRole("button", { name: "Retry counter summary" });
  expect(screen.getByRole("region", { name: "Counter summary" })).toHaveTextContent("123.45");
  api.get.mockResolvedValue(response({ ...snapshot, drawer: null, stock: null, recent: [] }));
  fireEvent.click(screen.getByRole("button", { name: "Retry counter summary" }));
  await screen.findByText("Stock access required"); expect(screen.getByText("Access required")).toBeInTheDocument();
});
it("keeps the same summary shell on failed initial load and supports retry", async () => {
  api.get.mockRejectedValueOnce(Error("offline")); render(<View />);
  const retry = await screen.findByRole("button", { name: "Retry counter summary" });
  expect(within(screen.getByRole("region", { name: "Counter summary" })).getAllByText("—")).toHaveLength(4);
  fireEvent.click(retry); await screen.findByText("3 low · 1 expiring · 1 expired");
});
it("retries recent bills independently when the counter summary row is not shown", async () => {
  api.get.mockRejectedValueOnce(Error("offline"));
  function RecentOnly() { const state = useCounterOverview("branch", ""); return <PharmacyCounterRecentBills state={state} onOpen={openBill} />; }
  render(<RecentOnly />);
  expect(await screen.findByText("Recent bills unavailable.")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Counter summary" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry recent bills" }));
  expect(await screen.findByRole("button", { name: `View recent bill ${snapshot.recent[0].invoiceNumber}` })).toBeInTheDocument();
});
it.each(["scope", "money", "drawer", "stock", "recent", "timezone"])("rejects invalid %s evidence", async kind => {
  const value = structuredClone(snapshot);
  if (kind === "scope") value.locationId = "foreign";
  if (kind === "money") value.salesPaise = 1.5;
  if (kind === "drawer") value.drawer!.cashPaise = -1;
  if (kind === "stock") value.stock!.days = 60;
  if (kind === "recent") value.recent[0].totalPaise = NaN;
  if (kind === "timezone") value.timezone = "Wrong/timezone";
  api.get.mockResolvedValue(response(value)); await expect(readCounterOverview("branch")).rejects.toThrow();
});
