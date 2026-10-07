"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/currency";
import type { SaaSPlan } from "@/services/billing.service";

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
    <div className="inline-flex max-w-full rounded-xl border border-border bg-surface p-1" role="group" aria-label="Billing cycle">
      {(["monthly", "annual"] as const).map(cycle => (
        <Button
          key={cycle}
          variant={value === cycle ? "primary" : "ghost"}
          size="sm"
          className="min-h-11 md:min-h-11"
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
export function PublicPlanCard({ plan, billingCycle, compact = false }: { plan: SaaSPlan; billingCycle: BillingCycle; compact?: boolean }) {
  const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
  const isEnterprise = plan.slug === "enterprise";
  const Heading = compact ? "h3" : "h2";
  const capacities = planCapacityRows.slice(0, compact ? 3 : 4);
  const features = planFeatureRows.filter(row => plan.features?.[row.key]);

  return (
    <article className="min-w-0 h-full" aria-label={`${plan.name} plan`}>
      <Card
        padding="lg"
        className={`h-full rounded-xl ${plan.isPopular ? "border-accent" : "border-border"}`}
        contentClassName="gap-0"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Heading className="text-xl font-semibold wrap-anywhere">{plan.name}</Heading>
          {plan.isPopular && <Badge variant="primary">Most popular</Badge>}
        </div>
        <p className={`${compact ? "mb-3" : "mb-5"} text-sm text-text-secondary wrap-anywhere`}>{plan.description}</p>
        <p className="text-3xl font-semibold wrap-anywhere">
          {formatCurrency(price, plan.currency)} <span className="text-sm font-normal text-text-muted">/ month</span>
        </p>
        {billingCycle === "annual" && (
          <p className="mt-1 text-xs text-text-secondary">Billed annually ({formatCurrency(plan.annualPrice, plan.currency)}/year)</p>
        )}
        <p className="mt-3 text-sm text-text-secondary">{plan.trialDays > 0 ? `${plan.trialDays}-day free trial` : "No free trial"}</p>
        <dl className={compact ? "my-4 grid grid-cols-3 gap-2 border-t border-border pt-3" : "my-5 space-y-2 border-t border-border pt-4 text-sm"}>
          {capacities.map(row => (
            <div key={row.key} className={compact ? "flex min-w-0 flex-col gap-1" : "flex justify-between gap-3"}>
              <dt className={compact ? "text-[11px] text-text-secondary" : "text-text-secondary"}>{compact && row.key === "maxLocations" ? "Locations" : row.label}</dt>
              <dd className={compact ? "text-lg font-medium wrap-anywhere" : "font-medium"}>{plan.limits?.[row.key]?.toLocaleString() ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {!compact && features.length > 0 && (
          <ul className="mb-5 space-y-1 text-sm text-text-secondary">
            {features.map(row => <li key={row.key}>{row.label}</li>)}
          </ul>
        )}
        {compact && (
          <p className="mb-4 text-xs text-text-secondary">
            {plan.features?.multiBranch ? "Multiple locations included." : "Location capacity follows the plan limits."}
          </p>
        )}
        <Link
          href={isEnterprise ? "mailto:ekavyuofficial@gmail.com" : `/onboarding?mode=new_org&plan=${encodeURIComponent(plan.slug)}`}
          className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${plan.isPopular ? "bg-primary text-brand-mist hover:bg-primary-hover" : "border border-border hover:bg-surface-hover"}`}
        >
          {isEnterprise ? "Contact Sales" : `Request ${plan.name} setup`}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </Card>
    </article>
  );
}
