import { formatCurrency } from "@/lib/currency";
import { pharmacyDocumentTitle, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";

/** The issued snapshot owns the paper document; live clinic branding never replaces its issuer. */
export function PharmacyInvoiceDocument({ invoice }: { invoice: IssuedPharmacyInvoice }) {
  const document = invoice.taxDocument;
  const money = (paise: number) => formatCurrency(paise / 100, invoice.currency || "INR");
  return <article className="space-y-4" aria-label="Issued pharmacy document">
    <header className="border-b border-border pb-3">
      <h2 className="text-lg font-bold">{pharmacyDocumentTitle(document.kind)}</h2>
      <p className="font-semibold">{document.issuer.legalName}</p>
      <p>{document.issuer.address}</p>
      <p>State code: {document.issuer.stateCode}{document.issuer.gstin ? ` · GSTIN: ${document.issuer.gstin}` : ""}</p>
      <p>Drug licences: {document.issuer.drugLicenceNumbers.join(", ")}</p>
      <p>Document: {invoice.invoiceNumber} · FY {invoice.financialYear}</p>
      <p>Issued: {new Date(invoice.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)</p>
    </header>
    <div>
      <p>Recipient: {document.recipient.name}</p>
      {document.recipient.address && <p>{document.recipient.address}</p>}
      {document.recipient.stateCode && <p>Recipient state code: {document.recipient.stateCode}</p>}
      {document.recipient.deliveryAddress && <p>Delivery at counter: {document.recipient.deliveryAddress}</p>}
      <p>Place of supply: {document.placeOfSupply} · Counter pickup</p>
      <p>Reverse charge: {document.reverseCharge ? "Yes" : "No"} · Payment status: {invoice.status.replaceAll("_", " ")}</p>
    </div>
    {document.notice && <p className="font-semibold">{document.notice}</p>}
    <table className="table-doc">
      <thead><tr><th>Description / HSN</th><th>Quantity / Unit</th><th>GST rate</th><th>Value before GST</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
      <tbody>{invoice.items.map((item, index) => <tr key={index}>
        <td data-label="Product">{item.description}<br />HSN: {item.hsnSacCode}{item.batches?.map((lot, number) => <p key={number}>Batch {lot.batchNumber} · {lot.quantity} units · Printed expiry {lot.expiryValue} · MRP per unit {money(lot.mrpPaise)}</p>)}</td><td data-label="Quantity">{item.quantity} {item.unitSnapshot?.baseUnit || item.unitCode}</td><td data-label="GST rate">{item.gstRate}%</td>
        <td data-label="Value before GST">{money(item.baseAmountPaise)}</td><td data-label="CGST">{money(item.cgstPaise)} ({item.gstRate / 2}%)</td><td data-label="SGST">{money(item.sgstPaise)} ({item.gstRate / 2}%)</td><td data-label="Total">{money(item.grossAmountPaise)}</td>
      </tr>)}</tbody>
    </table>
    <div className="text-right"><p>Value before GST: {formatCurrency(invoice.subtotal, invoice.currency)}</p>
      <p>CGST: {formatCurrency(invoice.cgstTotal, invoice.currency)} · SGST: {formatCurrency(invoice.sgstTotal, invoice.currency)}</p>
      {invoice.calculation && <><p>Discounts included above: {money(invoice.calculation.totals.lineDiscountPaise + invoice.calculation.totals.invoiceDiscountPaise)}</p><p>Round-off: {money(invoice.calculation.totals.roundOffPaise)}</p></>}
      <p className="font-bold">Total: {formatCurrency(invoice.totalAmount, invoice.currency)}</p><p>Prices include applicable tax.</p>
    </div>
    <footer className="pt-6"><p>For {document.issuer.legalName}</p><p>Authorised signatory: {document.issuer.authorisedSignatory}</p>
      <p className="mt-8 border-t border-border pt-1">Authorised signature (sign the printed document)</p>
    </footer>
  </article>;
}
