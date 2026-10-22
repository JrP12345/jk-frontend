import type { OpeningBalanceInvoice } from "@/lib/pharmacyOpeningBalance";
import { money } from "./pharmacyWorkspace";
export function PharmacyOpeningStatementDocument({ invoice }: { invoice: OpeningBalanceInvoice }) {
  const source = invoice.openingBalanceSnapshot;
  return <article aria-label="Saved pharmacy opening balance statement"><header><h2>Opening balance statement</h2><strong>{source.issuer.legalName}</strong><p>{source.issuer.address}</p><p>Drug licences: {source.issuer.drugLicenceNumbers.join(", ")}</p></header><p>Statement {invoice.invoiceNumber} · Recorded {new Date(invoice.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)</p><p>Customer: {invoice.customerSnapshot!.name}</p><p>Dated source: {source.sourceDate} · Reference {source.sourceReference}</p><p>Review reference: {source.reviewReference}</p><strong>Opening due {money(source.amountPaise / 100)}</strong><p>Received {money(invoice.amountPaid)} · Remaining due {money(invoice.balanceDue)}</p><p>Reviewed opening debt. This statement records no current supply, tax or stock movement. Confirmed receipts are separate documents.</p></article>;
}
