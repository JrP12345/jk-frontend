"use client";

import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { recoverCounter, type CounterResult } from "@/lib/pharmacyCounter";
import { money } from "./pharmacyWorkspace";

/** History authority can recover a sale even when new sales are disabled. */
export function PharmacySaleRecovery({ locationId, onOpen }: { locationId: string; onOpen: (invoiceId: string) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <SaleRecoverySession key={`${scope}:${locationId}`} locationId={locationId} onOpen={onOpen} />;
}
function SaleRecoverySession({ locationId, onOpen }: { locationId: string; onOpen: (invoiceId: string) => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-sale:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { key: sessionStorage.getItem(storageKey) || "", error: "" }; } catch { return { key: "", error: "Saved sale reference is unavailable in this browser. Enter the original reference to check it." }; } });
  const [key, setKey] = useState(initial.key), [error, setError] = useState(initial.error), [result, setResult] = useState<CounterResult | null>(null), [busy, setBusy] = useState(false);
  const beginRead = useLatestRead();
  async function check(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) { setError("Enter the original valid sale reference."); return; }
    const request = beginRead(); setBusy(true); setError(""); setResult(null);
    try { const value = await recoverCounter(locationId, key); if (request.isCurrent() && authScopeKey(useAuthStore.getState().user) === scope) setResult(value); }
    catch (failure) { if (request.isCurrent()) setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Sale result could not be checked. Keep the original reference.")); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  function acknowledge() {
    if (!result || busy) return;
    try { const stored = sessionStorage.getItem(storageKey); if (stored && stored !== result.requestKey) throw new Error("A different sale reference is pending. Check that result before clearing it."); if (stored) sessionStorage.removeItem(storageKey); setKey(""); setResult(null); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Sale reference could not be acknowledged."); }
  }
  return <section aria-label="Recover counter sale"><form onSubmit={check}><Input label="Original counter sale reference" value={key} disabled={busy} maxLength={100} onChange={event => { setKey(event.target.value); setResult(null); }} /><Button size="sm" variant="outline" type="submit" disabled={busy || !key}>Recover saved counter sale</Button></form>
    {error && <Alert variant="error" title="Sale recovery needs attention">{error}</Alert>}{result && <Alert variant="success" title="Saved sale recovered"><p>Invoice {result.invoiceNumber} · {money(result.totalPaise / 100)} at issue. Reference {result.requestKey}.</p><Button size="sm" onClick={() => onOpen(result.invoiceId)}>Open recovered bill and receipts</Button><Button size="sm" variant="outline" onClick={acknowledge}>Acknowledge recovered sale</Button></Alert>}
  </section>;
}
