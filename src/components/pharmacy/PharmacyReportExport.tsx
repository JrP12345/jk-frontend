"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { reportError, type PharmacyReportKind, type ReportFilters } from "@/lib/pharmacyReports";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
type Prepared = { id: string; locationId: string; requestKey: string; kind: string; state: string; digest?: string; expiresAt: string; failureReason?: string; summary: null | { label: string; timezone: string; asOf: string; startDate: string; endDate: string; rows: number; scanned: number; totals: Record<string, number | null>; amountColumns: Array<{ key: string; label: string }>; basis: string; totalScope: string } };
export function PharmacyReportExport({ kind, filters }: { kind: PharmacyReportKind; filters: ReportFilters }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-report-export:${scope}:${filters.locationId}`;
  const alive = useRef(true), lock = useRef(false), frozen = useRef<{ key: string; input: { kind: PharmacyReportKind; filters: ReportFilters } } | null>(null);
  const [pending, setPending] = useState<string | null>(null), [prepared, setPrepared] = useState<Prepared | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [canRetry, setCanRetry] = useState(false), [missing, setMissing] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; try { const key = sessionStorage.getItem(storageKey); if (key && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw Error("Saved export reference needs review"); setPending(key); } catch (failure) { setError((failure as Error).message); } return () => { alive.current = false; }; }, [storageKey]);
  async function request() {
    if (lock.current || pending && !frozen.current) return; lock.current = true; setBusy(true); setError("");
    try {
      if (!frozen.current) { const command = { key: crypto.randomUUID(), input: { kind, filters: { ...filters, cursor: undefined } } }; sessionStorage.setItem(storageKey, command.key); frozen.current = command; setPending(command.key); setCanRetry(true); }
      const command = frozen.current, result = (await api.post("/pharmacy/report-exports", command.input, { headers: { "Idempotency-Key": command.key } })).data?.data;
      if (!result || result.requestKey !== command.key || result.locationId !== filters.locationId || typeof result.id !== "string") throw Error("Export request acceptance could not be confirmed. Keep the same reference");
      if (current()) setCanRetry(false);
    } catch (failure) { const message = await reportError(failure); if (current()) setError(message); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function check() {
    if (!pending || lock.current) return; lock.current = true; setBusy(true); setError(""); setMissing(false);
    try {
      const data = (await api.get(`/pharmacy/report-exports/${pending}`, { params: { locationId: filters.locationId } })).data?.data as Prepared;
      if (!data || data.locationId !== filters.locationId || data.requestKey !== pending || !["queued", "processing", "ready", "failed", "expired"].includes(data.state) || !Number.isFinite(Date.parse(data.expiresAt)) || data.state === "ready" && (!/^[a-f\d]{64}$/.test(data.digest || "") || !data.summary || data.summary.totalScope !== "complete" || !Number.isSafeInteger(data.summary.rows) || data.summary.rows < 0 || data.summary.rows > 50000 || !Number.isSafeInteger(data.summary.scanned) || data.summary.scanned > 25000 || !Array.isArray(data.summary.amountColumns) || data.summary.amountColumns.length > 25)) throw Error("Prepared report summary could not be confirmed");
      if (current()) { setPrepared(data); setCanRetry(false); }
    } catch (failure) { const message = await reportError(failure); if (current()) { setError(message); setMissing((failure as { response?: { status?: number } }).response?.status === 404); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function download() {
    if (!pending || !prepared?.digest || lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const result = await api.get(`/pharmacy/report-exports/${pending}/download`, { params: { locationId: filters.locationId, expectedDigest: prepared.digest }, responseType: "blob" });
      if (!(result.data instanceof Blob) || !String(result.headers["content-type"] || "").startsWith("text/csv") || result.headers["x-report-digest"] !== prepared.digest) throw Error("Prepared download does not match the reviewed report");
      if (!current()) return; const url = URL.createObjectURL(result.data), link = document.createElement("a");
      try { link.href = url; link.download = `pharmacy-${prepared.kind}-prepared.csv`; document.body.appendChild(link); link.click(); }
      finally { link.remove(); URL.revokeObjectURL(url); }
    } catch (failure) { const message = await reportError(failure); if (current()) setError(message); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <details className={styles.card}><summary>Prepare a larger report in the background</summary><p>Uses the selected report and dates. The worker prepares one consistent snapshot, up to 25,000 source records, 50,000 rows and 16 MB. Requests exceeding the safe budget fail explicitly. Prepared copies expire after seven days; original business records remain available.</p>
    {error && <Alert variant="error" title="Prepared export needs attention">{error}</Alert>}{!pending && <Button size="sm" disabled={busy} onClick={() => { void request(); }}>Prepare background CSV export</Button>}
    {pending && <><p className="break-all">Request reference: {pending}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void check(); }}>Check background export</Button>{canRetry && <Button size="sm" disabled={busy} onClick={() => { void request(); }}>Retry same export request</Button>}</>}
    {prepared && <><p>Status: {prepared.state}. {prepared.failureReason}</p>{prepared.summary && <><h3>{prepared.summary.label}</h3><p>{prepared.summary.startDate} to {prepared.summary.endDate} · {prepared.summary.rows} rows from {prepared.summary.scanned} source records · Snapshot {new Date(prepared.summary.asOf).toLocaleString("en-IN", { timeZone: prepared.summary.timezone })}</p><p>{prepared.summary.basis}</p><dl>{prepared.summary.amountColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{prepared.summary!.totals[column.key] === null ? "Needs review" : money(prepared.summary!.totals[column.key]! / 100)}</dd></div>)}</dl><Button size="sm" disabled={busy} onClick={() => { void download(); }}>Download prepared reviewed CSV</Button></>}</>}
    {(prepared && ["ready", "failed", "expired"].includes(prepared.state) || missing) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { sessionStorage.removeItem(storageKey); frozen.current = null; setPending(null); setPrepared(null); setCanRetry(false); setMissing(false); }}>Review a separate export request</Button>}
    {busy && <p role="status">Checking export request...</p>}
  </details>;
}
