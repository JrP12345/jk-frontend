"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Button } from "@/components/ui";
import { billingService, type SaaSPlan } from "@/services/billing.service";
import { formatCurrency } from "@/lib/currency";

const capacityRows: { label: string; key: keyof SaaSPlan["limits"] }[] = [
  { label: "Clinic branches", key: "maxClinics" },
  { label: "Doctor profiles", key: "maxDoctors" },
  { label: "Staff members", key: "maxStaff" },
  { label: "Patient records", key: "maxPatients" },
  { label: "Appointments", key: "maxAppointments" },
  { label: "Storage (MB)", key: "maxStorageMB" },
];
const featureRows: { label: string; key: keyof SaaSPlan["features"] }[] = [
  { label: "Analytics", key: "analytics" },
  { label: "Audit logs", key: "auditLogs" },
  { label: "Multiple branches", key: "multiBranch" },
  { label: "Data export", key: "dataExport" },
  { label: "API access", key: "apiAccess" },
  { label: "Clinical AI", key: "aiFeatures" },
];

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
          <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Billing cycle">
            {(["monthly", "annual"] as const).map(cycle => (
              <button key={cycle} type="button" aria-pressed={billingCycle === cycle} onClick={() => setBillingCycle(cycle)} className={`min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${billingCycle === cycle ? "bg-primary text-brand-mist" : "text-text-secondary hover:bg-surface-hover"}`}>
                {cycle === "monthly" ? "Monthly billing" : "Annual billing"}
              </button>
            ))}
          </div>
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
              {plans.map(plan => {
                const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
                const isEnterprise = plan.slug === "enterprise";
                return (
                  <article key={plan.id || plan.slug} className={`flex flex-col rounded-xl border bg-surface p-4 sm:p-6 ${plan.isPopular ? "border-accent" : "border-border"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h2 className="text-xl font-semibold break-words">{plan.name}</h2>
                      {plan.isPopular && <span className="text-xs font-medium text-accent">Most popular</span>}
                    </div>
                    <p className="text-sm text-text-secondary mb-5">{plan.description}</p>
                    <p className="text-3xl font-semibold break-words">{formatCurrency(price, plan.currency)} <span className="text-sm font-normal text-text-muted">/ month</span></p>
                    {billingCycle === "annual" && <p className="text-xs text-text-secondary mt-1">Billed annually ({formatCurrency(plan.annualPrice, plan.currency)}/year)</p>}
                    <p className="text-sm text-text-secondary mt-3">{plan.trialDays > 0 ? `${plan.trialDays}-day free trial` : "No free trial"}</p>
                    <dl className="my-5 space-y-2 border-t border-border pt-4 text-sm">
                      {capacityRows.slice(0, 4).map(row => <div key={row.key} className="flex justify-between gap-3"><dt className="text-text-secondary">{row.label}</dt><dd className="font-medium">{plan.limits?.[row.key]?.toLocaleString() ?? "—"}</dd></div>)}
                    </dl>
                    <ul className="space-y-1 text-sm text-text-secondary mb-5">
                      {featureRows.filter(row => plan.features?.[row.key]).map(row => <li key={row.key}>{row.label}</li>)}
                    </ul>
                    <Link href={isEnterprise ? "mailto:ekavyuofficial@gmail.com" : `/onboarding?mode=new_org&plan=${encodeURIComponent(plan.slug)}`} className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${plan.isPopular ? "bg-primary text-brand-mist hover:opacity-90" : "border border-border hover:bg-surface-hover"}`}>
                      {isEnterprise ? "Contact Sales" : `Request ${plan.name} setup`} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
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
