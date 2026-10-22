import api from "./api";

export interface CounterProduct { id: string; name: string; genericName: string; strength?: string; manufacturer?: string; stockQuantity: number; eligible: boolean; unitDefinition?: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number } }
export interface CounterCustomer { id: string; name: string; address: string; phone?: string; revision: number }
export interface CounterIntent { locationId: string; customerId?: string; invoiceDiscountPaise: number; roundOffPaise: number; lines: Array<{ lineId: string; medicineId: string; quantity: number; expectedUnitVersion: number; discountPaise: number }> }
export interface CounterIssueInput extends CounterIntent { expectedProfileRevision: number; expectedTotalPaise: number; expectedQuoteHash: string; expectedCustomerRevision?: number; lines: Array<CounterIntent["lines"][number] & { expectedUnitVersion: number; expectedStockRevision: number }> }
export interface CounterQuote {
  locationId: string; currency: "INR"; quoteHash: string; customer: CounterCustomer | null; issueInput: CounterIssueInput;
  calculation: { policy: string; totals: { payablePaise: number; baseAmountPaise: number; cgstPaise: number; sgstPaise: number; lineDiscountPaise: number; invoiceDiscountPaise: number; roundOffPaise: number } };
  lines: Array<{ lineId: string; medicineId: string; description: string; quantity: number; unitSnapshot: { baseUnit: string }; batches: Array<{ batchNumber: string; quantity: number; expiryValue: string; mrpPaise: number; sellingPricePaise: number }> }>;
}
export interface CounterResult { invoiceId: string; dispenseId: string; invoiceNumber: string; totalPaise: number; status: "unpaid" | "paid"; requestKey: string }
async function searchPage<T>(path: string, locationId: string, query: Record<string, string | undefined>, signal?: AbortSignal) {
  const params = new URLSearchParams({ locationId }); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, value); });
  const response = await api.get(`/pharmacy/sales/${path}?${params}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Counter search is incomplete. Retry the lookup.");
  return page as { items: T[]; nextCursor: string | null };
}
export const counterProducts = (locationId: string, query: { search?: string; barcode?: string; cursor?: string }, signal?: AbortSignal) => searchPage<CounterProduct>("products", locationId, query, signal);
export const counterCustomers = (locationId: string, search: string, cursor?: string, signal?: AbortSignal) => searchPage<CounterCustomer>("customers", locationId, { search, cursor }, signal);
export async function quoteCounter(intent: CounterIntent, signal?: AbortSignal): Promise<CounterQuote> {
  const response = await api.post("/pharmacy/sales/quote", intent, { signal }), q = response.data?.data as CounterQuote;
  if (!q || q.locationId !== intent.locationId || q.currency !== "INR" || !/^[a-f0-9]{64}$/.test(q.quoteHash) || q.issueInput?.expectedQuoteHash !== q.quoteHash || q.issueInput.locationId !== intent.locationId ||
      q.calculation?.policy !== "pharmacy-paise-v2" || !Number.isSafeInteger(q.calculation.totals.payablePaise) || q.calculation.totals.payablePaise < 0 || q.issueInput.expectedTotalPaise !== q.calculation.totals.payablePaise ||
      [q.calculation.totals.baseAmountPaise, q.calculation.totals.cgstPaise, q.calculation.totals.sgstPaise, q.calculation.totals.lineDiscountPaise, q.calculation.totals.invoiceDiscountPaise].some(value => !Number.isSafeInteger(value) || value < 0) ||
      q.issueInput.customerId !== intent.customerId || q.issueInput.invoiceDiscountPaise !== intent.invoiceDiscountPaise || q.issueInput.roundOffPaise !== intent.roundOffPaise ||
      !Array.isArray(q.issueInput.lines) || q.issueInput.lines.length !== intent.lines.length || q.issueInput.lines.some(line => !intent.lines.some(wanted => wanted.lineId === line.lineId && wanted.medicineId === line.medicineId && wanted.quantity === line.quantity && wanted.discountPaise === line.discountPaise)) ||
      !Array.isArray(q.lines) || q.lines.length !== intent.lines.length || q.lines.some(line => !intent.lines.some(wanted => wanted.lineId === line.lineId && wanted.medicineId === line.medicineId && wanted.quantity === line.quantity) || !line.unitSnapshot?.baseUnit || !Array.isArray(line.batches) || !line.batches.length || line.batches.some(lot => !lot.batchNumber || !lot.expiryValue || !Number.isSafeInteger(lot.quantity) || lot.quantity <= 0 || !Number.isSafeInteger(lot.sellingPricePaise) || lot.sellingPricePaise < 0 || !Number.isSafeInteger(lot.mrpPaise) || lot.sellingPricePaise > lot.mrpPaise))) throw new Error("Counter quote could not be confirmed. Refresh the sale.");
  return q;
}
function result(value: unknown, locationId: string, key: string): CounterResult {
  const row = value as CounterResult;
  if (!locationId || !row || typeof row.invoiceId !== "string" || !row.invoiceId || typeof row.dispenseId !== "string" || !row.dispenseId || typeof row.invoiceNumber !== "string" || !row.invoiceNumber || !Number.isSafeInteger(row.totalPaise) || row.totalPaise < 0 || !["paid", "unpaid"].includes(row.status) || row.requestKey !== key) throw new Error("Sale result could not be confirmed. Keep the same reference.");
  return row;
}
export async function issueCounter(input: CounterIssueInput, key: string) {
  const response = await api.post("/pharmacy/sales", input, { headers: { "Idempotency-Key": key } }); return result(response.data?.data, input.locationId, key);
}
export async function recoverCounter(locationId: string, key: string) {
  const response = await api.get(`/pharmacy/sale-operations/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`); return result(response.data?.data, locationId, key);
}
