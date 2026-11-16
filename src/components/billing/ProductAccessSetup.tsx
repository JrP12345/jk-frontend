"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, Input, Select } from "@/components/ui";
import { ProductQuotePanel } from "./ProductQuotePanel";
import { billingService, type ProductPlan, type ProductQuote } from "@/services/billing.service";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { apiErrorMessage } from "@/lib/apiError";

interface Props { organizationId?: string; subscriptionId?: string; busy?: boolean; onSaved: () => void | Promise<void>; onPurchase?: (plan: ProductPlan, quote: ProductQuote) => void }
export function ProductAccessSetup({ organizationId, subscriptionId, busy, onSaved, onPurchase }: Props) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const [grantBusy, setGrantBusy] = useState(false);
  return <ProductQuotePanel organizationId={organizationId} busy={busy || grantBusy} onPurchase={onPurchase} quoteActions={user?.role === "root" && subscriptionId ? (plan, quote) => <ProductGrant key={`${scope}:${organizationId}:${subscriptionId}:${quote.fingerprint}`} plan={plan} quote={quote} subscriptionId={subscriptionId} busy={busy} onSaved={onSaved} onBusyChange={setGrantBusy} /> : undefined} emptyState={user?.role === "root" ? <Alert variant="info" title="No location-product catalogue">Create and review a location-product plan in <Link href="/dashboard/admin/billing" className="underline">Plans &amp; subscriptions</Link> before granting branch pharmacy access.</Alert> : undefined} />;
}
function ProductGrant({ plan, quote, subscriptionId, busy, onSaved, onBusyChange }: { plan: ProductPlan; quote: ProductQuote; subscriptionId: string; busy?: boolean; onSaved: Props["onSaved"]; onBusyChange: (busy: boolean) => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  const [kind, setKind] = useState<"manual" | "trial">("manual");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const trialAvailable = Number.isSafeInteger(plan.trialDays) && plan.trialDays >= 1 && plan.trialDays <= 365;
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope && useAuthStore.getState().user?.role === "root";
  return <form className="space-y-3 border-t border-border pt-4" aria-label="Reviewed product access grant" onSubmit={async event => {
    event.preventDefault();
    if (lock.current || busy || saved || needsReview || !current() || reason.trim().length < 10) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { setError("This quote expired. Preview the product selection again before granting access."); return; }
    lock.current = true; setSaving(true); onBusyChange(true); setError("");
    try {
      await billingService.adminActivateSubscription(subscriptionId, plan.slug, quote.billingCycle, reason.trim(), { quoteToken: quote.quoteToken, grantKind: kind });
      if (current()) { setSaved(true); await onSaved(); }
    } catch (failure) { if (current()) { setNeedsReview(true); setError(apiErrorMessage(failure, "Product access could not be confirmed.")); } }
    finally { lock.current = false; if (current()) { setSaving(false); onBusyChange(false); } }
  }}>
    <p className="text-sm text-text-secondary">Root access grant for the reviewed branches and plan above. This records an attributed entitlement and does not record a payment.</p>
    {error && <Alert variant="error" title="Access grant unavailable">{error}</Alert>}
    {needsReview && <p className="text-sm text-text-secondary">Refresh the subscription to check the recorded result, then preview a fresh quote before another grant. This form will not repeat the previous request.</p>}
    {saved ? <Alert variant="success" title="Product access granted">The subscription has been refreshed. Branch pharmacy enablement and staff permissions remain separate.</Alert> : <fieldset className="space-y-3" disabled={saving || busy || needsReview}>
      <Select label="Access grant type" value={kind} options={[{ value: "manual", label: "Reviewed manual access" }, ...(trialAvailable ? [{ value: "trial", label: `${plan.trialDays}-day configured trial` }] : [])]} onChange={event => setKind(event.target.value as "manual" | "trial")} />
      <Input label="Reason for product access grant" value={reason} minLength={10} maxLength={500} required onChange={event => setReason(event.target.value)} />
      <Button type="submit" loading={saving} disabled={reason.trim().length < 10}>{kind === "trial" ? "Grant configured product trial" : "Grant reviewed product access"}</Button>
    </fieldset>}
  </form>;
}
