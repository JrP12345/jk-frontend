type PharmacyStep = "checkout" | "draft_write" | "intent_write" | "save_request" | "print_handoff";

const serverPhases = new Set(["save", "authority", "readiness", "command", "prepare", "stock", "documents", "payment", "finalize"]);
/** Only known phase names and durations enter DevTools. Never retain response data. */
export function recordPharmacyServerTiming(header: unknown) {
  try {
    const clock = globalThis.performance, end = clock.now();
    for (const phase of serverPhases) clock.clearMeasures(`pharmacy.server.${phase}`);
    if (typeof header !== "string" || header.length > 2000) return;
    for (const item of header.split(",")) {
      const match = /^\s*counter_(\w+);dur=(\d+(?:\.\d+)?)\s*$/.exec(item);
      if (!match || !serverPhases.has(match[1])) continue;
      const duration = Number(match[2]);
      if (!Number.isFinite(duration) || duration > 600000) continue;
      const name = `pharmacy.server.${match[1]}`;
      clock.measure(name, { start: Math.max(0, end - duration), duration });
    }
  } catch { /* Diagnostics cannot change a financial outcome. */ }
}

/** Last duration per phase in DevTools; no identifiers, payloads or network telemetry. */
export async function measurePharmacyStep<T>(step: PharmacyStep, action: () => Promise<T>): Promise<T> {
  const clock = globalThis.performance;
  let start: number | undefined;
  try { start = clock?.now(); } catch { /* Timing may be disabled by the browser. */ }
  try { return await action(); }
  finally {
    if (clock && start !== undefined) try {
      const name = `pharmacy.${step}`;
      clock.clearMeasures(name);
      clock.measure(name, { start, end: clock.now() });
    } catch { /* Diagnostics must never alter Save or recovery. */ }
  }
}
