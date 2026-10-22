import { drawerFixture } from "./fixtures/pharmacyDrawer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PharmacyCollections } from "@/components/pharmacy/PharmacyCollections";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { validateCollectionReceipt } from "@/lib/pharmacyCollections";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data } });
const summary = { id: "invoice", invoiceNumber: "I00012627/000001", status: "unpaid", totalAmount: 20, currency: "INR", customerSnapshot: { anonymous: false, partyId: "customer", name: "Recorded customer" } };
const invoice = { ...summary, kind: "pharmacy", documentVersion: 2, locationId: "branch", paymentRevision: 0, amountPaid: 0, balanceDue: 20, items: [] };
const receipt = { receiptId: "receipt", invoiceId: "invoice", invoiceNumber: summary.invoiceNumber, locationId: "branch", currency: "INR", actorId: "cashier", paidAt: "2026-10-20T08:00:00Z", creditedPaise: 0, collectedPaise: 2000, paidPaise: 2000, balancePaise: 0, revision: 1, cashTenderedPaise: 2500, cashChangePaise: 500, status: "paid", evidenceMode: "staff_confirmed_manual", shiftId: drawerFixture.id, drawerCode: drawerFixture.drawerCode, entries: [{ componentId: "component-1", amountPaise: 2000, paymentMethod: "cash" }] };
const mount = (canCollect = true, locationId = "branch") => render(<ToastProvider><PharmacyCollections locationId={locationId} canCollect={canCollect} /></ToastProvider>);
const open = async () => { fireEvent.click(await screen.findByRole("button", { name: `Open sale ${summary.invoiceNumber}` })); await screen.findByRole("dialog", { name: "Counter invoice collections" }); if (screen.queryByRole("button", { name: "Record confirmed collection" })) await waitFor(() => expect(screen.getByRole("button", { name: "Record confirmed collection" })).toBeEnabled()); };
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
  mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText(/Confirm actual receipt/); expect(api.post).not.toHaveBeenCalled();
  change("Cash tendered (INR)", "25"); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("Collection confirmed");
  expect(api.post).toHaveBeenCalledWith("/pharmacy/invoices/invoice/collections", expect.objectContaining({ locationId: "branch", expectedPaymentRevision: 0, expectedBalancePaise: 2000, manualConfirmed: true, cashTenderedPaise: 2500, entries: [{ componentId: expect.any(String), amountPaise: 2000, paymentMethod: "cash" }] }), expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }));
  expect(screen.getByRole("region", { name: "Committed collection receipt" })).toHaveTextContent(/Change.*5/);
  expect(sessionStorage.length).toBe(1); expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toMatch(/amount|customer|cashTendered/);
  fireEvent.click(screen.getByRole("button", { name: "Done with collection" })); expect(sessionStorage.length).toBe(0);
});
it("records split UPI/card only with actual references and zero cash tender", async () => {
  api.post.mockImplementation(async (_path: string, body: { entries: unknown[] }, config: { headers: { "Idempotency-Key": string } }) => response({ ...receipt, cashTenderedPaise: 0, cashChangePaise: 0, entries: body.entries, requestKey: config.headers["Idempotency-Key"] }));
  mount(); await open(); change("Payment method 1", "upi"); change("Amount received 1 (INR)", "8"); change("Cash tendered (INR)", "0");
  fireEvent.click(screen.getByRole("button", { name: "Add split payment" })); change("Payment method 2", "card"); change("Amount received 2 (INR)", "12"); confirm();
  fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText(/Confirm actual receipt/); expect(api.post).not.toHaveBeenCalled();
  change("Actual payment reference 1", "UPI-RECEIVED-123"); change("Actual payment reference 2", "TERMINAL-APPROVED-456"); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("Collection confirmed");
  expect(api.post.mock.calls[0][1].entries).toEqual([{ componentId: expect.any(String), amountPaise: 800, paymentMethod: "upi", referenceNumber: "UPI-RECEIVED-123" }, { componentId: expect.any(String), amountPaise: 1200, paymentMethod: "card", referenceNumber: "TERMINAL-APPROVED-456" }]);
});
it("freezes submitted money and retries the identical payload/reference after transport failure", async () => {
  api.post.mockRejectedValueOnce(new Error("response lost")); mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("response lost");
  const first = api.post.mock.calls[0]; expect(screen.queryByRole("button", { name: "Record confirmed collection" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry same collection" })); await screen.findByText("Collection confirmed"); expect(api.post.mock.calls[1]).toEqual(first);
});
it("recovers a pending reference after reload without recording another payment", async () => {
  api.post.mockRejectedValueOnce(new Error("timeout")); const view = mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("timeout");
  const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; view.unmount();
  api.get.mockImplementation(async (url: string) => url.includes("/collection-operations/") ? response({ ...receipt, requestKey }) : response({ items: [summary], nextCursor: null }));
  mount(); fireEvent.click(screen.getByRole("button", { name: "Check collection result" })); await screen.findByText("Collection confirmed"); expect(api.post).toHaveBeenCalledTimes(1);
});
it("reads immutable receipt history without collection authority and pages only when requested", async () => {
  api.get.mockImplementation(async (url: string) => url.includes("/collections?") ? response({ items: [receipt], nextCursor: "next-receipt" }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [summary], nextCursor: null }));
  mount(false); await open(); const history = await screen.findByRole("region", { name: "Saved collection receipts" }); await within(history).findByText(/Receipt receipt/);
  expect(screen.queryByRole("button", { name: "Record confirmed collection" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next receipt page" })); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("cursor=next-receipt"), expect.any(Object))); expect(api.post).not.toHaveBeenCalled();
});
it("blocks dispatch when opaque recovery reference cannot be persisted", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); }); mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await screen.findByText("storage unavailable"); expect(api.post).not.toHaveBeenCalled();
});
it("clears the previous branch form and ignores its late payment result", async () => {
  let finish!: (value: unknown) => void; api.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await open(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Record confirmed collection" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; api.get.mockResolvedValue(response({ items: [], nextCursor: null }));
  view.rerender(<ToastProvider><PharmacyCollections locationId="other-branch" canCollect /></ToastProvider>);
  await act(async () => { finish(response({ ...receipt, cashTenderedPaise: 2000, cashChangePaise: 0, requestKey })); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByText("Collection confirmed")).not.toBeInTheDocument(); expect(sessionStorage.length).toBe(1);
});
it("refuses incomplete or inconsistent server receipts", () => {
  expect(validateCollectionReceipt(receipt)).toMatchObject({ collectedPaise: 2000 });
  for (const patch of [{ collectedPaise: "2000" }, { entries: [] }, { cashChangePaise: 499 }, { status: "partially_paid" }, { evidenceMode: "qr_displayed" }]) expect(() => validateCollectionReceipt({ ...receipt, ...patch })).toThrow(/could not be confirmed/);
});
