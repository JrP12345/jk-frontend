"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import api from "@/lib/api";
import type { CounterProduct } from "@/lib/pharmacyCounter";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
type Product = CounterProduct & { dosageForm: string };
type Comparison = { locationId: string; source: Product; items: Product[]; nextCursor: string | null; basis: string };
export function PharmacyAlternatives({ medicineId, locationId, onClose }: { medicineId: string; locationId: string; onClose: () => void }) {
  const begin = useLatestRead(), [page, setPage] = useState<Comparison | null>(null), [cursor, setCursor] = useState<string | undefined>(), [error, setError] = useState(""), [busy, setBusy] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    const request = begin(); setBusy(true); setPage(null); setError("");
    void api.get(`/pharmacy/medicines/${medicineId}/alternatives`, { params: { locationId, cursor }, signal: request.signal }).then(response => {
      const result = response.data?.data as Comparison;
      if (!result || result.locationId !== locationId || result.source?.id !== medicineId || !Array.isArray(result.items) || result.items.length > 25 || typeof result.basis !== "string" || result.nextCursor !== null && !/^[a-f\d]{24}$/i.test(result.nextCursor) || result.items.some(row => !row.id || !row.name || !row.genericName || !row.strength || !row.dosageForm || !Number.isSafeInteger(row.stockQuantity))) throw Error("Comparison could not be confirmed");
      if (request.isCurrent()) setPage(result);
    }).catch(failure => { if (request.isCurrent()) setError(failure?.response?.data?.message || failure.message || "Comparison is unavailable"); }).finally(() => { if (request.isCurrent()) setBusy(false); });
  }, [begin, medicineId, locationId, cursor, retry]);
  return <Modal open title="Compare medicine brands" size="lg" onClose={onClose}><section className={styles.list} aria-label="Medicine comparison">
    {busy && <div role="status" className="flex items-center gap-2 py-2 text-xs text-text-secondary"><Spinner size="sm" /><span>Checking matching medicines...</span></div>}{error && <Alert variant="error" title="Comparison unavailable" action={<Button size="sm" onClick={() => setRetry(value => value + 1)}>Retry comparison</Button>}>{error}</Alert>}
    {page && <><h3>{page.source.name} · {page.source.genericName} · {page.source.strength} · {page.source.dosageForm}</h3><p>{page.basis}</p>{!page.items.length && <p>No exact matches on this candidate page.</p>}{page.items.map(product => <article className={styles.card} key={product.id}><strong>{product.name}</strong><p>{product.manufacturer || "Manufacturer not recorded"} · {product.strength} · {product.dosageForm}</p><p>{product.retailPricePaise === undefined ? "Price checked at billing" : `${money(product.retailPricePaise / 100)} per ${product.unitDefinition?.baseUnit}`} · Recorded stock {product.stockQuantity} · {product.rackLocation ? `Rack ${product.rackLocation}` : "Rack not recorded"}</p>{product.saleBlocked && <p>Sale hold: {product.saleBlockReason}</p>}</article>)}<div className={styles.actions}>{cursor && <Button size="sm" variant="outline" onClick={() => setCursor(undefined)}>First comparison page</Button>}{page.nextCursor && <Button size="sm" onClick={() => setCursor(page.nextCursor!)}>Next comparison page</Button>}</div></>}
  </section></Modal>;
}
