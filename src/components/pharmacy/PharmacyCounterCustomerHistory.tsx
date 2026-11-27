"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, EmptyState, Modal, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { counterCustomerHistory, type CustomerSale } from "@/lib/pharmacyCollections";
import type { CounterCustomer } from "@/lib/pharmacyCounter";
import { PharmacyCollections } from "./PharmacyCollections";
import { money } from "./pharmacyWorkspace";

export function PharmacyCounterCustomerHistory({ customer, locationId, onClose }: { customer: CounterCustomer; locationId: string; onClose: () => void }) {
  const [items, setItems] = useState<CustomerSale[]>([]), [cursor, setCursor] = useState<string>(), [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [invoiceId, setInvoiceId] = useState<string | null>(null);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const read = beginRead(); setLoading(true); setError(""); setItems([]);
    try { const page = await counterCustomerHistory(customer.id, locationId, cursor, read.signal); if (read.isCurrent()) { setItems(page.items); setNext(page.nextCursor); } }
    catch (failure) { if (read.isCurrent()) setError(failure instanceof Error ? failure.message : "Customer history unavailable."); }
    finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, customer.id, locationId, cursor]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  if (invoiceId) return <PharmacyCollections locationId={locationId} canCollect={false} initialInvoiceId={invoiceId} focusOnly onInvoiceClose={() => setInvoiceId(null)} />;
  return <Modal open title="Customer history" description={customer.name} size="lg" onClose={onClose} footer={<><Button variant="outline" size="sm" onClick={onClose}>Close history</Button>{cursor && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(undefined)}>Latest bills</Button>}{next && <Button size="sm" variant="outline" disabled={loading} onClick={() => setCursor(next)}>Older bills</Button>}</>}>
    <p className="mb-4 text-sm text-text-secondary">Saved bills at this branch, newest first. Each bill shows its current remaining due.</p>
    {loading && <div role="status" className="flex items-center gap-2 py-2 text-xs text-text-secondary"><Spinner size="sm" /><span>Loading customer history...</span></div>}
    {error && <Alert variant="error" title="History unavailable">{error}<Button size="sm" onClick={() => { void load(); }}>Retry history</Button></Alert>}
    {!loading && !error && !items.length && <EmptyState title="No saved bills for this customer" description="Bills linked to this customer at this branch will appear here." />}
    <div className="divide-y divide-border">{items.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{row.invoiceNumber}</h3><p className="mt-1 text-xs text-text-secondary">{new Date(row.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p><p className="mt-1 text-xs text-text-secondary">{row.documentVersion === 3 ? "Opening balance" : "Bill"} {money(row.totalAmount)} · Received {money(row.amountPaid)} · Due {money(row.balanceDue)}</p></div>
      <div className="flex items-center gap-2"><Badge variant={row.balanceDue > 0 ? "warning" : "success"}>{row.status.replaceAll("_", " ")}</Badge><Button size="sm" variant="outline" onClick={() => setInvoiceId(row.id)} aria-label={`View bill ${row.invoiceNumber}`}>View bill</Button></div>
    </article>)}</div>
  </Modal>;
}
