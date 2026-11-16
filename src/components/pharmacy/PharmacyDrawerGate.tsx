"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { Wallet, RotateCw } from "lucide-react";
import { useLatestRead } from "@/hooks/useLatestRead";
import { activeDrawer, type CashierDrawer } from "@/lib/pharmacyTill";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyTill } from "./PharmacyTill";
/** Advisory preflight; the transaction always rechecks ownership and active status. */
export function PharmacyDrawerGate({ locationId, onReady, canOpen = false, compact = false, quietReady = false }: { locationId: string; onReady: (ready: boolean) => void; canOpen?: boolean; compact?: boolean; quietReady?: boolean }) {
  const [opening, setOpening] = useState(false);
  const [drawer, setDrawer] = useState<CashierDrawer | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [checked, setChecked] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setBusy(true); setError(""); onReady(false);
    try { const next = await activeDrawer(locationId, request.signal); if (request.isCurrent()) { setDrawer(next); onReady(Boolean(next)); } }
    catch (failure) { if (request.isCurrent()) { setDrawer(null); setError(pharmacyFinanceMessage(failure)); } }
    finally { if (request.isCurrent()) { setBusy(false); setChecked(true); } }
  }, [beginRead, locationId, onReady]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  if (!checked) return quietReady ? null : <p role="status" className="text-sm text-text-secondary">Checking payment drawer...</p>;
  if (quietReady && drawer && !error) return null;
  if (compact && drawer && !error) return <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"><div className="flex min-w-0 items-center gap-2"><Wallet size={16} className="shrink-0 text-accent" aria-hidden="true" /><p className="break-words text-xs text-text-secondary">Drawer {drawer.drawerCode} open</p></div><Button size="sm" variant="ghost" aria-label="Recheck open drawer" disabled={busy} onClick={() => { void load(); }}><RotateCw size={16} aria-hidden="true" /></Button></div>;
  if (drawer && !error) return <Card padding="sm" variant="flat" contentClassName="gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-1 items-start gap-3"><Wallet size={18} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">Drawer {drawer.drawerCode} open</p><p className="mt-1 text-xs leading-relaxed text-text-secondary">Payments and payouts are assigned to {drawer.cashierName}'s drawer.</p></div></div>
    <div className="shrink-0"><Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>{busy ? "Checking drawer..." : "Recheck open drawer"}</Button></div>
  </Card>;
  return <><Alert variant={error ? "error" : "warning"} title={error ? "Payment drawer could not be checked" : "Open your cash drawer first"}>
    <p>{error || (canOpen ? "Count the cash already in your drawer before recording payments." : "Ask your administrator for drawer access, or open your drawer from Cash drawer and recheck here.")}</p>
    <div className="mt-3 flex flex-wrap gap-2">{canOpen && <Button size="sm" disabled={busy} onClick={() => setOpening(true)}>Open drawer</Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>{busy ? "Checking drawer..." : "Recheck open drawer"}</Button></div>
  </Alert>{opening && canOpen && <Modal open title="Cash drawer" size="md" onClose={() => { setOpening(false); void load(); }}><PharmacyTill compact locationId={locationId} canOpen={canOpen} canClose={false} canMove={false} /></Modal>}</>;
}
