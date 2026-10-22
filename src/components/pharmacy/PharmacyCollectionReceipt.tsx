import type { CollectionReceipt } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";

export function CollectionReceiptSummary({ receipt }: { receipt: CollectionReceipt }) {
  return <section aria-label="Committed collection receipt"><p>Receipt {receipt.receiptId} · Document {receipt.invoiceNumber}</p><p>Received {money(receipt.collectedPaise / 100)} · Remaining {money(receipt.balancePaise / 100)}</p><p>Collected {new Date(receipt.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST). Operator {receipt.actorId}.</p>
    <p>Drawer {receipt.drawerCode} (session {receipt.shiftId})</p>
    {receipt.entries.map(entry => <p key={entry.componentId}>{entry.paymentMethod.toUpperCase()}: {money(entry.amountPaise / 100)}{entry.referenceNumber ? ` · ${entry.referenceNumber}` : ""}</p>)}{receipt.creditedPaise > 0 && <p>Credit applied at collection {money(receipt.creditedPaise / 100)}</p>}<p>Cash tendered {money(receipt.cashTenderedPaise / 100)} · Change {money(receipt.cashChangePaise / 100)}</p></section>;
}
