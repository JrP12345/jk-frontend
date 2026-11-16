"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { createPharmacyBranchCatalogue, type CatalogueStatus } from "@/lib/pharmacyBranchCatalogue";
import { counterCataloguePage } from "@/lib/pharmacyCounter";
import type { createPharmacyCatalogue } from "@/lib/pharmacyCatalogue";

/** Independent of the checkout restore/Save path. Cancellation never commits a partial manifest. */
export function usePharmacyCatalogueSync(scope: string, locationId: string, catalogue: ReturnType<typeof createPharmacyCatalogue>, online: boolean) {
  const [branch] = useState(() => createPharmacyBranchCatalogue(scope, locationId));
  const [, setStatus] = useState<CatalogueStatus>(() => branch.status), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0);
  const alive = useRef(true), flight = useRef<AbortController | null>(null), ready = useRef(false);
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);
  const refresh = useCallback(async () => {
    if (!ready.current || !current() || flight.current || !online) return;
    const controller = new AbortController(); flight.current = controller; setBusy(true); setProgress(0);
    try { await branch.sync((query, signal) => counterCataloguePage(locationId, query, signal), controller.signal, count => { if (current()) setProgress(count); }); }
    catch { /* Lookup/Save remain usable; the status exposes refresh failure and prior completeness. */ }
    finally { if (flight.current === controller) flight.current = null; if (current()) { setStatus(branch.status); setBusy(false); } }
  }, [branch, locationId, current, online]);
  useEffect(() => {
    alive.current = true;
    void branch.load().then(() => { if (current()) { catalogue.attachBranch(branch); ready.current = true; setStatus(branch.status); setLoaded(true); } });
    return () => { alive.current = false; ready.current = false; flight.current?.abort(); };
  }, [branch, catalogue, current]);
  useEffect(() => {
    if (!loaded || !online) return;
    // Wait for initial counter work. Subsequent reconnects refresh old preparation only.
    const timer = setTimeout(() => { if (!branch.status.checkedAt || Date.now() - branch.status.checkedAt >= 5 * 60_000) void refresh(); }, 2000);
    return () => clearTimeout(timer);
  }, [loaded, online, branch, refresh]);
  return { status: branch.status, busy, progress, refresh };
}
