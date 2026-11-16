"use client";
import { useEffect, useRef } from "react";

/** Retry reads after a real request failure; never replays a financial mutation. */
export function usePharmacyReconnect(enabled: boolean, retry: () => Promise<void>) {
  const action = useRef(retry);
  useEffect(() => { action.current = retry; });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, running = false, delay = 5000, timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); if (!stopped) timer = setTimeout(() => { void run(); }, delay); };
    const run = async () => {
      if (stopped || running) return;
      if (document.visibilityState === "hidden") { schedule(); return; }
      clearTimeout(timer); running = true;
      try { await action.current(); } catch { /* The caller owns error presentation; keep the read retry bounded. */ } finally { running = false; delay = Math.min(delay * 2, 60000); schedule(); }
    };
    const foreground = () => { if (document.visibilityState !== "hidden") void run(); };
    window.addEventListener("online", foreground); window.addEventListener("focus", foreground); document.addEventListener("visibilitychange", foreground); schedule();
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener("online", foreground); window.removeEventListener("focus", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, [enabled]);
}

export function pharmacyConnectionFailure(failure: unknown) {
  const e = failure as { response?: { status?: number }; code?: string; name?: string; message?: string };
  return e?.name !== "CanceledError" && e?.name !== "AbortError" && ((e?.response?.status || 0) >= 500 || !e?.response && (/ERR_NETWORK|ECONN|ETIMEDOUT/.test(e?.code || "") || /network|timeout|connection|offline|unavailable|failed to fetch/i.test(e?.message || "")));
}
