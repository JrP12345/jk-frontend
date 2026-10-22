import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { PharmacyStockReceipts } from "@/components/pharmacy/PharmacyStockReceipts";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { parseReceiptPaise, stockReceiptScope } from "@/lib/pharmacyStockReceipts";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), close: vi.fn(), committed: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
const medicine = { id: "medicine", locationId: "branch", name: "Synthetic tablet", genericName: "Synthetic", price: 10, stockQuantity: 0,
  unitDefinition: { version: 3, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const user = { id: "receiver", name: "Stock receiver", email: "receiver@example.test", role: "stock_manager", organization_id: "organization" };
const result = (key: string) => ({ requestKey: key, batchId: "lot", medicineId: "medicine", locationId: "branch", receiptLineId: key, kind: "receipt", receivedQuantity: 21,
  movementId: "movement", revision: 1, batch: { batchNumber: "PRINTED", receivedQuantity: 21, expirySnapshot: { precision: "month", value: "2099-12" }, unitSnapshot: { baseUnit: "tablet", unitsPerPack: 10 } } });
function Harness({ initialTarget, canReceive }: { initialTarget: typeof medicine | null; canReceive: boolean }) {
  const [target, setTarget] = useState(initialTarget);
  return <ToastProvider><PharmacyStockReceipts medicine={target} locationId="branch" canReceive={canReceive} canRecover onClose={() => { fixture.close(); setTarget(null); }} onCommitted={fixture.committed} /></ToastProvider>;
}
const mount = (target: typeof medicine | null = medicine, canReceive = true) => render(<Harness initialTarget={target} canReceive={canReceive} />);
const change = (label: string, value: string) => {
  const control = screen.getByLabelText(label);
  const input = control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
};
function fill() {
  change("Printed batch number *", "PRINTED"); change("Printed expiry *", "2099-12"); change("Full packs (strip) *", "2"); change("Loose units (tablet) *", "1");
  change("Total acquisition cost (INR) *", "12.37"); change("MRP per tablet (INR)", "12");
}
beforeEach(() => {
  localStorage.clear(); useAuthStore.setState({ user });
  fixture.get.mockReset().mockRejectedValue(new Error("No committed receipt is visible. Keep the reference."));
  fixture.post.mockReset().mockImplementation(async (_url: string, _body: unknown, config: { headers: Record<string, string> }) => ({ data: { data: result(config.headers["Idempotency-Key"]) } }));
  fixture.close.mockReset(); fixture.committed.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); });

it("requires actual receipt details before reserving a key or posting stock", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  expect(await screen.findByText(/Enter a batch, printed expiry/)).toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled(); expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBeNull();
});
it("posts exact paise, base-unit inputs and one durable key, then clears only a confirmed result", async () => {
  mount(); fill(); change("Receipt kind", "opening"); change("Opening source reference *", "Synthetic count sheet 001");
  fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  await screen.findByText("Stock receipt confirmed");
  const [url, payload, config] = fixture.post.mock.calls[0], key = config.headers["Idempotency-Key"];
  expect(url).toBe("/pharmacy/stock-receipts");
  expect(payload).toEqual({ medicineId: "medicine", locationId: "branch", receiptLineId: key, kind: "opening", expectedUnitVersion: 3, packs: 2, looseUnits: 1, batchNumber: "PRINTED",
    expiry: { precision: "month", value: "2099-12" }, purchaseTotalPaise: 1237, sellingPricePaise: 1000, mrpPaise: 1200, openingSourceReference: "Synthetic count sheet 001" });
  expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBe(key);
  expect(localStorage.getItem(stockReceiptScope(user, "branch"))).not.toContain("Synthetic");
  fireEvent.click(screen.getByRole("button", { name: "Done with stock receipt" }));
  await waitFor(() => expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBeNull());
  expect(fixture.committed).toHaveBeenCalled();
});
it("keeps an uncertain outcome pinned and retries the same payload and reference", async () => {
  fixture.post.mockRejectedValueOnce(new Error("Connection lost after send"));
  mount(); fill(); fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  await screen.findByText("Connection lost after send"); expect(screen.getByRole("button", { name: "Record stock receipt" })).toBeDisabled();
  const first = fixture.post.mock.calls[0];
  fireEvent.click(screen.getByRole("button", { name: "Retry same stock receipt" }));
  await screen.findByText("Stock receipt confirmed"); expect(fixture.post.mock.calls[1]).toEqual(first);
});
it("recovers a stored reference after remount without creating another receipt", async () => {
  const requestKey = "stored-receipt-0001";
  localStorage.setItem(stockReceiptScope(user, "branch"), requestKey);
  fixture.get.mockResolvedValue({ data: { data: result(requestKey) } });
  mount(null);
  await screen.findByText("Stock receipt confirmed"); expect(fixture.get).toHaveBeenCalledWith(`/pharmacy/stock-receipts/${requestKey}?locationId=branch`);
  expect(fixture.post).not.toHaveBeenCalled();
});
it("retains a not-found reference for review and does not offer acknowledgement as proof of failure", async () => {
  localStorage.setItem(stockReceiptScope(user, "branch"), "unconfirmed-0001"); mount(null);
  await screen.findByText("No committed receipt is visible. Keep the reference.");
  expect(screen.queryByRole("button", { name: "Done with stock receipt" })).not.toBeInTheDocument();
  expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBe("unconfirmed-0001");
});
it("re-enters receipt details after reload under the existing reference rather than creating a second key", async () => {
  const requestKey = "resume-receipt-0001"; localStorage.setItem(stockReceiptScope(user, "branch"), requestKey);
  mount(); await screen.findByText("No committed receipt is visible. Keep the reference."); fill();
  fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  await screen.findByText("Stock receipt confirmed");
  expect(fixture.post.mock.calls[0][2].headers["Idempotency-Key"]).toBe(requestKey);
  expect(fixture.post.mock.calls[0][1].receiptLineId).toBe(requestKey);
  expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBe(requestKey);
});
it("recovers committed results when new receiving is disabled", async () => {
  const requestKey = "disabled-receipt-0001"; localStorage.setItem(stockReceiptScope(user, "branch"), requestKey);
  fixture.get.mockResolvedValue({ data: { data: result(requestKey) } }); mount(null, false);
  await screen.findByText("Stock receipt confirmed"); expect(fixture.post).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Retry same stock receipt" })).not.toBeInTheDocument();
});
it("does not accept a mismatched server result as receipt confirmation", async () => {
  fixture.post.mockImplementation(async (_url: string, _body: unknown, config: { headers: Record<string, string> }) => ({ data: { data: { ...result(config.headers["Idempotency-Key"]), locationId: "other-branch" } } }));
  mount(); fill(); fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  await screen.findByText("Stock receipt could not be confirmed. Keep the same reference.");
  expect(fixture.close).not.toHaveBeenCalled(); expect(screen.queryByText("Stock receipt confirmed")).not.toBeInTheDocument();
});
it("ignores an old account's late receipt result while preserving its scoped reference", async () => {
  let resolve!: (value: unknown) => void;
  fixture.post.mockImplementation(() => new Promise(yes => { resolve = yes; }));
  const view = mount(); fill(); fireEvent.click(screen.getByRole("button", { name: "Record stock receipt" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1));
  const requestKey = fixture.post.mock.calls[0][2].headers["Idempotency-Key"];
  view.unmount(); useAuthStore.setState({ user: { ...user, id: "next-receiver" } });
  await act(async () => { resolve({ data: { data: result(requestKey) } }); });
  expect(fixture.close).not.toHaveBeenCalled(); expect(fixture.committed).not.toHaveBeenCalled();
  expect(localStorage.getItem(stockReceiptScope(user, "branch"))).toBe(requestKey);
});
it("parses exact money without silently rounding fractional paise or large amounts", () => {
  expect(parseReceiptPaise("0")).toBe(0); expect(parseReceiptPaise("12.37")).toBe(1237);
  expect(parseReceiptPaise("0.001")).toBeNull(); expect(parseReceiptPaise("-1")).toBeNull();
  expect(parseReceiptPaise("1e3")).toBeNull(); expect(parseReceiptPaise("1000000000.01")).toBeNull();
});
