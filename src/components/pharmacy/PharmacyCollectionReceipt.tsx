import type { CollectionReceipt } from "@/lib/pharmacyCollections";
import { money } from "./pharmacyWorkspace";

export function CollectionReceiptSummary({ receipt }: { receipt: CollectionReceipt }) {
  return <section aria-label="Committed collection receipt" className="space-y-3">
    <p className="text-sm font-semibold">{receipt.invoiceNumber} · {receipt.balancePaise === 0 ? "Paid in full" : "Part payment recorded"}</p>
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-sm"><div><dt className="text-xs text-text-secondary">Received</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{money(receipt.collectedPaise / 100)}</dd></div><div><dt className="text-xs text-text-secondary">Remaining</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{money(receipt.balancePaise / 100)}</dd></div><div className="col-span-2 flex justify-between gap-3 border-t border-border pt-3"><dt>Change to return</dt><dd className="font-semibold tabular-nums">{money(receipt.cashChangePaise / 100)}</dd></div></dl>
    {receipt.entries.map(entry => <p key={entry.componentId} className="text-xs text-text-secondary">{entry.paymentMethod.toUpperCase()}: {money(entry.amountPaise / 100)}{entry.referenceNumber ? ` · ${entry.referenceNumber}` : ""}</p>)}
    <p className="text-xs text-text-secondary">{new Date(receipt.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST) · Drawer {receipt.drawerCode}</p>
    <details className="text-xs text-text-secondary"><summary className="min-h-11 cursor-pointer py-3">Receipt details</summary><p>Receipt {receipt.receiptId} · Document {receipt.invoiceNumber}</p><p>Operator {receipt.actorId}. Drawer session {receipt.shiftId}.</p><p>Cash tendered {money(receipt.cashTenderedPaise / 100)} · Change {money(receipt.cashChangePaise / 100)}</p>{receipt.creditedPaise > 0 && <p>Credit applied at collection {money(receipt.creditedPaise / 100)}</p>}</details>
  </section>;
}
