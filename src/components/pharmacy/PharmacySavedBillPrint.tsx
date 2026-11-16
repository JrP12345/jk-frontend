"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readCounterInvoice, type CounterInvoice } from "@/lib/pharmacyCollections";
import { canPrintPharmacyInvoice, type IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import { getPrintErrorMessage, printElement } from "@/lib/printBrand";
import { measurePharmacyStep } from "@/lib/pharmacySavePerformance";
import { PharmacyInvoiceDocument } from "./PharmacyInvoiceDocument";
import styles from "./PharmacyPrint.module.css";

/** A print failure never retries either financial command. Only the saved document is read. */
export function PharmacySavedBillPrint({ invoiceId, locationId, savedDocument, onClose }: { invoiceId: string; locationId: string; savedDocument?: CounterInvoice; onClose: () => void }) {
  const [invoice, setInvoice] = useState<CounterInvoice | null>(null), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const preview = useRef<HTMLDivElement>(null), printed = useRef<CounterInvoice | null>(null);
  const loaded = useRef<CounterInvoice | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const beginRead = useLatestRead();
  useEffect(() => {
    const request = beginRead();
    const cached = savedDocument || (loaded.current?.id === invoiceId && loaded.current.locationId === locationId ? loaded.current : null);
    void (cached ? Promise.resolve(cached) : readCounterInvoice(invoiceId, locationId, request.signal)).then(bill => {
      if (!request.isCurrent()) return;
      if (bill.id !== invoiceId || bill.locationId !== locationId || !canPrintPharmacyInvoice(bill)) throw new Error("Saved bill evidence is incomplete. Open the saved bill before printing.");
      loaded.current = bill; setError(""); setInvoice(bill);
    }).catch(failure => { if (request.isCurrent()) setError(failure instanceof Error ? failure.message : "Saved bill could not be loaded for printing."); });
  }, [invoiceId, locationId, savedDocument, attempt, beginRead]);
  useEffect(() => {
    if (!invoice || !preview.current || printed.current === invoice) return;
    printed.current = invoice;
    let active = true;
    const element = preview.current;
    // This phase includes asset preparation and time spent in the native print dialog.
    void measurePharmacyStep("print_handoff", () => printElement(element, { title: invoice.invoiceNumber })).then(() => { if (active) close.current(); }).catch(failure => { if (active) setError(getPrintErrorMessage(failure)); });
    return () => { active = false; };
  }, [invoice]);
  return <>
    {!invoice && !error && <p role="status" className="fixed inset-x-4 bottom-20 z-[var(--layer-toast)] mx-auto w-fit rounded-control border border-border bg-surface px-4 py-2 text-sm text-text shadow-sm">Preparing saved bill for printing…</p>}
    <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, width: 800 }}><div ref={preview} className={styles.paper}>{invoice && <PharmacyInvoiceDocument invoice={invoice as IssuedPharmacyInvoice} />}</div></div>
    {error && <div className="fixed inset-x-4 bottom-36 z-[var(--layer-toast)] mx-auto max-w-md"><Alert variant="warning" title="Bill saved; printing needs attention"><p>{error}</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { printed.current = null; setError(""); setInvoice(null); setAttempt(value => value + 1); }}>Retry printing</Button><Button size="sm" variant="outline" onClick={onClose}>Close</Button></div></Alert></div>}
  </>;
}
