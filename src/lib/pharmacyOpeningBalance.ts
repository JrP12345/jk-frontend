import type { CounterInvoice } from "./pharmacyCollections";
export interface OpeningBalanceInvoice extends CounterInvoice {
  documentVersion: 3; openingBalanceId: string; openingBalanceSnapshot: NonNullable<CounterInvoice["openingBalanceSnapshot"]>;
}
export function isOpeningBalanceInvoice(value: unknown): value is OpeningBalanceInvoice {
  const invoice = value as OpeningBalanceInvoice | null, opening = invoice?.openingBalanceSnapshot;
  const paid = Math.round((invoice?.amountPaid ?? NaN) * 100), balance = Math.round((invoice?.balanceDue ?? NaN) * 100);
  return Boolean(invoice && invoice.kind === "pharmacy" && invoice.documentVersion === 3 && invoice.id && invoice.locationId && invoice.openingBalanceId && opening &&
    invoice.currency === "INR" && /^O[A-Z0-9]{4}[0-9]{4}\/[0-9]{6}$/.test(invoice.invoiceNumber) && Number.isFinite(new Date(invoice.issuedAt).getTime()) &&
    Number.isSafeInteger(opening.amountPaise) && opening.amountPaise > 0 && invoice.totalAmount === opening.amountPaise / 100 &&
    Number.isSafeInteger(paid) && paid >= 0 && Number.isSafeInteger(balance) && balance >= 0 && paid + balance === opening.amountPaise &&
    Math.abs(invoice.amountPaid * 100 - paid) < 0.000001 && Math.abs(invoice.balanceDue * 100 - balance) < 0.000001 && (invoice.creditedPaise ?? 0) === 0 && (invoice.refundedPaise ?? 0) === 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(opening.sourceDate) && opening.sourceReference && opening.reviewReference && opening.issuer?.legalName && opening.issuer.address && Array.isArray(opening.issuer.drugLicenceNumbers) &&
    invoice.customerSnapshot?.anonymous === false && invoice.customerSnapshot.partyId && invoice.customerSnapshot.name && !invoice.taxDocument && !invoice.calculation && Array.isArray(invoice.items) && !invoice.items.length && invoice.tax === 0);
}
