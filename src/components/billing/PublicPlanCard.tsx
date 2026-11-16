"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button, { buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/components/ui/utils";
import { formatCurrency } from "@/lib/currency";
import type { SaaSPlan } from "@/services/billing.service";
import styles from "./PublicPlanCard.module.css";

export type BillingCycle = "monthly" | "annual";

export const planCapacityRows: { label: string; key: keyof SaaSPlan["limits"] }[] = [
  { label: "Locations", key: "maxLocations" },
  { label: "Doctor profiles", key: "maxDoctors" },
  { label: "Staff members", key: "maxStaff" },
  { label: "Patient records", key: "maxPatients" },
  { label: "Appointments", key: "maxAppointments" },
  { label: "Storage (MB)", key: "maxStorageMB" },
];

export const planFeatureRows: { label: string; key: keyof SaaSPlan["features"] }[] = [
  { label: "Analytics", key: "analytics" },
  { label: "Audit logs", key: "auditLogs" },
  { label: "Multiple branches", key: "multiBranch" },
  { label: "Data export", key: "dataExport" },
  { label: "API access", key: "apiAccess" },
  { label: "Clinical AI", key: "aiFeatures" },
];

export function BillingCycleSwitch({ value, onChange }: { value: BillingCycle; onChange: (cycle: BillingCycle) => void }) {
  return (
    <div className="inline-flex max-w-full gap-1 rounded-control border border-border bg-surface p-1" role="group" aria-label="Billing cycle">
      {(["monthly", "annual"] as const).map(cycle => (
        <Button
          key={cycle}
          variant={value === cycle ? "primary" : "ghost"}
          size="sm"
          aria-pressed={value === cycle}
          onClick={() => onChange(cycle)}
        >
          {cycle === "monthly" ? "Monthly billing" : "Annual billing"}
        </Button>
      ))}
    </div>
  );
}

/** The public pricing page and homepage share the same configured plan presentation. */
export function PublicPlanCard({ plan, billingCycle, compact = false, single = false }: { plan: SaaSPlan; billingCycle: BillingCycle; compact?: boolean; single?: boolean }) {
  const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
  const isEnterprise = plan.slug === "enterprise";
  const Heading = compact ? "h3" : "h2";
  const capacities = planCapacityRows.slice(0, compact ? 3 : 4);
  const features = planFeatureRows.filter(row => plan.features?.[row.key]);

  return (
    <article className={cn(styles.plan, single && styles.single)} aria-label={`${plan.name} plan`}>
      <Card
        padding="none"
        className={cn("h-full", plan.isPopular && styles.popular)}
        contentClassName={styles.content}
      >
        <div className={styles.introduction}>
          <div className={styles.heading}>
            <Heading className={styles.name}>{plan.name}</Heading>
            {plan.isPopular && <Badge variant="primary">Most popular</Badge>}
          </div>
          <p className={styles.description}>{plan.description}</p>
          <div className={styles.priceGroup}>
            <p className={styles.price}>
              {formatCurrency(price, plan.currency)} <span>/ month</span>
            </p>
            {billingCycle === "annual" && (
              <p className={styles.billingNote}>Billed annually ({formatCurrency(plan.annualPrice, plan.currency)}/year)</p>
            )}
            <p className={styles.trial}>{plan.trialDays > 0 ? `${plan.trialDays}-day free trial` : "No free trial"}</p>
          </div>
        </div>
        <div className={styles.details}>
          <dl className={cn(styles.capacities, compact && styles.compactCapacities)}>
            {capacities.map(row => (
              <div key={row.key}>
                <dt>{row.label}</dt>
                <dd>{plan.limits?.[row.key]?.toLocaleString() ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {!compact && features.length > 0 && (
            <ul className={styles.features} aria-label="Included features">
              {features.map(row => <li key={row.key}><span aria-hidden="true">✓</span>{row.label}</li>)}
            </ul>
          )}
          <Link
            href={isEnterprise ? "mailto:ekavyuofficial@gmail.com" : `/onboarding?mode=new_org&plan=${encodeURIComponent(plan.slug)}`}
            prefetch={false}
            className={buttonClassName({ fullWidth: true, size: "lg", className: "mt-auto" })}
          >
            <span className="min-w-0 wrap-anywhere">{isEnterprise ? "Contact Sales" : `Request ${plan.name} setup`}</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </article>
  );
}
