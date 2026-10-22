import { drawerFixture } from "./fixtures/pharmacyDrawer";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyCounter } from "@/components/pharmacy/PharmacyCounter";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data } });
const product = { id: "medicine", name: "Ordinary product", genericName: "Synthetic", eligible: true, stockQuantity: 20, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
const bill = { invoiceId: "invoice", dispenseId: "dispense", invoiceNumber: "I00012627/000001", totalPaise: 2000, status: "unpaid" };
const invoice = { id: "invoice", kind: "pharmacy", locationId: "branch", invoiceNumber: bill.invoiceNumber, totalAmount: 20, balanceDue: 20, amountPaid: 0, paymentRevision: 0, currency: "INR", status: "unpaid", customerSnapshot: { anonymous: true }, items: [] };
const mount = (canCollect = true, locationId = "branch") => render(<ToastProvider><PharmacyCounter locationId={locationId} canCollect={canCollect} /></ToastProvider>);
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
async function scan() { change("Scan product barcode", "000123"); fireEvent.submit(screen.getByLabelText("Scan product barcode").closest("form")!); await screen.findByLabelText("Loose units Ordinary product"); }
async function review() { fireEvent.click(screen.getByRole("button", { name: "Review current quote" })); await screen.findByRole("region", { name: "Trusted counter quote" }); }
async function save() { await review(); fireEvent.click(screen.getByRole("button", { name: "Confirm and issue counter invoice" })); await screen.findByText("Counter invoice saved"); }
function quote(body: any) {
  const quoteHash = "a".repeat(64), totals = { payablePaise: 2000, baseAmountPaise: 2000, cgstPaise: 0, sgstPaise: 0, lineDiscountPaise: 0, invoiceDiscountPaise: body.invoiceDiscountPaise, roundOffPaise: 0 };
  return { locationId: body.locationId, currency: "INR", quoteHash, customer: body.customerId ? { id: body.customerId, name: "Actual customer" } : null, calculation: { policy: "pharmacy-paise-v2", totals },
    issueInput: { ...body, expectedProfileRevision: 1, expectedTotalPaise: 2000, expectedQuoteHash: quoteHash, lines: body.lines.map((line: any) => ({ ...line, expectedUnitVersion: 1, expectedStockRevision: 1 })) },
    lines: body.lines.map((line: any) => ({ ...line, description: product.name, unitSnapshot: { baseUnit: "tablet" }, batches: [{ batchNumber: "ACTUAL", quantity: line.quantity, expiryValue: "2099-12", sellingPricePaise: 1000, mrpPaise: 1200 }] })) };
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: "cashier", name: "Cashier", role: "cashier", email: "cashier@example.test", organization_id: "org", permissions: ["PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT"] } });
  sessionStorage.clear();
  api.get.mockReset().mockImplementation(async (url: string) => url === "/pharmacy/till" ? response({ active: drawerFixture }) : url.includes("/sales/products?") ? response({ items: [product], nextCursor: null }) : url.includes("/sales/customers?") ? response({ items: [{ id: "customer", name: "Actual customer", address: "Actual address", revision: 0 }], nextCursor: null }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [], nextCursor: null }));
  api.post.mockReset().mockImplementation(async (url: string, body: any, config: any) => url.endsWith("/quote") ? response(quote(body)) : url === "/pharmacy/sales" ? response({ ...bill, requestKey: config.headers["Idempotency-Key"] }) : response({ receiptId: "receipt", invoiceId: "invoice", invoiceNumber: bill.invoiceNumber, locationId: "branch", currency: "INR", actorId: "cashier", paidAt: "2026-10-20T08:00:00Z", creditedPaise: 0, collectedPaise: 2000, paidPaise: 2000, balancePaise: 0, revision: 1, cashTenderedPaise: body.cashTenderedPaise, cashChangePaise: body.cashTenderedPaise - 2000, status: "paid", evidenceMode: "staff_confirmed_manual", shiftId: drawerFixture.id, drawerCode: drawerFixture.drawerCode, entries: body.entries, requestKey: config.headers["Idempotency-Key"] }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });
it("scans exact leading-zero barcode, edits pack/loose quantity, issues a trusted quote and collects actual cash", async () => {
  mount(); await scan(); expect(api.get).toHaveBeenCalledWith(expect.stringContaining("barcode=000123"), expect.any(Object));
  change("Packs Ordinary product", "1"); change("Loose units Ordinary product", "2"); fireEvent.keyDown(screen.getByLabelText("Loose units Ordinary product"), { key: "Enter" }); expect(screen.getByLabelText("Scan product barcode")).toHaveFocus();
  await save(); const issued = api.post.mock.calls.find(([url]) => url === "/pharmacy/sales")!; expect(issued[1]).toMatchObject({ lines: [{ quantity: 12, expectedStockRevision: 1 }], expectedQuoteHash: "a".repeat(64) });
  await screen.findByRole("dialog", { name: "Counter invoice collections" }); change("Cash tendered (INR)", "25"); fireEvent.click(screen.getByRole("checkbox", { name: /I confirmed/ })); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("Collection confirmed");
  expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1); expect(sessionStorage.length).toBe(2); for (let n = 0; n < sessionStorage.length; n++) expect(sessionStorage.getItem(sessionStorage.key(n)!)).not.toMatch(/customer|amount|medicine|packs/);
});
it("invalidates quote after edits, holds a cart without a write and requires a fresh quote on resume", async () => {
  mount(); await scan(); await review(); change("Loose units Ordinary product", "3"); expect(screen.queryByRole("region", { name: "Trusted counter quote" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hold cart" })); expect(screen.queryByLabelText("Loose units Ordinary product")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Resume held cart 1/ })); expect(screen.getByLabelText("Loose units Ordinary product")).toHaveValue(3); expect(screen.queryByRole("button", { name: "Confirm and issue counter invoice" })).not.toBeInTheDocument(); expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("retries a frozen sale under the same key, then gives a separate purchase a new identity", async () => {
  api.post.mockImplementationOnce(async (_url, body) => response(quote(body))).mockRejectedValueOnce(new Error("response lost")); mount(false); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Confirm and issue counter invoice" })); await screen.findByText("response lost");
  const first = api.post.mock.calls[1]; fireEvent.click(screen.getByRole("button", { name: "Retry same sale" })); await screen.findByText("Counter invoice saved"); expect(api.post.mock.calls[2]).toEqual(first);
  fireEvent.click(await screen.findByRole("button", { name: "Close collections" })); fireEvent.click(screen.getByRole("button", { name: "Start a separate sale" })); await scan(); await save(); const issues = api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales"); expect(issues[2][2].headers["Idempotency-Key"]).not.toBe(first[2].headers["Idempotency-Key"]);
});
it("recovers an uncertain sale after reload without another issue or money mutation", async () => {
  api.post.mockImplementationOnce(async (_url, body) => response(quote(body))).mockRejectedValueOnce(new Error("timeout")); const view = mount(false); await scan(); await review(); fireEvent.click(screen.getByRole("button", { name: "Confirm and issue counter invoice" })); await screen.findByText("timeout");
  const key = api.post.mock.calls[1][2].headers["Idempotency-Key"]; view.unmount(); const original = api.get.getMockImplementation()!; api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/sale-operations/") ? response({ ...bill, requestKey: key }) : original(url, config));
  mount(false); fireEvent.click(screen.getByRole("button", { name: "Check sale result" })); await screen.findByText("Counter invoice saved"); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
});
it("a collection failure preserves the issued invoice and never reissues stock", async () => {
  mount(); await scan(); await save(); await screen.findByRole("dialog", { name: "Counter invoice collections" }); api.post.mockRejectedValueOnce(new Error("payment response lost"));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirmed/ })); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("payment response lost"); expect(screen.getByText("Counter invoice saved")).toBeInTheDocument(); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(1);
});
it("selects an existing customer through sales lookup and sends only its identity to the quote", async () => {
  mount(false); await scan(); change("Find recorded customer", "Actual"); fireEvent.click(screen.getByRole("button", { name: "Search customers" })); fireEvent.click(await screen.findByRole("button", { name: "Select customer Actual customer" })); await review(); expect(api.post.mock.calls[0][1]).toMatchObject({ customerId: "customer" }); expect(api.post.mock.calls[0][1]).not.toHaveProperty("expectedCustomerRevision");
});
it("prevents issue if recovery storage fails", async () => {
  mount(); await scan(); await review(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); }); fireEvent.click(screen.getByRole("button", { name: "Confirm and issue counter invoice" })); await screen.findByText("storage unavailable"); expect(api.post.mock.calls.filter(([url]) => url === "/pharmacy/sales")).toHaveLength(0);
});
it("ignores a late quote after cart edits and a late issue after branch change", async () => {
  let finish!: (value: unknown) => void; const view = mount(false); await scan(); api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Review current quote" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1)); const body = api.post.mock.calls[0][1]; change("Loose units Ordinary product", "3"); await act(async () => { finish(response(quote(body))); }); expect(screen.queryByRole("region", { name: "Trusted counter quote" })).not.toBeInTheDocument();
  await review(); api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Confirm and issue counter invoice" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3)); const key = api.post.mock.calls[2][2].headers["Idempotency-Key"];
  view.rerender(<ToastProvider><PharmacyCounter locationId="other-branch" canCollect={false} /></ToastProvider>); await act(async () => { finish(response({ ...bill, requestKey: key })); }); expect(screen.queryByText("Counter invoice saved")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Loose units Ordinary product")).not.toBeInTheDocument(); expect(sessionStorage.length).toBe(1);
});
