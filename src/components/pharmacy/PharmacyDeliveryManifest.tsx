"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { deliveryManifestTemplate, parseDeliveryManifest } from "@/lib/pharmacyDeliveryManifest";
import type { PurchaseDeliveryLine } from "@/lib/pharmacyReceiving";
import { readPharmacyImportFile } from "@/lib/pharmacyImportFile";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
export function PharmacyDeliveryManifest({ purchase, disabled, onReading, onReview }: { purchase: PurchaseDraft; disabled: boolean; onReading: (reading: boolean) => void; onReview: (lines: PurchaseDeliveryLine[]) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const [rows, setRows] = useState<PurchaseDeliveryLine[] | null>(null), [error, setError] = useState(""), [reading, setReading] = useState(false), [confirmed, setConfirmed] = useState(false);
  const active = useRef(0), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current++; }; }, []);
  function template() {
    try { const url = URL.createObjectURL(new Blob([deliveryManifestTemplate(purchase)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a"); try { link.href = url; link.download = `purchase-delivery-${purchase.id}-r${purchase.revision}.csv`; document.body.appendChild(link); link.click(); } finally { link.remove(); URL.revokeObjectURL(url); } } catch (failure) { setError(failure instanceof Error ? failure.message : "Delivery template is unavailable."); }
  }
  async function read(file?: File) {
    if (!file || disabled || reading) return; const request = ++active.current; const current = () => alive.current && active.current === request && authScopeKey(useAuthStore.getState().user) === scope;
    setReading(true); onReading(true); setRows(null); setConfirmed(false); setError("");
    try { const text = await readPharmacyImportFile(file), result = parseDeliveryManifest(purchase, text); if (current()) setRows(result); }
    catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Delivery file could not be reviewed."); }
    finally { if (current()) { setReading(false); onReading(false); } }
  }
  return <section className="min-w-0 space-y-3 rounded-control border border-border p-3" aria-label="Bulk batch and expiry review"><h3 className="font-semibold">Bulk batch and expiry entry</h3><p>Download the saved invoice’s template, fill the actual batches and printed expiry, then review it here. Rows can be split for multiple batches or removed for partial deliveries. Quantities are base units.</p><Button size="sm" variant="outline" disabled={disabled || reading} onClick={template}>Download delivery template</Button><Input label="Reviewed delivery CSV or values-only Excel" type="file" accept=".csv,.xlsx" disabled={disabled || reading} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }} />
    {reading && <p role="status">Checking batches, expiry and source allowances…</p>}{error && <Alert variant="error" title="Delivery file needs review">{error}</Alert>}
    {rows && <><p>{rows.length} received lots checked against this saved invoice. This preview has not received stock.</p><details><summary>Review all imported lots</summary>{rows.map((row, index) => <p key={row.lineId}>{index + 1}. {purchase.lines.find(source => source.lineId === row.purchaseLineId)?.medicineSnapshot.name} · {row.billed} billed + {row.free} free · Batch {row.batch} · Printed expiry {row.expiry}</p>)}</details><Checkbox label="I checked the physical batches, expiry and billed/free quantities against this delivery" checked={confirmed} disabled={disabled || reading} onChange={event => setConfirmed(event.target.checked)} /><Button size="sm" variant="outline" disabled={!confirmed || disabled || reading} onClick={() => { onReview(rows); setRows(null); setConfirmed(false); }}>Use reviewed delivery lots</Button></>}
  </section>;
}
