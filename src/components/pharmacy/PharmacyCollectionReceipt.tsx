import { CheckCircle2, Clock3 } from "lucide-react";
import type { CollectionReceipt } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";
import ui from "./PharmacyCollectionDetails.module.css";

export function CollectionReceiptSummary({ receipt, print = false }: { receipt: CollectionReceipt; print?: boolean }) {
  const complete = receipt.balancePaise === 0;
  const references = <dl className={ui.referenceList}>
    {receipt.cashTenderedPaise > receipt.collectedPaise && <div><dt>Cash tendered</dt><dd>{money(receipt.cashTenderedPaise / 100)}</dd></div>}
    {receipt.creditedPaise > 0 && <div><dt>Credit applied at collection</dt><dd>{money(receipt.creditedPaise / 100)}</dd></div>}
  </dl>;
  return <section aria-label="Committed collection receipt" className={ui.receipt} data-print={print || undefined}>
    <header className={ui.receiptHeading}>
      <div><span className={ui.eyebrow}>Payment received</span><strong className={ui.receiptAmount}>{money(receipt.collectedPaise / 100)}</strong></div>
      {(print || !complete) && <span className={ui.status} data-complete={complete || undefined}>{complete ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{complete ? "Paid in full" : "Part payment recorded"}</span>}
    </header>
    <p className={ui.receiptDate}>{new Date(receipt.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} IST</p>
    <dl className={ui.methods}>{receipt.entries.map(entry => <div key={entry.componentId}>
      <dt><span className={ui.method}>{entry.paymentMethod === "cash" ? "Cash" : entry.paymentMethod === "upi" ? "UPI" : "Card"}</span>{entry.referenceNumber && <span className={ui.paymentReference}>{entry.referenceNumber}</span>}</dt>
      <dd>{money(entry.amountPaise / 100)}</dd>
    </div>)}</dl>
    <dl className={ui.receiptTotals}>
      {receipt.balancePaise > 0 && <div><dt>Remaining after payment</dt><dd>{money(receipt.balancePaise / 100)}</dd></div>}
      {receipt.cashChangePaise > 0 && <div data-change><dt>Change to return</dt><dd>{money(receipt.cashChangePaise / 100)}</dd></div>}
    </dl>
    <p className={ui.drawer}>Drawer <strong>{receipt.drawerCode}</strong></p>
    {references}
  </section>;
}
