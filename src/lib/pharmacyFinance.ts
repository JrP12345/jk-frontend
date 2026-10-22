import api from "./api";
export type FinanceKind = "supplier_return" | "supplier_credit" | "supplier_payment" | "supplier_refund" | "customer_refund" | "opening_balance";
export interface FinanceReference { key: string; kind: FinanceKind; sourceId: string }
export interface FinanceOutcome { kind: FinanceKind; sourceId: string; requestKey: string; id: string; label: string; amountPaise: number; invoiceId?: string; data: Record<string, unknown> }
export interface FinanceParty { id: string; name: string; address: string; revision: number; archived: boolean }
export interface SupplierObligation { purchaseId?: string; openingBalanceId?: string; supplierInvoiceNumber?: string; statementNumber?: string; payablePaise: number; confirmedCreditPaise: number; pendingCreditPaise: number; paidPaise: number; duePaise: number; supplierRefundReceivablePaise: number; settlementRevision: number }
export interface SupplierStatement { supplierId: string; supplierName: string; locationId: string; currency: "INR"; purchases: SupplierObligation[]; openingBalances: SupplierObligation[]; returns: Array<{ id: string; purchaseId: string; expectedCreditPaise: number; confirmedCreditPaise: number }>; totals: Record<string, number> }
export interface CustomerStatement { customerId: string; customerName: string; locationId: string; currency: "INR"; invoices: Array<{ invoiceId: string; invoiceNumber: string; documentVersion: number; totalPaise: number; paidPaise: number; creditedPaise: number; balancePaise: number; refundPayablePaise: number; refundedPaise: number; paymentRevision: number }>; totals: Record<string, number> }
export interface RefundSource { invoiceId: string; invoiceNumber: string; locationId: string; customerName: string; currency: "INR"; paymentRevision: number; totalPaise: number; paidPaise: number; creditedPaise: number; refundedPaise: number; refundPayablePaise: number }
export interface SupplierReturnSource { purchaseId: string; locationId: string; supplierId: string; supplierName: string; supplierInvoiceNumber: string; purchaseRevision: number; settlementRevision: number; currency: "INR"; lines: Array<{ receiptId: string; receiptLineId: string; batchId: string; description: string; batchNumber: string; receivedQuantity: number; returnedQuantity: number; onHandQuantity: number; remainingQuantity: number; unitSnapshot: { baseUnit: string }; expiryValue: string }> }
export interface SupplierReturnIntent { locationId: string; reason: string; reviewReference: string; lines: Array<{ receiptId: string; receiptLineId: string; quantity: number }> }
export interface SupplierReturnQuote { purchaseId: string; locationId: string; currency: "INR"; expectedCreditPaise: number; issueInput: SupplierReturnIntent & { expectedPurchaseRevision: number; expectedSettlementRevision: number; expectedCreditPaise: number; lines: Array<SupplierReturnIntent["lines"][number] & { expectedStockRevision: number }> } }
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const financeKinds: FinanceKind[] = ["supplier_return", "supplier_credit", "supplier_payment", "supplier_refund", "customer_refund", "opening_balance"];
export async function financeParties(locationId: string, kind: "supplier" | "customer", search: string, includeArchived: boolean, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ locationId, kind, search, includeArchived: String(includeArchived) }); if (cursor) query.set("cursor", cursor);
  const response = await api.get(`/pharmacy/settlement-parties?${query}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string" || page.items.some((party: FinanceParty) => !party.id || !party.name || !safe(party.revision))) throw new Error("Party lookup is incomplete");
  return page as { items: FinanceParty[]; nextCursor: string | null };
}
export async function financeOpeningParty(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/parties/${encodeURIComponent(id)}?locationId=${encodeURIComponent(locationId)}`, { signal }), party = response.data?.data as FinanceParty & { locationIds: string[]; kinds: string[] };
  if (!party || party.id !== id || !Array.isArray(party.locationIds) || !party.locationIds.includes(locationId) || !Array.isArray(party.kinds) || !party.name || !safe(party.revision)) throw new Error("Original opening party could not be loaded"); return party;
}
export async function supplierStatement(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/suppliers/${encodeURIComponent(id)}/statement?locationId=${encodeURIComponent(locationId)}`, { signal }), doc = response.data?.data as SupplierStatement;
  if (!doc || doc.supplierId !== id || doc.locationId !== locationId || doc.currency !== "INR" || !Array.isArray(doc.purchases) || !Array.isArray(doc.openingBalances) || !Array.isArray(doc.returns) || doc.purchases.length > 1000 || doc.openingBalances.length > 1000 || doc.returns.length > 10000 ||
      [...doc.purchases, ...doc.openingBalances].some(row => !safe(row.settlementRevision) || !safe(row.duePaise) || !safe(row.supplierRefundReceivablePaise)) || !doc.totals || Object.values(doc.totals).some(value => !safe(value))) throw new Error("Supplier statement is incomplete"); return doc;
}
export async function customerStatement(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/customers/${encodeURIComponent(id)}/statement?locationId=${encodeURIComponent(locationId)}`, { signal }), doc = response.data?.data as CustomerStatement;
  if (!doc || doc.customerId !== id || doc.locationId !== locationId || doc.currency !== "INR" || !Array.isArray(doc.invoices) || doc.invoices.length > 1000 || doc.invoices.some(row => !row.invoiceId || !safe(row.balancePaise) || !safe(row.refundPayablePaise) || !safe(row.paymentRevision)) || !doc.totals || Object.values(doc.totals).some(value => !safe(value))) throw new Error("Customer statement is incomplete"); return doc;
}
export async function refundSource(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/invoices/${encodeURIComponent(id)}/refund-source?locationId=${encodeURIComponent(locationId)}`, { signal }), doc = response.data?.data as RefundSource;
  if (!doc || doc.invoiceId !== id || doc.locationId !== locationId || doc.currency !== "INR" || [doc.paymentRevision, doc.totalPaise, doc.paidPaise, doc.creditedPaise, doc.refundedPaise, doc.refundPayablePaise].some(value => !safe(value))) throw new Error("Refund source is incomplete"); return doc;
}
export async function refundInvoicePage(locationId: string, invoiceNumber: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ locationId, invoiceNumber }); if (cursor) query.set("cursor", cursor);
  const response = await api.get(`/pharmacy/refund-invoices?${query}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Refund invoice lookup is incomplete"); return page as { items: Array<{ id: string; invoiceNumber: string }>; nextCursor: string | null };
}
export async function supplierReturnSource(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/purchases/${encodeURIComponent(id)}/return-source?locationId=${encodeURIComponent(locationId)}`, { signal }), doc = response.data?.data as SupplierReturnSource;
  if (!doc || doc.purchaseId !== id || doc.locationId !== locationId || doc.currency !== "INR" || !Array.isArray(doc.lines) || doc.lines.length > 1000 || doc.lines.some(row => !row.receiptId || !row.receiptLineId || !row.unitSnapshot?.baseUnit || !safe(row.remainingQuantity) || !safe(row.onHandQuantity))) throw new Error("Supplier return source is incomplete"); return doc;
}
export async function supplierReturnQuote(id: string, input: SupplierReturnIntent, signal?: AbortSignal) {
  const response = await api.post(`/pharmacy/purchases/${encodeURIComponent(id)}/returns/quote`, input, { signal }), quote = response.data?.data as SupplierReturnQuote;
  if (!quote || quote.purchaseId !== id || quote.locationId !== input.locationId || quote.currency !== "INR" || !safe(quote.expectedCreditPaise) || quote.issueInput?.expectedCreditPaise !== quote.expectedCreditPaise || quote.issueInput.locationId !== input.locationId || quote.issueInput.reason !== input.reason || quote.issueInput.reviewReference !== input.reviewReference || !Array.isArray(quote.issueInput.lines) || quote.issueInput.lines.length !== input.lines.length || quote.issueInput.lines.some(line => !input.lines.some(row => row.receiptId === line.receiptId && row.receiptLineId === line.receiptLineId && row.quantity === line.quantity))) throw new Error("Supplier return review is incomplete"); return quote;
}
function outcome(value: unknown, reference: FinanceReference, locationId: string): FinanceOutcome {
  const data = value as Record<string, unknown>;
  if (!data || !locationId || data.locationId !== locationId || data.requestKey !== reference.key) throw new Error("Financial result could not be confirmed. Keep the same reference.");
  let id: unknown, label: unknown, amount: unknown;
  if (reference.kind === "opening_balance") { id = data.openingBalanceId; label = data.statementNumber; amount = data.amountPaise; if (data.partyId !== reference.sourceId || !["supplier_due", "customer_due"].includes(String(data.kind))) throw new Error("Opening source result does not match its reference"); }
  else if (reference.kind === "supplier_return") { id = data.returnId; label = "Supplier return"; amount = data.expectedCreditPaise; if (data.purchaseId !== reference.sourceId || data.supplierCreditConfirmed !== false) throw new Error("Supplier return result does not match its reference"); }
  else {
    id = data.eventId; label = data.referenceNumber; amount = data.amountPaise;
    const allocations = data.allocations as Array<{ amountPaise: number; invoiceId?: string }>;
    if (data.kind !== reference.kind || (reference.kind === "customer_refund" ? data.invoiceId !== reference.sourceId : data.partyId !== reference.sourceId) || data.currency !== "INR" || !safe(amount) || amount <= 0 ||
        !Array.isArray(allocations) || !allocations.length || allocations.length > 100 || allocations.some(row => !safe(row.amountPaise) || row.amountPaise <= 0) || allocations.reduce((sum, row) => sum + BigInt(row.amountPaise), BigInt(0)) !== BigInt(amount) ||
        reference.kind === "customer_refund" && (allocations.length !== 1 || allocations[0].invoiceId !== reference.sourceId) ||
        (reference.kind === "supplier_credit" ? data.paymentMethod !== "none" : !["cash", "upi", "card", "bank"].includes(String(data.paymentMethod))) || typeof data.recordedAt !== "string" || !Number.isFinite(new Date(data.recordedAt).getTime())) throw new Error("Settlement result does not match its reference");
  }
  if (typeof id !== "string" || !id || typeof label !== "string" || !label || !safe(amount)) throw new Error("Financial result is incomplete. Keep the same reference.");
  return { kind: reference.kind, sourceId: reference.sourceId, requestKey: reference.key, id, label, amountPaise: amount, invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : undefined, data };
}
export async function submitFinance(reference: FinanceReference, input: object) {
  const path = reference.kind === "opening_balance" ? "/pharmacy/opening-balances" : reference.kind === "supplier_return" ? `/pharmacy/purchases/${encodeURIComponent(reference.sourceId)}/returns` : `/pharmacy/settlements/${reference.kind.replaceAll("_", "-")}`;
  const locationId = (input as { locationId?: unknown }).locationId; if (typeof locationId !== "string" || !locationId) throw new Error("Financial branch reference is missing");
  const response = await api.post(path, input, { headers: { "Idempotency-Key": reference.key } }); return outcome(response.data?.data, reference, locationId);
}
export async function recoverFinance(reference: FinanceReference, locationId: string) {
  const kind = reference.kind === "opening_balance" ? "opening-balance-operations" : reference.kind === "supplier_return" ? "purchase-return-operations" : "cash-operations";
  const response = await api.get(`/pharmacy/${kind}/${encodeURIComponent(reference.key)}?locationId=${encodeURIComponent(locationId)}`); return outcome(response.data?.data, reference, locationId);
}
