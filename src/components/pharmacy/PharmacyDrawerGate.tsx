"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { activeDrawer, type CashierDrawer } from "@/lib/pharmacyTill";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
/** Advisory preflight; the transaction always rechecks ownership and active status. */
export function PharmacyDrawerGate({ locationId, onReady }: { locationId: string; onReady: (ready: boolean) => void }) {
  const [drawer, setDrawer] = useState<CashierDrawer | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setBusy(true); setError(""); onReady(false);
    try { const next = await activeDrawer(locationId, request.signal); if (request.isCurrent()) { setDrawer(next); onReady(Boolean(next)); } }
    catch (failure) { if (request.isCurrent()) { setDrawer(null); setError(pharmacyFinanceMessage(failure)); } }
    finally { if (request.isCurrent()) setBusy(false); }
  }, [beginRead, locationId, onReady]);
  useEffect(() => { void load(); }, [load]);
  return <Alert variant={drawer ? "info" : "warning"} title={drawer ? `Drawer ${drawer.drawerCode} open` : "Open drawer required"}>
    <p>{drawer ? `Collections and payouts will be assigned to ${drawer.cashierName}'s drawer. Recheck after changing or closing a drawer.` : "Open your physical drawer in Cash drawer before receiving or paying money, then recheck here."}</p>
    {error && <p>{error}</p>}<Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>{busy ? "Checking drawer..." : "Recheck open drawer"}</Button>
  </Alert>;
}
