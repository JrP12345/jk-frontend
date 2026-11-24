import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacySupplierRates } from "@/components/pharmacy/PharmacySupplierRates";
import { PharmacyPurchases } from "@/components/pharmacy/PharmacyPurchases";
import { validateSupplierRates, unitRate } from "@/lib/pharmacySupplierRates";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const locationId = "111111111111111111111111", medicineId = "222222222222222222222222", supplierId = "333333333333333333333333", purchaseId = "444444444444444444444444";
const data = () => ({ locationId, medicineId, productName: "Test tablets", currency: "INR", timezone: "Asia/Kolkata", asOf: "2026-11-23T10:00:00.000Z", startDate: "2025-11-23", endDate: "2026-11-23", basis: "net_excluding_gst", sourcePurchases: 1,
  note: "Historical invoice rates, not live quotes.", items: [{ supplierId, supplierName: "Test supplier", purchaseId, invoiceNumber: "BILL-1", invoiceDate: "2026-10-21", costTreatment: "exclude_tax", baseUnit: "tablet", unitVersion: 1, billedUnits: 3, freeUnits: 2, netPaise: 80, grossPaise: 94, receivedUnits: 0, state: "comparable", note: "Free goods may not yet be received." }] });
const response = (value: unknown) => ({ data: { data: value } });
beforeEach(() => {
  useAuthStore.setState({ user: { id: "owner", role: "admin", name: "Owner", email: "owner@example.test", organization_id: "org", permissions: ["PHARMACY_VIEW_PURCHASES", "PHARMACY_VIEW_COST"] } });
  api.get.mockReset().mockImplementation(async (url: string) => response(url.includes("purchase-products") ? { items: [{ id: medicineId, name: "Test tablets", unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } }], nextCursor: null } : url.includes("supplier-rates") ? data() : { items: [], nextCursor: null })); api.post.mockReset();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
async function selectProduct() { fireEvent.click(screen.getByRole("button", { name: "Find medicine" })); fireEvent.click(await screen.findByRole("button", { name: "Compare Test tablets" })); }
it("loads only after explicit search and comparison, shows net/gross/free/receipt distinctions and opens the source", async () => {
  const invoice = vi.fn(); render(<ToastProvider><PharmacySupplierRates locationId={locationId} onInvoice={invoice} /></ToastProvider>);
  expect(api.get).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText("Find medicine for rate comparison"), { target: { value: "Test" } }); expect(api.get).not.toHaveBeenCalled();
  await selectProduct(); expect(api.get).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole("button", { name: "Load supplier comparison" }));
  await screen.findByRole("region", { name: "Reviewed supplier rates" }); expect(screen.getByText("Net ₹0.1600 / tablet")).toBeInTheDocument(); expect(screen.getByText(/Including GST ₹0.1880/)).toBeInTheDocument(); expect(screen.getByText(/3 billed \+ 2 free · 0 received/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open source invoice BILL-1" })); expect(invoice).toHaveBeenCalledWith(purchaseId); expect(api.post).not.toHaveBeenCalled();
});
it("clears earlier prices when searching again and discards late results after branch changes", async () => {
  let finish!: (value: unknown) => void; const view = render(<ToastProvider><PharmacySupplierRates locationId={locationId} onInvoice={vi.fn()} /></ToastProvider>); await selectProduct(); api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Load supplier comparison" }));
  view.rerender(<ToastProvider><PharmacySupplierRates locationId="555555555555555555555555" onInvoice={vi.fn()} /></ToastProvider>); await act(async () => finish(response(data()))); expect(screen.queryByText("Test supplier")).not.toBeInTheDocument();
});
it("shows unit review rather than a misleading comparable price", async () => {
  const result = data(); result.items[0].state = "needs_review"; api.get.mockImplementation(async (url: string) => response(url.includes("supplier-rates") ? result : { items: [{ id: medicineId, name: "Test tablets" }], nextCursor: null }));
  render(<ToastProvider><PharmacySupplierRates locationId={locationId} onInvoice={vi.fn()} /></ToastProvider>); await selectProduct(); fireEvent.click(screen.getByRole("button", { name: "Load supplier comparison" })); await screen.findByText(/Unit review required/); expect(screen.queryByText("Net ₹0.1600 / tablet")).not.toBeInTheDocument();
});
it("mounts rate comparison only through an authorized purchase tab", async () => {
  const view = render(<ToastProvider><PharmacyPurchases locationId={locationId} canManage={false} canViewCost={false} /></ToastProvider>); await waitFor(() => expect(api.get).toHaveBeenCalledOnce()); expect(screen.queryByRole("tab", { name: "Compare supplier rates" })).not.toBeInTheDocument();
  view.rerender(<ToastProvider><PharmacyPurchases locationId={locationId} canManage={false} canViewCost /></ToastProvider>); fireEvent.click(screen.getByRole("tab", { name: "Compare supplier rates" })); await screen.findByRole("region", { name: "Supplier purchase-rate comparison" }); expect(api.get.mock.calls.every(([url]) => !url.includes("supplier-rates"))).toBe(true);
});
it.each(["scope", "currency", "quantity", "received", "date", "duplicates", "gross", "unit"])("rejects malformed %s comparison evidence", reason => {
  const result = data();
  if (reason === "scope") result.locationId = "other"; if (reason === "currency") result.currency = "USD"; if (reason === "quantity") result.items[0].freeUnits = -1; if (reason === "received") result.items[0].receivedUnits = 20; if (reason === "date") result.items[0].invoiceDate = "2026-02-30"; if (reason === "duplicates") { result.sourcePurchases = 2; result.items.push(result.items[0]); } if (reason === "gross") result.items[0].grossPaise = 10; if (reason === "unit") result.items[0].unitVersion = 0;
  expect(() => validateSupplierRates(result, locationId, medicineId)).toThrow(/could not be verified/);
});
it("rounds sub-paise unit rates only for display without overflowing intermediate products", () => {
  expect(unitRate(100, 3)).toBe("₹0.3333"); expect(unitRate(1, 6)).toBe("₹0.0017"); expect(unitRate(0, 10)).toBe("₹0.0000"); expect(unitRate(Number.MAX_SAFE_INTEGER, 1)).toBe("₹90071992547409.9100");
});
