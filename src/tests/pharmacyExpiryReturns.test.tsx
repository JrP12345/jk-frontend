import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyExpiryReturnPreparation } from "@/components/pharmacy/PharmacyExpiryReturnPreparation";
import { PharmacyFinance } from "@/components/pharmacy/PharmacyFinance";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { expiryDraftCsv, prepareSupplierExpiryDrafts, readExpiryReturnPreparation, type ExpiryReturnPreparation } from "@/lib/pharmacyExpiryReturns";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const id = (n: number) => n.toString(16).padStart(24, "0"), locationId = id(1);
const fixture = (): ExpiryReturnPreparation => ({ locationId, days: 60, asOf: "2026-11-23T10:00:00.000Z", cutoff: "2027-01-22T10:00:00.000Z", note: "Preparation does not move goods or post supplier credit.", review: [], documents: [80, 70, 50].map((quantity, index) => ({ purchaseId: id(10 + index), locationId, supplierId: id(20 + index), supplierName: `Supplier ${index}`, supplierInvoiceNumber: `INVOICE-${index}`, purchaseRevision: 2, settlementRevision: 0, currency: "INR", lines: [{ receiptId: id(30 + index), receiptLineId: `receipt-line-${index}`, batchId: id(40 + index), description: `Medicine ${index}`, batchNumber: `BATCH-${index}`, receivedQuantity: quantity, returnedQuantity: 0, onHandQuantity: quantity, remainingQuantity: quantity, expiryValue: "2026-12", unitSnapshot: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } }] })) });
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); api.get.mockReset().mockResolvedValue({ data: { data: fixture() } }); api.post.mockReset(); });
it("prepares three supplier packing lists while preserving separate source invoices and base units", () => {
  const value = fixture(), selected = Object.fromEntries(value.documents.map(doc => [doc.lines[0].batchId, String(doc.lines[0].remainingQuantity)])), groups = prepareSupplierExpiryDrafts(value, selected);
  expect(groups).toHaveLength(3); expect(groups[0].documents[0].quantities).toEqual({ [`${id(30)}:receipt-line-0`]: "80" });
  expect(expiryDraftCsv(groups[0], value.asOf)).toContain('"NO_STOCK_MOVEMENT_OR_CREDIT"'); expect(expiryDraftCsv(groups[0], value.asOf)).not.toContain("INVOICE-1");
  value.documents[0].supplierName = "=UNTRUSTED"; expect(expiryDraftCsv(prepareSupplierExpiryDrafts(value, selected)[0], value.asOf)).toContain("'=UNTRUSTED");
});
it("requires explicit whole quantities within original source allowances", () => {
  const value = fixture(); for (const quantity of ["0", "81", "1.5", "9007199254740992", "-1"]) expect(() => prepareSupplierExpiryDrafts(value, { [id(40)]: quantity })).toThrow();
  expect(() => prepareSupplierExpiryDrafts(value, {})).toThrow(); expect(() => prepareSupplierExpiryDrafts(value, { unknown: "1" })).toThrow();
});
it("rejects mismatched branches, duplicate lots and inconsistent source allowances", async () => {
  for (const change of [(v: ExpiryReturnPreparation) => { v.locationId = id(999); }, (v: ExpiryReturnPreparation) => { v.documents[1].lines[0].batchId = id(40); }, (v: ExpiryReturnPreparation) => { v.documents[0].lines[0].remainingQuantity = 81; }]) { const value = fixture(); change(value); api.get.mockResolvedValueOnce({ data: { data: value } }); await expect(readExpiryReturnPreparation(locationId, 60)).rejects.toThrow(/verified/); }
});
it("loads on request, prepares locally and passes selected source quantities for fresh invoice review", async () => {
  const review = vi.fn(); render(<PharmacyExpiryReturnPreparation locationId={locationId} disabled={false} onReviewInvoice={review} />);
  expect(api.get).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Prepare expiry returns by supplier")); fireEvent.click(screen.getByRole("button", { name: "Find expiry return sources" }));
  await screen.findByText(/No|Snapshot/); for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText(`Medicine ${i} · Batch BATCH-${i} · Expiry 2026-12`));
  fireEvent.click(screen.getByRole("button", { name: "Prepare selected supplier drafts" })); expect(await screen.findByText(/3 supplier drafts prepared locally/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review goods return INVOICE-0" })); expect(review).toHaveBeenCalledWith(id(10), { [`${id(30)}:receipt-line-0`]: "80" }); expect(api.post).not.toHaveBeenCalled();
});
it("ignores late reads after the view closes", async () => {
  let finish!: (value: unknown) => void; api.get.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const view = render(<PharmacyExpiryReturnPreparation locationId={locationId} disabled={false} onReviewInvoice={vi.fn()} />);
  fireEvent.click(screen.getByText("Prepare expiry returns by supplier")); fireEvent.click(screen.getByRole("button", { name: "Find expiry return sources" })); await waitFor(() => expect(api.get).toHaveBeenCalledOnce()); view.unmount(); finish({ data: { data: fixture() } }); expect(api.post).not.toHaveBeenCalled();
});
it("hands selected lots to the original goods-return editor without authorizing a financial write", async () => {
  const value = fixture(), doc = value.documents[0]; sessionStorage.clear();
  useAuthStore.setState({ user: { id: "return-clerk", name: "Return clerk", email: "clerk@example.test", role: "clerk", organization_id: "org", permissions: ["PHARMACY_PURCHASE", "PHARMACY_RETURN"] } });
  const totals = { payablePaise: 11800, confirmedCreditPaise: 0, paidPaise: 0, duePaise: 11800, pendingCreditPaise: 0, supplierRefundReceivablePaise: 0 };
  api.get.mockImplementation(async (url: string) => ({ data: { data: url.includes("expiry-return-preparation") ? value : url.includes("return-source") ? doc : { supplierId: doc.supplierId, supplierName: doc.supplierName, locationId, currency: "INR", purchases: [{ ...totals, purchaseId: doc.purchaseId, supplierInvoiceNumber: doc.supplierInvoiceNumber, settlementRevision: 0 }], openingBalances: [], returns: [], totals } } }));
  render(<ToastProvider><PharmacyFinance locationId={locationId} canViewSuppliers canViewCustomers={false} canSettle={false} canReturn canCollect={false} canViewSales={false} canOpening={false} /></ToastProvider>);
  fireEvent.click(screen.getByText("Prepare expiry returns by supplier")); fireEvent.click(screen.getByRole("button", { name: "Find expiry return sources" }));
  fireEvent.click(await screen.findByLabelText("Medicine 0 · Batch BATCH-0 · Expiry 2026-12")); fireEvent.click(screen.getByRole("button", { name: "Prepare selected supplier drafts" })); fireEvent.click(screen.getByRole("button", { name: "Review goods return INVOICE-0" }));
  await screen.findByRole("region", { name: "Supplier received return source" });
  expect(screen.getByLabelText("Supplier return quantity BATCH-0")).toHaveValue(80); expect(screen.getByLabelText("Actual supplier return reason")).toHaveValue("Near-expiry goods");
  expect(api.post).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: "Confirm supplier goods return" })).not.toBeInTheDocument();
});
