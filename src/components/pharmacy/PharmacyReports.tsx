"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Select, DatePicker } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readReportChoices, readPharmacyReport, downloadReport, reportError, type PharmacyReportKind, type PharmacyReportPage, type ReportFilters, type ReportChoice, type ReportColumn } from "@/lib/pharmacyReports";
import styles from "./PharmacyWorkspace.module.css";
const currentKinds = new Set(["stock", "low_stock", "expiry", "valuation", "dead_stock", "supplier_dues", "customer_dues"]);
export function PharmacyReports({ locationId }: { locationId: string }) { const scope = authScopeKey(useAuthStore(state => state.user)); return <ReportSession key={`${scope}:${locationId}`} locationId={locationId} />; }
function ReportSession({ locationId }: { locationId: string }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), alive = useRef(true), beginRead = useLatestRead();
  const [choices, setChoices] = useState<ReportChoice[]>([]), [kind, setKind] = useState<PharmacyReportKind | "">(""), [catalogueBusy, setCatalogueBusy] = useState(true), [retry, setRetry] = useState(0);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [days, setDays] = useState("90"), [limit, setLimit] = useState("25"), [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState("");
  const [loaded, setLoaded] = useState<{ page: PharmacyReportPage; filters: ReportFilters } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const request = beginRead();
    void readReportChoices(locationId, request.signal).then(items => { if (request.isCurrent()) { setChoices(items); setKind(items[0]?.kind || ""); } }).catch(async failure => { const message = await reportError(failure); if (request.isCurrent()) setError(message); }).finally(() => { if (request.isCurrent()) setCatalogueBusy(false); });
  }, [beginRead, locationId, retry]);
  function change(action: () => void) { beginRead(); setLoaded(null); setBusy(false); setError(""); action(); }
  async function load(cursor?: string) {
    if (!kind || exporting) return; const request = beginRead(); setBusy(true); setLoaded(null); setError("");
    const filters: ReportFilters = { locationId, days: Number(days), limit: Number(limit), ...(!currentKinds.has(kind) && (start || end) ? { startDate: start, endDate: end } : {}), ...(cursor ? { cursor } : {}) };
    try { const page = await readPharmacyReport(kind, filters, request.signal); if (request.isCurrent()) setLoaded({ page, filters }); }
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
    {error && <Alert variant="error" title="Report unavailable">{error}</Alert>}
    {catalogueBusy ? <p role="status">Checking report access...</p> : !choices.length ? <><p>No report source is available with your current permissions.</p><Button size="sm" onClick={() => { setCatalogueBusy(true); setError(""); setRetry(value => value + 1); }}>Recheck report access</Button></> : <>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void load(); }}><fieldset className={styles.form} disabled={exporting}>
        <Select label="Operational report" value={kind} onChange={event => change(() => setKind(event.target.value as PharmacyReportKind))} options={choices.map(row => ({ value: row.kind, label: row.label }))} />
        {!currentKinds.has(kind) && <><DatePicker label="Report start date" value={start} onChange={value => change(() => setStart(value))} /><DatePicker label="Report end date" value={end} onChange={value => change(() => setEnd(value))} /><p>Choose both local dates, up to 93 calendar days. Leave both empty for the branch's last 30 days.</p></>}
        {["expiry", "dead_stock"].includes(kind) && <Select label="Report elapsed-day window" value={days} onChange={event => change(() => setDays(event.target.value))} options={[30, 60, 90, 180, 365].map(value => ({ value: String(value), label: `${value} days` }))} />}
        <Select label="Source page size" value={limit} onChange={event => change(() => setLimit(event.target.value))} options={[1, 5, 10, 25].map(value => ({ value: String(value), label: `${value} source records` }))} /><Button size="sm" type="submit" disabled={busy}>Load report</Button>
      </fieldset></form>{busy && <p role="status">Loading report sources...</p>}
      {page && <section className={styles.list} aria-label="Reviewed report page"><header><h3>{page.label}</h3><p>{page.basis}</p><p>Read {new Date(page.asOf).toLocaleString("en-IN", { timeZone: page.timezone })} ({page.timezone}). {currentKinds.has(page.kind) ? "Current balances and stock." : `Period ${page.startDate} to ${page.endDate}.`}</p><p>{page.rows.length} result rows from {page.scanned} source records. Amount subtotals cover this page only. Pages are separate live snapshots.</p></header>
        {!page.rows.length && <p>{page.nextCursor ? "No matches on this source page. Continue to the next page." : "No matching source rows on this page."}</p>}
        {page.rows.length > 0 && <div className={styles.reportTable}><table><caption>{page.label} · {page.currency} · current page</caption><thead><tr>{page.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{page.rows.map(row => <tr key={row.id}>{page.columns.map(column => <td key={column.key}>{cell(row[column.key], column, page.timezone)}</td>)}</tr>)}</tbody><tfoot><tr>{page.columns.map((column, index) => <td key={column.key}>{Object.hasOwn(page.totals, column.key) ? cell(page.totals[column.key], column, page.timezone) : index === 0 ? "This page only" : ""}</td>)}</tr></tfoot></table></div>}
        <div className={styles.actions}><Button size="sm" variant="outline" disabled={busy || exporting} onClick={() => { void load(); }}>First report page</Button>{page.nextCursor && <Button size="sm" disabled={busy || exporting} onClick={() => { void load(page.nextCursor!); }}>Next report page</Button>}<Button size="sm" variant="outline" disabled={busy || exporting || !page.rows.length} onClick={() => { void exportPage(); }}>{exporting ? "Preparing reviewed export..." : "Export reviewed page CSV"}</Button></div><p>Export requires the page to remain unchanged and records an audit. Refresh and review if the source changes. Download each required page; this does not export the entire branch.</p>
      </section>}
    </>}
  </section>;
}
function cell(value: string | number | null | undefined, column: ReportColumn, timezone: string) {
  if (value === null || value === undefined) return "Needs review";
  if (column.format === "paise") { const paise = BigInt(value), absolute = paise < BigInt(0) ? -paise : paise; return `${paise < BigInt(0) ? "−" : ""}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(absolute / BigInt(100))}.${String(absolute % BigInt(100)).padStart(2, "0")}`; }
  if (column.format === "date") return new Date(String(value)).toLocaleString("en-IN", { timeZone: timezone }); return String(value) || "—";
}
