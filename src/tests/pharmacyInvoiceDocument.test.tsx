import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UnifiedDocumentModal } from "@/components/clinical/UnifiedDocumentModal";
import { PharmacyInvoiceDocument } from "@/components/pharmacy/PharmacyInvoiceDocument";
import { canPrintPharmacyInvoice, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import { printHtml } from "@/lib/printBrand";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/printBrand", async () => ({ ...await vi.importActual("@/lib/printBrand"), printHtml: vi.fn(), getPrintBrandStyles: () => "" }));
beforeEach(() => { vi.mocked(printHtml).mockReset().mockResolvedValue(); });
afterEach(cleanup);
const invoice: IssuedPharmacyInvoice = {
  invoiceNumber: "I00012627/000001", documentVersion: 1, financialYear: "2026-27", issuedAt: "2026-10-19T06:30:00Z", status: "unpaid",
  currency: "INR", subtotal: 200, tax: 10, cgstTotal: 5, sgstTotal: 5, totalAmount: 210,
  taxDocument: { version: 1, kind: "tax_invoice", issuedAt: "2026-10-19T06:30:00Z", signatureMode: "manual_on_print", placeOfSupply: "27", reverseCharge: false,
    issuer: { legalName: "Captured Pharmacy", address: "Captured branch address", gstin: "27ABCDE1234F1Z5", stateCode: "27", registration: "regular", drugLicenceNumbers: ["LIC-20", "LIC-21"], authorisedSignatory: "Captured signatory" },
    recipient: { name: "Captured recipient", address: "Captured customer address", stateCode: "27", deliveryAddress: "Captured branch address" } },
  items: [{ description: "Medicine (Batch: RECORDED)", quantity: 2, amount: 100, hsnSacCode: "300490", unitCode: "NOS", gstRate: 5,
    baseAmountPaise: 20000, cgstPaise: 500, sgstPaise: 500, grossAmountPaise: 21000 }],
};
it("prints the captured issuer, recipient, tax, unit and signature fields through the shared print lifecycle", async () => {
  render(<ToastProvider><UnifiedDocumentModal open onClose={() => {}} document={{ documentType: "invoice", title: "Tax Invoice", locationName: "Changed clinic",
    doctorName: "Changed doctor", patientName: "Changed patient", date: "Today", pharmacyInvoice: invoice }} /></ToastProvider>);
  const paper = screen.getByRole("article", { name: "Issued pharmacy document" });
  expect(within(paper).getByText("Captured Pharmacy")).toBeInTheDocument();
  expect(within(paper).getByText(/GSTIN: 27ABCDE1234F1Z5/)).toBeInTheDocument();
  expect(within(paper).getByText(/LIC-20, LIC-21/)).toBeInTheDocument();
  expect(within(paper).getByText(/Recipient: Captured recipient/)).toBeInTheDocument();
  expect(within(paper).getByText("2 NOS")).toBeInTheDocument();
  expect(within(paper).getByText(/HSN: 300490/)).toBeInTheDocument();
  expect(within(paper).getByText(/Payment status: unpaid/)).toBeInTheDocument();
  expect(within(paper).queryByText(/Changed doctor|Changed clinic|Attending Physician/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print invoice" }));
  await waitFor(() => expect(printHtml).toHaveBeenCalledOnce());
  const html = vi.mocked(printHtml).mock.calls[0][0];
  expect(html).toContain("Captured Pharmacy"); expect(html).toContain("300490"); expect(html).toContain("Authorised signature");
  expect(html).not.toContain("Changed clinic"); expect(html).not.toContain("Changed doctor");
});
it.each(["ordinary_bill", "bill_of_supply", "invoice_cum_bill_of_supply"] as const)("uses the captured %s document type", kind => {
  const title = kind === "ordinary_bill" ? "Pharmacy Bill" : kind === "bill_of_supply" ? "Bill of Supply" : "Invoice-cum-Bill of Supply";
  render(<PharmacyInvoiceDocument invoice={{ ...invoice, taxDocument: { ...invoice.taxDocument, kind, notice: "Captured statutory notice" } }} />);
  expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  expect(screen.getByText("Captured statutory notice")).toBeInTheDocument();
});
it("refuses an incomplete issued snapshot instead of printing a reconstructed clinical invoice", async () => {
  const incomplete = { ...invoice, items: [{ ...invoice.items[0], hsnSacCode: "" }] };
  expect(canPrintPharmacyInvoice(incomplete)).toBe(false);
  render(<ToastProvider><UnifiedDocumentModal open onClose={() => {}} document={{ documentType: "invoice", title: "Invoice", locationName: "Clinic", patientName: "Recipient", date: "Today", pharmacyInvoice: incomplete }} /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Print invoice" }));
  await screen.findByText("Could not prepare invoice");
  expect(printHtml).not.toHaveBeenCalled();
});
it("retains captured prices and tax amounts instead of recalculating from the catalogue", () => {
  expect(canPrintPharmacyInvoice(invoice)).toBe(true);
  expect(canPrintPharmacyInvoice({ ...invoice, totalAmount: 999 })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...invoice, items: [{ ...invoice.items[0], grossAmountPaise: 999 }] })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...invoice, taxDocument: { ...invoice.taxDocument, issuer: { ...invoice.taxDocument.issuer, gstin: undefined } } })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...invoice, taxDocument: { ...invoice.taxDocument, kind: "toString" } })).toBe(false);
});
const retail: IssuedPharmacyInvoice = { ...invoice, kind: "pharmacy", createdBy: "actual-operator", customerSnapshot: { anonymous: true }, documentVersion: 2, totalAmount: 209.99,
  taxDocument: { ...invoice.taxDocument, version: 2, recipient: { name: "Walk-in customer", stateCode: "27" } },
  calculation: { policy: "pharmacy-paise-v2", currency: "INR", priceMode: "inclusive", taxMode: "sgst", totals: { lineDiscountPaise: 1000, invoiceDiscountPaise: 1000, grossAmountPaise: 21000, roundOffPaise: -1, payablePaise: 20999 } },
  items: [{ ...invoice.items[0], unitSnapshot: { baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, batches: [{ batchNumber: "CAPTURED-LOT", quantity: 2, expiryValue: "2099-12", expiryPrecision: "month", mrpPaise: 12000, sellingPricePaise: 11500 }] }] };
it("prints patient-optional counter evidence, actual lots, discounts and round-off through the shared lifecycle", async () => {
  expect(canPrintPharmacyInvoice(retail)).toBe(true);
  render(<ToastProvider><UnifiedDocumentModal open onClose={() => {}} document={{ documentType: "invoice", title: "Counter invoice", locationName: "Changed business", patientName: "Unused clinical name", date: "Today", pharmacyInvoice: retail }} /></ToastProvider>);
  const paper = screen.getByRole("article", { name: "Issued pharmacy document" });
  expect(within(paper).getByText(/Recipient: Walk-in customer/)).toBeInTheDocument(); expect(within(paper).getByText(/Batch CAPTURED-LOT/)).toHaveTextContent(/2099-12/);
  expect(within(paper).getByText("2 tablet")).toBeInTheDocument(); expect(within(paper).getByText(/Discounts included above:/)).toHaveTextContent(/20(\.00)?/); expect(within(paper).getByText(/Round-off:/)).toHaveTextContent(/0\.01/);
  expect(within(paper).queryByText(/Unused clinical name|Changed business|Attending Physician/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print invoice" })); await waitFor(() => expect(printHtml).toHaveBeenCalledOnce());
  expect(vi.mocked(printHtml).mock.calls[0][0]).toContain("209.99");
});
it("refuses malformed retail totals, actor/customer snapshots and captured lot evidence", () => {
  expect(canPrintPharmacyInvoice({ ...retail, createdBy: undefined })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...retail, customerSnapshot: undefined })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...retail, calculation: undefined })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...retail, totalAmount: 210 })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...retail, items: [{ ...retail.items[0], batches: [] }] })).toBe(false);
  expect(canPrintPharmacyInvoice({ ...retail, items: [{ ...retail.items[0], batches: [{ ...retail.items[0].batches![0], quantity: 1 }] }] })).toBe(false);
});
