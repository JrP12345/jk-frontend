import { canPrintPharmacyInvoice, pharmacyDocumentTitle } from "./pharmacyInvoice";
import type { StoredOfflineReceipt } from "./pharmacyOfflineLedger";
import { readPharmacyPaper, type PharmacyPaper } from "./pharmacyPrintPreferences";

const text = (tag: string, value: string, className?: string) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
/** Static restart shell counterpart of PharmacyInvoiceDocument. Financial data
 * comes exclusively from an already committed receipt; there is no price fetch,
 * HTML interpolation, payment command or Save retry in the print path.
 */
export function printOfflinePharmacyReceipt(original: StoredOfflineReceipt, paperSize: PharmacyPaper = readPharmacyPaper(original.receipt.scope?.locationId || "")) {
  const invoice = original.receipt.invoice;
  if (!canPrintPharmacyInvoice(invoice)) throw new Error("Original saved invoice evidence is incomplete. Retain this bill for recovery.");
  if (typeof window.print !== "function") throw new Error("Printing is unavailable in this browser. The bill remains saved; open it in a browser with printing or Save as PDF support.");
  document.getElementById("pharmacy-final-paper")?.remove();
  const paper = text("article", "", "offline-paper"); paper.id = "pharmacy-final-paper"; paper.dataset.paper = paperSize;
  const amount = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  const issuer = invoice.taxDocument.issuer, header = text("div", "", "paper-header"), business = text("div", ""), identity = text("div", "");
  business.append(text("h1", issuer.legalName), text("p", issuer.address), text("p", `Drug licences: ${issuer.drugLicenceNumbers.join(" / ")}`), text("p", issuer.gstin ? `GSTIN: ${issuer.gstin}` : "GST registration: Unregistered"));
  identity.append(text("h2", pharmacyDocumentTitle(invoice.taxDocument.kind)), text("strong", invoice.invoiceNumber), text("p", new Date(invoice.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })), text("p", `Financial year: ${invoice.financialYear}`));
  header.append(business, identity); paper.append(header, text("p", `Billed to: ${invoice.taxDocument.recipient.name} · Place of supply: ${invoice.taxDocument.placeOfSupply}`));
  const table = document.createElement("table"), head = table.createTHead().insertRow();
  for (const label of ["#", "Medicine / HSN / batch / expiry", "Qty", "Rate", "GST", "Amount"]) head.append(text("th", label));
  const body = table.createTBody();
  invoice.items.forEach((item, index) => {
    const row = body.insertRow(), product = row.insertCell(); product.textContent = String(index + 1);
    const description = row.insertCell(); description.dataset.label = "Medicine"; description.append(text("strong", item.description), text("p", `HSN ${item.hsnSacCode} · ${item.unitSnapshot!.baseUnit}`));
    for (const lot of item.batches || []) description.append(text("p", `${lot.batchNumber} · Exp ${lot.expiryValue} · ${lot.quantity} units · MRP ${amount(lot.mrpPaise / 100)}`));
    for (const [label, value] of [["Quantity", String(item.quantity)], ["Rate", amount(item.amount)], ["GST", `${item.gstRate}%`], ["Amount", amount(item.grossAmountPaise / 100)]]) { const cell = row.insertCell(); cell.dataset.label = label; cell.textContent = value; }
  });
  paper.append(table);
  const totals = text("dl", "", "paper-totals"), add = (label: string, value: number) => { const row = text("div", ""); row.append(text("dt", label), text("dd", amount(value))); totals.append(row); };
  add("Taxable value", invoice.subtotal); add("CGST", invoice.cgstTotal); add("SGST", invoice.sgstTotal);
  add("Discount", ((invoice.calculation?.totals.lineDiscountPaise || 0) + (invoice.calculation?.totals.invoiceDiscountPaise || 0)) / 100);
  add("Round off", (invoice.calculation?.totals.roundOffPaise || 0) / 100); add("Total", invoice.totalAmount);
  add("Cash received", original.receipt.payment.cashTenderedPaise / 100); add("Change returned", original.receipt.payment.changePaise / 100); add("Balance due", 0); paper.append(totals);
  if (invoice.taxDocument.notice) paper.append(text("p", invoice.taxDocument.notice));
  paper.append(text("p", `Authorized signatory: ${issuer.authorisedSignatory}`, "paper-signature"), text("p", "Original cash sale recorded on the designated billing PC. Retain this invoice for any return."));
  document.body.append(paper); window.print();
}
