"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readCounterAvailability, type CounterAvailability } from "@/lib/pharmacyCounterAvailability";

/** Small advisory read. Final posting always rechecks transactional ownership.
 * Preserve a known hold on failed refresh; a failed read never releases a branch.
 */
export function usePharmacyCounterAvailability(locationId: string) {
  const [snapshot, setSnapshot] = useState<CounterAvailability | null>(null), [error, setError] = useState(""), [checking, setChecking] = useState(false);
  const alive = useRef(false), flight = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!alive.current || flight.current) return;
    const controller = new AbortController(); flight.current = controller; setChecking(true);
    try { const value = await readCounterAvailability(locationId, controller.signal); if (alive.current && !controller.signal.aborted) { setSnapshot(value); setError(""); } }
    catch { if (alive.current && !controller.signal.aborted) setError("Branch availability could not refresh. The server will check ownership when saving; keep the original reference if a save is uncertain."); }
    finally { if (flight.current === controller) flight.current = null; if (alive.current && !controller.signal.aborted) setChecking(false); }
  }, [locationId]);
  useEffect(() => {
    alive.current = true; let active = true;
    // Start after effect setup so Strict Mode's discarded setup does not issue a read.
    void Promise.resolve().then(() => { if (active) void refresh(); });
    const foreground = () => { if (document.visibilityState !== "hidden") void refresh(); };
    const timer = setInterval(foreground, 60_000);
    window.addEventListener("focus", foreground); window.addEventListener("online", foreground); document.addEventListener("visibilitychange", foreground);
    return () => { active = false; alive.current = false; flight.current?.abort(); flight.current = null; clearInterval(timer); window.removeEventListener("focus", foreground); window.removeEventListener("online", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, [refresh]);
  const scopedSnapshot = snapshot?.locationId === locationId ? snapshot : null;
  return { snapshot: scopedSnapshot, blocked: Boolean(scopedSnapshot && scopedSnapshot.mode !== "cloud"), error, checking, refresh };
}
