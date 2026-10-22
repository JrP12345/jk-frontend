"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Select, Spinner, Tabs } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { readStockAlert, reportError, type PharmacyReportPage, type ReportRow } from "@/lib/pharmacyReports";
import { readMedicinePage, type Medicine } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
interface Props { locationId: string; medicines: Medicine[]; onOpenAddBatch: (medicine: Medicine) => void; canManage: boolean; refreshKey: number }
type Result = { key: string; page?: PharmacyReportPage; error?: string };
export function PharmacyAlertsCenter(props: Props) { const scope = authScopeKey(useAuthStore(state => state.user)); return <AlertSession key={`${scope}:${props.locationId}`} {...props} />; }
function AlertSession({ locationId, medicines, onOpenAddBatch, canManage, refreshKey }: Props) {
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
  const rows = page?.rows.filter(row => tab === "low" || row.review || (tab === "expired" ? expired(row) : !expired(row))) || [];
  async function restock(row: ReportRow) {
    if (!canManage || adding || row.review) return; const request = productRead(); setAdding(true); setActionError("");
    try {
      const medicineId = String(tab === "low" ? row.id : row.medicineId), present = medicines.find(medicine => medicine.id === medicineId);
      const target = present || (await readMedicinePage(locationId, request.signal, { medicineIds: [medicineId] })).items.find(medicine => medicine.id === medicineId);
      if (!target || target.locationId !== locationId) throw new Error("Current product could not be checked for this branch"); if (request.isCurrent()) onOpenAddBatch(target);
    } catch (failure) { const error = await reportError(failure); if (request.isCurrent()) setActionError(error); }
    finally { if (request.isCurrent()) setAdding(false); }
  }
  const content = !locationId ? <p className={styles.empty}>Choose a location to review stock and expiry alerts.</p> : <div className={styles.list}>
    <p>Alerts use eligible saleable units and captured lot cutoffs. Counts describe this source page; more matches may appear on later pages.</p>
    {result?.error && <Alert variant="error" title={tab === "low" ? "Low-stock alerts unavailable" : "Expiry alerts unavailable"} action={<Button size="sm" onClick={() => setRetry(value => value + 1)}>Retry alerts</Button>}>{result.error}</Alert>}
    {!result && <div role="status"><Spinner size="sm" /> Loading stock alerts...</div>}
    {actionError && <Alert variant="error" title="Product needs attention">{actionError}</Alert>}
    {rows.map(row => <article className={styles.card} key={row.id}><div className={styles.cardTop}><div><strong>{String(row.product)}</strong>{tab === "low" ? <p>Eligible {row.eligible === null ? "unknown" : row.eligible} · Physical {row.units} {row.unit} · Reorder at {row.reorder} base units</p> : <p>{row.batch} · Printed expiry {row.printedExpiry} · {row.units} {row.unit} · {row.status}</p>}</div>{row.review ? <Badge variant="warning">Needs review</Badge> : <Badge variant={tab === "expired" ? "danger" : "warning"}>{tab === "low" ? "Low saleable stock" : tab === "expired" ? "Expired" : "Expiring"}</Badge>}</div>{row.review && <p>{row.review}</p>}{canManage && !row.review && <Button size="sm" variant="outline" disabled={adding} onClick={() => { void restock(row); }}>{tab === "low" ? "Add batch" : "Add fresh batch"}</Button>}</article>)}
    {page && !rows.length && <p className={styles.empty}>{page.nextCursor ? "No matches on this source page. Continue to check the next page." : tab === "low" ? "No low-stock matches on this source page." : tab === "expired" ? "No expired batches on this source page." : `No expiring batches on this source page within ${days} days.`}</p>}
    {page && <div className={styles.actions}><Button size="sm" variant="outline" onClick={() => { setActionError(""); if (tab === "low") setLowCursor(undefined); else setExpiryCursor(undefined); setRetry(value => value + 1); }}>First alert page</Button>{page.nextCursor && <Button size="sm" onClick={() => { setActionError(""); if (tab === "low") setLowCursor(page.nextCursor!); else setExpiryCursor(page.nextCursor!); }}>Next {tab === "low" ? "low-stock" : "expiry"} page</Button>}</div>}
  </div>;
  return <section className={styles.list} aria-label="Stock and expiry alerts"><header className={styles.alertHeader}><h2>Stock & expiry</h2>{expiryEnabled && locationId && <Select aria-label="Expiry window" value={days} onChange={event => { setDays(event.target.value); setExpiryCursor(undefined); setActionError(""); }} options={[30, 60, 90].map(value => ({ value: String(value), label: `Next ${value} days` }))} />}</header><Tabs className={styles.alertTabs} variant="pills" activeTab={tab} onChange={value => { productRead(); setAdding(false); setActionError(""); setTab(value); }} scrollActiveIntoView={false} tabs={[
    { id: "low", label: "Low stock", badge: low?.key === lowKey ? low.page?.rows.length : undefined, content }, { id: "soon", label: "Expiring", content }, { id: "expired", label: "Expired", content },
  ]} /></section>;
}
