"use client";

import { useEffect, useState } from "react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Button } from "@/components/ui";
import { billingService, type SaaSPlan } from "@/services/billing.service";
import { BillingCycleSwitch, PublicPlanCard, planCapacityRows as capacityRows, planFeatureRows as featureRows } from "@/components/billing/PublicPlanCard";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    billingService.getPlans().then(data => {
      if (!current) return;
      setPlans(data || []);
      if (!data?.length) setError("No active pricing plans are configured.");
    }).catch(() => {
      if (!current) return;
      setPlans([]);
      setError("Pricing plans could not be loaded. Please try again.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]);

  return (
    <div className="min-h-dvh bg-background text-text flex flex-col">
      <MarketplaceNavbar />
      <main className="mx-auto w-full max-w-6xl px-4 pt-24 pb-10 sm:px-6">
        <header className="mb-8 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Plans for your practice</h1>
          <p className="text-sm text-text-secondary max-w-2xl">Compare clinic capacity and features. Trial duration and pricing depend on the selected plan.</p>
          <BillingCycleSwitch value={billingCycle} onChange={setBillingCycle} />
        </header>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading pricing tiers">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-xl border border-border bg-surface-alt" />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
            <p role="status" className="text-sm text-text-secondary">{error}</p>
            <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Subscription plans">
              {plans.map(plan => <PublicPlanCard key={plan.id || plan.slug} plan={plan} billingCycle={billingCycle} />)}
            </section>
            <details className="mt-6 rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer p-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Compare all limits and features</summary>
              <div className="overflow-x-auto px-4 pb-4 touch-scroll focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" tabIndex={0} role="region" aria-label="Plan feature comparison">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Configured subscription plan limits and features</caption>
                  <thead><tr className="border-b border-border"><th scope="col" className="p-3">Feature</th>{plans.map(plan => <th scope="col" className="p-3 text-center" key={plan.id || plan.slug}>{plan.name}</th>)}</tr></thead>
                  <tbody>
                    {capacityRows.map(row => <tr key={row.key} className="border-b border-border"><th scope="row" className="p-3 font-medium">{row.label}</th>{plans.map(plan => <td key={plan.id || plan.slug} className="p-3 text-center">{plan.limits?.[row.key]?.toLocaleString() ?? "—"}</td>)}</tr>)}
                    {featureRows.map(row => <tr key={row.key} className="border-b border-border"><th scope="row" className="p-3 font-medium">{row.label}</th>{plans.map(plan => <td key={plan.id || plan.slug} className="p-3 text-center">{plan.features?.[row.key] ? "Included" : "Not included"}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </main>
      <footer className="mt-auto border-t border-border p-6 text-center text-xs text-text-muted">© 2026 Ekavyu Healthcare Infrastructure Platform.</footer>
    </div>
  );
}
