"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { financeKinds, recoverFinance, submitFinance, type FinanceKind, type FinanceOutcome, type FinanceReference } from "@/lib/pharmacyFinance";
export const pharmacyFinanceMessage = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Financial outcome could not be confirmed. Keep the same reference.");
function stored(storageKey: string): FinanceReference | null {
  const value = sessionStorage.getItem(storageKey); if (!value) return null; const ref = JSON.parse(value) as FinanceReference;
  if (!ref || !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) || !financeKinds.includes(ref.kind) || typeof ref.sourceId !== "string" || !ref.sourceId) throw new Error("Financial reference needs review before another command"); return ref;
}
/** Shares one opaque uncertain-command reference across the new finance forms. */
export function usePharmacyFinanceCommand(locationId: string) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-finance:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { ref: stored(storageKey), error: "" }; } catch (failure) { return { ref: null, error: pharmacyFinanceMessage(failure) }; } });
  const [pending, setPending] = useState(initial.ref), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [canReview, setCanReview] = useState(false), [result, setResult] = useState<FinanceOutcome | null>(null);
  const frozen = useRef<{ reference: FinanceReference; input: object } | null>(null), lock = useRef(false), alive = useRef(true);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function submit(kind: FinanceKind, sourceId: string, input: object) {
    if (!current() || lock.current || result) return;
    lock.current = true; setBusy(true); setError(""); setCanReview(false);
    try {
      const saved = stored(storageKey);
      if ((saved?.key || null) !== (pending?.key || null) || pending && (pending.kind !== kind || pending.sourceId !== sourceId)) throw new Error("Resolve the existing financial reference before starting another command");
      const reference = pending || { key: crypto.randomUUID(), kind, sourceId }; if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(reference)); setPending(reference);
      const command = frozen.current || { reference, input: JSON.parse(JSON.stringify(input)) as object }; frozen.current = command; setSubmitted(true);
      const outcome = await submitFinance(command.reference, command.input); if (current()) setResult(outcome);
    } catch (failure) { if (current()) { setError(pharmacyFinanceMessage(failure)); setCanReview([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return;
    lock.current = true; setBusy(true); setError("");
    try { const outcome = await recoverFinance(pending, locationId); if (current()) setResult(outcome); }
    catch (failure) { if (current()) setError(pharmacyFinanceMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function review() { if (!current() || busy || result || submitted && !canReview) return; frozen.current = null; setSubmitted(false); setCanReview(false); setError(""); }
  function acknowledge() {
    if (!current() || busy || !result) return false;
    try { if (stored(storageKey)?.key !== result.requestKey) throw new Error("Financial reference changed; recover its saved result"); sessionStorage.removeItem(storageKey); setPending(null); setResult(null); setSubmitted(false); setCanReview(false); frozen.current = null; setError(""); return true; }
    catch (failure) { setError(pharmacyFinanceMessage(failure)); return false; }
  }
  return { pending, error, busy, submitted, canReview, result, submit, recover, review, acknowledge, retry: () => { if (frozen.current) return submit(frozen.current.reference.kind, frozen.current.reference.sourceId, frozen.current.input); } };
}
