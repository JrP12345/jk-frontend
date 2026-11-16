"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Button } from "@/components/ui";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { billingService, type SaaSPlan } from "@/services/billing.service";
import { BillingCycleSwitch, PublicPlanCard, planCapacityRows as capacityRows, planFeatureRows as featureRows } from "@/components/billing/PublicPlanCard";
import styles from "./pricing.module.css";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<SaaSPlan[]>(() => queryClient.getQueryData(["public-plans"]) || []);
  const [loading, setLoading] = useState(!plans.length);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setError(null);
    void queryClient.fetchQuery({
      queryKey: ["public-plans"], queryFn: () => billingService.getPlans(),
      staleTime: 5 * 60 * 1000, retry: false,
    }).then(data => {
      if (!current) return;
      setPlans(data);
      if (!data.length) setError("No active pricing plans are configured.");
    }).catch(() => {
      if (!current) return;
      setPlans([]);
      setError("Pricing plans could not be loaded. Please try again.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [queryClient, attempt]);

  return <div className={styles.page}>
    <MarketplaceNavbar showSearch={false} showSignUp showProviderRequest />
    <main className={styles.main}>
      <Breadcrumbs className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Plans" }]} />
      <header className={styles.introduction}>
        <p className={styles.eyebrow}>For clinics &amp; hospitals</p>
        <h1>Plans for your practice</h1>
        <p>Choose the capacity and tools your team needs. We’ll confirm your plan and help you get started.</p>
      </header>
      <div className={styles.controls}>
        <BillingCycleSwitch value={billingCycle} onChange={setBillingCycle} />
        <p>Pricing and trial terms follow your selected plan.</p>
      </div>
      {loading ? <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading pricing tiers"><span className="sr-only">Loading current plans</span><Skeleton height="20rem" rounded="2xl" /></div> : error ? <Card padding="lg" contentClassName={styles.unavailable}>
        <h2>Plan details are unavailable</h2><p role="status">{error}</p>
        <div className={styles.recovery}><Button variant="outline" onClick={() => {
          void queryClient.invalidateQueries({ queryKey: ["public-plans"], exact: true, refetchType: "none" });
          setLoading(true); setAttempt(value => value + 1);
        }}>Try again</Button><a href="mailto:ekavyuofficial@gmail.com">Contact the team</a></div>
      </Card> : <>
        <section className={styles.plans} data-plan-count={plans.length} aria-label="Subscription plans">
          {plans.map(plan => <PublicPlanCard key={plan.id || plan.slug} plan={plan} billingCycle={billingCycle} single={plans.length === 1} />)}
        </section>
        <p className={styles.setupNote}>Setup is assisted. Your team’s access and included tools are confirmed before activation.</p>
        <details className={styles.comparison}>
          <summary>Compare all limits and features</summary>
          <div className={styles.tableRegion} tabIndex={0} role="region" aria-label="Plan feature comparison">
            <table>
              <caption className="sr-only">Configured subscription plan limits and features</caption>
              <thead><tr><th scope="col">Feature</th>{plans.map(plan => <th scope="col" key={plan.id || plan.slug}>{plan.name}</th>)}</tr></thead>
              <tbody>
                {capacityRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{plans.map(plan => <td key={plan.id || plan.slug}>{plan.limits?.[row.key]?.toLocaleString() ?? "—"}</td>)}</tr>)}
                {featureRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{plans.map(plan => <td key={plan.id || plan.slug}>{plan.features?.[row.key] ? "Included" : "Not included"}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </details>
      </>}
      <aside className={styles.help} aria-label="Plan questions"><div><h2>Need help choosing?</h2><p>Tell us about your practice and the team you’re setting up.</p></div><a href="mailto:ekavyuofficial@gmail.com">Talk to the team <span aria-hidden="true">↗</span></a></aside>
      <div className={styles.otherAudience}><span>Setting up a pharmacy?</span><Link href="/pharmacy-start">View pharmacy onboarding <span aria-hidden="true">→</span></Link></div>
    </main>
    <footer className={styles.footer}><span>Ekavyu · Care, connected.</span><Link href="/browse">Browse care</Link></footer>
  </div>;
}
