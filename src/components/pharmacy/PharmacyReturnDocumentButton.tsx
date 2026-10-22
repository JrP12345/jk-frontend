"use client";
import { useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import PrintDialogActions from "@/components/ui/PrintDialogActions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readReturnDocument, type ReturnDocument } from "@/lib/pharmacyReturns";
import { printElement, PrintPreparationError } from "@/lib/printBrand";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyPrint.module.css";

export function PharmacyReturnDocumentButton({ returnId, locationId }: { returnId: string; locationId: string }) {
  const [doc, setDoc] = useState<ReturnDocument | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false), preview = useRef<HTMLDivElement>(null);
  const beginRead = useLatestRead();
  async function open() {
    const request = beginRead(); setLoading(true); setError("");
    try { const value = await readReturnDocument(returnId, locationId, request.signal); if (request.isCurrent()) setDoc(value); }
    catch (failure) { if (request.isCurrent()) setError(failure instanceof Error ? failure.message : "Saved credit note could not be loaded"); }
    finally { if (request.isCurrent()) setLoading(false); }
  }
  async function print() { if (!doc || !preview.current) throw new PrintPreparationError("not-ready"); await printElement(preview.current, { title: doc.creditNote.creditNoteNumber, paper: "A4" }); }
  return <><Button size="sm" variant="outline" disabled={loading} onClick={() => { void open(); }}>Preview return credit note {returnId}</Button>{error && <Alert variant="error" title="Credit note unavailable">{error}</Alert>}
    {doc && <Modal open title="Sales return credit note" description={doc.creditNote.creditNoteNumber} onClose={() => setDoc(null)} size="lg" footer={<PrintDialogActions documentName="return credit note" onClose={() => setDoc(null)} onPrint={print} />}><div ref={preview} className={styles.paper}>
      <article aria-label="Saved sales return credit note"><header><h2>Sales return credit note</h2><strong>{doc.creditNote.issuerSnapshot.issuer.legalName}</strong><p>{doc.creditNote.issuerSnapshot.issuer.address}</p><p>Drug licences: {doc.creditNote.issuerSnapshot.issuer.drugLicenceNumbers.join(", ")}</p>{doc.creditNote.issuerSnapshot.issuer.gstin && <p>GSTIN: {doc.creditNote.issuerSnapshot.issuer.gstin}</p>}</header>
        <p>Credit note {doc.creditNote.creditNoteNumber} · Issued {new Date(doc.creditNote.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)</p><p>Source invoice {doc.invoiceNumber} · Issued {new Date(doc.creditNote.sourceIssuedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p><p>Customer: {doc.creditNote.issuerSnapshot.recipient.name}</p>
        <p>Reason: {doc.reason}. Review reference: {doc.reviewReference}. Operator {doc.actorId}; approval {doc.approvedBy}.</p>
        <table><thead><tr><th>Original product / lot</th><th>Returned quantity</th><th>Condition</th><th>Credit (INR)</th></tr></thead><tbody>{doc.lines.map((line, index) => <tr key={index}><td>{line.description} · {line.batchNumber}</td><td>{line.quantity}</td><td>{line.condition}</td><td>{money(line.payablePaise / 100)}</td></tr>)}</tbody></table>
        <p>Captured value {money(doc.creditNote.baseAmountPaise / 100)} · CGST {money(doc.creditNote.cgstPaise / 100)} · SGST {money(doc.creditNote.sgstPaise / 100)} · Allocation/rounding {money(doc.creditNote.roundOffPaise / 100)}</p><strong>Commercial credit {money(doc.creditNote.payablePaise / 100)}</strong><p>Returned goods are quarantined. This credit note does not record a refund payment. Tax adjustment requires professional review.</p>
      </article>
    </div></Modal>}
  </>;
}
