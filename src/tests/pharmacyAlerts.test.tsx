import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyAlertsCenter } from "@/components/pharmacy/PharmacyAlertsCenter";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: fixture }));
const medicine = { id: "medicine", locationId: "clinic", name: "Sample medicine", genericName: "Sample generic", stockQuantity: 15, reorderLevel: 20, costPrice: 5, price: 10, expiryDate: "2030-12-01", batchNumber: "B-001" };
const response = (data: unknown) => ({ data: { data } });
const batch = { _id: "batch", medicineId: { _id: "medicine", name: "Sample medicine", genericName: "Sample generic" }, expiryDate: "2020-01-01", batchNumber: "OLD", quantity: 5, purchaseCost: 5, sellingPrice: 10, status: "expired" };
const defaults = { locationId: "clinic", medicines: [medicine], onOpenAddBatch: vi.fn(), canManage: true, inventoryLoading: false, inventoryError: null, refreshKey: 0 };
beforeEach(() => { fixture.get.mockReset().mockResolvedValue(response([batch])); defaults.onOpenAddBatch.mockClear(); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });

it("uses the configured reorder level and restocks only the selected medicine", async () => {
  render(<PharmacyAlertsCenter {...defaults} />); expect(screen.getByRole("tab", { name: /Low stock\s*1/ })).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Add batch" })); expect(defaults.onOpenAddBatch).toHaveBeenCalledWith(medicine);
  fireEvent.click(screen.getByRole("tab", { name: /Expired/ })); await screen.findByText("OLD"); fireEvent.click(screen.getByRole("button", { name: "Add fresh batch" })); expect(defaults.onOpenAddBatch).toHaveBeenLastCalledWith(medicine);
});

it("shows an expiry read failure rather than a false empty success and supports retry", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")); render(<PharmacyAlertsCenter {...defaults} />); fireEvent.click(screen.getByRole("tab", { name: "Expiring" }));
  await screen.findByText("Expiry alerts unavailable"); expect(screen.queryByText(/No batches expire/)).not.toBeInTheDocument(); fixture.get.mockResolvedValue(response([])); fireEvent.click(screen.getByRole("button", { name: "Retry alerts" }));
  await screen.findByText("No batches expire within the next 60 days.");
});

it("clears the previous expiry window and ignores a late response", async () => {
  let finish!: (data: unknown) => void; fixture.get.mockImplementation((url: string) => url.includes("days=30") ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response([batch])));
  render(<PharmacyAlertsCenter {...defaults} />); fireEvent.click(screen.getByRole("tab", { name: "Expired" })); await screen.findByText("OLD");
  fireEvent.click(screen.getByRole("combobox", { name: "Expiry window" })); fireEvent.click(await screen.findByRole("option", { name: "Next 30 days" })); expect(screen.queryByText("OLD")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Expiry window" })); fireEvent.click(await screen.findByRole("option", { name: "Next 90 days" })); await screen.findByText("OLD");
  await act(async () => finish(response([{ ...batch, batchNumber: "STALE" }]))); expect(screen.queryByText("STALE")).not.toBeInTheDocument();
});

it("refreshes expiry rows after a stock write and avoids offering an unrelated restock target", async () => {
  const view = render(<PharmacyAlertsCenter {...defaults} medicines={[]} />); fireEvent.click(screen.getByRole("tab", { name: "Expired" })); await screen.findByText("OLD"); expect(screen.queryByRole("button", { name: "Add fresh batch" })).not.toBeInTheDocument();
  fixture.get.mockResolvedValue(response([])); view.rerender(<PharmacyAlertsCenter {...defaults} medicines={[]} refreshKey={1} />); await screen.findByText("No expired batches found."); expect(fixture.get).toHaveBeenCalledTimes(2);
});

it("handles missing locations and inventory failures without showing restock actions", async () => {
  const view = render(<PharmacyAlertsCenter {...defaults} locationId="" canManage={false} inventoryError="offline" />); expect(screen.getByText("Inventory unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Expiring" })); expect(screen.getByText("Choose a location to review batch expiry alerts.")).toBeInTheDocument(); expect(fixture.get).not.toHaveBeenCalled();
  view.rerender(<PharmacyAlertsCenter {...defaults} canManage={false} />); fireEvent.click(screen.getByRole("tab", { name: /Low stock/ })); await waitFor(() => expect(screen.getByText("Sample medicine")).toBeInTheDocument()); expect(screen.queryByRole("button", { name: "Add batch" })).not.toBeInTheDocument();
});
