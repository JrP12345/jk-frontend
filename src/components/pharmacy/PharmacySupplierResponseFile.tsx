"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import type { OrderResponseLine, PurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
import { canImportSupplierResponse, parseSupplierResponse, supplierResponseTemplate, SUPPLIER_RESPONSE_MAX_BYTES } from "@/lib/pharmacySupplierExchange";
import styles from "./PharmacyWorkspace.module.css";

export function PharmacySupplierResponseFile({ order, disabled, onReview, onBusyChange }: { order: PurchaseOrder; disabled: boolean; onReview: (lines: OrderResponseLine[], name: string) => void; onBusyChange: (busy: boolean) => void }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), epoch = useRef(0), lock = useRef(false);
  useEffect(() => () => { epoch.current++; }, []);
  function download() {
    const url = URL.createObjectURL(new Blob([supplierResponseTemplate(order)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `supplier-response-${order.id}-r${order.revision}.csv`; document.body.append(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  }
  async function inspect(file?: File) {
    if (!file || disabled || lock.current || !canImportSupplierResponse(order)) return;
    const request = ++epoch.current; lock.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      if (!/\.csv$/i.test(file.name) || file.size > SUPPLIER_RESPONSE_MAX_BYTES) throw Error("Choose a UTF-8 .csv supplier response smaller than 256 KB.");
      const source = await file.text();
      if (request !== epoch.current) return;
      const lines = parseSupplierResponse(order, source); onReview(lines, file.name);
    } catch (failure) { if (request === epoch.current) setError(failure instanceof Error ? failure.message : "Review the supplier response file."); }
    finally { lock.current = false; if (request === epoch.current) { setBusy(false); onBusyChange(false); } }
  }
  if (!canImportSupplierResponse(order)) return null;
  return <details className={styles.form}>
    <summary>Supplier response CSV</summary>
    <p className={styles.meta}>Send this template to your supplier. Ask them to fill accepted base units for every product, an optional INR price per base unit and a note. Keep the other columns unchanged. Review the returned quantities below before recording the supplier response.</p>
    <Button size="sm" variant="outline" disabled={disabled || busy} onClick={download}>Download supplier response template</Button>
    <Input label="Returned supplier response CSV" className="min-w-0 max-w-full" type="file" accept=".csv,text/csv" disabled={disabled || busy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void inspect(file); }} />
    {busy && <p role="status">Reading supplier response...</p>}
    {error && <Alert variant="error" title="Supplier file needs review">{error}</Alert>}
  </details>;
}
