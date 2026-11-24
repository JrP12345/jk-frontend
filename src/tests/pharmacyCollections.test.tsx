import { drawerFixture } from "./fixtures/pharmacyDrawer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PharmacyCollections } from "@/components/pharmacy/PharmacyCollections";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { collectionInvoicePage, validateCollectionReceipt } from "@/lib/pharmacyCollections";
import { datePickerInput } from "./datePickerTestUtils";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data } });
const summary = { id: "invoice", invoiceNumber: "I00012627/000001", status: "unpaid", totalAmount: 20, currency: "INR", customerSnapshot: { anonymous: false, partyId: "customer", name: "Recorded customer" } };
const invoice = { ...summary, kind: "pharmacy", documentVersion: 2, locationId: "branch", paymentRevision: 0, amountPaid: 0, balanceDue: 20, items: [] };
const receipt = { receiptId: "receipt", invoiceId: "invoice", invoiceNumber: summary.invoiceNumber, locationId: "branch", currency: "INR", actorId: "cashier", paidAt: "2026-10-20T08:00:00Z", creditedPaise: 0, collectedPaise: 2000, paidPaise: 2000, balancePaise: 0, revision: 1, cashTenderedPaise: 2500, cashChangePaise: 500, status: "paid", evidenceMode: "staff_confirmed_manual", shiftId: drawerFixture.id, drawerCode: drawerFixture.drawerCode, entries: [{ componentId: "component-1", amountPaise: 2000, paymentMethod: "cash" }] };
const mount = (canCollect = true, locationId = "branch") => render(<ToastProvider><PharmacyCollections locationId={locationId} canCollect={canCollect} /></ToastProvider>);
const open = async () => { fireEvent.click(await screen.findByRole("button", { name: `Open sale ${summary.invoiceNumber}` })); await screen.findByRole("dialog", { name: /Collect payment|Bill & receipts/ }); if (screen.queryByRole("button", { name: "Record payment" })) await screen.findByRole("button", { name: "Recheck open drawer" }); };
function change(label: string, value: string) {
  const control = screen.getByLabelText(label), input = control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
}
function confirm() { fireEvent.click(screen.getByRole("checkbox", { name: /I confirmed/ })); }
beforeEach(() => {
  useAuthStore.setState({ user: { id: "cashier", name: "Cashier", role: "cashier", email: "cashier@example.test", organization_id: "org", permissions: ["PHARMACY_COLLECT_PAYMENT"] } });
  sessionStorage.clear(); api.get.mockReset().mockImplementation(async (url: string) => url === "/pharmacy/till" ? response({ active: drawerFixture }) : url.includes("/collection-operations/") ? response({ ...receipt, requestKey: "pending-reference" }) : url.includes("/collections?") ? response({ items: [], nextCursor: null }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [summary], nextCursor: null }));
  api.post.mockReset().mockImplementation(async (_path: string, body: { entries: unknown[]; cashTenderedPaise: number }, config: { headers: { "Idempotency-Key": string } }) => response({ ...receipt, entries: body.entries, cashTenderedPaise: body.cashTenderedPaise, cashChangePaise: body.cashTenderedPaise - 2000, requestKey: config.headers["Idempotency-Key"] }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });
it("requires actual receipt confirmation and records exact paise with a stable key", async () => {
  mount(); await open(); expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
  change("Cash tendered (INR)", "25"); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("Collection confirmed");
  expect(api.post).toHaveBeenCalledWith("/pharmacy/invoices/invoice/collections", expect.objectContaining({ locationId: "branch", expectedPaymentRevision: 0, expectedBalancePaise: 2000, manualConfirmed: true, cashTenderedPaise: 2500, entries: [{ componentId: expect.any(String), amountPaise: 2000, paymentMethod: "cash" }] }), expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }));
  expect(screen.getByRole("region", { name: "Committed collection receipt" })).toHaveTextContent(/Change.*5/);
  expect(Object.keys(sessionStorage).filter(key => key.startsWith("pharmacy-")).length).toBe(1); expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toMatch(/amount|customer|cashTendered/);
  fireEvent.click(screen.getByRole("button", { name: "Done with collection" })); expect(Object.keys(sessionStorage).filter(key => key.startsWith("pharmacy-")).length).toBe(0);
});
it("resets receipt confirmation whenever the cash input or payment method changes", async () => {
  mount(); await open(); confirm(); expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
  change("Cash tendered (INR)", "50");
  expect(screen.getByRole("checkbox", { name: /I confirmed/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
  confirm(); fireEvent.click(screen.getByRole("button", { name: "UPI", exact: true }));
  expect(screen.queryByLabelText("Cash tendered (INR)")).not.toBeInTheDocument();
  change("Actual payment reference 1", "VERIFIED-UPI");
  expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled(); confirm();
  expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
  expect(api.post).not.toHaveBeenCalled();
});
it("lets a recorded customer make an explicit partial payment", async () => {
  api.post.mockImplementation(async (_url, body, config) => response({ ...receipt, collectedPaise: 800, paidPaise: 800, balancePaise: 1200, status: "partially_paid", entries: body.entries, cashTenderedPaise: body.cashTenderedPaise, cashChangePaise: body.cashTenderedPaise - 800, requestKey: config.headers["Idempotency-Key"] }));
  mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "Partial payment", exact: true }));
  change("Amount received 1 (INR)", "8"); change("Cash tendered (INR)", "10");
  expect(screen.getByText(/Due after this payment/)).toHaveTextContent("12.00");
  confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
  await screen.findByText("Collection confirmed");
  expect(screen.getByRole("region", { name: "Committed collection receipt" })).toHaveTextContent("Part payment recorded");
  expect(api.post.mock.calls[0][1]).toMatchObject({ cashTenderedPaise: 1000, entries: [expect.objectContaining({ amountPaise: 800 })] });
});
it("requires the full walk-in balance and fills the unallocated split amount", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url, config) => url.includes("/invoices/invoice?") ? response({ ...invoice, customerSnapshot: { anonymous: true } }) : get(url, config));
  mount(); await open(); expect(screen.queryByRole("button", { name: "Partial payment", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add split payment" }));
  change("Amount received 1 (INR)", "8");
  fireEvent.click(screen.getByRole("button", { name: "Use remaining ₹12.00" }));
  expect(screen.getByLabelText("Amount received 2 (INR)")).toHaveValue(12);
  change("Actual payment reference 2", "UPI-VERIFIED"); confirm();
  expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
  change("Amount received 2 (INR)", "10");
  expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
it("records split UPI/card only with actual references and zero cash tender", async () => {
  api.post.mockImplementation(async (_path: string, body: { entries: unknown[] }, config: { headers: { "Idempotency-Key": string } }) => response({ ...receipt, cashTenderedPaise: 0, cashChangePaise: 0, entries: body.entries, requestKey: config.headers["Idempotency-Key"] }));
  mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "UPI", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Add split payment" })); change("Amount received 1 (INR)", "8"); change("Payment method 2", "card"); change("Amount received 2 (INR)", "12"); confirm();
  expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled(); expect(screen.getByText(/Enter the verified transaction reference/)).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  change("Actual payment reference 1", "UPI-RECEIVED-123"); change("Actual payment reference 2", "TERMINAL-APPROVED-456"); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("Collection confirmed");
  expect(api.post.mock.calls[0][1].entries).toEqual([{ componentId: expect.any(String), amountPaise: 800, paymentMethod: "upi", referenceNumber: "UPI-RECEIVED-123" }, { componentId: expect.any(String), amountPaise: 1200, paymentMethod: "card", referenceNumber: "TERMINAL-APPROVED-456" }]);
});
it("freezes submitted money and retries the identical payload/reference after transport failure", async () => {
  api.post.mockRejectedValueOnce(new Error("response lost")); mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("response lost");
  const first = api.post.mock.calls[0]; expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry same collection" })); await screen.findByText("Collection confirmed"); expect(api.post.mock.calls[1]).toEqual(first);
});
it("recovers a pending reference after reload without recording another payment", async () => {
  api.post.mockRejectedValueOnce(new Error("timeout")); const view = mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("timeout");
  const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; view.unmount();
  api.get.mockImplementation(async (url: string) => url.includes("/collection-operations/") ? response({ ...receipt, requestKey }) : response({ items: [summary], nextCursor: null }));
  mount(); fireEvent.click(screen.getByRole("button", { name: "Check collection result" })); await screen.findByText("Collection confirmed"); expect(api.post).toHaveBeenCalledTimes(1);
});
it("restores the submitted payment amounts after reload and retries the identical collection", async () => {
  const post = api.post.getMockImplementation()!;
  api.post.mockRejectedValueOnce(Error("response lost after payment")); const view = mount(); await open(); change("Cash tendered (INR)", "25"); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("response lost after payment");
  const first = api.post.mock.calls[0]; view.unmount(); api.post.mockImplementation(post); mount();
  fireEvent.click(await screen.findByRole("button", { name: "Retry same collection" })); await screen.findByText("Collection confirmed");
  expect(api.post.mock.calls[1]).toEqual(first);
});
it("reads immutable receipt history without collection authority and pages only when requested", async () => {
  api.get.mockImplementation(async (url: string) => url.includes("/collections?") ? response({ items: [receipt], nextCursor: "next-receipt" }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [summary], nextCursor: null }));
  mount(false); await open(); const history = await screen.findByRole("region", { name: "Saved collection receipts" }); await within(history).findByText(/Receipt receipt/);
  expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next receipt page" })); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("cursor=next-receipt"), expect.any(Object))); expect(api.post).not.toHaveBeenCalled();
});
it("blocks dispatch when opaque recovery reference cannot be persisted", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); }); mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await screen.findByText("storage unavailable"); expect(api.post).not.toHaveBeenCalled();
});
it("clears the previous branch form and ignores its late payment result", async () => {
  let finish!: (value: unknown) => void; api.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; api.get.mockResolvedValue(response({ items: [], nextCursor: null }));
  view.rerender(<ToastProvider><PharmacyCollections locationId="other-branch" canCollect /></ToastProvider>);
  await act(async () => { finish(response({ ...receipt, cashTenderedPaise: 2000, cashChangePaise: 0, requestKey })); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByText("Collection confirmed")).not.toBeInTheDocument(); expect(Object.keys(sessionStorage).filter(key => key.startsWith("pharmacy-")).length).toBe(1);
});
it("refuses incomplete or inconsistent server receipts", () => {
  expect(validateCollectionReceipt(receipt)).toMatchObject({ collectedPaise: 2000 });
  for (const patch of [{ collectedPaise: "2000" }, { entries: [] }, { cashChangePaise: 499 }, { status: "partially_paid" }, { evidenceMode: "qr_displayed" }]) expect(() => validateCollectionReceipt({ ...receipt, ...patch })).toThrow(/could not be confirmed/);
});

it("previews exact change with cash shortcuts while still requiring receipt confirmation", async () => {
  mount(); await open();
  fireEvent.click(screen.getByRole("button", { name: "\u20b9100.00", exact: true }));
  expect(screen.getByLabelText("Cash tendered (INR)")).toHaveValue(100);
  expect(screen.getByText("Change to return").parentElement).toHaveTextContent("\u20b980.00");
  fireEvent.click(screen.getByRole("button", { name: "Exact", exact: true }));
  expect(screen.getByLabelText("Cash tendered (INR)")).toHaveValue(20);
  expect(screen.getByText("Change to return").parentElement).toHaveTextContent("\u20b90.00");
  expect(api.post).not.toHaveBeenCalled();
});
it("searches branch sales and payment status on the server without writing", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => {
    if (!url.startsWith("/pharmacy/invoices?")) return get(url, config);
    const query = new URL(url, "https://test.invalid").searchParams;
    const rows = [summary, { ...summary, id: "paid", invoiceNumber: "PAID-002", status: "paid" }].filter(row => (!query.get("search") || row.invoiceNumber.includes(query.get("search")!)) && (query.get("status") !== "unpaid" || row.status !== "paid"));
    return response({ items: rows, nextCursor: null });
  });
  mount(); await screen.findByRole("button", { name: "Open sale PAID-002" });
  fireEvent.click(screen.getByRole("button", { name: "Unpaid", exact: true }));
  expect(screen.queryByRole("button", { name: "Open sale PAID-002" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All", exact: true }));
  change("Search sales", "PAID-002");
  expect(await screen.findByRole("button", { name: "Open sale PAID-002" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open sale " + summary.invoiceNumber })).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([url]) => String(url).includes("search=PAID-002"))).toBe(true);
  expect(api.get.mock.calls.some(([url]) => String(url).includes("status=unpaid"))).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

function saleDate(label: string, value: string) { fireEvent.change(datePickerInput(screen.getByLabelText(label)), { target: { value } }); }
it("applies sale dates explicitly, retains other filters and dates across pages, and clears them", async () => {
  api.get.mockImplementation(async (url: string) => {
    const params = new URL(url, "https://test.invalid").searchParams;
    return response({ items: [summary], nextCursor: params.has("cursor") ? null : "older-sale", ...(params.has("startDate") ? { period: { startDate: params.get("startDate"), endDate: params.get("endDate"), timezone: "Asia/Kolkata" } } : {}) });
  });
  mount(); await screen.findByRole("button", { name: "Next sales page" });
  fireEvent.click(screen.getByRole("button", { name: "Next sales page" }));
  await screen.findByRole("button", { name: "First sales page" });
  fireEvent.click(screen.getByText("Sale dates: All dates"));
  const calls = api.get.mock.calls.length;
  saleDate("Sale start date", "2026-10-20");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose both sale dates"); expect(api.get).toHaveBeenCalledTimes(calls);
  saleDate("Sale end date", "2026-10-19");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  expect(screen.getByRole("alert")).toHaveTextContent("start on or before"); expect(api.get).toHaveBeenCalledTimes(calls);
  saleDate("Sale end date", "2026-10-21");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByText(/Both dates include.*Asia\/Kolkata/);
  expect(new URL(api.get.mock.lastCall![0], "https://test.invalid").searchParams.has("cursor")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Unpaid", exact: true }));
  change("Search sales", "Dated");
  await waitFor(() => expect(api.get.mock.lastCall![0]).toContain("search=Dated"));
  await screen.findByRole("button", { name: "Next sales page" });
  fireEvent.click(screen.getByRole("button", { name: "Next sales page" }));
  await screen.findByRole("button", { name: "First sales page" });
  const params = new URL(api.get.mock.lastCall![0], "https://test.invalid").searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ locationId: "branch", cursor: "older-sale", search: "Dated", status: "unpaid", startDate: "2026-10-20", endDate: "2026-10-21" });
  fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
  await waitFor(() => expect(api.get.mock.lastCall![0]).not.toContain("startDate"));
  expect(api.get.mock.lastCall![0]).toContain("status=unpaid");
  expect(screen.getByText("Sale dates: All dates")).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it("ignores a late previous date result and reports an unconfirmed server date filter", async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementation(async (url: string) => {
    if (url.includes("startDate=2026-10-20")) return new Promise(resolve => { finish = resolve; });
    if (url.includes("startDate=2026-10-21")) return response({ items: [], nextCursor: null });
    return response({ items: [summary], nextCursor: null });
  });
  mount(); await screen.findByRole("button", { name: "Open sale " + summary.invoiceNumber });
  fireEvent.click(screen.getByText("Sale dates: All dates"));
  saleDate("Sale start date", "2026-10-20"); saleDate("Sale end date", "2026-10-20");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  saleDate("Sale start date", "2026-10-21"); saleDate("Sale end date", "2026-10-21");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByText("Sales unavailable");
  expect(screen.getByText(/Sales dates could not be confirmed/)).toBeInTheDocument();
  await act(async () => { finish(response({ items: [summary], nextCursor: null, period: { startDate: "2026-10-20", endDate: "2026-10-20", timezone: "Asia/Kolkata" } })); });
  expect(screen.queryByRole("button", { name: "Open sale " + summary.invoiceNumber })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("refuses a server response that confirms different sale dates", async () => {
  api.get.mockResolvedValue(response({ items: [], nextCursor: null, period: { startDate: "2026-10-19", endDate: "2026-10-20", timezone: "Asia/Kolkata" } }));
  await expect(collectionInvoicePage("branch", undefined, undefined, { startDate: "2026-10-20", endDate: "2026-10-20" })).rejects.toThrow("Sales dates could not be confirmed");
});
it("does not load sales history or show date filters during checkout", async () => {
  render(<ToastProvider><PharmacyCollections locationId="branch" canCollect checkoutOnly initialInvoiceId="invoice" /></ToastProvider>);
  await screen.findByRole("dialog", { name: /Collect payment/ });
  expect(screen.queryByText("Sale dates: All dates")).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/pharmacy/invoices?"))).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
});

it("keeps search and payment controls available after an empty result or failed read", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => {
    if (!url.startsWith("/pharmacy/invoices?")) return get(url, config);
    if (url.includes("search=failed")) throw new Error("Connection lost");
    return response({ items: url.includes("search=missing") ? [] : [summary], nextCursor: null });
  });
  mount(); await screen.findByRole("button", { name: "Open sale " + summary.invoiceNumber });
  change("Search sales", "missing");
  await screen.findByText("No matching sales");
  expect(screen.getByRole("searchbox", { name: "Search sales" })).toHaveValue("missing");
  expect(screen.getByRole("button", { name: "Unpaid", exact: true })).toBeEnabled();
  change("Search sales", "failed");
  await screen.findByText("Sales unavailable");
  expect(screen.getByRole("searchbox", { name: "Search sales" })).toHaveValue("failed");
  change("Search sales", "");
  expect(await screen.findByRole("button", { name: "Open sale " + summary.invoiceNumber })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("opens drawer setup inside collection and keeps collection blocked until the drawer exists", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (url: string, config: unknown) => url === "/pharmacy/till" ? response({ active: null }) : url === "/pharmacy/till/history" ? response({ items: [], nextCursor: null }) : get(url, config));
  render(<ToastProvider><PharmacyCollections locationId="branch" canCollect canOpenTill /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Open sale " + summary.invoiceNumber }));
  fireEvent.click(await screen.findByRole("button", { name: "Open drawer", exact: true }));
  const drawer = await screen.findByRole("dialog", { name: "Cash drawer", exact: true });
  expect(await within(drawer).findByLabelText("Physical drawer code")).toBeEnabled();
  fireEvent.click(within(drawer).getByRole("button", { name: "Close modal", exact: true }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled());
  expect(screen.getByLabelText("Cash tendered (INR)")).toHaveValue(20);
  expect(api.post).not.toHaveBeenCalled();
});
