"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { BillingCycleSwitch, PublicPlanCard, type BillingCycle } from "@/components/billing/PublicPlanCard";
import { billingService } from "@/services/billing.service";
import styles from "./home.module.css";

export default function HomePricing() {
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const element = useRef<HTMLDivElement>(null);
  const { data: plans, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => billingService.getPlans(),
    enabled: visible,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!element.current) return;
    if (typeof IntersectionObserver === "undefined") {
      const fallback = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(fallback);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={element} className={styles.pricingContent}>
      <div className={styles.pricingControls}>
        <BillingCycleSwitch value={cycle} onChange={setCycle} />
        <p>Monthly or annual pricing. Capacity for your team. Assisted setup.</p>
      </div>
      {isPending ? (
        <div className={styles.pricingLoading} aria-busy="true">
          <Spinner size="sm" label="Loading current plans" />
        </div>
      ) : isError || !plans?.length ? (
        <div className={styles.pricingUnavailable}>
          <div>
            <h3>{isError ? "Plans couldn’t be loaded." : "No active plans are listed right now."}</h3>
            <p>Ask our team about the right setup for your organization. We’ll confirm capacity, pricing and trial terms with you.</p>
          </div>
          <div className={styles.actions}>
            <Button variant="outline" loading={isFetching} icon={<RefreshCw size={15} />} onClick={() => refetch()}>Try again</Button>
            <a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}>Talk to the team <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      ) : (
        <>
          {plans.length > 1 && <p className={styles.planSwipeHint}>Swipe to compare plans <ArrowRight size={14} aria-hidden="true" /></p>}
          <div className={styles.planGrid} role="region" aria-label="Current organization plans" tabIndex={0}>
            {plans.map(plan => <PublicPlanCard key={plan.id || plan.slug} plan={plan} billingCycle={cycle} compact />)}
          </div>
        </>
      )}
      <div className={styles.pricingFootnote}>
        <p>Organization activation is assisted. Included modules and trial terms depend on your selected plan.</p>
        <Link href="/pricing" className={styles.textLink}>Compare every limit & feature <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
