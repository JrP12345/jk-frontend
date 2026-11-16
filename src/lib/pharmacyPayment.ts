import { parseReceiptPaise } from "./pharmacyStockReceipts";
import type { CollectionInput, CollectionMethod, CounterInvoice } from "./pharmacyCollections";

export type PaymentPart = { componentId: string; amount: string; paymentMethod: CollectionMethod; referenceNumber: string };
/** Actual payment confirmed once in the counter. Never persisted as a reusable payment authorization. */
export type CounterCheckoutPayment = { method: CollectionMethod; tender: string; referenceNumber: string; expectedTotalPaise: number };
/** A conditional write against a newly issued bill; the server still checks the actual balance/revision. */
export function prepareIssuedCheckoutPayment(locationId: string, totalPaise: number, payment: CounterCheckoutPayment) {
  if (!locationId || !Number.isSafeInteger(totalPaise) || totalPaise <= 0 || payment.expectedTotalPaise !== totalPaise) return null;
  return prepareCounterCollection({ locationId, paymentRevision: 0, balanceDue: totalPaise / 100, customerSnapshot: { anonymous: true } },
    [{ componentId: crypto.randomUUID(), amount: String(totalPaise / 100), paymentMethod: payment.method, referenceNumber: payment.referenceNumber }], payment.tender, true).input;
}
export function prepareCheckoutPayment(invoice: CounterInvoice, payment: CounterCheckoutPayment) {
  if (invoice.amountPaid !== 0 || parseReceiptPaise(String(invoice.balanceDue)) !== payment.expectedTotalPaise ||
      parseReceiptPaise(String(invoice.totalAmount)) !== payment.expectedTotalPaise) return null;
  return prepareCounterCollection(invoice, [{ componentId: crypto.randomUUID(), amount: String(invoice.balanceDue), paymentMethod: payment.method, referenceNumber: payment.referenceNumber }], payment.tender, true).input;
}
export function prepareCounterCollection(invoice: Pick<CounterInvoice, "locationId" | "paymentRevision" | "balanceDue" | "customerSnapshot">, parts: PaymentPart[], tender: string, full: boolean) {
  const balance = parseReceiptPaise(String(invoice.balanceDue));
  const entries = parts.map(part => ({ componentId: part.componentId, amountPaise: parseReceiptPaise(part.amount), paymentMethod: part.paymentMethod, ...(part.referenceNumber.trim() ? { referenceNumber: part.referenceNumber.trim() } : {}) }));
  const total = entries.reduce((sum, part) => sum + (part.amountPaise ?? 0), 0);
  const cash = entries.filter(part => part.paymentMethod === "cash").reduce((sum, part) => sum + (part.amountPaise ?? 0), 0);
  const handed = parseReceiptPaise(cash > 0 ? tender : "0");
  let problem = "";
  if (balance === null || !entries.length || entries.length > 10 || new Set(entries.map(part => part.componentId)).size !== entries.length || entries.some(part => !part.componentId || !["cash", "upi", "card"].includes(part.paymentMethod) || part.amountPaise === null || part.amountPaise <= 0) || !Number.isSafeInteger(total)) problem = "Enter a positive amount for each payment method.";
  else if (entries.some(part => part.paymentMethod !== "cash" && (!part.referenceNumber || part.referenceNumber.length < 3))) problem = "Enter the verified transaction reference for every UPI or card payment.";
  else if (total > balance) problem = "Payment amounts exceed the balance. Enter extra cash in Cash received to calculate change.";
  else if ((full || invoice.customerSnapshot?.anonymous) && total !== balance) problem = "Allocate the full balance across the selected payment methods.";
  else if (handed === null || handed < cash) problem = "Cash received must cover the cash payment amount.";
  const input: CollectionInput | null = problem || balance === null || handed === null ? null : { locationId: invoice.locationId, expectedPaymentRevision: invoice.paymentRevision, expectedBalancePaise: balance, manualConfirmed: true, cashTenderedPaise: handed, entries: entries as CollectionInput["entries"] };
  return { input, problem, total, cash, change: handed !== null && handed >= cash ? handed - cash : null, remaining: balance === null ? null : balance - total };
}
