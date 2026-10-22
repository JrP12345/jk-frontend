import api from "./api";
import type { InvoiceSummary } from "./pharmacyCollections";
import type { PharmacyTaxDocument } from "./pharmacyInvoice";
export interface ReturnLine { sourceLineId: string; sourceBatchId: string; medicineId: string; description: string; batchNumber: string; soldQuantity: number; returnedQuantity: number; remainingQuantity: number; unitSnapshot: { baseUnit: string }; expiryValue: string }
export interface ReturnSource { invoiceId: string; invoiceNumber: string; locationId: string; currency: "INR"; customerName: string; returnRevision: number; paymentRevision: number; totalPaise: number; paidPaise: number; creditedPaise: number; balancePaise: number; refundPayablePaise: number; lines: ReturnLine[]; credits: Array<{ id: string; returnId: string; creditNoteNumber: string; payablePaise: number }> }
export interface ReturnIntent { locationId: string; reason: string; reviewReference: string; confirmedQuarantine: true; lines: Array<{ sourceLineId: string; sourceBatchId: string; quantity: number; condition: string }> }
export interface ReturnCommit extends ReturnIntent { expectedReturnRevision: number; expectedPaymentRevision: number; expectedCreditPaise: number }
export interface ReturnQuote { invoiceId: string; locationId: string; currency: "INR"; disposition: "quarantined"; totals: { payablePaise: number; baseAmountPaise: number; cgstPaise: number; sgstPaise: number }; issueInput: ReturnCommit }
export interface ReturnResult { returnId: string; invoiceId: string; locationId: string; invoiceNumber: string; creditNoteId: string; creditNoteNumber: string; creditedPaise: number; totalCreditedPaise: number; balancePaise: number; refundPayablePaise: number; disposition: "quarantined"; taxAdjustment: string; revision: number; requestKey: string }
export async function returnInvoicePage(locationId: string, invoiceNumber: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ locationId }); if (invoiceNumber.trim()) query.set("invoiceNumber", invoiceNumber.trim()); if (cursor) query.set("cursor", cursor);
  const response = await api.get(`/pharmacy/return-invoices?${query}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Return invoice list is incomplete");
  return page as { items: InvoiceSummary[]; nextCursor: string | null };
}
export async function readReturnSource(invoiceId: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/invoices/${encodeURIComponent(invoiceId)}/return-source?locationId=${encodeURIComponent(locationId)}`, { signal }), source = response.data?.data as ReturnSource;
  if (!source || source.invoiceId !== invoiceId || source.locationId !== locationId || source.currency !== "INR" || !Array.isArray(source.lines) || source.lines.length > 1000 || !Array.isArray(source.credits) ||
      [source.returnRevision, source.paymentRevision, source.totalPaise, source.paidPaise, source.creditedPaise, source.balancePaise, source.refundPayablePaise].some(value => !Number.isSafeInteger(value) || value < 0) ||
      source.lines.some(line => !line.sourceLineId || !line.sourceBatchId || [line.soldQuantity, line.returnedQuantity, line.remainingQuantity].some(value => !Number.isSafeInteger(value) || value < 0) || line.soldQuantity - line.returnedQuantity !== line.remainingQuantity || !line.unitSnapshot?.baseUnit)) throw new Error("Return source evidence is incomplete");
  return source;
}
export async function previewReturn(invoiceId: string, intent: ReturnIntent, signal?: AbortSignal) {
  const response = await api.post(`/pharmacy/invoices/${encodeURIComponent(invoiceId)}/returns/quote`, intent, { signal }), quote = response.data?.data as ReturnQuote;
  if (!quote || quote.invoiceId !== invoiceId || quote.locationId !== intent.locationId || quote.currency !== "INR" || quote.disposition !== "quarantined" || !quote.totals || [quote.totals.payablePaise, quote.totals.baseAmountPaise, quote.totals.cgstPaise, quote.totals.sgstPaise].some(value => !Number.isSafeInteger(value) || value < 0) || quote.issueInput?.expectedCreditPaise !== quote.totals.payablePaise || quote.issueInput.locationId !== intent.locationId || quote.issueInput.reason !== intent.reason || quote.issueInput.reviewReference !== intent.reviewReference || quote.issueInput.confirmedQuarantine !== true || JSON.stringify(quote.issueInput.lines) !== JSON.stringify(intent.lines)) throw new Error("Return credit review is incomplete");
  return quote;
}
function validateResult(value: unknown, locationId: string, key: string) {
  const result = value as ReturnResult;
  if (!result || result.locationId !== locationId || result.requestKey !== key || !result.returnId || !result.invoiceId || !result.creditNoteId || !result.creditNoteNumber || result.disposition !== "quarantined" || [result.creditedPaise, result.totalCreditedPaise, result.balancePaise, result.refundPayablePaise, result.revision].some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("Return result could not be confirmed. Keep the same reference.");
  return result;
}
export async function submitReturn(invoiceId: string, input: ReturnCommit, key: string) { const response = await api.post(`/pharmacy/invoices/${encodeURIComponent(invoiceId)}/returns`, input, { headers: { "Idempotency-Key": key } }); return validateResult(response.data?.data, input.locationId, key); }
export async function recoverReturn(locationId: string, key: string) { const response = await api.get(`/pharmacy/return-operations/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`); return validateResult(response.data?.data, locationId, key); }
export interface ReturnDocument {
  id: string; locationId: string; invoiceId: string; invoiceNumber: string; createdAt: string; actorId: string; approvedBy: string; reason: string; reviewReference: string;
  lines: Array<{ description: string; batchNumber: string; quantity: number; condition: string; payablePaise: number }>;
  creditNote: { id: string; returnId: string; locationId: string; invoiceId: string; sourceInvoiceNumber: string; sourceIssuedAt: string; creditNoteNumber: string; issuedAt: string; currency: string; taxAdjustment: string; issuerSnapshot: PharmacyTaxDocument; baseAmountPaise: number; cgstPaise: number; sgstPaise: number; grossAmountPaise: number; roundOffPaise: number; payablePaise: number };
}
export async function readReturnDocument(returnId: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/returns/${encodeURIComponent(returnId)}?locationId=${encodeURIComponent(locationId)}`, { signal }), doc = response.data?.data as ReturnDocument, credit = doc?.creditNote;
  if (!doc || doc.id !== returnId || doc.locationId !== locationId || !credit || credit.returnId !== returnId || credit.locationId !== locationId || credit.invoiceId !== doc.invoiceId || credit.sourceInvoiceNumber !== doc.invoiceNumber || credit.currency !== "INR" || !credit.creditNoteNumber || !credit.issuerSnapshot?.issuer?.legalName || !credit.issuerSnapshot.issuer.address || !Array.isArray(credit.issuerSnapshot.issuer.drugLicenceNumbers) || !credit.issuerSnapshot.issuer.drugLicenceNumbers.length || !credit.issuerSnapshot.recipient?.name || !Number.isFinite(new Date(credit.issuedAt).getTime()) || !Number.isFinite(new Date(credit.sourceIssuedAt).getTime()) ||
      [credit.baseAmountPaise, credit.cgstPaise, credit.sgstPaise, credit.grossAmountPaise, credit.payablePaise].some(value => !Number.isSafeInteger(value) || value < 0) || !Number.isSafeInteger(credit.roundOffPaise) || credit.baseAmountPaise + credit.cgstPaise + credit.sgstPaise !== credit.grossAmountPaise || credit.grossAmountPaise + credit.roundOffPaise !== credit.payablePaise ||
      !Array.isArray(doc.lines) || !doc.lines.length || doc.lines.length > 100 || doc.lines.some(line => !line.description || !line.batchNumber || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.payablePaise) || line.payablePaise < 0) || doc.lines.reduce((sum, line) => sum + line.payablePaise, 0) !== credit.payablePaise) throw new Error("Saved return/credit document evidence is incomplete");
  return doc;
}
