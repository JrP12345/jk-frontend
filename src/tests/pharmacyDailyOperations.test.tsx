import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyCounterCustomerForm } from "@/components/pharmacy/PharmacyCounterCustomerForm";
import { PharmacyCounterPaymentEditor } from "@/components/pharmacy/PharmacyCounterPaymentEditor";
import { PharmacyProductStockTools } from "@/components/pharmacy/PharmacyProductStockTools";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";

const storage = vi.hoisted(() => ({ durable: true, save: vi.fn(), value: null as unknown }));
vi.mock("@/lib/pharmacyDrafts", async original => ({ ...await original<typeof import("@/lib/pharmacyDrafts")>(), createPharmacyLocalClient: () => ({ load: async () => ({ value: storage.value, durable: storage.durable }), save: storage.save }) }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const customer = { id: "customer", name: "Actual customer", address: "Actual address", revision: 0 };
const stock = { medicineId: "medicine", locationId: "branch", name: "Synthetic", stockQuantity: 10, stockRevision: 2, unitDefinition: { baseUnit: "tablet" }, totals: { saleable: 10, quarantined: 0, expired: 0, held: 0 }, review: "", batches: [{ id: "lot", batchNumber: "PRINTED", quantity: 10, status: "active", expiryDate: "2099-12-01", sellingPrice: 10, mrp: 12, saleBlocked: false }], nextCursor: null };
const data = (value: unknown) => ({ data: { data: value } });
const change = (label: string, value: string) => {
  const control = screen.getByLabelText(label);
  fireEvent.change(control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control, { target: { value } });
};
beforeEach(async () => {
  storage.durable = true; storage.value = null; storage.save.mockReset().mockImplementation(async value => { storage.value = value; return { durable: storage.durable }; });
  api.get.mockReset().mockResolvedValue(data(stock)); api.post.mockReset();
  sessionStorage.clear(); localStorage.clear(); await clearPharmacyDrafts();
  useAuthStore.setState({ user: { id: "staff", name: "Staff", role: "owner", organization_id: "org", email: "staff@example.test", permissions: ["MANAGE_ORGANIZATION"] } });
});
function addCustomer(selected = vi.fn()) {
  render(<ToastProvider><PharmacyCounterCustomerForm locationId="branch" onClose={vi.fn()} onSelected={selected} /></ToastProvider>);
  change("Customer name", customer.name); change("Customer address", customer.address); return selected;
}
it("offers an existing customer after a possible duplicate instead of silently creating a second record", async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: "Check duplicate", details: { code: "CUSTOMER_POSSIBLE_DUPLICATE", customers: [customer] } } } });
  const selected = addCustomer(); fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Use this customer" }));
  expect(selected).toHaveBeenCalledWith(customer); expect(api.post).toHaveBeenCalledTimes(1);
});
it("freezes an uncertain customer request and retries exactly the original command", async () => {
  api.post.mockRejectedValueOnce(new Error("Network lost")).mockResolvedValueOnce(data(customer));
  const selected = addCustomer(); fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
  const retry = await screen.findByRole("button", { name: "Retry same customer" });
  expect(screen.getByLabelText("Customer name")).toBeDisabled();
  fireEvent.click(retry); await waitFor(() => expect(selected).toHaveBeenCalledWith(customer));
  expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
});
it("permits named-customer split receipts and leaves the unpaid remainder as credit", async () => {
  const apply = vi.fn(); render(<ToastProvider><PharmacyCounterPaymentEditor locationId="branch" totalPaise={2000} customerId="customer" initial={null} onClose={vi.fn()} onApply={apply} /></ToastProvider>);
  change("Payment 1 amount (INR)", "5"); change("Split cash received (INR)", "10");
  fireEvent.click(screen.getByRole("button", { name: "Add payment method" }));
  change("Payment 2 amount (INR)", "7"); change("Payment 2 verified reference", "UPI-VERIFIED-001");
  fireEvent.click(screen.getByRole("button", { name: "Use these payments" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ totalPaise: 2000, customerId: "customer", tender: "10", parts: [expect.objectContaining({ amount: "5", paymentMethod: "cash" }), expect.objectContaining({ amount: "7", paymentMethod: "upi", referenceNumber: "UPI-VERIFIED-001" })] }));
});
it("prevents anonymous partial payment and digital receipts without verified references", () => {
  const apply = vi.fn(); render(<ToastProvider><PharmacyCounterPaymentEditor locationId="branch" totalPaise={2000} customerId={null} initial={null} onClose={vi.fn()} onApply={apply} /></ToastProvider>);
  change("Payment 1 amount (INR)", "5"); expect(screen.getByRole("button", { name: "Use these payments" })).toBeDisabled();
  change("Payment 1 amount (INR)", "20"); change("Payment 1 method", "upi");
  expect(screen.getByRole("button", { name: "Use these payments" })).toBeDisabled(); expect(apply).not.toHaveBeenCalled();
});
async function countForm() {
  render(<ToastProvider><PharmacyProductStockTools medicineId="medicine" locationId="branch" canAdjust canReadMovements onClose={vi.fn()} onChanged={vi.fn()} /></ToastProvider>);
  await screen.findByText("PRINTED"); await waitFor(() => expect(screen.getByRole("button", { name: "Confirm physical adjustment" })).toBeEnabled());
  change("Count batch", "lot"); change("Actual units remaining", "8"); change("Count / disposal source reference", "Count sheet 001");
}
it("preserves a durable physical-count command after a network failure and retries the same revision and key", async () => {
  api.post.mockRejectedValueOnce(new Error("Lost response")).mockResolvedValueOnce(data({ movement: { _id: "movement", revision: 3, beforeQuantity: 10, afterQuantity: 8 } }));
  await countForm(); fireEvent.click(screen.getByRole("button", { name: "Confirm physical adjustment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry same count" })); await screen.findByText("Stock adjustment confirmed");
  expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
  expect(api.post.mock.calls[0][1]).toMatchObject({ expectedRevision: 2, expectedQuantity: 10, newQuantity: 8, batchId: "lot" });
});
it("allows a fresh count only after the server confirms the original stale count was rejected", async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: "Stock changed", details: { code: "STOCK_COUNT_STALE" } } } });
  await countForm(); fireEvent.click(screen.getByRole("button", { name: "Confirm physical adjustment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Reload stock and recount rejected adjustment" }));
  await screen.findByRole("button", { name: "Confirm physical adjustment" });
  expect(screen.queryByRole("button", { name: "Retry same count" })).not.toBeInTheDocument(); expect(api.post).toHaveBeenCalledTimes(1);
});

it("keeps physical adjustments unavailable without durable local recovery storage", async () => {
  storage.durable = false;
  render(<ToastProvider><PharmacyProductStockTools medicineId="medicine" locationId="branch" canAdjust canReadMovements={false} onClose={vi.fn()} onChanged={vi.fn()} /></ToastProvider>);
  await screen.findByText("Local recovery storage required"); expect(screen.getByRole("button", { name: "Confirm physical adjustment" })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
