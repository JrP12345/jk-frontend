export interface PharmacyTaxDocument {
  version: 1 | 2;
  kind: "tax_invoice" | "bill_of_supply" | "invoice_cum_bill_of_supply" | "ordinary_bill";
  issuer: { legalName: string; address: string; stateCode: string; gstin?: string; registration: string; drugLicenceNumbers: string[]; authorisedSignatory: string };
  recipient: { name: string; address?: string; stateCode: string; deliveryAddress?: string };
  placeOfSupply: string; reverseCharge: boolean; notice?: string;
  issuedAt: string; signatureMode: "manual_on_print";
}
export interface IssuedPharmacyInvoice {
  kind?: "clinical" | "pharmacy"; createdBy?: string; customerSnapshot?: { anonymous: boolean; partyId?: string; name?: string };
  calculation?: { policy: string; priceMode: string; taxMode: string; currency: string;
    totals: { lineDiscountPaise: number; invoiceDiscountPaise: number; roundOffPaise: number; grossAmountPaise: number; payablePaise: number } };
  invoiceNumber: string; issuedAt: string; financialYear: string; documentVersion: number;
  currency?: string; status: string; subtotal: number; tax: number; totalAmount: number; cgstTotal: number; sgstTotal: number;
  taxDocument: PharmacyTaxDocument;
  items: Array<{ description: string; amount: number; quantity: number; hsnSacCode: string; unitCode: string; gstRate: number;
    baseAmountPaise: number; cgstPaise: number; sgstPaise: number; grossAmountPaise: number;
    unitSnapshot?: { baseUnit: string; packUnit: string; unitsPerPack: number };
    batches?: Array<{ batchNumber: string; quantity: number; expiryValue: string; expiryPrecision: string; mrpPaise: number; sellingPricePaise: number }> }>;
}
export const pharmacyDocumentTitle = (kind: PharmacyTaxDocument["kind"]) => ({
  tax_invoice: "Tax Invoice", bill_of_supply: "Bill of Supply", invoice_cum_bill_of_supply: "Invoice-cum-Bill of Supply", ordinary_bill: "Pharmacy Bill",
})[kind];

export function canPrintPharmacyInvoice(value: unknown): value is IssuedPharmacyInvoice {
  const invoice = value as IssuedPharmacyInvoice | null;
  const document = invoice?.taxDocument;
  if (!invoice || ![1, 2].includes(invoice.documentVersion) || invoice.currency !== "INR" || !document || document.version !== invoice.documentVersion ||
      !["tax_invoice", "bill_of_supply", "invoice_cum_bill_of_supply", "ordinary_bill"].includes(document.kind) ||
      !document.issuer?.legalName || !document.issuer.address || !document.issuer.authorisedSignatory ||
      !document.issuer.drugLicenceNumbers?.length || !document.recipient?.name ||
      !/^I[A-Z0-9]{4}[0-9]{4}\/[0-9]{6}$/.test(invoice.invoiceNumber) || !Number.isFinite(new Date(invoice.issuedAt).getTime()) || !invoice.items?.length) return false;
  if (document.kind === "ordinary_bill" ? document.issuer.registration !== "unregistered" || Boolean(document.issuer.gstin)
    : !["regular", "composition"].includes(document.issuer.registration) || !document.issuer.gstin) return false;
  const fields = ["baseAmountPaise", "cgstPaise", "sgstPaise", "grossAmountPaise"] as const;
  if (invoice.items.some(item => fields.some(field => !Number.isSafeInteger(item[field]) || item[field] < 0) ||
      item.baseAmountPaise + item.cgstPaise + item.sgstPaise !== item.grossAmountPaise ||
      !item.description || !/^\d{4}(\d{2})?(\d{2})?$/.test(item.hsnSacCode) || !/^[A-Z]{3}$/.test(item.unitCode))) return false;
  const sums = fields.map(field => invoice.items.reduce((sum, item) => sum + item[field], 0));
  if (sums.some(value => !Number.isSafeInteger(value))) return false;
  let roundOff = 0;
  if (invoice.documentVersion === 2) {
    const calc = invoice.calculation;
    if (invoice.kind !== "pharmacy" || !invoice.createdBy || !invoice.customerSnapshot || !calc || calc.policy !== "pharmacy-paise-v2" || calc.currency !== "INR" || calc.priceMode !== "inclusive" || !["sgst", "none"].includes(calc.taxMode) ||
        !invoice.customerSnapshot.anonymous && (!invoice.customerSnapshot.partyId || !invoice.customerSnapshot.name) ||
        !calc.totals || [calc.totals.lineDiscountPaise, calc.totals.invoiceDiscountPaise, calc.totals.grossAmountPaise, calc.totals.payablePaise].some(value => !Number.isSafeInteger(value) || value < 0) ||
        !Number.isSafeInteger(calc.totals.roundOffPaise) || Math.abs(calc.totals.roundOffPaise) > 99 ||
        calc.totals.grossAmountPaise !== sums[3] || calc.totals.payablePaise !== calc.totals.grossAmountPaise + calc.totals.roundOffPaise ||
        invoice.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !item.unitSnapshot?.baseUnit || !item.batches?.length || item.batches.some(lot => !lot.batchNumber || !/^\d{4}-\d{2}(-\d{2})?$/.test(lot.expiryValue) ||
          !Number.isSafeInteger(lot.quantity) || lot.quantity <= 0 || !Number.isSafeInteger(lot.sellingPricePaise) || lot.sellingPricePaise < 0 || !Number.isSafeInteger(lot.mrpPaise) || lot.sellingPricePaise > lot.mrpPaise) || item.batches.reduce((sum, lot) => sum + lot.quantity, 0) !== item.quantity)) return false;
    roundOff = calc.totals.roundOffPaise;
  }
  const total = (key: typeof fields[number]) => sums[fields.indexOf(key)] / 100;
  return (sums[3] + roundOff) / 100 === invoice.totalAmount && total("baseAmountPaise") === invoice.subtotal &&
    total("cgstPaise") === invoice.cgstTotal && total("sgstPaise") === invoice.sgstTotal &&
    Math.round((invoice.cgstTotal + invoice.sgstTotal) * 100) / 100 === invoice.tax;
}
