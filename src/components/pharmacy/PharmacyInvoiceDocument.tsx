import { Fragment } from "react";
import { formatCurrency } from "@/lib/currency";
import { pharmacyDocumentTitle, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import styles from "./PharmacyPrint.module.css";

/** Print only saved issuer, recipient, lots and calculation; never substitute current catalogue data. */
export function PharmacyInvoiceDocument({ invoice }: { invoice: IssuedPharmacyInvoice }) {
  const document = invoice.taxDocument, issuer = document.issuer;
  const currency = invoice.currency || "INR", amount = (value: number) => formatCurrency(value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (paise: number) => amount(paise / 100);
  const issued = new Date(invoice.issuedAt);
  const hasPayment = [invoice.amountPaid, invoice.balanceDue].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return <article className={styles.document} aria-label="Issued pharmacy document">
    <header className={styles.documentHeader}>
      <div className={styles.issuer}><p className={styles.eyebrow}>PHARMACY</p><h1>{issuer.legalName}</h1><p>{issuer.address}</p>
        <p className={styles.registration}>Drug licences: {issuer.drugLicenceNumbers.join(" / ")}</p>
        <p className={styles.registration}>{issuer.gstin ? `GSTIN: ${issuer.gstin}` : "GST registration: Unregistered"} · State code: {issuer.stateCode}</p>
      </div>
      <div className={styles.documentMeta}><h2>{pharmacyDocumentTitle(document.kind)}</h2><strong>{invoice.invoiceNumber}</strong>
        <dl><div><dt>Date</dt><dd>{issued.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}</dd></div>
          <div><dt>Time</dt><dd>{issued.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST</dd></div>
          <div><dt>Financial year</dt><dd>{invoice.financialYear}</dd></div></dl>
      </div>
    </header>
    <section className={styles.recipientGrid} aria-label="Recipient and supply details">
      <div><h3>Bill to</h3><strong>{document.recipient.name}</strong>{document.recipient.address && <p>{document.recipient.address}</p>}
        {document.recipient.stateCode && <p>Recipient state code: {document.recipient.stateCode}</p>}{document.recipient.deliveryAddress && <p>Delivery at counter: {document.recipient.deliveryAddress}</p>}</div>
      <dl><div><dt>Place of supply</dt><dd>{document.placeOfSupply}</dd></div><div><dt>Supply</dt><dd>Counter pickup</dd></div>
        <div><dt>Reverse charge</dt><dd>{document.reverseCharge ? "Yes" : "No"}</dd></div><div><dt>Payment status</dt><dd className={styles.paymentStatus}>{invoice.status.replaceAll("_", " ")}</dd></div></dl>
    </section>
    {document.notice && <p className={styles.documentNotice}>{document.notice}</p>}
    <table className={styles.items} aria-label="Billed medicines and tax">
      <colgroup><col style={{ width: "4%" }} /><col style={{ width: "26%" }} /><col style={{ width: "8%" }} /><col style={{ width: "10%" }} /><col style={{ width: "13%" }} /><col style={{ width: "6%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "13%" }} /></colgroup>
      <thead><tr><th scope="col">#</th><th scope="col">Item / HSN</th><th scope="col">Qty</th><th scope="col">Rate*</th><th scope="col">Value</th><th scope="col">GST</th><th scope="col">CGST</th><th scope="col">SGST</th><th scope="col">Amount</th></tr></thead>
      <tbody>{invoice.items.map((item, index) => {
        const rates = [...new Set(item.batches?.map(lot => lot.sellingPricePaise) || [])];
        return <Fragment key={index}><tr className={styles.itemRow}>
          <td className={styles.ordinal} data-label="Item">{index + 1}</td><td data-label="Product"><strong>{item.description}</strong><small>HSN: {item.hsnSacCode}</small></td>
          <td data-label="Quantity">{item.quantity}<small>{item.unitSnapshot?.baseUnit || item.unitCode}</small></td>
          <td data-label="Rate (tax inclusive)">{rates.length === 1 ? money(rates[0]) : rates.length > 1 ? "See batches" : item.quantity > 0 ? money(item.grossAmountPaise / item.quantity) : "—"}</td>
          <td data-label="Value before GST">{money(item.baseAmountPaise)}</td><td data-label="GST rate">{item.gstRate}%</td>
          <td data-label="CGST">{money(item.cgstPaise)}<small>{item.gstRate / 2}%</small></td><td data-label="SGST">{money(item.sgstPaise)}<small>{item.gstRate / 2}%</small></td><td data-label="Amount"><strong>{money(item.grossAmountPaise)}</strong></td>
        </tr>{item.batches?.map((lot, lotIndex) => <tr key={lotIndex} className={styles.batchRow}><td /><td colSpan={8} data-label="Batch details"><div>
          <span>Batch <strong>{lot.batchNumber}</strong></span><span>Expiry {lot.expiryValue}</span><span>{lot.quantity} {item.unitSnapshot?.baseUnit || item.unitCode}</span><span>MRP / unit {money(lot.mrpPaise)}</span>{rates.length > 1 && <span>Rate / unit {money(lot.sellingPricePaise)}</span>}
        </div></td></tr>)}</Fragment>;
      })}</tbody>
    </table>
    <div className={styles.closing}>
      <section className={styles.summaryGrid} aria-label="Invoice totals">
        <div className={styles.documentNotes}><h3>Billing notes</h3><p>* Rates include applicable GST. Item values and amounts include applied discounts.</p>
          {invoice.calculation && <p>Discount included: {money(invoice.calculation.totals.lineDiscountPaise + invoice.calculation.totals.invoiceDiscountPaise)}</p>}
          <p>Batch and expiry details reflect the goods supplied. Retain this bill for your records.</p></div>
        <dl className={styles.documentTotals}><div><dt>Value before GST</dt><dd>{amount(invoice.subtotal)}</dd></div><div><dt>CGST</dt><dd>{amount(invoice.cgstTotal)}</dd></div><div><dt>SGST</dt><dd>{amount(invoice.sgstTotal)}</dd></div>
          {invoice.calculation && <div><dt>Round-off</dt><dd>{money(invoice.calculation.totals.roundOffPaise)}</dd></div>}
          <div className={styles.grandTotal}><dt>Total ({currency})</dt><dd>{amount(invoice.totalAmount)}</dd></div>
          {hasPayment && <><div><dt>Amount received</dt><dd>{amount(invoice.amountPaid!)}</dd></div><div><dt>Balance due</dt><dd>{amount(invoice.balanceDue!)}</dd></div></>}
        </dl>
      </section>
      <footer className={styles.documentFooter}><div><p>{pharmacyDocumentTitle(document.kind)} · {invoice.invoiceNumber}</p><p>Issued {issued.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>
        <div className={styles.signature}><p>For {issuer.legalName}</p><div /><strong>{issuer.authorisedSignatory}</strong><p>Authorised signature (sign the printed document)</p></div>
      </footer>
    </div>
  </article>;
}
