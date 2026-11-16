import { drawerFixture } from "./fixtures/pharmacyDrawer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyCounter } from "@/components/pharmacy/PharmacyCounter";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { quoteCounter } from "@/lib/pharmacyCounter";
import { referenceOwnerKey } from "@/lib/authScope";
import * as catalogueModule from "@/lib/pharmacyCatalogue";
import * as journalModule from "@/lib/pharmacyCommandJournal";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const device = vi.hoisted(() => ({ ready: true }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("@/lib/pharmacyOfflineSession", () => ({ readOfflineSession: vi.fn(async () => null) }));
vi.mock("@/components/pharmacy/PharmacySavedBillPrint", () => ({ PharmacySavedBillPrint: ({ invoiceId }: { invoiceId: string }) => <span data-testid="saved-print-request">{invoiceId}</span> }));
vi.mock("@/hooks/usePharmacyDraft", () => ({ usePharmacyDraft: () => ({ ready: device.ready, error: "", status: "", flush: async () => {} }) }));
const response = (data: unknown) => ({ data: { data } });
const product = { id: "medicine", name: "Ordinary product", genericName: "Synthetic", eligible: true, stockQuantity: 20, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const bill = { invoiceId: "invoice", dispenseId: "dispense", invoiceNumber: "I00012627/000001", totalPaise: 2000, status: "unpaid" };
const invoice = { id: "invoice", kind: "pharmacy", locationId: "branch", invoiceNumber: bill.invoiceNumber, totalAmount: 20, balanceDue: 20, amountPaid: 0, paymentRevision: 0, currency: "INR", status: "unpaid", customerSnapshot: { anonymous: true }, items: [] };
function receipt(body: any, key: string) { return { receiptId: "receipt", invoiceId: "invoice", invoiceNumber: bill.invoiceNumber, locationId: "branch", currency: "INR", actorId: "cashier", paidAt: "2026-10-20T08:00:00Z", creditedPaise: 0, collectedPaise: body.entries.reduce((sum: number, entry: any) => sum + entry.amountPaise, 0), paidPaise: body.entries.reduce((sum: number, entry: any) => sum + entry.amountPaise, 0), balancePaise: 0, revision: 1, cashTenderedPaise: body.cashTenderedPaise, cashChangePaise: body.cashTenderedPaise - body.entries.filter((entry: any) => entry.paymentMethod === "cash").reduce((sum: number, entry: any) => sum + entry.amountPaise, 0), status: "paid", evidenceMode: "staff_confirmed_manual", shiftId: drawerFixture.id, drawerCode: drawerFixture.drawerCode, entries: body.entries, requestKey: key }; }
const mount = (canCollect = true, locationId = "branch", canReviewProducts = false) => render(<ToastProvider><PharmacyCounter locationId={locationId} canCollect={canCollect} canReviewProducts={canReviewProducts} /></ToastProvider>);
it("adds a zero-stock catalogue item in billing-only mode and sends its mode with a locally priced Save", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, stockQuantity: 0, retailPricePaise: 1000 }], nextCursor: null }) : get(url, config));
  render(<ToastProvider><PharmacyCounter locationId="branch" inventoryMode="billing_only" canCollect={false} /></ToastProvider>);
  const add = await screen.findByRole("button", { name: "Add Ordinary product" });
  expect(add).toBeEnabled(); expect(add).toHaveTextContent("Stock not tracked");
  fireEvent.click(add); change("Quantity Ordinary product", "2");
  expect(screen.getByLabelText("Bill total")).toHaveTextContent("20.00");
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await waitFor(() => expect(api.post.mock.calls.some(([url]) => url === "/pharmacy/sales")).toBe(true));
  expect(api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")?.[1]).toMatchObject({ expectedInventoryMode: "billing_only", confirmationMode: "current_total", lines: [{ quantity: 2, expectedLineTotalPaise: 2000 }] });
});
function change(label: string, value: string) {
  const lineEdit = /^(Packs |Loose units |Discount Ordinary)/.test(label);
  if (lineEdit && !screen.queryByLabelText(label)) fireEvent.click(screen.getByRole("button", { name: "Edit item Ordinary product" }));
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  if (lineEdit) fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
}

it("loads the bounded branch list on entry and keeps retail display prices separate from a trusted quote", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, rackLocation: "A3 / Shelf 2", retailPricePaise: 1525 }], nextCursor: null }) : get(url, config));
  mount(false);
  const add = await screen.findByRole("button", { name: "Add Ordinary product" }, { timeout: 5000 });
  expect(screen.queryByRole("region", { name: "Counter summary" })).not.toBeInTheDocument();
  expect(add).toHaveTextContent("15.25");
  expect(add).toHaveTextContent("Rack A3 / Shelf 2");
  expect(api.get).toHaveBeenCalledWith("/pharmacy/sales/products?locationId=branch&search=", expect.any(Object));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(add); await review();
  expect(screen.getByLabelText("Pricing Ordinary product")).toHaveTextContent("10.00");
  expect(screen.getByRole("group", { name: "Cart Ordinary product" })).toHaveTextContent("Rack A3 / Shelf 2");
});
it("calculates quantity edits locally and asks for review when fresh server prices differ on Save", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, retailPricePaise: 1500 }], nextCursor: null }) : get(url, config));
  mount(false); fireEvent.click(await screen.findByRole("button", { name: "Add Ordinary product" }));
  change("Quantity Ordinary product", "3");
  expect(screen.getByLabelText("Bill total")).toHaveTextContent("45.00");
  expect(screen.getByLabelText("Pricing Ordinary product")).not.toHaveTextContent("est.");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText(/The current total changed/);
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(screen.getByLabelText("Bill total")).toHaveTextContent("20.00");
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/quote"))).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(2);
});
it("blocks cash Save without sufficient tender or an open payment drawer", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url === "/pharmacy/till" ? response({ active: null }) : get(url, config));
  mount(); await scan(); await review();
  await screen.findByText("Open your cash drawer first");
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  fireEvent.keyDown(window, { key: "F10" });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
});
it("Save and print waits for the confirmed payment and prints only the saved invoice", async () => {
  const post = api.post.getMockImplementation()!;
  let finish!: (value: unknown) => void;
  api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? new Promise(resolve => { finish = async value => resolve(value ?? await post(url, body, config)); }) : post(url, body, config));
  mount(); await scan(); await review();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save and print counter bill" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save and print counter bill" }));
  await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1));
  expect(screen.queryByTestId("saved-print-request")).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "F10" });
  await act(async () => { finish(undefined); });
  await screen.findByTestId("saved-print-request");
  expect(screen.getByTestId("saved-print-request")).toHaveTextContent("invoice");
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
  expect(api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")?.[1].includeDocument).toBe(true);
});

it("saves a priced local cart with one atomic request and no preflight quote", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? Promise.resolve(response({ items: [{ ...product, retailPricePaise: 2000 }], nextCursor: null })) : get(url, config));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Add Ordinary product" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][1]).toMatchObject({ confirmationMode: "current_total", expectedTotalPaise: 2000, lines: [{ medicineId: product.id, quantity: 1, expectedUnitVersion: 1, expectedLineTotalPaise: 2000 }], payment: { expectedBalancePaise: 2000 } });
  expect(api.post.mock.calls[0][1]).not.toHaveProperty("expectedQuoteHash");
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
});
it("refuses insufficient cash before making an invoice or collection", async () => {
  mount(); await scan(); await review(); change("Cash received (INR)", "19.99");
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  fireEvent.keyDown(window, { key: "F10" });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
});
it("preserves actual cash and clears a digital reference when fresh prices change the total", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, retailPricePaise: 1500 }], nextCursor: null }) : get(url, config));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Add Ordinary product" }));
  change("Cash received (INR)", "100");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText(/The current total changed/);
  expect(screen.getByLabelText("Cash received (INR)")).toHaveValue(100);
  expect(screen.getByText("Change to return").parentElement).toHaveTextContent("80.00");
  // A later cart edit invalidates the quote and digital approval for its new total.
  fireEvent.click(within(screen.getByRole("group", { name: "Preferred payment method" })).getByRole("button", { name: "UPI" }));
  change("Verified payment reference", "OLD-AMOUNT-REFERENCE");
  change("Invoice discount (INR)", "0.01");
  const post = api.post.getMockImplementation()!;
  api.post.mockImplementation(async (url, body, config) => {
    if (!url.endsWith("/quote")) return post(url, body, config);
    const changed = quote(body); changed.calculation.totals.payablePaise = 2100; changed.calculation.totals.baseAmountPaise = 2100; changed.calculation.lines[0].grossAmountPaise = 2100; changed.issueInput.expectedTotalPaise = 2100;
    return response(changed);
  });
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await waitFor(() => expect(screen.getByLabelText("Bill total")).toHaveTextContent("21.00"));
  expect(screen.getByLabelText("Verified payment reference")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(2);
});
it("does not complete or collect when transactional stock validation fails during Save", async () => {
  mount(); await scan(); await review();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: "Insufficient current stock" } } });
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText("Insufficient current stock");
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
});
it("opens pack and discount editing in a dialog and keeps it out of the bill rows", async () => {
  mount(false); await scan();
  expect(screen.queryByLabelText("Packs Ordinary product")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit item Ordinary product" }));
  const dialog = screen.getByRole("dialog", { name: "Edit item" });
  fireEvent.change(within(dialog).getByLabelText("Packs Ordinary product"), { target: { value: "1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Done", exact: true }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(11);
  expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("closes a held bill only after confirmation and preserves the active bill", async () => {
  mount(false); await scan(); fireEvent.keyDown(window, { key: "F2" });
  await scan(); change("Quantity Ordinary product", "4");
  fireEvent.keyDown(window, { key: "2", altKey: true }); expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  fireEvent.keyDown(window, { key: "2", altKey: true }); expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(4);
  fireEvent.click(screen.getByRole("button", { name: "Close held bill 1" }));
  let dialog = screen.getByRole("dialog", { name: "Close held bill?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: /Resume held cart 1/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close held bill 1" }));
  dialog = screen.getByRole("dialog", { name: "Close held bill?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Close held bill", exact: true }));
  expect(screen.queryByRole("button", { name: /Resume held cart/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(4);
  expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("requires a recorded customer for Credit and saves the unpaid invoice without recording a collection", async () => {
  mount(); await scan(); await review();
  expect(screen.getByRole("button", { name: "Credit", exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  expect(screen.getByRole("button", { name: "Credit", exact: true })).toBeDisabled();
  change("Find recorded customer", "Actual"); fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  fireEvent.click(await screen.findByRole("button", { name: "Select customer Actual customer" }));
  fireEvent.click(screen.getByRole("button", { name: "Credit", exact: true }));
  await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")![1]).toMatchObject({ customerId: "customer" });
  expect(api.post.mock.calls.some(([url]) => url.endsWith("/collections"))).toBe(false);
  expect(screen.queryByRole("dialog", { name: "Collect payment" })).not.toBeInTheDocument();
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
});

it("finds products while typing, adds the single match with Enter and edits quantities directly", async () => {
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); change("Scan barcode or search products", "Ordinary");
  await screen.findByRole("button", { name: "Add Ordinary product" });
  fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
  await screen.findByLabelText("Quantity Ordinary product");
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity Ordinary product" }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(2);
  fireEvent.click(screen.getByRole("button", { name: "+1 strip (10)" }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(12);
  fireEvent.click(screen.getByRole("button", { name: "Decrease quantity Ordinary product" }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(11);
  await review();
  expect(api.post.mock.calls.every(call => call[0] === "/pharmacy/sales/quote")).toBe(true);
});
it("keeps both carts when opening a new bill and switching between held drafts", async () => {
  mount(false); await scan(); change("Quantity Ordinary product", "3"); change("Invoice discount (INR)", "1");
  fireEvent.keyDown(window, { key: "F2" });
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  await scan(); change("Quantity Ordinary product", "7");
  fireEvent.click(screen.getByRole("button", { name: /Resume held cart 1/ }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(3);
  expect(screen.getByLabelText("Invoice discount (INR)")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: /Resume held cart 1/ }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(7);
  expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("filters current product results and adds the highlighted result with keyboard navigation", async () => {
  const get = api.get.getMockImplementation()!;
  const capsule = { ...product, id: "capsule", name: "Synthetic capsule", unitDefinition: { ...product.unitDefinition, baseUnit: "capsule" } };
  api.get.mockImplementation(async (url, config) => url.includes("/sales/products?") ? response({ items: [product, capsule], nextCursor: null }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  change("Scan barcode or search products", "Synthetic"); fireEvent.click(screen.getByRole("button", { name: "Search products" }));
  await screen.findByRole("button", { name: "Add Synthetic capsule" });
  fireEvent.click(screen.getByRole("button", { name: "Capsules", exact: true }));
  expect(screen.queryByRole("button", { name: "Add Ordinary product" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All", exact: true }));
  fireEvent.keyDown(screen.getByLabelText("Scan barcode or search products"), { key: "ArrowDown" });
  fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
  expect(screen.getByLabelText("Quantity Synthetic capsule")).toHaveValue(1);
  expect(screen.queryByLabelText("Quantity Ordinary product")).not.toBeInTheDocument();
});
it("saves confirmed cash once without a second collection dialog or a completion banner", async () => {
  mount(); await scan(); await review(); change("Cash received (INR)", "50");
  expect(screen.getByText("Change to return").parentElement).toHaveTextContent("30.00");
  await save(); await screen.findByRole("button", { name: "View last saved bill" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Sale complete")).not.toBeInTheDocument();
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  const payments = api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales");
  expect(payments).toHaveLength(1);
  expect(payments[0][1].payment).toMatchObject({ cashTenderedPaise: 5000, expectedBalancePaise: 2000, manualConfirmed: true, entries: [expect.objectContaining({ amountPaise: 2000, paymentMethod: "cash" })] });
  expect(api.get.mock.calls.some(([url]) => url.startsWith("/pharmacy/invoices/invoice?"))).toBe(false);
});
it.each(["UPI", "Card"])("saves %s only with a verified reference captured in the counter", async label => {
  mount(); await scan(); await review();
  fireEvent.click(within(screen.getByRole("group", { name: "Preferred payment method" })).getByRole("button", { name: label }));
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  change("Verified payment reference", "VERIFIED-123");
  await save(); await screen.findByRole("button", { name: "View last saved bill" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")![1].payment).toMatchObject({ cashTenderedPaise: 0, entries: [expect.objectContaining({ paymentMethod: label.toLowerCase(), referenceNumber: "VERIFIED-123" })] });
});
it("requires selection of a recorded customer before billing or using the issue shortcut", async () => {
  mount(false); await scan(); await review();
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  await review(); expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  fireEvent.keyDown(window, { key: "F10" });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
  change("Find recorded customer", "Actual"); fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  fireEvent.click(await screen.findByRole("button", { name: "Select customer Actual customer" }));
  await review(); expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled();
});
it("changes mobile panels without changing the cart and scopes destructive shortcuts to confirmation", async () => {
  mount(false); await scan();
  const nav = screen.getByRole("navigation", { name: "Counter workspace panels" });
  fireEvent.click(within(nav).getByRole("button", { name: "Cart (1)", exact: true }));
  expect(within(nav).getByRole("button", { name: "Cart (1)", exact: true })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(nav).getByRole("button", { name: /^Pay/ }));
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  fireEvent.keyDown(window, { key: "Delete", ctrlKey: true });
  await screen.findByRole("dialog", { name: "Clear this cart?" });
  fireEvent.keyDown(window, { key: "F2" });
  expect(screen.queryByRole("button", { name: /Resume held cart/ })).not.toBeInTheDocument();
});
it("requires confirmation to clear the cart and allows cancelling", async () => {
  mount(false); await scan(); fireEvent.click(screen.getByRole("button", { name: "Clear cart", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Clear this cart?" })).not.toBeInTheDocument());
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear cart", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Clear this cart?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear cart", exact: true }));
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(screen.getByLabelText("Invoice discount (INR)")).toHaveValue(0);
});
async function scan() { await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); change("Scan barcode or search products", "000123"); fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!); await screen.findByLabelText("Quantity Ordinary product"); }
async function review() { if (!screen.queryByRole("region", { name: "Trusted counter quote" })) { await waitFor(() => expect(screen.getByRole("button", { name: "Refresh prices" })).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "Refresh prices" })); } await screen.findByRole("region", { name: "Trusted counter quote" }, { timeout: 3000 }); }
async function save() { await review(); await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await waitFor(() => expect(screen.queryByText(`Bill ${bill.invoiceNumber} saved`) || screen.queryByRole("button", { name: "View last saved bill" })).toBeTruthy()); }
function quote(body: any) {
  const quoteHash = "a".repeat(64), totals = { payablePaise: 2000, baseAmountPaise: 2000, cgstPaise: 0, sgstPaise: 0, lineDiscountPaise: 0, invoiceDiscountPaise: body.invoiceDiscountPaise, roundOffPaise: 0 };
  return { locationId: body.locationId, currency: "INR", quoteHash, customer: body.customerId ? { id: body.customerId, name: "Actual customer" } : null, calculation: { policy: "pharmacy-paise-v2", lines: body.lines.map((line: any, index: number) => ({ lineId: line.lineId, quantity: line.quantity, grossAmountPaise: index === 0 ? 2000 : 0 })), totals },
    issueInput: { ...body, ...(body.customerId ? { expectedCustomerRevision: 0 } : {}), expectedProfileRevision: 1, expectedTotalPaise: 2000, expectedQuoteHash: quoteHash, lines: body.lines.map((line: any) => ({ ...line, expectedUnitVersion: 1, expectedStockRevision: 1 })) },
    lines: body.lines.map((line: any) => ({ ...line, description: product.name, unitSnapshot: { baseUnit: "tablet" }, batches: [{ batchNumber: "ACTUAL", quantity: line.quantity, expiryValue: "2099-12", sellingPricePaise: 1000, mrpPaise: 1200 }] })) };
}
beforeEach(() => {
  device.ready = true;
  useAuthStore.setState({ user: { id: "cashier", name: "Cashier", role: "cashier", email: "cashier@example.test", organization_id: "org", permissions: ["PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT"] } });
  sessionStorage.clear();
  api.put.mockReset();
  api.get.mockReset().mockImplementation(async (url: string) => url === "/pharmacy/till" ? response({ active: drawerFixture }) : url.includes("/sales/products?") ? response({ items: [product], nextCursor: null }) : url.includes("/sales/customers?") ? response({ items: [{ id: "customer", name: "Actual customer", address: "Actual address", revision: 0 }], nextCursor: null }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [], nextCursor: null }));
  api.post.mockReset().mockImplementation(async (url: string, body: any, config: any) => {
    if (url.endsWith("/quote")) return response(quote(body));
    if (url === "/pharmacy/sales") {
      if (body.confirmationMode === "current_total" && body.expectedTotalPaise !== bill.totalPaise) throw { response: { status: 409, data: { details: { code: "COUNTER_TOTAL_CHANGED" } } } };
      return response({ ...bill, requestKey: config.headers["Idempotency-Key"], ...(body.payment ? { status: "paid", collection: receipt(body.payment, config.headers["Idempotency-Key"]) } : {}) });
    }
    return response(receipt(body, config.headers["Idempotency-Key"]));
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });
it("keeps one loading surface until draft, catalogue and sale journal have all restored", async () => {
  device.ready = false;
  let finishCatalogue!: () => void;
  let finishJournal!: (value: { value: null; durable: boolean }) => void;
  const catalogueWait = new Promise<void>(resolve => { finishCatalogue = resolve; });
  const journalWait = new Promise<{ value: null; durable: boolean }>(resolve => { finishJournal = resolve; });
  const createCatalogue = catalogueModule.createPharmacyCatalogue, createJournal = journalModule.createSaleJournal;
  vi.spyOn(catalogueModule, "createPharmacyCatalogue").mockImplementation((...args) => ({ ...createCatalogue(...args), load: () => catalogueWait }));
  vi.spyOn(journalModule, "createSaleJournal").mockImplementation((...args) => ({ ...createJournal(...args), load: () => journalWait }));
  const view = mount(false);
  const loading = screen.getByRole("status", { name: "Loading pharmacy" });
  expect(screen.getAllByRole("status", { name: "Loading pharmacy" })).toHaveLength(1);
  expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Scan barcode or search products")).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "F10" });
  await act(async () => { finishCatalogue(); });
  expect(screen.getByRole("status", { name: "Loading pharmacy" })).toBe(loading);
  device.ready = true;
  view.rerender(<ToastProvider><PharmacyCounter locationId="branch" canCollect={false} /></ToastProvider>);
  expect(screen.getByRole("status", { name: "Loading pharmacy" })).toBe(loading);
  await act(async () => { finishJournal({ value: null, durable: true }); });
  expect(screen.queryByRole("status", { name: "Loading pharmacy" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled();
  expect(api.post).not.toHaveBeenCalled();
});
it("keeps the counter recoverable when the saved sale journal cannot be read", async () => {
  const createJournal = journalModule.createSaleJournal;
  vi.spyOn(journalModule, "createSaleJournal").mockImplementation((...args) => ({ ...createJournal(...args), load: async () => { throw new Error("Saved sale intent needs review"); } }));
  mount(false);
  await screen.findByText("Counter needs attention");
  expect(screen.getByRole("alert")).toHaveTextContent("Saved sale intent needs review");
  expect(screen.queryByRole("status", { name: "Loading pharmacy" })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("adds a ready product, automatically prices each cart line and omits unnecessary review actions", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "admin", permissions: ["MANAGE_ORGANIZATION", "PHARMACY_SELL"] } });
  mount(false, "branch", true);
  await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  change("Scan barcode or search products", "Ordinary"); fireEvent.click(screen.getByRole("button", { name: "Search products" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add Ordinary product" }));
  expect(screen.getByText(/Added 1 tablet of Ordinary product to cart/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Review.*product/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Ordinary product" })).toBeEnabled();
  await review(); expect(screen.getByLabelText("Pricing Ordinary product")).toHaveTextContent(/10.00 per tablet/);
  expect(screen.getByLabelText("Pricing Ordinary product")).toHaveTextContent(/Line total.*20.00/);
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled();
  change("Loose units Ordinary product", "3");
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled();
  expect(screen.getByLabelText("Pricing Ordinary product")).toHaveTextContent("30.00");
  expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true); expect(api.put).not.toHaveBeenCalled();
});
it.each(["missing", "wrong quantity", "wrong total", "duplicate"])("rejects %s calculated line prices before enabling issue", async kind => {
  const input = { locationId: "branch", invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line-1", medicineId: "medicine", quantity: 1, expectedUnitVersion: 1, discountPaise: 0 }] };
  const value = quote(input);
  if (kind === "missing") delete (value.calculation as any).lines;
  if (kind === "wrong quantity") value.calculation.lines[0].quantity = 2;
  if (kind === "wrong total") value.calculation.lines[0].grossAmountPaise = 1000;
  if (kind === "duplicate") value.calculation.lines.push(value.calculation.lines[0]);
  api.post.mockResolvedValueOnce(response(value));
  await expect(quoteCounter(input)).rejects.toThrow(/could not be confirmed/);
});
it("scans exact leading-zero barcode, edits pack quantity, issues fresh evidence and collects once", async () => {
  mount(); await scan(); expect(api.get).toHaveBeenCalledWith(expect.stringContaining("barcode=000123"), expect.any(Object));
  change("Packs Ordinary product", "1"); change("Loose units Ordinary product", "2");
  await save(); await screen.findByRole("button", { name: "View last saved bill" });
  const issued = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")!;
  expect(issued[1]).toMatchObject({ lines: [{ quantity: 12, expectedStockRevision: 1 }], expectedQuoteHash: "a".repeat(64) });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
  expect(Object.keys(sessionStorage).filter(key => key.startsWith("pharmacy-")).length).toBe(0);
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
});
it("resolves a different pending collection before issuing the new cart and never marks the cart paid", async () => {
  const requestKey = "old-pending-collection", owner = referenceOwnerKey(useAuthStore.getState().user);
  sessionStorage.setItem(`pharmacy-collection:${owner}:branch`, JSON.stringify({ key: requestKey, invoiceId: "other-invoice" }));
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/collection-operations/") ? response({ ...receipt({ entries: [{ componentId: "one", amountPaise: 2000, paymentMethod: "cash" }], cashTenderedPaise: 2000 }, requestKey), invoiceId: "other-invoice", invoiceNumber: "OLD-001" }) : get(url, config));
  mount(); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByRole("dialog", { name: "Resolve earlier payment" });
  fireEvent.click(screen.getByRole("button", { name: "Check collection result" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "View last saved bill" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
});

it("invalidates quote after edits, holds a cart without a write and requires a fresh quote on resume", async () => {
  mount(); await scan(); await review(); change("Loose units Ordinary product", "3"); expect(screen.queryByRole("region", { name: "Trusted counter quote" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hold cart" })); expect(screen.queryByLabelText("Quantity Ordinary product")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Resume held cart 1/ })); expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(3); expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled(); expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("retries a frozen sale under the same key, then gives a separate purchase a new identity", async () => {
  const post = api.post.getMockImplementation()!; let failed = false; api.post.mockImplementation((url, body, config) => { if (url === "/pharmacy/sales" && !failed) { failed = true; return Promise.reject(new Error("response lost")); } return post(url, body, config); }); mount(false); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await screen.findByText("response lost");
  fireEvent.keyDown(window, { key: "F2" }); fireEvent.keyDown(window, { key: "2", altKey: true });
  expect(screen.queryByRole("button", { name: /Resume held cart/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  const first = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")!; fireEvent.click(screen.getByRole("button", { name: "Retry same sale" })); await screen.findByRole("button", { name: "View last saved bill" }); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")[1]).toEqual(first);
  await scan(); await save(); const issues = api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales"); expect(issues[2][2].headers["Idempotency-Key"]).not.toBe(first[2].headers["Idempotency-Key"]);
});
it("recovers an uncertain sale after reload without another issue or money mutation", async () => {
  const post = api.post.getMockImplementation()!; api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? Promise.reject(new Error("timeout")) : post(url, body, config)); const view = mount(false); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await screen.findByText("timeout");
  const key = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")![2].headers["Idempotency-Key"]; view.unmount(); const original = api.get.getMockImplementation()!; api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/sale-operations/") ? response({ ...bill, requestKey: key }) : original(url, config));
  mount(false); fireEvent.click(await screen.findByRole("button", { name: "Check sale result" })); await screen.findByText(`Bill ${bill.invoiceNumber} saved`); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
});
it("retries an uncertain paid save with the same frozen bill and payment without a second money command", async () => {
  const post = api.post.getMockImplementation()!; let failed = false;
  api.post.mockImplementation((url, body, config) => { if (url === "/pharmacy/sales" && !failed) { failed = true; return Promise.reject(new Error("Save response lost")); } return post(url, body, config); });
  mount(); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await screen.findByText("Save response lost");
  const first = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")!;
  expect(first[1].payment).toMatchObject({ expectedBalancePaise: 2000, manualConfirmed: true });
  expect(screen.queryByText("Bill " + bill.invoiceNumber + " saved")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry same sale" }));
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")[1]).toEqual(first);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
});

it("recovers an issued bill without automatically treating a restored preference as payment confirmation", async () => {
  const owner = referenceOwnerKey(useAuthStore.getState().user);
  sessionStorage.setItem("pharmacy-sale:" + owner + ":branch", "recovered-sale-key");
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sale-operations/") ? Promise.resolve(response({ ...bill, requestKey: "recovered-sale-key" })) : get(url, config));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Check sale result" }));
  await screen.findByRole("button", { name: "Record payment" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /I confirmed/ })).not.toBeChecked();
  expect(api.post).not.toHaveBeenCalled();
});
it("in-session sale recovery stays read-only even after Save captured payment details", async () => {
  const post = api.post.getMockImplementation()!, get = api.get.getMockImplementation()!;
  let key = "";
  api.post.mockImplementation((url, body, config) => { if (url === "/pharmacy/sales") { key = config.headers["Idempotency-Key"]; return Promise.reject(new Error("Invoice reply lost")); } return post(url, body, config); });
  api.get.mockImplementation((url, config) => url.includes("/sale-operations/") ? Promise.resolve(response({ ...bill, requestKey: key })) : get(url, config));
  mount(); await scan(); await review();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText("Invoice reply lost");
  fireEvent.click(screen.getByRole("button", { name: "Check sale result" }));
  await screen.findByRole("button", { name: "Record payment" });
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
  expect(screen.getByRole("checkbox", { name: /I confirmed/ })).not.toBeChecked();
});
it("finishes a fully discounted zero-value bill without a collection popup or zero-value receipt", async () => {
  api.post.mockImplementation(async (url, body, config) => {
    if (url.endsWith("/quote")) { const q = quote(body); q.calculation.lines[0].grossAmountPaise = 0; q.calculation.totals.payablePaise = 0; q.calculation.totals.baseAmountPaise = 0; q.issueInput.expectedTotalPaise = 0; q.lines[0].batches[0].sellingPricePaise = 2000; q.lines[0].batches[0].mrpPaise = 2400; return response(q); }
    return response({ ...bill, totalPaise: 0, status: "paid", requestKey: config.headers["Idempotency-Key"] });
  });
  mount(); await scan(); change("Invoice discount (INR)", "20"); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByRole("button", { name: "View last saved bill" }); expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(api.post.mock.calls.filter(([url]) => url.includes("/collections"))).toHaveLength(0);
});
it("selects an existing customer through sales lookup and sends only its identity to the quote", async () => {
  mount(false); await scan(); fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true })); change("Find recorded customer", "Actual"); fireEvent.click(screen.getByRole("button", { name: "Search customers" })); fireEvent.click(await screen.findByRole("button", { name: "Select customer Actual customer" })); await review(); expect(api.post.mock.calls.at(-1)![1]).toMatchObject({ customerId: "customer" }); expect(api.post.mock.calls.at(-1)![1]).not.toHaveProperty("expectedCustomerRevision");
});
it("prevents issue if recovery storage fails", async () => {
  mount(); await scan(); await review(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); }); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await screen.findByText("storage unavailable"); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
});
it("ignores a late quote after cart edits and a late issue after branch change", async () => {
  let finish!: (value: unknown) => void; const view = mount(false); await scan(); api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1)); const body = api.post.mock.calls[0][1]; change("Loose units Ordinary product", "3"); await act(async () => { finish(response(quote(body))); }); expect(screen.queryByRole("region", { name: "Trusted counter quote" })).not.toBeInTheDocument();
  await review(); const post = api.post.getMockImplementation()!; api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? new Promise(resolve => { finish = resolve; }) : post(url, body, config)); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1)); const key = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")![2].headers["Idempotency-Key"];
  view.rerender(<ToastProvider><PharmacyCounter locationId="other-branch" canCollect={false} /></ToastProvider>); await act(async () => { finish(response({ ...bill, requestKey: key })); }); expect(screen.queryByText(`Bill ${bill.invoiceNumber} saved`)).not.toBeInTheDocument(); expect(screen.queryByLabelText("Quantity Ordinary product")).not.toBeInTheDocument(); expect(Object.keys(sessionStorage).filter(key => key.startsWith("pharmacy-")).length).toBe(1);
});
it("shows a cashier why a blocked product needs administrator review without allowing approval", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/sales/products?") ? response({ items: [{ ...product, eligible: false }], nextCursor: null }) : get(url, config));
  mount(); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "Search products" }));
  await screen.findByText("Product review required"); expect(screen.getByText(/Ask your organization administrator/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Review product/ })).not.toBeInTheDocument(); expect(api.put).not.toHaveBeenCalled();
});
it("explains an empty branch after initial loading and an unmatched name after searching", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/sales/products?") || url.includes("/sales/customers?") ? response({ items: [], nextCursor: null }) : get(url, config));
  mount(); await screen.findByText("No products at this branch"); expect(screen.queryByText("No products found")).not.toBeInTheDocument();
  change("Scan barcode or search products", "Missing"); fireEvent.click(screen.getByRole("button", { name: "Search products" })); await screen.findByText("No products found");
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true })); fireEvent.click(screen.getByRole("button", { name: "Search customers" })); await screen.findByText(/No matching customers found/);
  expect(api.post).not.toHaveBeenCalled();
});
it("takes a blocked scan through both reviews, refreshes eligibility from the server and requires an explicit Add", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "admin", permissions: ["MANAGE_ORGANIZATION", "PHARMACY_VIEW_STOCK", "PHARMACY_SELL"] } });
  let raw: any = { ...product, locationId: "branch", scheduleType: "general", hsnCode: "9999", gstRate: 0, dispensingRevision: 0, taxRevision: 0 };
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url.startsWith("/medicines?") ? response([raw]) : url.includes("/sales/products?") ? response({ items: [{ ...product, eligible: raw.dispensingRevision > 0 && raw.taxRevision > 0 }], nextCursor: null }) : get(url, config));
  api.put.mockImplementation(async (url: string, input: any) => {
    const evidence = { confirmedBy: "owner", confirmedAt: "2026-11-11T10:00:00.000Z" };
    if (url.endsWith("/dispensing-classification")) raw = { ...raw, scheduleType: input.scheduleType, dispensingRevision: input.expectedRevision + 1, dispensingReview: { ...input, ...evidence } };
    else raw = { ...raw, hsnCode: input.hsnCode, gstRate: input.gstRate, taxRevision: input.expectedRevision + 1, taxClassification: { ...input, ...evidence } };
    return response(raw);
  });
  mount(false, "branch", true); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); change("Scan barcode or search products", "000123"); fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
  fireEvent.click(await screen.findByRole("button", { name: "Review product Ordinary product" }));
  await screen.findByRole("dialog", { name: "Review product" }); await screen.findByLabelText("Sale review reference *");
  change("Sale review reference *", "Synthetic sale review"); fireEvent.click(screen.getByLabelText("I confirm the sale classification and review reference")); fireEvent.click(screen.getByRole("button", { name: "Save sale review" }));
  await screen.findByText("Sale classification review saved."); change("Document unit code *", "NOS"); fireEvent.click(screen.getByRole("combobox", { name: "Tax treatment *" })); fireEvent.click(screen.getByRole("option", { name: "Nil rated", exact: true })); change("Tax review reference *", "Synthetic tax review");
  fireEvent.click(screen.getByLabelText("I confirm the tax classification and review reference")); fireEvent.click(screen.getByRole("button", { name: "Save tax review" })); await screen.findByText("Tax classification review saved.");
  fireEvent.click(screen.getByRole("button", { name: "Close product review" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add Ordinary product" })); await screen.findByLabelText("Quantity Ordinary product");
  expect(api.put).toHaveBeenCalledTimes(2); expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("reports pricing setup failures without asking an administrator to re-review a ready cart product", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "admin", permissions: ["MANAGE_ORGANIZATION", "PHARMACY_VIEW_STOCK", "PHARMACY_SELL"] } });
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url.startsWith("/medicines?") ? response([{ ...product, locationId: "branch", scheduleType: "general", hsnCode: "9999", gstRate: 0, dispensingRevision: 1, taxRevision: 0 }]) : get(url, config));
  api.post.mockRejectedValueOnce(new Error("Tax setup needs attention"));
  mount(false, "branch", true); await scan(); await screen.findByText("Prices could not be calculated");
  expect(screen.queryByRole("button", { name: /Review.*product/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry prices" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});

it("uses a name lookup for words and preserves an explicit alphanumeric barcode exactly", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url.endsWith("search=") ? response({ items: [], nextCursor: null }) : get(url, config));
  mount(false);
  await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  change("Scan barcode or search products", "Ordinary");
  fireEvent.click(screen.getByRole("button", { name: "Search products" }));
  await screen.findByRole("button", { name: "Add Ordinary product" });
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining("search=Ordinary"), expect.any(Object));
  fireEvent.click(screen.getByRole("combobox", { name: "Product lookup mode" }));
  fireEvent.click(await screen.findByRole("option", { name: "Exact barcode" }));
  change("Scan barcode or search products", "00ABC123");
  fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
  await screen.findByLabelText("Quantity Ordinary product");
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining("barcode=00ABC123"), expect.any(Object));
  expect(api.post).not.toHaveBeenCalled();
});

it("ignores a late barcode response after the operator changes the lookup", async () => {
  let finish!: (value: unknown) => void;
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url: string, config: unknown) => url.includes("/sales/products?") ? new Promise(resolve => { finish = resolve; }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); change("Scan barcode or search products", "000123");
  fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
  change("Scan barcode or search products", "Another product");
  await act(async () => { finish(response({ items: [product], nextCursor: null })); });
  expect(screen.queryByLabelText("Quantity Ordinary product")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("deduplicates an in-flight repeated barcode while preserving both scanned units", async () => {
  let finish!: (value: unknown) => void;
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? new Promise(resolve => { finish = resolve; }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  change("Scan barcode or search products", "000123"); const form = screen.getByLabelText("Scan barcode or search products").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(api.get.mock.calls.filter(([url]) => url.includes("barcode=000123"))).toHaveLength(1);
  await act(async () => finish(response({ items: [product], nextCursor: null })));
  expect(await screen.findByLabelText("Quantity Ordinary product")).toHaveValue(2);
  expect(screen.getByLabelText("Scan barcode or search products")).toHaveFocus();
});
it("restores a frozen issue payload after reload and retries the same original bill identity", async () => {
  const post = api.post.getMockImplementation()!;
  api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? Promise.reject(Error("transport response lost")) : post(url, body, config));
  const view = mount(false); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" })); await screen.findByText("transport response lost");
  const first = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")!; view.unmount(); api.post.mockImplementation(post); mount(false);
  fireEvent.click(await screen.findByRole("button", { name: "Retry same sale" })); await screen.findByRole("button", { name: "View last saved bill" });
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")[1]).toEqual(first);
});

it("ignores recorded-customer results after switching back to walk-in", async () => {
  let finish!: (value: unknown) => void;
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url: string, config: unknown) => url.includes("/sales/customers?") ? new Promise(resolve => { finish = resolve; }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled()); fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  fireEvent.click(screen.getByRole("tab", { name: "Walk-in", exact: true }));
  await act(async () => { finish(response({ items: [{ id: "customer", name: "Late customer", address: "Synthetic address", revision: 0 }], nextCursor: null })); });
  expect(screen.queryByRole("button", { name: "Select customer Late customer" })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

it("keeps checkout and product rows stable during a slow atomic Save, then prepares the next bill", async () => {
  const post = api.post.getMockImplementation()!;
  let finish!: () => Promise<void>;
  api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? new Promise(resolve => { finish = async () => resolve(await post(url, body, config)); }) : post(url, body, config));
  mount(); await scan(); await review();
  expect(screen.getByRole("status", { name: "Bill save status" })).toHaveTextContent("Prices checked");
  const received = screen.getByLabelText("Cash received (INR)"), saveButton = screen.getByRole("button", { name: "Save counter bill" });
  const overviewReads = api.get.mock.calls.filter(([url]) => url === "/pharmacy/sales/overview").length;
  const quoteReads = api.post.mock.calls.filter(([url]) => url.endsWith("/quote")).length;
  fireEvent.click(saveButton);
  await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1));
  expect(screen.getByLabelText("Cash received (INR)")).toBe(received);
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBe(saveButton);
  expect(saveButton).toBeDisabled();
  expect(screen.getByRole("status", { name: "Bill save status" })).toHaveTextContent("Saving");
  expect(screen.getByRole("status", { name: "Save progress" })).toHaveTextContent("Saving bill and payment together");
  expect(screen.queryByText(`Bill ${bill.invoiceNumber} saved`)).not.toBeInTheDocument();
  expect(api.get.mock.calls.filter(([url]) => url === "/pharmacy/sales/overview")).toHaveLength(overviewReads);
  fireEvent.keyDown(window, { key: "F10" });
  await act(async () => finish());
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Bill save status" })).toHaveTextContent("Draft");
  expect(screen.getByRole("button", { name: "Add Ordinary product" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Add Ordinary product" })).toHaveTextContent("19 in stock");
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/quote"))).toHaveLength(quoteReads);
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
});

it("recovers a lost paid-save response without resubmitting the bill or collecting again", async () => {
  const post = api.post.getMockImplementation()!, get = api.get.getMockImplementation()!;
  let saved: any;
  api.post.mockImplementation(async (url, body, config) => {
    if (url === "/pharmacy/sales") { saved = await post(url, body, config); throw Error("Commit reply lost"); }
    return post(url, body, config);
  });
  api.get.mockImplementation((url, config) => url.includes("/sale-operations/") ? Promise.resolve(saved) : get(url, config));
  mount(); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText("Commit reply lost");
  expect(screen.getByRole("status", { name: "Bill save status" })).toHaveTextContent("Check save result");
  expect(screen.queryByText("Pending Sync")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check sale result" }));
  await screen.findByRole("button", { name: "View last saved bill" });
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
});

it("does not announce paid or clear the bill if the atomic response omits its payment receipt", async () => {
  const post = api.post.getMockImplementation()!;
  api.post.mockImplementation((url, body, config) => url === "/pharmacy/sales" ? Promise.resolve(response({ ...bill, requestKey: config.headers["Idempotency-Key"] })) : post(url, body, config));
  mount(); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText("Saved payment could not be confirmed. Keep the same reference.");
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  expect(screen.queryByRole("button", { name: "View last saved bill" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check sale result" })).toBeEnabled();
});

it("rechecks a drawer that closed during Save and blocks another paid attempt until it is open", async () => {
  const get = api.get.getMockImplementation()!, post = api.post.getMockImplementation()!;
  let closed = false;
  api.get.mockImplementation((url, config) => closed && url === "/pharmacy/till" ? Promise.resolve(response({ active: null })) : get(url, config));
  api.post.mockImplementation((url, body, config) => {
    if (url === "/pharmacy/sales") { closed = true; return Promise.reject({ response: { status: 428, data: { message: "An open drawer is required" } } }); }
    return post(url, body, config);
  });
  mount(); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Save counter bill" }));
  await screen.findByText("Save needs review");
  await screen.findByText("Open your cash drawer first");
  fireEvent.click(screen.getByRole("button", { name: "Review rejected sale" }));
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
  expect(api.post.mock.calls.filter(([url]) => url.endsWith("/collections"))).toHaveLength(0);
});

it("searches a recorded customer by phone and shows that number before selection", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/customers?") ? response({ items: [{ id: "customer", name: "Actual customer", address: "Actual address", phone: "+91 98765 43210", revision: 0 }], nextCursor: null }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  expect(screen.getByLabelText("Find recorded customer")).toHaveAttribute("placeholder", "Search by name or phone");
  change("Find recorded customer", "9876543210"); fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  const select = await screen.findByRole("button", { name: "Select customer Actual customer" });
  expect(select.closest("article")).toHaveTextContent("+91 98765 43210");
  expect(api.get.mock.calls.some(([url]) => url.includes("/sales/customers?") && url.includes("search=9876543210"))).toBe(true);
  fireEvent.click(select); expect(screen.getByText("Customer history")).toBeInTheDocument();
});

it("discards a late customer response immediately when the search text changes", async () => {
  const get = api.get.getMockImplementation()!;
  let finish!: (value: unknown) => void;
  api.get.mockImplementation((url, config) => url.includes("/sales/customers?") ? new Promise(resolve => { finish = resolve; }) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  change("Find recorded customer", "98765"); fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  change("Find recorded customer", "Another customer");
  await act(async () => finish(response({ items: [{ id: "old", name: "Old match", address: "Old address", revision: 0 }], nextCursor: null })));
  expect(screen.queryByRole("button", { name: "Select customer Old match" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search customers" })).toBeEnabled();
});

it("shows customer lookup failures in checkout without creating a pending bill", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/customers?") ? Promise.reject(Error("Customer lookup unavailable")) : get(url, config));
  mount(false); await waitFor(() => expect(screen.getByLabelText("Scan barcode or search products")).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name: "Recorded", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("Customer lookup unavailable"); expect(error.closest("aside")).not.toBeNull();
  expect(screen.queryByText("Pending sale")).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

it("revalidates an expired cached barcode match before adding another unit", async () => {
  mount(false); await scan();
  const now = Date.now(), clock = vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
  const get = api.get.getMockImplementation()!;
  let finish!: (value: unknown) => void;
  api.get.mockImplementation((url, config) => url.includes("barcode=000123") ? new Promise(resolve => { finish = resolve; }) : get(url, config));
  try {
    change("Scan barcode or search products", "000123"); fireEvent.submit(screen.getByLabelText("Scan barcode or search products").closest("form")!);
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(1);
    await act(async () => finish(response({ items: [product], nextCursor: null })));
    expect(screen.getByLabelText("Quantity Ordinary product")).toHaveValue(2);
  } finally { clock.mockRestore(); }
});

it("distinguishes same-name medicine choices by manufacturer without another row or review step", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, id: "acme", manufacturer: "Acme" }, { ...product, id: "other", manufacturer: "Other maker" }], nextCursor: null }) : get(url, config));
  mount(false);
  const selected = await screen.findByRole("button", { name: "Add Ordinary product (Acme)" });
  expect(selected).toHaveTextContent("20 in stock · Acme");
  expect(screen.getByRole("button", { name: "Add Ordinary product (Other maker)" })).toHaveTextContent("Other maker");
  fireEvent.click(selected); expect(await screen.findByLabelText("Quantity Ordinary product (Acme)")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Add Ordinary product (Other maker)" }));
  expect(await screen.findByLabelText("Quantity Ordinary product (Other maker)")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity Ordinary product (Acme)" }));
  expect(screen.getByLabelText("Quantity Ordinary product (Acme)")).toHaveValue(2);
  expect(screen.getByLabelText("Quantity Ordinary product (Other maker)")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove Ordinary product (Other maker)" }));
  expect(screen.queryByLabelText("Quantity Ordinary product (Other maker)")).not.toBeInTheDocument();
  expect(screen.queryByText("Review product")).not.toBeInTheDocument();
});

it("lets an explicit search refresh a cached out-of-stock result immediately", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, stockQuantity: 0 }], nextCursor: null }) : get(url, config));
  mount(false); expect(await screen.findByRole("button", { name: "Add Ordinary product" })).toBeDisabled();
  const before = api.get.mock.calls.filter(([url]) => url.includes("/sales/products?")).length;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? response({ items: [{ ...product, stockQuantity: 3 }], nextCursor: null }) : get(url, config));
  fireEvent.click(screen.getByRole("button", { name: "Search products" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Ordinary product" })).toBeEnabled());
  expect(api.get.mock.calls.filter(([url]) => url.includes("/sales/products?"))).toHaveLength(before + 1);
  expect(screen.getByRole("button", { name: "Add Ordinary product" })).toHaveTextContent("3 in stock");
});

it("keeps a later-page pick available in Frequent after returning to the first query page", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation((url, config) => url.includes("/sales/products?") ? response(url.includes("cursor=") ? { items: [{ ...product, id: "later", name: "Later medicine" }], nextCursor: null } : { items: [product], nextCursor: "page-2" }) : get(url, config));
  mount(false); await screen.findByRole("button", { name: "Next product page" });
  fireEvent.click(screen.getByRole("button", { name: "Frequent", exact: true }));
  expect(screen.getByText(/Products you add often appear here/)).toBeInTheDocument();
  expect(screen.queryByText("No products at this branch")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Next product page" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add Later medicine" }));
  fireEvent.click(screen.getByRole("button", { name: "Frequent", exact: true }));
  expect(await screen.findByRole("button", { name: "Add Later medicine" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Next product page" })).not.toBeInTheDocument();
});
