import { drawerFixture } from "./fixtures/pharmacyDrawer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyDocumentButton } from "@/components/pharmacy/PharmacyDocumentButton";
import { PharmacyCollections } from "@/components/pharmacy/PharmacyCollections";
import { PharmacySaleRecovery } from "@/components/pharmacy/PharmacySaleRecovery";
import { ToastProvider } from "@/components/ui";
import { printElement, PrintPreparationError } from "@/lib/printBrand";
import { useAuthStore } from "@/store/authStore";
import { referenceOwnerKey } from "@/lib/authScope";
import type { CounterInvoice, CollectionReceipt } from "@/lib/pharmacyCollections";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("@/lib/printBrand", async () => ({ ...await vi.importActual("@/lib/printBrand"), printElement: vi.fn() }));
const response = (data: unknown) => ({ data: { data } });
const invoice: CounterInvoice = { id: "invoice", locationId: "branch", paymentRevision: 2, amountPaid: 20, balanceDue: 0,
  kind: "pharmacy", createdBy: "operator", customerSnapshot: { anonymous: true }, invoiceNumber: "I00012627/000001", documentVersion: 2, financialYear: "2026-27", issuedAt: "2026-10-20T06:30:00Z", currency: "INR", status: "paid", subtotal: 20, totalAmount: 20, tax: 0, cgstTotal: 0, sgstTotal: 0,
  taxDocument: { version: 2, kind: "ordinary_bill", signatureMode: "manual_on_print", issuedAt: "2026-10-20T06:30:00Z", placeOfSupply: "27", reverseCharge: false,
    issuer: { legalName: "Captured Pharmacy", address: "Captured branch address", stateCode: "27", registration: "unregistered", drugLicenceNumbers: ["CAPTURED-LICENCE"], authorisedSignatory: "Actual signatory" }, recipient: { name: "Walk-in customer", stateCode: "27" } },
  calculation: { policy: "pharmacy-paise-v2", currency: "INR", priceMode: "inclusive", taxMode: "none", totals: { lineDiscountPaise: 0, invoiceDiscountPaise: 0, grossAmountPaise: 2000, payablePaise: 2000, roundOffPaise: 0 } },
  items: [{ description: "Captured product", quantity: 2, amount: 10, hsnSacCode: "300490", gstRate: 0, unitCode: "NOS", baseAmountPaise: 2000, cgstPaise: 0, sgstPaise: 0, grossAmountPaise: 2000, unitSnapshot: { baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, batches: [{ batchNumber: "CAPTURED-BATCH", quantity: 2, expiryValue: "2099-12", expiryPrecision: "month", sellingPricePaise: 1000, mrpPaise: 1200 }] }] };
const receipt: CollectionReceipt = { receiptId: "receipt-original", invoiceId: "invoice", invoiceNumber: invoice.invoiceNumber, locationId: "branch", currency: "INR", actorId: "actual-cashier", paidAt: "2026-10-20T08:00:00Z", creditedPaise: 0, collectedPaise: 700, paidPaise: 700, balancePaise: 1300, revision: 1, cashTenderedPaise: 1000, cashChangePaise: 300, status: "partially_paid", evidenceMode: "staff_confirmed_manual", shiftId: drawerFixture.id, drawerCode: drawerFixture.drawerCode, entries: [{ componentId: "component-one", amountPaise: 700, paymentMethod: "cash" }] };
beforeEach(() => {
  sessionStorage.clear(); useAuthStore.setState({ user: { id: "cashier", name: "Cashier", email: "cashier@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_SELL"] } });
  api.get.mockReset().mockImplementation(async (url: string) => url === "/pharmacy/till" ? response({ active: drawerFixture }) : url.includes("/sale-operations/") ? response({ invoiceId: "invoice", dispenseId: "dispense", invoiceNumber: invoice.invoiceNumber, totalPaise: 2000, status: "unpaid", requestKey: "original-reference" }) : url.includes("/collections?") ? response({ items: [receipt], nextCursor: null }) : url.includes("/invoices/invoice?") ? response(invoice) : response({ items: [{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: "paid", totalAmount: 20, currency: "INR" }], nextCursor: null }));
  api.post.mockReset(); vi.mocked(printElement).mockReset().mockResolvedValue(); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });
it("previews and reprints the saved bill at A4, 80 and 58 mm without any financial mutation", async () => {
  render(<ToastProvider><PharmacyDocumentButton invoice={invoice} /></ToastProvider>); fireEvent.click(screen.getByRole("button", { name: "Preview saved pharmacy bill" }));
  const dialog = screen.getByRole("dialog", { name: "Pharmacy Bill" }); expect(within(dialog).getByText(/CAPTURED-BATCH/)).toHaveTextContent("2099-12");
  fireEvent.click(screen.getByRole("button", { name: "Print pharmacy bill" })); await waitFor(() => expect(printElement).toHaveBeenCalledTimes(1)); expect(vi.mocked(printElement).mock.calls[0][1]).toMatchObject({ title: invoice.invoiceNumber, paper: "A4" });
  for (const paper of ["80mm", "58mm"]) { const trigger = screen.getByLabelText("Pharmacy paper size"); fireEvent.change(document.getElementById(trigger.id.replace(/-trigger$/, ""))!, { target: { value: paper } }); fireEvent.click(screen.getByRole("button", { name: "Print pharmacy bill" })); await waitFor(() => expect(vi.mocked(printElement).mock.lastCall![1]).toMatchObject({ paper, css: expect.stringContaining(`calc(${paper} - 4mm)`) })); }
  expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
});
it("retains the same document after printer failure and allows reprint without issuing again", async () => {
  vi.mocked(printElement).mockRejectedValueOnce(new PrintPreparationError("unavailable")); render(<ToastProvider><PharmacyDocumentButton invoice={invoice} /></ToastProvider>); fireEvent.click(screen.getByRole("button", { name: "Preview saved pharmacy bill" })); fireEvent.click(screen.getByRole("button", { name: "Print pharmacy bill" })); await screen.findByText("Could not prepare pharmacy bill");
  expect(screen.getByRole("article", { name: "Issued pharmacy document" })).toHaveTextContent(invoice.invoiceNumber); fireEvent.click(screen.getByRole("button", { name: "Print pharmacy bill" })); await waitFor(() => expect(printElement).toHaveBeenCalledTimes(2)); expect(vi.mocked(printElement).mock.calls[0][0]).toBe(vi.mocked(printElement).mock.calls[1][0]); expect(api.post).not.toHaveBeenCalled();
});
it("prints the original partial receipt after later settlement, keeping its actual cashier and cash change", async () => {
  render(<ToastProvider><PharmacyDocumentButton invoice={invoice} receipt={receipt} /></ToastProvider>); fireEvent.click(screen.getByRole("button", { name: `Preview receipt ${receipt.receiptId}` })); const paper = screen.getByRole("article", { name: "Saved pharmacy collection receipt" });
  expect(paper).toHaveTextContent("Captured Pharmacy"); expect(paper).toHaveTextContent("actual-cashier"); expect(paper).toHaveTextContent(/Remaining.*13/); expect(paper).toHaveTextContent(/Change.*3/); expect(within(paper).queryByText(/Payment status: paid/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print collection receipt" })); await waitFor(() => expect(printElement).toHaveBeenCalledOnce()); expect(vi.mocked(printElement).mock.lastCall![1]?.title).toBe(`Receipt ${receipt.receiptId}`); expect(api.post).not.toHaveBeenCalled();
});
it("blocks printing incomplete bills, inconsistent receipts and a receipt linked to another invoice or branch", () => {
  const view = render(<ToastProvider><PharmacyDocumentButton invoice={{ ...invoice, items: [] }} /></ToastProvider>); expect(screen.getByRole("button", { name: "Preview saved pharmacy bill" })).toBeDisabled();
  for (const patch of [{ invoiceId: "another" }, { locationId: "foreign" }, { invoiceNumber: "another" }, { cashChangePaise: 299 }, { balancePaise: 1200 }]) { view.rerender(<ToastProvider><PharmacyDocumentButton invoice={invoice} receipt={{ ...receipt, ...patch }} /></ToastProvider>); expect(screen.getByRole("button", { name: `Preview receipt ${receipt.receiptId}` })).toBeDisabled(); }
  expect(printElement).not.toHaveBeenCalled();
});
it("opens saved bill and receipt previews through the sales history without collection authority", async () => {
  render(<ToastProvider><PharmacyCollections locationId="branch" canCollect={false} /></ToastProvider>); fireEvent.click(await screen.findByRole("button", { name: `Open sale ${invoice.invoiceNumber}` })); await screen.findByRole("dialog", { name: "Counter invoice collections" }); fireEvent.click(await screen.findByRole("button", { name: `Preview receipt ${receipt.receiptId}` })); await screen.findByRole("article", { name: "Saved pharmacy collection receipt" }); expect(screen.queryByRole("button", { name: "Record confirmed collection" })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it("recovers a saved sale under history authority, opens its real ID, and acknowledges only the opaque reference", async () => {
  sessionStorage.setItem(`pharmacy-sale:${referenceOwnerKey(useAuthStore.getState().user)}:branch`, "original-reference"); const onOpen = vi.fn(); render(<ToastProvider><PharmacySaleRecovery locationId="branch" onOpen={onOpen} /></ToastProvider>);
  expect(screen.getByLabelText("Original counter sale reference")).toHaveValue("original-reference"); fireEvent.click(screen.getByRole("button", { name: "Recover saved counter sale" })); await screen.findByText("Saved sale recovered"); fireEvent.click(screen.getByRole("button", { name: "Open recovered bill and receipts" })); expect(onOpen).toHaveBeenCalledWith("invoice"); fireEvent.click(screen.getByRole("button", { name: "Acknowledge recovered sale" })); expect(sessionStorage.length).toBe(0); expect(api.post).not.toHaveBeenCalled();
});
it("keeps an unresolved reference after a 404 instead of enabling a duplicate issue", async () => {
  api.get.mockRejectedValue({ response: { status: 404, data: { message: "No committed counter invoice is visible. Keep the same reference." } } }); render(<ToastProvider><PharmacySaleRecovery locationId="branch" onOpen={vi.fn()} /></ToastProvider>); fireEvent.change(screen.getByLabelText("Original counter sale reference"), { target: { value: "original-reference" } }); fireEvent.click(screen.getByRole("button", { name: "Recover saved counter sale" })); await screen.findByText(/No committed counter invoice is visible/); expect(screen.getByLabelText("Original counter sale reference")).toHaveValue("original-reference"); expect(screen.queryByRole("button", { name: "Acknowledge recovered sale" })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it("does not clear another pending sale when a manually entered reference is recovered", async () => {
  const storageKey = `pharmacy-sale:${referenceOwnerKey(useAuthStore.getState().user)}:branch`; sessionStorage.setItem(storageKey, "different-pending-reference"); render(<ToastProvider><PharmacySaleRecovery locationId="branch" onOpen={vi.fn()} /></ToastProvider>);
  fireEvent.change(screen.getByLabelText("Original counter sale reference"), { target: { value: "original-reference" } }); fireEvent.click(screen.getByRole("button", { name: "Recover saved counter sale" })); await screen.findByText("Saved sale recovered"); fireEvent.click(screen.getByRole("button", { name: "Acknowledge recovered sale" })); await screen.findByText(/A different sale reference is pending/); expect(sessionStorage.getItem(storageKey)).toBe("different-pending-reference");
});
it("clears the recovered document when branch authority changes", async () => {
  const view = render(<ToastProvider><PharmacySaleRecovery locationId="branch" onOpen={vi.fn()} /></ToastProvider>); fireEvent.change(screen.getByLabelText("Original counter sale reference"), { target: { value: "original-reference" } }); fireEvent.click(screen.getByRole("button", { name: "Recover saved counter sale" })); await screen.findByText("Saved sale recovered");
  view.rerender(<ToastProvider><PharmacySaleRecovery locationId="other-branch" onOpen={vi.fn()} /></ToastProvider>); expect(screen.queryByText("Saved sale recovered")).not.toBeInTheDocument(); expect(screen.getByLabelText("Original counter sale reference")).toHaveValue(""); expect(api.post).not.toHaveBeenCalled();
});
it("ignores a late recovery after its workspace unmounts", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const view = render(<ToastProvider><PharmacySaleRecovery locationId="branch" onOpen={vi.fn()} /></ToastProvider>); fireEvent.change(screen.getByLabelText("Original counter sale reference"), { target: { value: "original-reference" } }); fireEvent.click(screen.getByRole("button", { name: "Recover saved counter sale" })); await waitFor(() => expect(api.get).toHaveBeenCalledOnce()); view.unmount(); await act(async () => { finish(response({ invoiceId: "invoice", dispenseId: "dispense", invoiceNumber: invoice.invoiceNumber, totalPaise: 2000, status: "unpaid", requestKey: "original-reference" })); }); expect(screen.queryByText("Saved sale recovered")).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
