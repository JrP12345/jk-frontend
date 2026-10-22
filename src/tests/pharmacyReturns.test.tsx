import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PharmacyReturns } from "@/components/pharmacy/PharmacyReturns";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { printElement } from "@/lib/printBrand";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("@/lib/printBrand", async () => ({ ...await vi.importActual("@/lib/printBrand"), printElement: vi.fn() }));
const response = (data: unknown) => ({ data: { data } });
const source = { invoiceId: "invoice", invoiceNumber: "I00012627/000001", locationId: "branch", currency: "INR", customerName: "Walk-in customer", returnRevision: 0, paymentRevision: 0, totalPaise: 2000, paidPaise: 0, creditedPaise: 0, balancePaise: 2000, refundPayablePaise: 0,
  lines: [{ sourceLineId: "source-line", sourceBatchId: "source-batch", medicineId: "medicine", description: "Original product", batchNumber: "ACTUAL-BATCH", soldQuantity: 2, returnedQuantity: 0, remainingQuantity: 2, unitSnapshot: { baseUnit: "tablet" }, expiryValue: "2099-12" }], credits: [] };
const result = { returnId: "return", invoiceId: "invoice", locationId: "branch", invoiceNumber: source.invoiceNumber, creditNoteId: "credit", creditNoteNumber: "C00012627/000001", creditedPaise: 1000, totalCreditedPaise: 1000, balancePaise: 1000, refundPayablePaise: 0, disposition: "quarantined", taxAdjustment: "professional_review_required", revision: 1 };
const mount = (canApprove = true, locationId = "branch", canProcess = true) => render(<ToastProvider><PharmacyReturns locationId={locationId} canProcess={canProcess} canApprove={canApprove} /></ToastProvider>);
async function open() { fireEvent.click(await screen.findByRole("button", { name: `Review return ${source.invoiceNumber}` })); await screen.findByRole("region", { name: "Original return source" }); }
function fill() { fireEvent.change(screen.getByLabelText("Return quantity ACTUAL-BATCH"), { target: { value: "1" } }); fireEvent.change(screen.getByLabelText("Actual return reason"), { target: { value: "Actual goods returned" } }); fireEvent.change(screen.getByLabelText("Actual approval/review reference"), { target: { value: "Actual approval reference" } }); fireEvent.click(screen.getByRole("checkbox", { name: /physical quarantine/ })); }
async function review() { fireEvent.click(screen.getByRole("button", { name: "Review source credit" })); await screen.findByRole("region", { name: "Reviewed return credit" }); }
beforeEach(() => {
  vi.mocked(printElement).mockReset().mockResolvedValue();
  sessionStorage.clear(); useAuthStore.setState({ user: { id: "operator", name: "Operator", role: "cashier", email: "operator@example.test", organization_id: "org", permissions: ["PHARMACY_RETURN", "PHARMACY_APPROVE_REFUND"] } });
  api.get.mockReset().mockImplementation(async (url: string) => url.includes("/return-source?") ? response(source) : response({ items: [{ id: "invoice", invoiceNumber: source.invoiceNumber, totalAmount: 20, currency: "INR" }], nextCursor: null }));
  api.post.mockReset().mockImplementation(async (url: string, body: any, config: any) => url.endsWith("/quote") ? response({ invoiceId: "invoice", locationId: "branch", currency: "INR", disposition: "quarantined", totals: { payablePaise: 1000, baseAmountPaise: 1000, cgstPaise: 0, sgstPaise: 0 }, issueInput: { ...body, expectedReturnRevision: 0, expectedPaymentRevision: 0, expectedCreditPaise: 1000 } }) : response({ ...result, requestKey: config.headers["Idempotency-Key"] }));
});
afterEach(() => { vi.restoreAllMocks(); });
it("requires source quantities, approval evidence and actual quarantine before credit review and posting", async () => {
  mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "Review source credit" })); await screen.findByText(/Select returned quantities/); expect(api.post).not.toHaveBeenCalled(); fill(); await review(); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await screen.findByText("Return committed");
  expect(api.post.mock.calls[1][1]).toMatchObject({ expectedReturnRevision: 0, expectedPaymentRevision: 0, expectedCreditPaise: 1000, confirmedQuarantine: true, lines: [{ sourceLineId: "source-line", sourceBatchId: "source-batch", quantity: 1, condition: "unknown" }] }); expect(screen.getByText(/Refund payouts are recorded separately/)).toBeInTheDocument(); expect(sessionStorage.length).toBe(1); expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toMatch(/quantity|reason|reviewReference|customer/);
  fireEvent.click(screen.getByRole("button", { name: "Done with return" })); expect(sessionStorage.length).toBe(0);
});
it("invalidates credit review when returned quantities change, and rejects over-return locally", async () => {
  mount(); await open(); fill(); await review(); fireEvent.change(screen.getByLabelText("Return quantity ACTUAL-BATCH"), { target: { value: "3" } }); expect(screen.queryByRole("region", { name: "Reviewed return credit" })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Review source credit" })); await screen.findByText(/within the remaining sold lots/); expect(api.post).toHaveBeenCalledTimes(1);
});
it("retains and retries the same immutable return command after a lost response", async () => {
  mount(); await open(); fill(); await review(); api.post.mockRejectedValueOnce(new Error("response lost")); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await screen.findByText("response lost"); const first = api.post.mock.calls[1]; fireEvent.click(screen.getByRole("button", { name: "Retry same return" })); await screen.findByText("Return committed"); expect(api.post.mock.calls[2]).toEqual(first);
});
it("recovers a committed return after reload without another stock or money command", async () => {
  const view = mount(); await open(); fill(); await review(); api.post.mockRejectedValueOnce(new Error("timeout")); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await screen.findByText("timeout"); const requestKey = api.post.mock.calls[1][2].headers["Idempotency-Key"]; view.unmount(); const original = api.get.getMockImplementation()!; api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/return-operations/") ? response({ ...result, requestKey }) : original(url, config)); mount(); fireEvent.click(screen.getByRole("button", { name: "Check return result" })); await screen.findByText("Return committed"); expect(api.post).toHaveBeenCalledTimes(2);
});
it("allows source review without financial approval and prevents posting", async () => {
  mount(false); await open(); fill(); await review(); expect(screen.getByRole("button", { name: "Approve and post return" })).toBeDisabled(); expect(api.post.mock.calls.every(([url]) => url.endsWith("/quote"))).toBe(true);
});
it("blocks dispatch if opaque recovery storage cannot be written", async () => {
  mount(); await open(); fill(); await review(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); }); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await screen.findByText("storage unavailable"); expect(api.post).toHaveBeenCalledTimes(1);
});
it("clears branch-local return details and ignores a late posting result", async () => {
  let finish!: (value: unknown) => void; const view = mount(); await open(); fill(); await review(); api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); const requestKey = api.post.mock.calls[1][2].headers["Idempotency-Key"];
  api.get.mockResolvedValue(response({ items: [], nextCursor: null })); view.rerender(<ToastProvider><PharmacyReturns locationId="foreign-branch" canProcess canApprove /></ToastProvider>); await act(async () => { finish(response({ ...result, requestKey })); }); expect(screen.queryByText("Return committed")).not.toBeInTheDocument(); expect(screen.queryByRole("region", { name: "Original return source" })).not.toBeInTheDocument(); expect(sessionStorage.length).toBe(1);
});
it("loads and reprints the committed credit note without another return or refund command", async () => {
  mount(); await open(); fill(); await review(); fireEvent.click(screen.getByRole("button", { name: "Approve and post return" })); await screen.findByText("Return committed");
  const document = { id: "return", invoiceId: "invoice", invoiceNumber: source.invoiceNumber, locationId: "branch", actorId: "actual-operator", approvedBy: "actual-approver", createdAt: "2026-10-20T06:30:00Z", reason: "Actual returned goods", reviewReference: "Actual review",
    lines: [{ description: "Original product", batchNumber: "ACTUAL-BATCH", quantity: 1, condition: "unopened", payablePaise: 1000 }],
    creditNote: { id: "credit", returnId: "return", locationId: "branch", invoiceId: "invoice", sourceInvoiceNumber: source.invoiceNumber, sourceIssuedAt: "2026-10-19T06:30:00Z", issuedAt: "2026-10-20T06:30:00Z", creditNoteNumber: result.creditNoteNumber, currency: "INR", taxAdjustment: "professional_review_required", baseAmountPaise: 1000, cgstPaise: 0, sgstPaise: 0, grossAmountPaise: 1000, roundOffPaise: 0, payablePaise: 1000,
      issuerSnapshot: { issuer: { legalName: "Captured Pharmacy", address: "Captured branch", drugLicenceNumbers: ["CAPTURED-LICENCE"] }, recipient: { name: "Actual customer" } } } };
  api.get.mockResolvedValue(response(document)); fireEvent.click(screen.getByRole("button", { name: "Preview return credit note return" })); const paper = await screen.findByRole("article", { name: "Saved sales return credit note" }); expect(paper).toHaveTextContent("Captured Pharmacy"); expect(paper).toHaveTextContent("actual-approver"); expect(paper).toHaveTextContent("ACTUAL-BATCH");
  fireEvent.click(screen.getByRole("button", { name: "Print return credit note" })); await waitFor(() => expect(printElement).toHaveBeenCalledOnce()); expect(vi.mocked(printElement).mock.lastCall![1]).toMatchObject({ title: result.creditNoteNumber, paper: "A4" }); expect(api.post).toHaveBeenCalledTimes(2);
});
