"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Select, DatePicker } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readReportChoices, readPharmacyReport, downloadReport, reportError, type PharmacyReportKind, type PharmacyReportPage, type ReportFilters, type ReportChoice, type ReportColumn } from "@/lib/pharmacyReports";
import styles from "./PharmacyWorkspace.module.css";
import { PharmacyAccountingExport } from "./PharmacyAccountingExport";
import { PharmacyMerchantSettlements } from "./PharmacyMerchantSettlements";
import { hasAnyPermission } from "@/lib/permissions";
import { PharmacyReportExport } from "./PharmacyReportExport";
const currentKinds = new Set(["stock", "low_stock", "expiry", "valuation", "dead_stock", "stock_velocity", "expiry_value", "supplier_dues", "customer_dues"]);
export function PharmacyReports({ locationId, initial }: { locationId: string; initial?: { kind: PharmacyReportKind; date: string } }) { const scope = authScopeKey(useAuthStore(state => state.user)); return <ReportSession key={`${scope}:${locationId}:${initial?.kind || ""}:${initial?.date || ""}`} locationId={locationId} initial={initial} />; }
function ReportSession({ locationId, initial }: { locationId: string; initial?: { kind: PharmacyReportKind; date: string } }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), alive = useRef(true), beginRead = useLatestRead();
  const [choices, setChoices] = useState<ReportChoice[]>([]), [kind, setKind] = useState<PharmacyReportKind | "">(""), [catalogueBusy, setCatalogueBusy] = useState(true), [retry, setRetry] = useState(0);
  const [start, setStart] = useState(initial && !currentKinds.has(initial.kind) ? initial.date : ""), [end, setEnd] = useState(initial && !currentKinds.has(initial.kind) ? initial.date : ""), [days, setDays] = useState("90"), [limit, setLimit] = useState("25"), [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState("");
  const [loaded, setLoaded] = useState<{ page: PharmacyReportPage; filters: ReportFilters } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const request = beginRead();
    void readReportChoices(locationId, request.signal).then(items => { if (request.isCurrent()) { setChoices(items); setKind(items.find(item => item.kind === initial?.kind)?.kind || items[0]?.kind || ""); } }).catch(async failure => { const message = await reportError(failure); if (request.isCurrent()) setError(message); }).finally(() => { if (request.isCurrent()) setCatalogueBusy(false); });
  }, [beginRead, locationId, retry, initial?.kind]);
  function change(action: () => void) { beginRead(); setLoaded(null); setBusy(false); setError(""); action(); }
  async function load(cursor?: string, complete = false) {
    if (!kind || exporting) return; const request = beginRead(); setBusy(true); setLoaded(null); setError("");
    const filters: ReportFilters = { locationId, days: Number(days), limit: Number(limit), ...(!currentKinds.has(kind) && (start || end) ? { startDate: start, endDate: end } : {}), ...(cursor ? { cursor } : {}) };
    try { const page = await readPharmacyReport(kind, filters, request.signal, complete); if (request.isCurrent()) setLoaded({ page, filters }); }
    catch (failure) { const message = await reportError(failure); if (request.isCurrent()) setError(message); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function exportPage() {
    if (!loaded || busy || exporting || !current()) return; setExporting(true); setError("");
    try {
      const blob = await downloadReport(loaded.page, loaded.filters); if (!current()) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      try { link.href = url; link.download = `pharmacy-${loaded.page.kind}-${loaded.page.endDate}.csv`; document.body.appendChild(link); link.click(); }
      finally { link.remove(); URL.revokeObjectURL(url); }
    } catch (failure) { const message = await reportError(failure); if (current()) setError(message); }
    finally { if (current()) setExporting(false); }
  }
  const page = loaded?.page;
  return <section className={styles.list} aria-label="Pharmacy operational reports"><header><h2>Operational reports</h2><p>Source records stay separate: supply, receipts, credits, dues and physical stock answer different questions.</p></header>
    {hasAnyPermission(useAuthStore.getState().user, "PHARMACY_VIEW_FINANCE", "PHARMACY_APPROVE_REFUND", "PHARMACY_PURCHASE", "MANAGE_ORGANIZATION") && <PharmacyMerchantSettlements locationId={locationId} />}
    {error && <Alert variant="error" title="Report unavailable">{error}</Alert>}
    {catalogueBusy ? <p role="status">Checking report access...</p> : !choices.length ? <><p>No report source is available with your current permissions.</p><Button size="sm" onClick={() => { setCatalogueBusy(true); setError(""); setRetry(value => value + 1); }}>Recheck report access</Button></> : <>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void load(); }}><fieldset className={styles.form} disabled={exporting}>
        <Select label="Operational report" value={kind} onChange={event => change(() => setKind(event.target.value as PharmacyReportKind))} options={choices.map(row => ({ value: row.kind, label: row.label }))} />
        {!currentKinds.has(kind) && <><DatePicker label="Report start date" value={start} onChange={value => change(() => setStart(value))} /><DatePicker label="Report end date" value={end} onChange={value => change(() => setEnd(value))} /><p>Choose both local dates, up to 93 calendar days. Leave both empty for the branch's last 30 days.</p></>}
        {["expiry", "expiry_value", "dead_stock", "stock_velocity"].includes(kind) && <Select label="Report elapsed-day window" value={days} onChange={event => change(() => setDays(event.target.value))} options={[30, 60, 90, 180, 365].map(value => ({ value: String(value), label: `${value} days` }))} />}
        <Select label="Source page size" value={limit} onChange={event => change(() => setLimit(event.target.value))} options={[1, 5, 10, 25].map(value => ({ value: String(value), label: `${value} source records` }))} /><Button size="sm" type="submit" disabled={busy}>Load report</Button><Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => { void load(undefined, true); }}>Load complete report</Button><p>Complete reports use one consistent snapshot, up to 2,000 source records and result rows. Narrow the dates if the safe read budget is exceeded.</p>
      </fieldset></form>{kind && <PharmacyReportExport key={locationId} kind={kind} filters={{ locationId, days: Number(days), limit: Number(limit), ...(!currentKinds.has(kind) && (start || end) ? { startDate: start, endDate: end } : {}) }} />}{busy && <p role="status">Loading report sources...</p>}
      {page && <section className={styles.list} aria-label="Reviewed report page"><header><h3>{page.label}</h3><p>{page.basis}</p><p>Read {new Date(page.asOf).toLocaleString("en-IN", { timeZone: page.timezone })} ({page.timezone}). {currentKinds.has(page.kind) ? "Current balances and stock." : `Period ${page.startDate} to ${page.endDate}.`}</p><p>{page.rows.length} result rows from {page.scanned} source records. {page.totalScope === "complete" ? "Complete result and totals from one snapshot." : "Amount subtotals cover this page only. Pages are separate live snapshots."}</p></header>
        {!page.rows.length && <p>{page.nextCursor ? "No matches on this source page. Continue to the next page." : "No matching source rows on this page."}</p>}
        {page.rows.length > 0 && <div className={styles.reportTable}><table><caption>{page.label} · {page.currency} · {page.totalScope === "complete" ? "complete result" : "current page"}</caption><thead><tr>{page.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{page.rows.map(row => <tr key={row.id}>{page.columns.map(column => <td key={column.key}>{cell(row[column.key], column, page.timezone)}</td>)}</tr>)}</tbody><tfoot><tr>{page.columns.map((column, index) => <td key={column.key}>{Object.hasOwn(page.totals, column.key) ? cell(page.totals[column.key], column, page.timezone) : index === 0 ? page.totalScope === "complete" ? "Complete result" : "This page only" : ""}</td>)}</tr></tfoot></table></div>}
        <div className={styles.actions}><Button size="sm" variant="outline" disabled={busy || exporting} onClick={() => { void load(); }}>First report page</Button>{page.nextCursor && <Button size="sm" disabled={busy || exporting} onClick={() => { void load(page.nextCursor!); }}>Next report page</Button>}<Button size="sm" variant="outline" disabled={busy || exporting || !page.rows.length} onClick={() => { void exportPage(); }}>{exporting ? "Preparing reviewed export..." : page.totalScope === "complete" ? "Export complete reviewed CSV" : "Export reviewed page CSV"}</Button></div><p>Export requires the page to remain unchanged and records an audit. Refresh and review if the source changes. Choose Load complete report for all matching sources within the safe read budget. Ordinary page exports include only that reviewed page.</p>
        {loaded && <PharmacyAccountingExport key={page.digest} page={page} filters={loaded.filters} />}
      </section>}
    </>}
  </section>;
}
function cell(value: string | number | null | undefined, column: ReportColumn, timezone: string) {
  if (value === null || value === undefined) return "Needs review";
  if (column.format === "paise") { const paise = BigInt(value), absolute = paise < BigInt(0) ? -paise : paise; return `${paise < BigInt(0) ? "−" : ""}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(absolute / BigInt(100))}.${String(absolute % BigInt(100)).padStart(2, "0")}`; }
  if (column.format === "date") return new Date(String(value)).toLocaleString("en-IN", { timeZone: timezone }); return String(value) || "—";
}
