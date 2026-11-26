"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Alert, Badge, Button, Card, ProgressBar, Select, Table, Tabs } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { readStockAlert, reportError, type PharmacyReportPage, type ReportRow } from "@/lib/pharmacyReports";
import { readMedicinePage, type Medicine } from "./pharmacyWorkspace";
interface Props { locationId: string; medicines: Medicine[]; onOpenAddBatch: (medicine: Medicine) => void; canManage: boolean; refreshKey: number; toolbarActions?: ReactNode; onSupplierReturn?: (source: { purchaseId: string; batchId: string }) => void; onShortbook?: (medicine: Medicine) => void }
type Result = { key: string; page?: PharmacyReportPage; error?: string };
function reorderRatio(row: ReportRow) {
  return typeof row.eligible === "number" && typeof row.reorder === "number" && row.reorder > 0 ? row.eligible / row.reorder : null;
}
function StockProgress({ row }: { row: ReportRow }) {
  const ratio = reorderRatio(row);
  if (ratio === null) return <span className="text-[11px] text-text-secondary">{row.eligible === null ? "Saleable stock unknown" : "No reorder threshold"}</span>;
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return <div role="group" aria-label={`${row.product}: saleable stock versus reorder level`} className="flex min-w-28 items-center gap-2"><ProgressBar value={percent} size="sm" color={row.eligible === 0 ? "danger" : "warning"} animated={false} /><span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">{percent}%</span></div>;
}
function AlertStatus({ row, tab }: { row: ReportRow; tab: string }) {
  return <Badge dot className="max-w-full" variant={row.review ? "warning" : tab === "expired" || (tab === "low" && row.eligible === 0) ? "danger" : "warning"}><span className="whitespace-normal">{row.review ? "Needs review" : tab === "low" ? row.eligible === null ? "Saleable stock unknown" : row.eligible === 0 ? "No saleable stock" : "Low saleable stock" : tab === "expired" ? "Expired" : "Expiring"}</span></Badge>;
}
export function PharmacyAlertsCenter(props: Props) { const scope = authScopeKey(useAuthStore(state => state.user)); return <AlertSession key={`${scope}:${props.locationId}`} {...props} />; }
function AlertSession({ locationId, medicines, onOpenAddBatch, canManage, refreshKey, toolbarActions, onSupplierReturn, onShortbook }: Props) {
  const [days, setDays] = useState("60"), [tab, setTab] = useState("low"), [lowCursor, setLowCursor] = useState<string>(), [expiryCursor, setExpiryCursor] = useState<string>(), [retry, setRetry] = useState(0);
  const [low, setLow] = useState<Result | null>(null), [expiry, setExpiry] = useState<Result | null>(null), [actionError, setActionError] = useState(""), [adding, setAdding] = useState(false);
  const lowRead = useLatestRead(), expiryRead = useLatestRead(), productRead = useLatestRead(), expiryEnabled = tab !== "low";
  const lowKey = `${locationId}:${lowCursor || ""}:${refreshKey}:${retry}`, expiryKey = `${locationId}:${days}:${expiryCursor || ""}:${refreshKey}:${retry}`;
  useEffect(() => {
    if (!locationId || expiryEnabled) return; const request = lowRead();
    void readStockAlert("low_stock", locationId, 90, lowCursor, request.signal).then(page => { if (request.isCurrent()) setLow({ key: lowKey, page }); }).catch(async failure => { const error = await reportError(failure); if (request.isCurrent()) setLow({ key: lowKey, error }); });
  }, [locationId, lowCursor, lowKey, lowRead, expiryEnabled]);
  useEffect(() => {
    if (!locationId || !expiryEnabled) return; const request = expiryRead();
    void readStockAlert("expiry", locationId, Number(days), expiryCursor, request.signal).then(page => { if (request.isCurrent()) setExpiry({ key: expiryKey, page }); }).catch(async failure => { const error = await reportError(failure); if (request.isCurrent()) setExpiry({ key: expiryKey, error }); });
  }, [locationId, days, expiryCursor, expiryKey, expiryRead, expiryEnabled]);
  const result = tab === "low" ? low?.key === lowKey ? low : null : expiry?.key === expiryKey ? expiry : null, page = result?.page;
  const expired = (row: ReportRow) => page && row.expiryCutoff && Date.parse(String(row.expiryCutoff)) <= Date.parse(page.asOf);
  const rows = (page?.rows.filter(row => tab === "low" || row.review || (tab === "expired" ? expired(row) : !expired(row))) || []).sort((a, b) => {
    if (tab !== "low") return 0;
    return (reorderRatio(a) ?? Infinity) - (reorderRatio(b) ?? Infinity);
  });
  async function restock(row: ReportRow, shortbook = false) {
    if (!(shortbook ? onShortbook : canManage) || adding || row.review) return; const request = productRead(); setAdding(true); setActionError("");
    try {
      const medicineId = String(tab === "low" ? row.id : row.medicineId), present = medicines.find(medicine => medicine.id === medicineId);
      const target = present || (await readMedicinePage(locationId, request.signal, { medicineIds: [medicineId] })).items.find(medicine => medicine.id === medicineId);
      if (!target || target.locationId !== locationId) throw new Error("Current product could not be checked for this branch");
      if (shortbook && !target.unitDefinition) throw new Error("Configure this product's base and pack units before adding it to the shortbook.");
      if (request.isCurrent()) { if (shortbook) onShortbook?.(target); else onOpenAddBatch(target); }
    } catch (failure) { const error = await reportError(failure); if (request.isCurrent()) setActionError(error); }
    finally { if (request.isCurrent()) setAdding(false); }
  }
  const actions = (row: ReportRow) => row.review || !(canManage || (tab === "low" ? onShortbook : typeof row.purchaseId === "string" && onSupplierReturn)) ? null : <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 [&_button_span]:whitespace-nowrap md:flex-nowrap md:justify-end md:[&>button]:flex-none">
    {canManage && <Button size="xs" variant="outline" disabled={adding} onClick={() => { void restock(row); }}>{tab === "low" ? "Add batch" : "Add fresh batch"}</Button>}
    {tab === "low" && onShortbook && <Button size="xs" variant="outline" disabled={adding} onClick={() => { void restock(row, true); }}>Add to shortbook</Button>}
    {tab !== "low" && typeof row.purchaseId === "string" && onSupplierReturn && <Button size="xs" variant="outline" aria-label="Review supplier return" onClick={() => onSupplierReturn({ purchaseId: String(row.purchaseId), batchId: row.id })}>Supplier return</Button>}
  </div>;
  const identity = (row: ReportRow) => <div className="min-w-0"><strong className="text-xs font-medium text-text">{row.product}</strong>{tab !== "low" && <p className="mt-0.5 text-[11px] text-text-secondary">{row.batch} · Printed expiry {row.printedExpiry} · {row.status}</p>}{row.review && <p className="mt-1 text-[11px] text-warning-text">{row.review}</p>}</div>;
  const emptyMessage = page?.nextCursor ? "No matches on this source page. Continue to check the next page." : tab === "low" ? "No low-stock matches on this source page." : tab === "expired" ? "No expired batches on this source page." : `No expiring batches on this source page within ${days} days.`;
  return <section aria-label="Stock and expiry alerts" className="min-w-0">
    <Card padding="none" className="shadow-none" contentClassName="gap-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-3 md:px-4">
        <h2 className="text-sm font-semibold text-text md:text-base">Stock & expiry</h2>
        {toolbarActions && <div className="flex flex-wrap items-center gap-2">{toolbarActions}</div>}
      </header>
      <Tabs variant="underline" fullWidth activeTab={tab} onChange={value => { productRead(); setAdding(false); setActionError(""); setTab(value); }} scrollActiveIntoView={false} tabs={[
        { id: "low", label: "Low stock", badge: low?.key === lowKey ? low.page?.rows.length : undefined }, { id: "soon", label: "Expiring" }, { id: "expired", label: "Expired" },
      ]} />
      {!locationId ? <p className="p-4 text-xs text-text-secondary">Choose a location to review stock and expiry alerts.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-surface-alt px-3 py-2 md:px-4">
          <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[11px] text-text-secondary"><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{tab === "low" ? "Based on saleable units. Counts cover this source page; more matches may appear on later pages. Sorted by urgency." : "Based on captured lot cutoffs. Counts cover this source page; more batches may appear on later pages."}</span></p>
          {expiryEnabled && <div className="w-40 shrink-0"><Select aria-label="Expiry window" value={days} onChange={event => { productRead(); setAdding(false); setDays(event.target.value); setExpiryCursor(undefined); setActionError(""); }} options={[30, 60, 90].map(value => ({ value: String(value), label: `Next ${value} days` }))} /></div>}
        </div>
        {result?.error && <div className="p-3"><Alert variant="error" title={tab === "low" ? "Low-stock alerts unavailable" : "Expiry alerts unavailable"} action={<Button size="xs" onClick={() => setRetry(value => value + 1)}>Retry alerts</Button>}>{result.error}</Alert></div>}
        {actionError && <div className="p-3"><Alert variant="error" title="Product needs attention">{actionError}</Alert></div>}
        {!result?.error && <Table<ReportRow> caption={tab === "low" ? "Low-stock alerts" : "Expiry alerts"} variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={false} mobileLayout="list" data={rows} loading={!result} emptyMessage={emptyMessage}
          columns={[
            { key: "product", header: "Medicine", render: identity },
            ...(tab === "low" ? [
              { key: "eligible", header: "Saleable", align: "right" as const, render: (row: ReportRow) => <span className={row.eligible === 0 ? "font-semibold text-error-text" : "tabular-nums"}>{row.eligible ?? "Unknown"}</span> },
              { key: "units", header: "Physical", render: (row: ReportRow) => <span>{row.units} {row.unit}</span> },
              { key: "reorder", header: "Reorder at", align: "right" as const },
              { key: "ratio", header: "Saleable vs reorder", render: (row: ReportRow) => <StockProgress row={row} /> },
            ] : [{ key: "units", header: "Physical", render: (row: ReportRow) => <span>{row.units} {row.unit}</span> }]),
            { key: "status", header: "Status", render: row => <AlertStatus row={row} tab={tab} /> },
            { key: "actions", header: "", align: "right", render: actions },
          ]}
          renderMobileCard={row => <article className="space-y-2.5 px-3 py-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1">{identity(row)}</div><div className="max-w-[45%]"><AlertStatus row={row} tab={tab} /></div></div>
            {tab === "low" ? <><p className="text-[11px] text-text-secondary">Eligible {row.eligible ?? "unknown"} · Physical {row.units} {row.unit} · Reorder at {row.reorder} base units</p><StockProgress row={row} /></> : <p className="text-[11px] text-text-secondary">Physical {row.units} {row.unit}</p>}
            {actions(row)}
          </article>} />}
        {page && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-surface-alt px-3 py-2 text-[11px] text-text-secondary md:px-4">
          <span>{rows.length} {tab === "low" ? "low-stock alerts" : "batches"} on this source page</span>
          {(lowCursor && tab === "low" || expiryCursor && tab !== "low" || page.nextCursor) && <div className="flex items-center gap-2"><Button size="xs" variant="outline" onClick={() => { productRead(); setAdding(false); setActionError(""); if (tab === "low") setLowCursor(undefined); else setExpiryCursor(undefined); setRetry(value => value + 1); }}>First alert page</Button>{page.nextCursor && <Button size="xs" onClick={() => { productRead(); setAdding(false); setActionError(""); if (tab === "low") setLowCursor(page.nextCursor!); else setExpiryCursor(page.nextCursor!); }}>Next {tab === "low" ? "low-stock" : "expiry"} page</Button>}</div>}
        </footer>}
      </>}
    </Card>
  </section>;
}
