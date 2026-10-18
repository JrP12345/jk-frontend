"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Badge, Button, Select, Spinner, Tabs } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { dateLabel, expired, lowStock, type Medicine } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

export interface ExpiringBatchItem {
  _id: string; id?: string;
  medicineId: { _id: string; id?: string; name: string; genericName: string };
  batchNumber: string; expiryDate: string; quantity: number; purchaseCost: number; sellingPrice: number;
  status: "active" | "expired" | "depleted";
}
interface PharmacyAlertsCenterProps {
  locationId: string; medicines: Medicine[]; onOpenAddBatch: (medicine: Medicine) => void;
  canManage: boolean; inventoryLoading: boolean; inventoryError: string | null; refreshKey: number;
}
export function PharmacyAlertsCenter({ locationId, medicines, onOpenAddBatch, canManage, inventoryLoading, inventoryError, refreshKey }: PharmacyAlertsCenterProps) {
  const [days, setDays] = useState("60");
  const [tab, setTab] = useState("low");
  const [batches, setBatches] = useState<ExpiringBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const beginRead = useLatestRead();
  const readKey = `${locationId}:${days}`;
  const refresh = useCallback(async () => {
    const request = beginRead();
    if (!locationId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await api.get(`/pharmacy/expiring?locationId=${encodeURIComponent(locationId)}&days=${days}`, { signal: request.signal });
      if (!Array.isArray(response.data?.data)) throw new Error("Incomplete expiry alerts");
      if (request.isCurrent()) { setBatches(response.data.data); setLoadedKey(`${locationId}:${days}`); }
    } catch { if (request.isCurrent()) setError("Expiry alerts could not be loaded. Please retry."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, locationId, days]);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);
  const visibleBatches = loadedKey === readKey ? batches : [];
  const low = medicines.filter(lowStock);
  const expiring = visibleBatches.filter(batch => !expired(batch.expiryDate));
  const past = visibleBatches.filter(batch => expired(batch.expiryDate));
  const available = loadedKey === readKey;
  const batchList = (items: ExpiringBatchItem[]) => !locationId ? <p className={styles.empty}>Choose a location to review batch expiry alerts.</p> : <div className={styles.list}>
    {error && <Alert variant="error" title="Expiry alerts unavailable" action={<Button size="sm" variant="outline" disabled={loading} onClick={refresh}>Retry alerts</Button>}>{error}</Alert>}
    {loading && !available ? <div role="status" className={styles.empty}><Spinner size="sm" /> Loading expiry alerts...</div> : !error && items.length === 0 ? <p className={styles.empty}>{tab === "expired" ? "No expired batches found." : `No batches expire within the next ${days} days.`}</p> : items.map(batch => {
      const medicine = medicines.find(item => item.id === (batch.medicineId?.id || batch.medicineId?._id));
      return <article className={styles.card} key={batch._id || batch.id}><div className={styles.rowHeading}><div className={styles.identity}><strong>{batch.medicineId?.name || "Medicine batch"}</strong><small>{batch.medicineId?.genericName}</small></div><Badge variant={expired(batch.expiryDate) ? "error" : "warning"}>{expired(batch.expiryDate) ? "Expired" : "Expiring"}</Badge></div><dl className={styles.cardFacts}><div><dt>Batch</dt><dd>{batch.batchNumber}</dd></div><div><dt>Expiry</dt><dd>{dateLabel(batch.expiryDate)}</dd></div><div><dt>Remaining</dt><dd>{batch.quantity} units</dd></div></dl>{canManage && medicine && <Button size="sm" variant="outline" onClick={() => onOpenAddBatch(medicine)}>Add fresh batch</Button>}</article>;
    })}
  </div>;
  return <section className={styles.list} aria-label="Stock and expiry alerts">
    <header className={styles.alertHeader}><h2>Stock & expiry</h2>{tab !== "low" && locationId && <Select aria-label="Expiry window" value={days} onChange={event => setDays(event.target.value)} options={[{ value: "30", label: "Next 30 days" }, { value: "60", label: "Next 60 days" }, { value: "90", label: "Next 90 days" }]} />}</header>
    <Tabs className={styles.alertTabs} variant="pills" activeTab={tab} onChange={setTab} scrollActiveIntoView={false} tabs={[
      { id: "low", label: "Low stock", badge: inventoryLoading || inventoryError ? undefined : low.length, content: inventoryError ? <Alert variant="error" title="Inventory unavailable">Refresh pharmacy to check stock levels.</Alert> : inventoryLoading ? <div role="status" className={styles.empty}><Spinner size="sm" /> Loading stock...</div> : low.length === 0 ? <p className={styles.empty}>All medicines are above their reorder level.</p> : <div className={styles.list}>{low.map(medicine => <article key={medicine.id} className={styles.card}><div className={styles.rowHeading}><div className={styles.identity}><strong>{medicine.name}</strong><small>{medicine.genericName}</small></div><Badge variant="warning">{medicine.stockQuantity} left</Badge></div><p className={styles.meta}>Reorder at {medicine.reorderLevel ?? 20} units</p>{canManage && <Button size="sm" variant="outline" onClick={() => onOpenAddBatch(medicine)}>Add batch</Button>}</article>)}</div> },
      { id: "soon", label: "Expiring", badge: available ? expiring.length : undefined, content: batchList(expiring) },
      { id: "expired", label: "Expired", badge: available ? past.length : undefined, content: batchList(past) },
    ]} />
  </section>;
}
