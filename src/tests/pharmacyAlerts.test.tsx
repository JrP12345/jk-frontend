import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyAlertsCenter } from "@/components/pharmacy/PharmacyAlertsCenter";
import { reportFixture, stockReportRow, expiryReportRow } from "./fixtures/pharmacyReport";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: fixture }));
const medicine = { id: "medicine", locationId: "clinic", name: "Sample medicine", genericName: "Sample generic", stockQuantity: 15, reorderLevel: 20, price: 10 };
const response = (data: unknown) => ({ data: { data } });
const defaults = { locationId: "clinic", medicines: [medicine], onOpenAddBatch: vi.fn(), canManage: true, refreshKey: 0 };
beforeEach(() => { fixture.get.mockReset().mockImplementation(async (url: string, config: any) => response(reportFixture(url.endsWith("expiry") ? "expiry" : "low_stock", config.params.locationId, url.endsWith("expiry") ? [expiryReportRow] : [stockReportRow], { days: config.params.days, cursor: config.params.cursor || null }))); defaults.onOpenAddBatch.mockClear(); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });
it("uses trusted saleable quantities and the configured base-unit reorder basis when selecting a restock target", async () => {
  render(<PharmacyAlertsCenter {...defaults} />); await screen.findByText(/Eligible 2.*Physical 15.*Reorder at 20/); fireEvent.click(screen.getByRole("button", { name: "Add batch" })); expect(defaults.onOpenAddBatch).toHaveBeenCalledWith(medicine);
  fireEvent.click(screen.getByRole("tab", { name: "Expired" })); await screen.findByText(/OLD.*Printed expiry 2020-01/); fireEvent.click(screen.getByRole("button", { name: "Add fresh batch" })); expect(defaults.onOpenAddBatch).toHaveBeenLastCalledWith(medicine);
});
it("shows an expiry read failure instead of a false empty success and supports retry", async () => {
  render(<PharmacyAlertsCenter {...defaults} />); await screen.findByText("Sample medicine"); fixture.get.mockRejectedValueOnce(new Error("Synthetic expiry offline")); fireEvent.click(screen.getByRole("tab", { name: "Expiring" })); await screen.findByText("Expiry alerts unavailable"); expect(screen.queryByText(/No expiring/)).not.toBeInTheDocument();
  fixture.get.mockResolvedValueOnce(response(reportFixture("expiry", "clinic", [], { days: 60 }))); fireEvent.click(screen.getByRole("button", { name: "Retry alerts" })); await screen.findByText("No expiring batches on this source page within 60 days.");
});
it("shows printed month precision and classifies expiry using the server read time", async () => {
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation(async (url: string, config: any) => url.endsWith("expiry") ? response(reportFixture("expiry", "clinic", [{ ...expiryReportRow, printedExpiry: "2030-12", expiryCutoff: "2030-12-31T18:30:00.000Z" }], { days: 60 })) : original(url, config));
  render(<PharmacyAlertsCenter {...defaults} />); fireEvent.click(screen.getByRole("tab", { name: "Expiring" })); await screen.findByText(/Printed expiry 2030-12/); expect(screen.queryByText(/Printed expiry.*2031-01/)).not.toBeInTheDocument();
});
it("clears a changed expiry window and ignores an earlier slow response", async () => {
  let finish!: (value: unknown) => void; const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string, config: any) => config.params.days === 30 ? new Promise(resolve => { finish = resolve; }) : original(url, config));
  render(<PharmacyAlertsCenter {...defaults} />); fireEvent.click(screen.getByRole("tab", { name: "Expired" })); await screen.findByText(/OLD/); fireEvent.click(screen.getByRole("combobox", { name: "Expiry window" })); fireEvent.click(await screen.findByRole("option", { name: "Next 30 days" })); expect(screen.queryByText(/OLD/)).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("combobox", { name: "Expiry window" })); fireEvent.click(await screen.findByRole("option", { name: "Next 90 days" })); await screen.findByText(/OLD/);
  await act(async () => { finish(response(reportFixture("expiry", "clinic", [{ ...expiryReportRow, batch: "STALE" }], { days: 30 }))); }); expect(screen.queryByText(/STALE/)).not.toBeInTheDocument();
});
it("refreshes after stock changes, displays unknown eligibility for review and suppresses unsafe restocking", async () => {
  const view = render(<PharmacyAlertsCenter {...defaults} />); await screen.findByText("Sample medicine"); fixture.get.mockResolvedValueOnce(response(reportFixture("low_stock", "clinic", [{ ...stockReportRow, eligible: null, review: "Owned stock needs reconciliation" }]))); view.rerender(<PharmacyAlertsCenter {...defaults} refreshKey={1} />); await screen.findByText("Owned stock needs reconciliation"); expect(screen.queryByRole("button", { name: "Add batch" })).not.toBeInTheDocument(); expect(screen.getByText(/Eligible unknown/)).toBeInTheDocument();
});
it("handles absent locations without a request and keeps stock-only read access independent of inventory load", async () => {
  const view = render(<PharmacyAlertsCenter {...defaults} locationId="" canManage={false} />); expect(screen.getByText("Choose a location to review stock and expiry alerts.")).toBeInTheDocument(); expect(fixture.get).not.toHaveBeenCalled(); view.rerender(<PharmacyAlertsCenter {...defaults} canManage={false} />); await screen.findByText("Sample medicine"); expect(screen.queryByRole("button", { name: "Add batch" })).not.toBeInTheDocument();
});
it("paginates low-stock source pages and never labels a filtered empty page as the whole store", async () => {
  const cursor = "b".repeat(24); fixture.get.mockImplementation(async (_url: string, config: any) => response(reportFixture("low_stock", "clinic", config.params.cursor ? [{ ...stockReportRow, id: "later", product: "Later low-stock product" }] : [], { scanned: 25, nextCursor: config.params.cursor ? null : cursor, cursor: config.params.cursor || null })));
  render(<PharmacyAlertsCenter {...defaults} medicines={[]} />); await screen.findByText("No matches on this source page. Continue to check the next page."); fireEvent.click(screen.getByRole("button", { name: "Next low-stock page" })); await screen.findByText("Later low-stock product"); expect(fixture.get.mock.calls.at(-1)?.[1].params.cursor).toBe(cursor);
});
it("resolves a current branch product before offering restocking outside the visible catalogue page", async () => {
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation(async (url: string, config: any) => url.startsWith("/medicines") ? { ...response([medicine]), headers: { "x-total-pages": "1", "x-total-count": "1" } } : original(url, config)); render(<PharmacyAlertsCenter {...defaults} medicines={[]} />); fireEvent.click(await screen.findByRole("button", { name: "Add batch" })); await waitFor(() => expect(defaults.onOpenAddBatch).toHaveBeenCalledWith(medicine)); expect(fixture.get.mock.calls.some(([url]) => url.startsWith("/medicines") && url.includes("medicineIds=medicine"))).toBe(true);
});
it("does not open an old branch product after a scope change during restock lookup", async () => {
  let finish!: (value: unknown) => void; const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string, config: any) => url.startsWith("/medicines") ? new Promise(resolve => { finish = resolve; }) : original(url, config));
  const view = render(<PharmacyAlertsCenter {...defaults} medicines={[]} />); fireEvent.click(await screen.findByRole("button", { name: "Add batch" })); await waitFor(() => expect(fixture.get.mock.calls.some(([url]) => url.startsWith("/medicines"))).toBe(true)); view.rerender(<PharmacyAlertsCenter {...defaults} locationId="other" medicines={[]} />);
  await act(async () => { finish({ ...response([medicine]), headers: { "x-total-pages": "1", "x-total-count": "1" } }); }); expect(defaults.onOpenAddBatch).not.toHaveBeenCalled();
});
