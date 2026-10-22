"use client";

import { useRef, useState } from "react";
import { Button, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import PrintDialogActions from "@/components/ui/PrintDialogActions";
import { printElement, PrintPreparationError } from "@/lib/printBrand";
import { canPrintPharmacyInvoice, pharmacyDocumentTitle, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import { validateCollectionReceipt, type CollectionReceipt } from "@/lib/pharmacyCollections";
import { PharmacyInvoiceDocument } from "./PharmacyInvoiceDocument";
import { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";
import { isOpeningBalanceInvoice } from "@/lib/pharmacyOpeningBalance";
import { PharmacyOpeningStatementDocument } from "./PharmacyOpeningStatementDocument";
import styles from "./PharmacyPrint.module.css";

function printableReceipt(invoice: unknown, receipt: CollectionReceipt) {
  try {
    const bill = invoice as IssuedPharmacyInvoice & { id?: string; locationId?: string };
    validateCollectionReceipt(receipt);
    const opening = isOpeningBalanceInvoice(invoice) ? invoice : null;
    return (Boolean(opening) || canPrintPharmacyInvoice(bill)) && bill.kind === "pharmacy" && bill.id === receipt.invoiceId && bill.locationId === receipt.locationId && bill.invoiceNumber === receipt.invoiceNumber &&
      receipt.paidPaise + receipt.balancePaise + receipt.creditedPaise === (opening ? opening.openingBalanceSnapshot.amountPaise : bill.calculation?.totals.payablePaise);
  } catch { return false; }
}
export function PharmacyDocumentButton({ invoice, receipt }: { invoice: unknown; receipt?: CollectionReceipt }) {
  const [open, setOpen] = useState(false), [paper, setPaper] = useState<"A4" | "80mm" | "58mm">("A4");
  const preview = useRef<HTMLDivElement>(null);
  const opening = isOpeningBalanceInvoice(invoice) ? invoice : null;
  const ready = receipt ? printableReceipt(invoice, receipt) : Boolean(opening) || canPrintPharmacyInvoice(invoice);
  const bill = invoice as IssuedPharmacyInvoice;
  const title = receipt ? "Collection receipt" : opening ? "Opening balance statement" : ready ? pharmacyDocumentTitle(bill.taxDocument.kind) : "Pharmacy bill";
  const issuer = ready ? opening ? opening.openingBalanceSnapshot.issuer : bill.taxDocument.issuer : null;
  async function print() {
    if (!ready || !preview.current) throw new PrintPreparationError("not-ready");
    await printElement(preview.current, { title: receipt ? `Receipt ${receipt.receiptId}` : bill.invoiceNumber, paper,
      css: paper === "A4" ? "thead{display:table-header-group}tfoot{display:table-footer-group}" : `html,body{width:calc(${paper} - 4mm)!important}` });
  }
  return <><Button size="sm" variant="outline" disabled={!ready} onClick={() => setOpen(true)}>{receipt ? `Preview receipt ${receipt.receiptId}` : opening ? "Preview opening balance statement" : "Preview saved pharmacy bill"}</Button>
    {!ready && <small>Saved document evidence is incomplete. Review it before printing.</small>}
    {open && ready && <Modal open title={title} description={receipt ? receipt.invoiceNumber : bill.invoiceNumber} onClose={() => setOpen(false)} size="lg" footer={<PrintDialogActions documentName={receipt ? "collection receipt" : opening ? "opening balance statement" : "pharmacy bill"} onClose={() => setOpen(false)} onPrint={print} />}>
      <Select label="Pharmacy paper size" value={paper} onChange={event => setPaper(event.target.value as typeof paper)} options={[{ value: "A4", label: "A4" }, { value: "80mm", label: "80 mm receipt roll" }, { value: "58mm", label: "58 mm receipt roll" }]} />
      <div style={{ width: paper === "A4" ? "100%" : paper, maxWidth: "100%", marginInline: "auto" }}><div ref={preview} className={`${styles.paper} ${paper !== "A4" ? styles.thermal : ""}`}>
        {receipt && issuer ? <article aria-label="Saved pharmacy collection receipt"><header><h2>Collection receipt</h2><strong>{issuer.legalName}</strong><p>{issuer.address}</p><p>Drug licences: {issuer.drugLicenceNumbers.join(", ")}</p>{"gstin" in issuer && typeof issuer.gstin === "string" && issuer.gstin.length > 0 && <p>GSTIN: {issuer.gstin}</p>}</header><p>Customer: {opening ? opening.customerSnapshot!.name : bill.taxDocument.recipient.name}</p><CollectionReceiptSummary receipt={receipt} /><p>Staff-confirmed manual collection. {opening ? "Received against the referenced opening balance statement." : "The issued bill contains the supply and tax details."}</p></article> : opening ? <PharmacyOpeningStatementDocument invoice={opening} /> : <PharmacyInvoiceDocument invoice={bill} />}
      </div></div>
    </Modal>}
  </>;
}
