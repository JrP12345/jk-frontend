"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Skeleton } from "@/components/ui";
import { RotateCw } from "lucide-react";
import { useLatestRead } from "@/hooks/useLatestRead";
import { money } from "./pharmacyWorkspace";
import { readCounterOverview, type CounterOverview } from "@/lib/pharmacyCounterOverview";
import pos from "./PharmacyCounter.module.css";
import type { CounterResult } from "@/lib/pharmacyCounter";

export function useCounterOverview(locationId: string, revision: string) {
  const [data, setData] = useState<CounterOverview | null>(null), [error, setError] = useState(false), [loading, setLoading] = useState(true);
  const begin = useLatestRead();
  const reload = useCallback(async () => {
    const request = begin(); setLoading(true); setError(false);
    try { const next = await readCounterOverview(locationId, request.signal); if (request.isCurrent()) setData(next); }
    catch { if (request.isCurrent()) setError(true); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [begin, locationId]);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload, revision]);
  return { data, error, loading, reload };
}
type OverviewState = ReturnType<typeof useCounterOverview>;
const amount = (paise: number) => money(paise / 100);

export function PharmacyCounterOverview({ state, held }: { state: OverviewState; held: number }) {
  const { data, loading, error, reload } = state;
  const values = [
    { label: "Today's sales", value: data ? amount(data.salesPaise) : "—", help: data ? `Original branch bills issued on ${data.date} (${data.timezone}). Excludes opening balances and cancelled bills; returns and collections are separate.` : "Original branch bills issued today" },
    { label: "Bills today", value: data ? String(data.bills) : "—" },
    { label: "Cash in your drawer", value: data?.drawer ? data.drawer.active ? amount(data.drawer.cashPaise!) : "Drawer closed" : data ? "Access required" : "—", help: "Expected cash in your active drawer, including its opening float and recorded movements." },
    { label: "Active / held bills", value: `1 / ${held}`, help: "One active bill and the bills held on this device." },
    { label: "Stock alerts", value: data?.stock ? `${data.stock.low} low · ${data.stock.expiring} expiring · ${data.stock.expired} expired` : data ? "Stock access required" : "—", help: "Low: products at or below their physical reorder level. Expiring: positive on-hand lots within 90 days. Expired: positive on-hand lots past their expiry cutoff. Final saleable stock is checked at billing." },
  ];
  return <section className={pos.overview} aria-label="Counter summary" aria-busy={loading} data-stale={error || undefined}>
    {values.map((tile, index) => <div key={tile.label} className={pos.stat} title={tile.help}><span>{tile.label}</span>{loading && !data && index !== 3 ? <Skeleton className="h-5 w-20" /> : <strong>{tile.value}</strong>}</div>)}
    <Button size="sm" variant="ghost" className={pos.summaryRefresh} disabled={loading} onClick={() => { void reload(); }} aria-label={error ? "Retry counter summary" : "Refresh counter summary"} title={error ? data ? "Summary could not be refreshed; showing the last snapshot" : "Summary unavailable. Retry." : "Refresh summary"}><RotateCw size={14} aria-hidden="true" /></Button>
    {error && <span role="status" className="sr-only">{data ? "Summary could not be refreshed; showing the last snapshot." : "Counter summary unavailable. Use Retry counter summary."}</span>}
  </section>;
}

export function PharmacyCounterRecentBills({ state, onOpen, latest, onHistory }: { state: OverviewState; onOpen: (id: string) => void; latest?: CounterResult | null; onHistory?: () => void }) {
  const { data, error, loading, reload } = state;
  const recent = [...(latest ? [{ id: latest.invoiceId, invoiceNumber: latest.invoiceNumber, totalPaise: latest.totalPaise, status: latest.status }] : []), ...(data?.recent || []).filter(bill => bill.id !== latest?.invoiceId)].slice(0, 5);
  return <section className={pos.recentBills} aria-label="Recent bills today">
    <h3>Recent bills {onHistory && <Button size="xs" variant="ghost" onClick={onHistory} aria-label="View bill history">History →</Button>}</h3>
    {error && <div className="flex flex-wrap items-center justify-between gap-2"><p role="status">{data ? "Recent bills could not be refreshed; showing the last snapshot." : "Recent bills unavailable."}</p><Button size="sm" variant="ghost" loading={loading} onClick={() => { void reload(); }}>Retry recent bills</Button></div>}
    {recent.length ? <div className={pos.recentList}>{recent.map(bill => <Button size="sm" variant="ghost" key={bill.id} onClick={() => onOpen(bill.id)} aria-label={bill.id === latest?.invoiceId ? "View last saved bill" : `View recent bill ${bill.invoiceNumber}`} title={`${bill.invoiceNumber} · ${bill.status.replaceAll("_", " ")}`}><span className={pos.recentBody}><span>{bill.invoiceNumber}</span><span>({amount(bill.totalPaise)})</span></span></Button>)}</div> : loading && !data ? <Skeleton className="h-4 w-52" /> : !error && <p>No bills issued at this branch today.</p>}
  </section>;
}
