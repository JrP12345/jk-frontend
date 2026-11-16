import { createPharmacyLocalClient } from "./pharmacyDrafts";
import type { CounterIssueInput } from "./pharmacyCounter";
import type { CollectionInput } from "./pharmacyCollections";
type Sale = { key: string; input: CounterIssueInput };
type Collection = { key: string; invoiceId: string; input: CollectionInput };
const validKey = (key: unknown) => typeof key === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(key);
const whole = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
export function createSaleJournal(scope: string, locationId: string, namespace = "sale-intent") {
  return createPharmacyLocalClient<Sale | null>(scope, locationId, namespace, raw => {
    if (raw === null) return null;
    const v = raw as Sale, p = v?.input;
    const currentTotal = p?.confirmationMode === "current_total";
    if (p?.expectedInventoryMode !== undefined && !["tracked", "billing_only"].includes(p.expectedInventoryMode)) throw Error("Saved inventory mode needs review");
    if (!validKey(v?.key) || p?.locationId !== locationId || (currentTotal ? p.expectedProfileRevision !== undefined || p.expectedQuoteHash !== undefined : p.confirmationMode !== undefined || !/^[a-f\d]{64}$/.test(p.expectedQuoteHash || "") || !whole(p.expectedProfileRevision)) || p.includeDocument !== undefined && p.includeDocument !== true || !Array.isArray(p.lines) || !p.lines.length || p.lines.length > 100 || ![p.expectedTotalPaise, p.invoiceDiscountPaise].every(whole) || !Number.isSafeInteger(p.roundOffPaise) || Math.abs(p.roundOffPaise) > 99 || p.customerId !== undefined && typeof p.customerId !== "string" || p.expectedCustomerRevision !== undefined && !whole(p.expectedCustomerRevision) || p.customerId !== undefined && !whole(p.expectedCustomerRevision)) throw Error("Saved sale intent needs review");
    // Preserve the exact confirmed amounts for same-key retry; local prices never authorize a server write.
    const lines = p.lines.map(line => { if (!line || typeof line.lineId !== "string" || typeof line.medicineId !== "string" || ![line.quantity, line.expectedUnitVersion, line.discountPaise].every(whole) || (currentTotal ? !whole(line.expectedLineTotalPaise) || line.expectedStockRevision !== undefined : !whole(line.expectedStockRevision) || line.expectedLineTotalPaise !== undefined) || line.quantity < 1 || line.expectedUnitVersion < 1) throw Error("Saved sale quantities need review"); return { lineId: line.lineId, medicineId: line.medicineId, quantity: line.quantity, expectedUnitVersion: line.expectedUnitVersion, ...(currentTotal ? { expectedLineTotalPaise: line.expectedLineTotalPaise } : { expectedStockRevision: line.expectedStockRevision }), discountPaise: line.discountPaise }; });
    const payment = p.payment === undefined ? undefined : cleanCollectionInput(p.payment, locationId);
    const externalPrescription = p.externalPrescription;
    if (externalPrescription && (!/^[a-f\d]{24}$/i.test(externalPrescription.id) || !whole(externalPrescription.revision))) throw Error("Saved prescription source needs review");
    if (payment && (payment.expectedPaymentRevision !== 0 || payment.expectedBalancePaise !== p.expectedTotalPaise || payment.entries.reduce((sum, entry) => sum + entry.amountPaise, 0) !== p.expectedTotalPaise)) throw Error("Saved payment differs from the confirmed bill");
    return { key: v.key, input: { locationId, ...(p.expectedInventoryMode ? { expectedInventoryMode: p.expectedInventoryMode } : {}), ...(externalPrescription ? { externalPrescription: { id: externalPrescription.id, revision: externalPrescription.revision } } : {}), ...(currentTotal ? { confirmationMode: "current_total" as const } : { expectedProfileRevision: p.expectedProfileRevision, expectedQuoteHash: p.expectedQuoteHash }), expectedTotalPaise: p.expectedTotalPaise, ...(p.includeDocument ? { includeDocument: true as const } : {}), ...(p.customerId ? { customerId: p.customerId } : {}), ...(p.expectedCustomerRevision !== undefined ? { expectedCustomerRevision: p.expectedCustomerRevision } : {}), invoiceDiscountPaise: p.invoiceDiscountPaise, roundOffPaise: p.roundOffPaise, lines, ...(payment ? { payment } : {}) } };
  });
}
export function createCollectionJournal(scope: string, locationId: string) {
  return createPharmacyLocalClient<Collection | null>(scope, locationId, "collection-intent", raw => {
    if (raw === null) return null;
    const v = raw as Collection;
    if (!validKey(v?.key) || typeof v.invoiceId !== "string") throw Error("Saved collection intent needs review");
    return { key: v.key, invoiceId: v.invoiceId, input: cleanCollectionInput(v.input, locationId) };
  });
}

function cleanCollectionInput(p: CollectionInput | undefined, locationId: string): CollectionInput {
    if (p?.locationId !== locationId || p.manualConfirmed !== true || !Array.isArray(p.entries) || !p.entries.length || p.entries.length > 10 || ![p.expectedPaymentRevision, p.expectedBalancePaise, p.cashTenderedPaise].every(whole)) throw Error("Saved collection intent needs review");
    const entries = p.entries.map(entry => { if (!entry || typeof entry.componentId !== "string" || !whole(entry.amountPaise) || entry.amountPaise < 1 || !["cash", "upi", "card"].includes(entry.paymentMethod) || entry.referenceNumber !== undefined && (typeof entry.referenceNumber !== "string" || entry.referenceNumber.length > 200)) throw Error("Saved collection amounts need review"); return { componentId: entry.componentId, amountPaise: entry.amountPaise, paymentMethod: entry.paymentMethod, ...(entry.referenceNumber ? { referenceNumber: entry.referenceNumber } : {}) }; });
    return { locationId, expectedPaymentRevision: p.expectedPaymentRevision, expectedBalancePaise: p.expectedBalancePaise, cashTenderedPaise: p.cashTenderedPaise, manualConfirmed: true, entries };
}
