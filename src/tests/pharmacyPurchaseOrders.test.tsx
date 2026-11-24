import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyPurchaseOrders } from "@/components/pharmacy/PharmacyPurchaseOrders";
import { PharmacyPurchaseOrderDocument, purchaseOrderCsv } from "@/components/pharmacy/PharmacyPurchaseOrderDocument";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import { listOrders, orderSeedFromPurchase, validatePurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { orderFixture, orderId, orderInvoiceId, orderLocationId, orderProduct, orderProductId, orderSupplier, orderSupplierId } from "./fixtures/pharmacyPurchaseOrder";
import api from "@/lib/api";
import { supplierResponseTemplate } from "@/lib/pharmacySupplierExchange";
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const print = vi.hoisted(() => ({ element: vi.fn() }));
vi.mock("@/lib/printBrand", () => ({ printElement: print.element, getPrintErrorMessage: () => "Print failed" }));
const result = (data: unknown) => ({ data: { data } });
let current: ReturnType<typeof orderFixture>;
beforeEach(async () => {
  vi.clearAllMocks(); sessionStorage.clear(); await clearPharmacyDrafts(); vi.stubGlobal("indexedDB", undefined); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "buyer", role: "purchaser", name: "Buyer", email: "buyer@example.test", organization_id: "org", permissions: ["PHARMACY_PURCHASE"] } });
  current = orderFixture();
  vi.mocked(api.get).mockImplementation(async path => {
    const url = String(path);
    if (url.includes("/purchase-order-commands/")) return result(current);
    if (url.includes("/history?")) return result({ items: [], nextCursor: null });
    if (url.includes(`/purchase-orders/${orderId}?`)) return result(current);
    if (url.startsWith("/pharmacy/purchase-orders?")) return result({ items: [current], nextCursor: null });
    if (url.startsWith("/pharmacy/parties")) return result({ items: [orderSupplier], nextCursor: null });
    if (url.startsWith("/pharmacy/purchase-products?")) return result({ items: [orderProduct], nextCursor: null });
    if (url.startsWith("/pharmacy/purchases?")) return result({ items: [{ id: orderInvoiceId, supplierInvoiceNumber: "ACTUAL-SUPPLIER-INVOICE", supplierId: orderSupplierId, status: "posted" }], nextCursor: null });
    throw Error(`Unexpected test URL ${url}`);
  });
  vi.mocked(api.post).mockResolvedValue(result(current)); vi.mocked(api.put).mockResolvedValue(result({ ...current, revision: 1 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = (canManage = true, extra = {}) => { const onOpenInvoice = vi.fn(); const view = render(<ToastProvider><PharmacyPurchaseOrders locationId={orderLocationId} canManage={canManage} onSeedClosed={vi.fn()} onOpenInvoice={onOpenInvoice} {...extra} /></ToastProvider>); return { ...view, onOpenInvoice }; };
function change(label: string, value: string) { const control = screen.getByLabelText(label), input = control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control; fireEvent.change(input, { target: { value } }); }
async function fill() {
  await waitFor(() => expect(screen.getByRole("button", { name: "New purchase order" })).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "New purchase order" }));
  const dialog = screen.getByRole("dialog", { name: "New purchase order" });
  await within(dialog).findByText(orderSupplier.name, { selector: "option" }); change("Order supplier", orderSupplierId);
  await within(dialog).findByText(orderProduct.name, { selector: "option" }); change("Order product", orderProductId); fireEvent.click(screen.getByRole("button", { name: "Add order product" }));
  change(`Order packs ${orderProduct.name}`, "2"); change(`Order loose units ${orderProduct.name}`, "1");
}
async function open() { fireEvent.click(await screen.findByRole("button", { name: "Open order PO-SYNTHETIC-1" })); return screen.findByRole("dialog", { name: "Purchase order PO-SYNTHETIC-1" }); }

it("creates an order from existing products and supplier without sending retail prices, schemes or stock", async () => {
  mount(); await fill(); fireEvent.click(screen.getByRole("button", { name: "Save order draft" }));
  await screen.findByRole("dialog", { name: "Purchase order PO-SYNTHETIC-1" });
  const [url, input, config] = vi.mocked(api.post).mock.calls[0]; expect(url).toBe("/pharmacy/purchase-orders");
  expect(input).toMatchObject({ locationId: orderLocationId, supplierId: orderSupplierId, expectedSupplierRevision: 0, lines: [{ medicineId: orderProductId, packs: 2, looseUnits: 1, expectedUnitVersion: 1 }] });
  expect(JSON.stringify(input)).not.toMatch(/stockQuantity|sellingPrice|baseAmount|scheme/); expect(config?.headers?.["Idempotency-Key"]).toBeTruthy();
});

it("retains a lost-response command across remount and recovers the original order without another POST", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(Error("Network response lost after commit")); const view = mount(); await fill(); fireEvent.click(screen.getByRole("button", { name: "Save order draft" }));
  await screen.findByText("Network response lost after commit"); expect(api.post).toHaveBeenCalledOnce();
  view.unmount(); mount(); const recover = await screen.findByRole("button", { name: "Check saved order result" }); fireEvent.click(recover);
  await screen.findByRole("dialog", { name: "Purchase order PO-SYNTHETIC-1" }); expect(api.post).toHaveBeenCalledOnce();
  expect(vi.mocked(api.get).mock.calls.some(([url]) => String(url).includes("/purchase-order-commands/"))).toBe(true);
});

it("retries the exact frozen payload with the same command key after uncertain failure", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(Error("Temporary outage")); mount(); await fill(); fireEvent.click(screen.getByRole("button", { name: "Save order draft" }));
  await screen.findByText("Temporary outage"); const original = structuredClone(vi.mocked(api.post).mock.calls[0]);
  expect(screen.getByLabelText(`Order packs ${orderProduct.name}`)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry original order request" })); await screen.findByRole("dialog", { name: "Purchase order PO-SYNTHETIC-1" });
  expect(vi.mocked(api.post).mock.calls[1]).toEqual(original);
});

it("records a supplier response only after confirmation and shows actual response quantities", async () => {
  current = orderFixture({ state: "submitted", status: "submitted", revision: 1 }); mount(); const dialog = await open();
  change(`Accepted base units ${orderProduct.name}`, "7"); change("Supplier price per base unit 1 (INR, optional)", "1.50"); change("Supplier availability / scheme note 1", "Seven available; remaining unavailable");
  change("Actual communication / review reference", "Supplier phone confirmation");
  expect(within(dialog).getByRole("button", { name: "Record order action" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /verified this order action/ })); fireEvent.click(screen.getByRole("button", { name: "Record order action" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce()); expect(vi.mocked(api.post).mock.calls[0]).toEqual([`/pharmacy/purchase-orders/${orderId}/actions`, expect.objectContaining({ action: "respond", expectedRevision: 1, confirmed: true, lines: [{ lineId: "order-line-0001", acceptedQuantity: 7, quotedUnitPricePaise: 150, note: "Seven available; remaining unavailable" }] }), expect.any(Object)]);
});

it("reviews a supplier response file in the existing form and records it only after actual communication confirmation", async () => {
  current = orderFixture({ state: "submitted", status: "submitted", revision: 1 }); mount(); await open();
  fireEvent.click(screen.getByText("Supplier response CSV"));
  fireEvent.click(screen.getByRole("checkbox", { name: /verified this order action/ }));
  const csv = supplierResponseTemplate(current).replace(/"21","","",""$/, '"21","7","1.05","Only seven available"');
  const file = new File([csv], "supplier-response.csv", { type: "text/csv" }); Object.defineProperty(file, "text", { value: async () => csv });
  fireEvent.change(screen.getByLabelText("Returned supplier response CSV"), { target: { files: [file] } });
  await screen.findByText("Supplier file ready for review");
  expect(screen.getByLabelText(`Accepted base units ${orderProduct.name}`)).toHaveValue(7);
  expect(screen.getByLabelText("Supplier price per base unit 1 (INR, optional)")).toHaveValue("1.05");
  expect(screen.getByRole("checkbox", { name: /verified this order action/ })).not.toBeChecked(); expect(api.post).not.toHaveBeenCalled();
  change("Actual communication / review reference", "Supplier returned CSV by email"); fireEvent.click(screen.getByRole("checkbox", { name: /verified this order action/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record order action" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ action: "respond", expectedRevision: 1, lines: [{ lineId: "order-line-0001", acceptedQuantity: 7, quotedUnitPricePaise: 105, note: "Only seven available" }] });
});

it("keeps all existing fields when a returned response file belongs to an earlier order revision", async () => {
  current = orderFixture({ state: "submitted", status: "submitted", revision: 2 }); mount(); await open();
  change(`Accepted base units ${orderProduct.name}`, "3"); fireEvent.click(screen.getByText("Supplier response CSV"));
  const csv = supplierResponseTemplate({ ...current, revision: 1 }), file = new File([csv], "old.csv"); Object.defineProperty(file, "text", { value: async () => csv });
  fireEvent.change(screen.getByLabelText("Returned supplier response CSV"), { target: { files: [file] } });
  await screen.findByText(/differs from this order, revision/); expect(screen.getByLabelText(`Accepted base units ${orderProduct.name}`)).toHaveValue(3); expect(api.post).not.toHaveBeenCalled();
});

it("limits invoice lookup to posted, unlinked invoices from this supplier and opens the existing receiver", async () => {
  current = orderFixture({ state: "dispatched", status: "billed", invoiceCount: 1, invoices: [{ id: orderInvoiceId, number: "BILL-1", payablePaise: 1000, receiptCount: 0, revision: 1 }] });
  const view = mount(); await open();
  await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([url]) => String(url).includes(`/purchases?`) && String(url).includes(`supplierId=${orderSupplierId}`) && String(url).includes("status=posted") && String(url).includes("unlinked=true"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Review / receive BILL-1" })); expect(view.onOpenInvoice).toHaveBeenCalledWith(orderInvoiceId); expect(api.post).not.toHaveBeenCalled();
});

it("reorders quantities into a draft and requires selecting actual current supplier terms", async () => {
  mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "Reorder products" }));
  await screen.findByRole("dialog", { name: "New purchase order" }); expect(screen.getByLabelText(`Order packs ${orderProduct.name}`)).toHaveValue(2); expect(screen.getByLabelText(`Order loose units ${orderProduct.name}`)).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Save order draft" })); await screen.findByText("Select an active supplier and at least one product."); expect(api.post).not.toHaveBeenCalled();
});

it.each(["billed", "partially_received", "received"])("shows current %s fulfilment separately from supplier dispatch in order history", async status => {
  current = orderFixture({ state: "dispatched", status, invoiceCount: 1 }); mount();
  expect(await screen.findByText(`Fulfilment: ${status.replaceAll("_", " ")}`)).toBeVisible();
  expect(screen.getByText(/Supplier stage: dispatched/)).toBeVisible();
  expect(api.post).not.toHaveBeenCalled();
});

it("rejects an unconfirmed order-list fulfilment status", async () => {
  current = orderFixture({ status: "invented-delivery-promise" });
  await expect(listOrders(orderLocationId, "", undefined, undefined, new AbortController().signal)).rejects.toThrow(/could not be confirmed/);
});

it("keeps write actions unavailable to viewers", async () => {
  mount(false); await open(); expect(screen.queryByRole("button", { name: "New purchase order" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Record order action" })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

it("reorders actual posted invoice quantities and combines duplicate product lines without copying prices", () => {
  const source = { lineId: "invoice-line-1", medicineId: orderProductId, medicineSnapshot: { name: orderProduct.name }, unitSnapshot: orderProduct.unitDefinition,
    packs: 1, looseUnits: 0, freePacks: 0, freeLooseUnits: 1, billedBaseUnits: 10, freeBaseUnits: 1, sellingPricePaise: 99999 };
  const purchase = { status: "posted", revision: 1, supplierInvoiceNumber: "ACTUAL-BILL", lines: [source, { ...source, lineId: "invoice-line-2" }], receiptProgress: [{ lineId: "invoice-line-1", billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 }, { lineId: "invoice-line-2", billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 }] } as unknown as PurchaseDraft;
  const seed = orderSeedFromPurchase(purchase); expect(seed.lines).toHaveLength(1); expect(seed.lines[0]).toMatchObject({ quantity: 22, product: { price: 0 } });
  expect(() => orderSeedFromPurchase({ ...purchase, status: "draft" })).toThrow(/posted/);
});

it("validates branch/product reconciliation and safely exports a real order document", async () => {
  expect(() => validatePurchaseOrder(current, "f".repeat(24))).toThrow(/incomplete/);
  expect(() => validatePurchaseOrder({ ...current, comparison: [{ ...current.comparison[0], received: 10, invoiced: 1 }] }, orderLocationId)).toThrow(/incomplete/);
  const malicious = orderFixture({ reference: "=FORMULA", lines: [{ ...current.lines[0], medicineSnapshot: { name: '<img src=x onerror="alert(1)">' } }] });
  expect(purchaseOrderCsv(malicious)).toContain("'=FORMULA");
  render(<ToastProvider><PharmacyPurchaseOrderDocument order={malicious} onClose={vi.fn()} /></ToastProvider>);
  expect(document.querySelector("img[src=x]")).toBeNull(); expect(screen.getByText(/not a tax invoice/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Print Purchase order/ })); await waitFor(() => expect(print.element).toHaveBeenCalledOnce()); expect(print.element.mock.calls[0][1]).toMatchObject({ paper: "A4" });
});
