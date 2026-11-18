import api from "./api";
import { validateCollectionReceipt, type CollectionInput, type CollectionReceipt, type CounterInvoice } from "./pharmacyCollections";
import type { CataloguePage, CataloguePageQuery } from "./pharmacyBranchCatalogue";
import { recordPharmacyServerTiming } from "./pharmacySavePerformance";

export interface CounterProduct { id: string; name: string; genericName: string; strength?: string; manufacturer?: string; rackLocation?: string; barcodes?: string[]; retailPricePaise?: number; stockQuantity: number; eligible: boolean; saleBlocked?: boolean; saleBlockReason?: string; unitDefinition?: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number } }
export interface CounterCustomer { id: string; name: string; address: string; phone?: string; revision: number }
export interface CounterIntent { locationId: string; expectedInventoryMode?: "tracked" | "billing_only"; externalPrescription?: { id: string; revision: number }; customerId?: string; invoiceDiscountPaise: number; roundOffPaise: number; lines: Array<{ lineId: string; medicineId: string; quantity: number; expectedUnitVersion: number; discountPaise: number }> }
export interface CounterIssueInput extends CounterIntent { confirmationMode?: "current_total"; includeDocument?: true; expectedProfileRevision?: number; expectedTotalPaise: number; expectedQuoteHash?: string; expectedCustomerRevision?: number; payment?: CollectionInput; lines: Array<CounterIntent["lines"][number] & { expectedStockRevision?: number; expectedLineTotalPaise?: number }> }
export interface CounterQuote {
  locationId: string; currency: "INR"; quoteHash: string; customer: CounterCustomer | null; issueInput: CounterIssueInput;
  calculation: { policy: string; lines: Array<{ lineId: string; quantity: number; grossAmountPaise: number; gstRateBps?: number }>; totals: { payablePaise: number; baseAmountPaise: number; cgstPaise: number; sgstPaise: number; lineDiscountPaise: number; invoiceDiscountPaise: number; roundOffPaise: number } };
  lines: Array<{ lineId: string; medicineId: string; description: string; quantity: number; unitSnapshot: { baseUnit: string }; batches: Array<{ batchNumber: string; quantity: number; expiryValue: string; mrpPaise: number; sellingPricePaise: number }> }>;
}
export interface CounterResult { invoiceId: string; dispenseId: string; invoiceNumber: string; totalPaise: number; status: "unpaid" | "paid"; requestKey: string; collection?: CollectionReceipt; document?: CounterInvoice }
async function searchPage<T>(path: string, locationId: string, query: Record<string, string | undefined>, signal?: AbortSignal) {
  const params = new URLSearchParams({ locationId }); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, value); });
  const response = await api.get(`/pharmacy/sales/${path}?${params}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Counter search is incomplete. Retry the lookup.");
  return page as { items: T[]; nextCursor: string | null };
}
export const counterProducts = (locationId: string, query: { search?: string; barcode?: string; cursor?: string }, signal?: AbortSignal) => searchPage<CounterProduct>("products", locationId, query, signal);
export async function counterCataloguePage(locationId: string, query: CataloguePageQuery, signal: AbortSignal): Promise<CataloguePage> {
  const params = new URLSearchParams({ locationId, ...query });
  return (await api.get(`/pharmacy/sales/catalogue?${params}`, { signal })).data?.data;
}
export const counterCustomers = (locationId: string, search: string, cursor?: string, signal?: AbortSignal) => searchPage<CounterCustomer>("customers", locationId, { search, cursor }, signal);
export async function quoteCounter(intent: CounterIntent, signal?: AbortSignal): Promise<CounterQuote> {
  const response = await api.post(intent.externalPrescription ? "/pharmacy/external-prescriptions/quote" : "/pharmacy/sales/quote", intent, { signal }), q = response.data?.data as CounterQuote;
  if (!q || q.locationId !== intent.locationId || q.currency !== "INR" || !/^[a-f0-9]{64}$/.test(q.quoteHash) || q.issueInput?.expectedQuoteHash !== q.quoteHash || q.issueInput.locationId !== intent.locationId ||
      q.calculation?.policy !== "pharmacy-paise-v2" || !Number.isSafeInteger(q.calculation.totals.payablePaise) || q.calculation.totals.payablePaise < 0 || q.issueInput.expectedTotalPaise !== q.calculation.totals.payablePaise ||
      [q.calculation.totals.baseAmountPaise, q.calculation.totals.cgstPaise, q.calculation.totals.sgstPaise, q.calculation.totals.lineDiscountPaise, q.calculation.totals.invoiceDiscountPaise].some(value => !Number.isSafeInteger(value) || value < 0) ||
      !Array.isArray(q.calculation.lines) || q.calculation.lines.length !== intent.lines.length || new Set(q.calculation.lines.map(line => line.lineId)).size !== intent.lines.length ||
      q.calculation.lines.some(line => !intent.lines.some(wanted => wanted.lineId === line.lineId && wanted.quantity === line.quantity) || !Number.isSafeInteger(line.grossAmountPaise) || line.grossAmountPaise < 0) ||
      q.calculation.totals.roundOffPaise !== intent.roundOffPaise || q.calculation.totals.invoiceDiscountPaise !== intent.invoiceDiscountPaise || q.calculation.lines.reduce((sum, line) => sum + BigInt(line.grossAmountPaise), BigInt(0)) + BigInt(q.calculation.totals.roundOffPaise) !== BigInt(q.calculation.totals.payablePaise) ||
      (q.issueInput.expectedInventoryMode || "tracked") !== (intent.expectedInventoryMode || "tracked") || q.issueInput.externalPrescription?.id !== intent.externalPrescription?.id || q.issueInput.externalPrescription?.revision !== intent.externalPrescription?.revision ||
      q.issueInput.customerId !== intent.customerId || q.issueInput.invoiceDiscountPaise !== intent.invoiceDiscountPaise || q.issueInput.roundOffPaise !== intent.roundOffPaise ||
      !Array.isArray(q.issueInput.lines) || q.issueInput.lines.length !== intent.lines.length || q.issueInput.lines.some(line => !intent.lines.some(wanted => wanted.lineId === line.lineId && wanted.medicineId === line.medicineId && wanted.quantity === line.quantity && wanted.discountPaise === line.discountPaise)) ||
      !Array.isArray(q.lines) || q.lines.length !== intent.lines.length || q.lines.some(line => !intent.lines.some(wanted => wanted.lineId === line.lineId && wanted.medicineId === line.medicineId && wanted.quantity === line.quantity) || !line.unitSnapshot?.baseUnit || !Array.isArray(line.batches) || !line.batches.length || line.batches.some(lot => !lot.batchNumber || !lot.expiryValue || !Number.isSafeInteger(lot.quantity) || lot.quantity <= 0 || !Number.isSafeInteger(lot.sellingPricePaise) || lot.sellingPricePaise < 0 || !Number.isSafeInteger(lot.mrpPaise) || lot.sellingPricePaise > lot.mrpPaise))) throw new Error("Counter quote could not be confirmed. Refresh the sale.");
  return q;
}
function result(value: unknown, locationId: string, key: string): CounterResult {
  const row = value as CounterResult;
  if (!locationId || !row || typeof row.invoiceId !== "string" || !row.invoiceId || typeof row.dispenseId !== "string" || !row.dispenseId || typeof row.invoiceNumber !== "string" || !row.invoiceNumber || !Number.isSafeInteger(row.totalPaise) || row.totalPaise < 0 || !["paid", "unpaid"].includes(row.status) || row.requestKey !== key) throw new Error("Sale result could not be confirmed. Keep the same reference.");
  if (row.collection !== undefined) {
    const receipt = validateCollectionReceipt(row.collection);
    if (row.status !== "paid" || receipt.status !== "paid" || receipt.invoiceId !== row.invoiceId || receipt.invoiceNumber !== row.invoiceNumber || receipt.locationId !== locationId || receipt.requestKey !== key || receipt.paidPaise !== row.totalPaise || receipt.collectedPaise !== row.totalPaise || receipt.revision !== 1 || receipt.creditedPaise !== 0) throw new Error("Saved payment does not match this bill. Keep the same reference.");
  }
  return row;
}
export async function issueCounter(input: CounterIssueInput, key: string) {
  let response;
  try { response = await api.post(input.externalPrescription ? "/pharmacy/external-prescriptions/supply" : "/pharmacy/sales", input, { headers: { "Idempotency-Key": key } }); }
  catch (failure) { recordPharmacyServerTiming((failure as { response?: { headers?: Record<string, unknown> } }).response?.headers?.["server-timing"]); throw failure; }
  recordPharmacyServerTiming(response.headers?.["server-timing"]);
  const saved = result(response.data?.data, input.locationId, key);
  if (saved.totalPaise !== input.expectedTotalPaise) throw new Error("Saved total differs from the confirmed bill. Keep the same reference.");
  if (input.payment && (!saved.collection || saved.collection.entries.length !== input.payment.entries.length || saved.collection.entries.some(entry => !input.payment!.entries.some(wanted => wanted.componentId === entry.componentId && wanted.amountPaise === entry.amountPaise && wanted.paymentMethod === entry.paymentMethod && wanted.referenceNumber === entry.referenceNumber)) || saved.collection.cashTenderedPaise !== input.payment.cashTenderedPaise)) throw new Error("Saved payment could not be confirmed. Keep the same reference.");
  return saved;
}
export async function recoverCounter(locationId: string, key: string, external = false) {
  const response = await api.get(`/pharmacy/${external ? "external-prescription-operations" : "sale-operations"}/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`); return result(response.data?.data, locationId, key);
}
