"use client";

import { FileText } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Select } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import PrintButton from "@/components/ui/PrintButton";
import { printElement, PrintPreparationError } from "@/lib/printBrand";
import { canPrintPharmacyInvoice, pharmacyDocumentTitle, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import { validateCollectionReceipt, type CollectionReceipt } from "@/lib/pharmacyCollections";
import { PharmacyInvoiceDocument } from "./PharmacyInvoiceDocument";
import { CollectionReceiptSummary } from "./PharmacyCollectionReceipt";
import { isOpeningBalanceInvoice } from "@/lib/pharmacyOpeningBalance";
import { PharmacyOpeningStatementDocument } from "./PharmacyOpeningStatementDocument";
import { PHARMACY_PAPER_OPTIONS, readPharmacyPaper, rememberPharmacyPaper, type PharmacyPaper } from "@/lib/pharmacyPrintPreferences";
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
export function PharmacyDocumentButton({ invoice, receipt, directPrint = false }: { invoice: unknown; receipt?: CollectionReceipt; directPrint?: boolean }) {
  const [open, setOpen] = useState(false), [paper, setPaper] = useState<PharmacyPaper>("A4"), [paperNotice, setPaperNotice] = useState("");
  const preview = useRef<HTMLDivElement>(null);
  const opening = isOpeningBalanceInvoice(invoice) ? invoice : null;
  const ready = receipt ? printableReceipt(invoice, receipt) : Boolean(opening) || canPrintPharmacyInvoice(invoice);
  const bill = invoice as IssuedPharmacyInvoice;
  const title = receipt ? "Collection receipt" : opening ? "Opening balance statement" : ready ? pharmacyDocumentTitle(bill.taxDocument.kind) : "Pharmacy bill";
  const issuer = ready ? opening ? opening.openingBalanceSnapshot.issuer : bill.taxDocument.issuer : null;
  const locationId = (invoice as { locationId?: string } | null)?.locationId || "";
  async function print(selectedPaper = paper) {
    if (!ready || !preview.current) throw new PrintPreparationError("not-ready");
    const printable = directPrint ? preview.current.cloneNode(true) as HTMLDivElement : preview.current;
    printable.classList.toggle(styles.thermal, selectedPaper !== "A4");
    await printElement(printable, { title: receipt ? `Receipt ${receipt.invoiceNumber}` : bill.invoiceNumber, paper: selectedPaper,
      css: selectedPaper === "A4" ? "thead{display:table-header-group}tfoot{display:table-footer-group}" : `html,body{width:calc(${selectedPaper} - 4mm)!important}` });
  }
  const document = ready ? <div ref={preview} className={`${styles.paper} ${paper !== "A4" ? styles.thermal : ""}`}>
        {receipt && issuer ? <article className={styles.receiptDocument} aria-label="Saved pharmacy collection receipt"><header><p className={styles.eyebrow}>COLLECTION RECEIPT</p><h2>{issuer.legalName}</h2><p>{issuer.address}</p><p className={styles.registration}>Drug licences: {issuer.drugLicenceNumbers.join(", ")}</p>{"gstin" in issuer && typeof issuer.gstin === "string" && issuer.gstin.length > 0 && <p>GSTIN: {issuer.gstin}</p>}<strong>{receipt.invoiceNumber}</strong></header><p className={styles.receiptCustomer}>Customer: {opening ? opening.customerSnapshot!.name : bill.taxDocument.recipient.name}</p><CollectionReceiptSummary receipt={receipt} print /><p className={styles.receiptNote}>Staff-confirmed manual collection. {opening ? "Received against the referenced opening balance statement." : "The issued bill contains the supply and tax details."}</p></article> : opening ? <PharmacyOpeningStatementDocument invoice={opening} /> : <PharmacyInvoiceDocument invoice={bill} />}
      </div> : null;
  if (directPrint) return <><PrintButton size="sm" variant="ghost" documentName={receipt ? "receipt" : opening ? "statement" : "bill"} disabled={!ready} onPrint={() => print(readPharmacyPaper(locationId))}>{receipt ? "Print receipt" : opening ? "Print statement" : "Print bill"}</PrintButton><div hidden aria-hidden="true">{document}</div>{!ready && <small>Saved document evidence is incomplete. Review it before printing.</small>}</>;
  return <><Button size="sm" variant="ghost" aria-label={receipt ? `Preview receipt ${receipt.receiptId}` : opening ? "Preview opening balance statement" : "Preview saved pharmacy bill"} disabled={!ready} onClick={() => { setPaper(readPharmacyPaper(locationId)); setPaperNotice(""); setOpen(true); }}><FileText size={15} aria-hidden="true" />{receipt ? "View receipt" : opening ? "View statement" : "View bill"}</Button>
    {!ready && <small>Saved document evidence is incomplete. Review it before printing.</small>}
    {open && ready && <Modal open title={title} description={receipt ? receipt.invoiceNumber : bill.invoiceNumber} onClose={() => setOpen(false)} size="xl" className={styles.previewDialog} bodyClassName={styles.previewBody} contentClassName={styles.previewContent} footer={<PrintButton size="sm" variant="primary" documentName={receipt ? "collection receipt" : opening ? "opening balance statement" : "pharmacy bill"} onPrint={() => print()}>Print</PrintButton>}>
      <div className={styles.previewToolbar}>
      <Select label="Pharmacy paper size" value={paper} onChange={event => { const selected = event.target.value as PharmacyPaper; setPaper(selected); setPaperNotice(rememberPharmacyPaper(locationId, selected) ? "" : "This paper size applies now. Browser storage could not remember it for the next print."); }} options={[...PHARMACY_PAPER_OPTIONS]} />
      <p className="text-xs text-text-secondary">Print or save as PDF. Your saved bill stays unchanged.</p>
      {paperNotice && <p role="status" className="text-xs text-text-secondary">{paperNotice}</p>}
      </div>
      <div className={styles.previewScroll} role="region" aria-label="Document preview" tabIndex={0}>
      <div style={{ width: paper === "A4" ? "100%" : paper, maxWidth: "100%", marginInline: "auto" }}>{document}</div></div>
    </Modal>}
  </>;
}
