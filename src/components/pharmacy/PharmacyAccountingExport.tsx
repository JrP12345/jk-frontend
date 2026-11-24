"use client";
import { useRef, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { reportError, type PharmacyReportPage, type ReportFilters } from "@/lib/pharmacyReports";
import styles from "./PharmacyWorkspace.module.css";
const defaults = { receivable: "Pharmacy receivables", sales: "Pharmacy sales", cgst: "Output CGST", sgst: "Output SGST", utgst: "Output UTGST", igst: "Output IGST", rounding: "Pharmacy round off" };
export function PharmacyAccountingExport({ page, filters }: { page: PharmacyReportPage; filters: ReportFilters }) {
  const [ledgers, setLedgers] = useState(defaults), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), scope = authScopeKey(useAuthStore(state => state.user));
  if (page.totalScope !== "complete" || !["tax", "sales_returns"].includes(page.kind)) return null;
  async function download() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const response = await api.post(`/pharmacy/reports/${page.kind}/accounting-export`, { filters: { ...filters, expectedDigest: page.digest }, ledgers }, { responseType: "blob" });
      if (authScopeKey(useAuthStore.getState().user) !== scope) return;
      if (!(response.data instanceof Blob) || !String(response.headers["content-type"] || "").startsWith("application/xml") || response.headers["x-report-digest"] !== page.digest) throw Error("Accounting export does not match the reviewed report");
      const url = URL.createObjectURL(response.data), link = document.createElement("a");
      try { link.href = url; link.download = `pharmacy-${page.kind}-${page.endDate}-tally.xml`; document.body.appendChild(link); link.click(); }
      finally { link.remove(); URL.revokeObjectURL(url); }
    } catch (failure) { const message = await reportError(failure); if (authScopeKey(useAuthStore.getState().user) === scope) setError(message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <details className={styles.card}><summary>Tally accounting export</summary><p>Match these names to existing ledgers in the accountant's Tally company. The file contains accounting vouchers for this complete report. Receipts, inventory and GST filing need separate reconciliation. Review credit notes before tax adjustment, and check Tally's import results before importing a file again.</p>
    <fieldset className={styles.form} disabled={busy}>{Object.entries(ledgers).map(([key, value]) => <Input key={key} label={`Tally ${key} ledger`} value={value} maxLength={100} onChange={event => setLedgers(previous => ({ ...previous, [key]: event.target.value }))} />)}<Button size="sm" disabled={busy || !page.rows.length} onClick={() => { void download(); }}>{busy ? "Preparing accounting file..." : "Download reviewed Tally XML"}</Button></fieldset>
    {error && <Alert variant="error" title="Accounting export unavailable">{error}</Alert>}
  </details>;
}
