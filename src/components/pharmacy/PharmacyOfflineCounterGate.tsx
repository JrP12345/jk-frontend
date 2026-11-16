"use client";

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import { readOfflineSession, type OfflineSessionControl } from "@/lib/pharmacyOfflineSession";
import { PharmacyCounterSkeleton } from "./PharmacyCounterSkeleton";

const PreparedCounter = lazy(() => import("./PharmacyPreparedCounter").then(module => ({ default: module.PharmacyPreparedCounter })));
const CheckoutSettings = lazy(() => import("./PharmacyOfflineCheckoutSettings").then(module => ({ default: module.PharmacyOfflineCheckoutSettings })));
const noBusy = () => {};
export function PharmacyOfflineCounterGate({ organizationId, locationId, actorId, canIssue, children }: { organizationId?: string; locationId: string; actorId?: string; canIssue: boolean; children: ReactNode }) {
  const [control, setControl] = useState<OfflineSessionControl | null>(null), [ready, setReady] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const read = () => {
      if (!organizationId || typeof indexedDB === "undefined") { setReady(true); return; }
      void readOfflineSession({ organizationId, locationId }).then(value => { if (active) { setControl(value); setError(""); } }).catch(failure => { if (active) setError((failure as Error).message); }).finally(() => { if (active) setReady(true); });
    };
    read(); window.addEventListener("pharmacy-offline-session", read);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ekavyu-pharmacy-offline-session");
    if (channel) channel.onmessage = read;
    return () => { active = false; window.removeEventListener("pharmacy-offline-session", read); channel?.close(); };
  }, [organizationId, locationId]);
  if (!organizationId || !actorId) return children;
  if (!ready) return <PharmacyCounterSkeleton label="Opening pharmacy counter" />;
  if (error) return <Alert variant="error" title="Saved offline setup needs recovery">{error}</Alert>;
  if (!control || control.phase === "closed") return children;
  if (control.actorId !== actorId) return <Alert variant="warning" title="This PC has another operator's prepared session">The original prepared operator must sign in to recover, synchronize or stop this cash counter. Issued bills remain on this PC.</Alert>;
  return <Suspense fallback={<PharmacyCounterSkeleton label="Opening prepared counter" />}>
    {["active", "stopped"].includes(control.phase) ? <PreparedCounter key={control.authorityId} control={control} actorId={actorId} canIssue={canIssue} />
      : <CheckoutSettings key={control.authorityId} organizationId={organizationId} locationId={locationId} onBusyChange={noBusy} />}
  </Suspense>;
}
