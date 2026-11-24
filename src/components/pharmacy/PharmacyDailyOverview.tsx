"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, DatePicker, Skeleton } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { dailyDate, dailySourceReports, readDailyOverview, type DailySection, type DailySectionKey, type PharmacyDailyOverviewData } from "@/lib/pharmacyDailyOverview";
import type { PharmacyReportKind } from "@/lib/pharmacyReports";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyDailyOverview.module.css";

interface Props { locationId: string; onReport: (kind: PharmacyReportKind, date: string) => void; onStock: () => void; onDrawer: () => void; canViewStock: boolean; canViewDrawer: boolean }
export function PharmacyDailyOverview(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <DailySession key={`${scope}:${props.locationId}`} {...props} />;
}
function DailySession({ locationId, onReport, onStock, onDrawer, canViewStock, canViewDrawer }: Props) {
  const [data, setData] = useState<PharmacyDailyOverviewData | null>(null), [date, setDate] = useState(""), [applied, setApplied] = useState(""), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const begin = useLatestRead();
  useEffect(() => {
    const request = begin();
    void readDailyOverview(locationId, applied, request.signal).then(value => { if (request.isCurrent()) { setData(value); setError(""); } }).catch(failure => { if (request.isCurrent()) { if ([401, 403, 404].includes((failure as { response?: { status?: number } })?.response?.status || 0)) setData(null); setError(failure instanceof Error ? failure.message : "Daily overview could not refresh."); } }).finally(() => { if (request.isCurrent()) setBusy(false); });
  }, [locationId, applied, attempt, begin]);
  function load(next: string) {
    if (next && !dailyDate(next)) { setError("Choose a valid business day."); return; }
    begin(); if (next !== applied) setData(null); setError(""); setBusy(true); setApplied(next); setAttempt(value => value + 1);
  }
  const amount = (section: DailySection | undefined, key: string) => section?.state !== "ready" ? section?.state === "restricted" ? "Access required" : section?.state === "not_tracked" ? "Not tracked" : "Unavailable" : section.values?.[key] === null ? "Unknown" : money(section.values![key]! / 100);
  const count = (section: DailySection | undefined, key: string) => section?.state !== "ready" ? section?.state === "restricted" ? "Access required" : section?.state === "not_tracked" ? "Not tracked" : "Unavailable" : section.values?.[key] === null ? "Unknown" : String(section.values![key]);
  function card(key: DailySectionKey, title: string, value: string, children?: ReactNode) {
    const section = data?.sections[key];
    return <article className={styles.card} data-unavailable={section?.state !== "ready" || undefined} aria-label={title}>
      <h3>{title}</h3>{!data && busy ? <Skeleton className="h-8 w-32" /> : <strong className={styles.amount}>{value}</strong>}
      {children}
      {section && <details><summary>Details and source</summary><p>{section.note}</p>{data && section.state === "ready" && <Button size="sm" variant="ghost" onClick={() => onReport(dailySourceReports[key], data.date)}>Review {title.toLowerCase()} source</Button>}</details>}
    </article>;
  }
  const s = data?.sections;
  return <section className={styles.overview} aria-label="Pharmacy daily overview" aria-busy={busy}>
    <header className={styles.header}><div><h2>Daily overview</h2><p className={styles.muted}>Sales, money received and credit answer different questions.</p></div>{canViewDrawer && <Button size="sm" variant="outline" onClick={onDrawer}>Review cash drawer</Button>}</header>
    <form className={styles.controls} onSubmit={event => { event.preventDefault(); load(date); }}><DatePicker label="Overview business day" value={date} onChange={setDate} /><Button size="sm" type="submit" disabled={busy}>Load day</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { setDate(""); load(""); }}>Today</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => load(applied)}>Refresh overview</Button></form>
    {error && <Alert variant="error" title="Overview needs attention">{error}{data && <p>Showing the last successful snapshot below; these figures have not refreshed.</p>}</Alert>}
    {data && <p className={styles.muted}>Business day {data.date} ({data.timezone}). Snapshot {new Date(data.asOf).toLocaleString("en-IN", { timeZone: data.timezone })}. Current dues and stock are as of this snapshot, including when viewing an earlier day.</p>}
    {data && ["active", "expired"].includes(data.coverage.offlineSession) && <Alert variant="warning" title="Local counter still needs reconciliation">These are cloud records. The local session is still open; any unsynchronized bills are excluded. Complete totals require synchronizing and reconciling the original ledger.{data.coverage.offlineSession === "expired" && <p>Local billing authority has expired. Expiry does not release branch ownership.</p>}</Alert>}
    {data?.coverage.offlineSession === "preparing" && <Alert variant="info" title="Offline preparation in progress">The designated PC holds the branch while preparation is reviewed.</Alert>}
    {data && data.paymentReview !== null && data.paymentReview > 0 && <Alert variant="warning" title="Online payments need review">{data.paymentReview} payment checks need reconciliation. Pending captures are not added to confirmed collections until posted.</Alert>}
    <div className={styles.grid}>
      {card("sales", "Sales issued", amount(s?.sales, "grossSalesPaise"), <p className={styles.muted}>{count(s?.sales, "bills")} bills. Includes GST.</p>)}
      {card("collections", "Cash collected", amount(s?.collections, "cashPaise"), <p className={styles.muted}>After change; includes older dues.</p>)}
      {card("collections", "UPI collected", amount(s?.collections, "upiPaise"))}
      {card("newCredit", "Customer credit created", amount(s?.newCredit, "amountPaise"), <p className={styles.muted}>Captured at issue, before later collections.</p>)}
      {card("margin", "Gross contribution", amount(s?.margin, "contributionPaise"), <p className={styles.muted}>From this day&apos;s bills. Excludes overheads; not net profit.</p>)}
      {card("stock", "Low physical stock", count(s?.stock, "lowPhysicalProducts"), <><p className={styles.muted}>Review expiry, holds and saleable availability.</p>{canViewStock && <Button size="sm" variant="outline" onClick={onStock}>Review stock &amp; expiry</Button>}</>)}
    </div>
    <details className={styles.more}><summary>Dues, card payments, returns and expiry</summary><div className={styles.grid}>
      {card("collections", "Card collected", amount(s?.collections, "cardPaise"))}
      {card("returns", "Return credits issued", amount(s?.returns, "creditsPaise"), <p className={styles.muted}>Includes credits for older bills; not cash paid out.</p>)}
      {card("cashMovements", "Other cash out", amount(s?.cashMovements, "cashOutPaise"), <><p className={styles.muted}>Cash refunds, supplier payments and cash out. Opening float is separate.</p><p className={styles.row}><span>Other cash in</span><strong>{amount(s?.cashMovements, "cashInPaise")}</strong></p><p className={styles.row}><span>Customer refunds, all methods</span><strong>{amount(s?.cashMovements, "refundsPaise")}</strong></p></>)}
      {card("customerDues", "Customer dues now", amount(s?.customerDues, "duePaise"), <p className={styles.muted}>All issue dates, including opening dues.</p>)}
      {card("supplierDues", "Supplier dues now", amount(s?.supplierDues, "duePaise"), <p className={styles.row}><span>Claims awaiting credit</span><strong>{amount(s?.supplierDues, "pendingCreditPaise")}</strong></p>)}
      {card("stock", "Lots expiring in 60 days", count(s?.stock, "expiringLots"), <p className={styles.row}><span>Already expired lots</span><strong>{count(s?.stock, "expiredLots")}</strong></p>)}
    </div>{s?.stock.items.length ? <section className={styles.shortlist} aria-label="First five low-stock products"><h3>First five low-stock products</h3>{s.stock.items.map(item => <p className={styles.row} key={item.id}><span>{item.label}</span><strong>{item.units} {item.unit}</strong></p>)}</section> : null}</details>
    <p className={styles.muted}>Unavailable sections need source review or a larger report export. Access-required sections remain hidden by permission. No unknown amount is treated as zero.</p>
  </section>;
}
