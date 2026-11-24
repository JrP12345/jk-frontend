"use client";

import { Alert, Button } from "@/components/ui";
import type { CounterAvailability } from "@/lib/pharmacyCounterAvailability";

export function PharmacyCounterAvailabilityNotice({ snapshot, error, checking, onRefresh }: { snapshot: CounterAvailability | null; error: string; checking: boolean; onRefresh: () => void }) {
  if (!error && (!snapshot || snapshot.mode === "cloud")) return null;
  return <Alert variant="warning" title={snapshot?.offline ? "Branch reserved for the designated offline PC" : "Check branch availability"}>
    {snapshot?.offline && <><p>{snapshot.offline.deviceName} holds this branch&apos;s stock and cash drawer. You can prepare carts here.</p>
      <p>{snapshot.mode === "offline_reconciliation" ? "Its billing authorization has expired. The original operator must stop, synchronize and reconcile the saved ledger before other counters resume. Expiry does not release stock." : snapshot.mode === "offline_preparing" ? "Preparation is in progress. The original operator must activate that counter or cancel unused preparation." : "Issue final bills on that PC. To resume cloud billing, the original operator must stop the local counter, synchronize its bills and release ownership."}</p>
      {snapshot.offline.currentOperator && <p>You are the prepared operator. Use the original browser profile on the designated PC to recover its session.</p>}</>}
    {error && <p>{error}</p>}
    <Button size="sm" variant="outline" disabled={checking} onClick={onRefresh}>Refresh counter availability</Button>
  </Alert>;
}
