"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BadgeVariant } from "@/components/ui/Badge";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, RotateCw, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Skeleton, Table, BarChart, Select, type Column } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/lib/currency";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { getPlatformDashboard, type OrganizationHealth, type PlatformDashboardData, type PlatformOrganizationActivity, type PlatformRange } from "@/services/platformDashboard.service";
import styles from "./DashboardOverview.module.css";

const count = (value: number) => value.toLocaleString("en-IN");
const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const healthPresentation: Record<OrganizationHealth, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" }, trial: { label: "Trial", variant: "info" },
  expiring_soon: { label: "Ending soon", variant: "warning" }, expired: { label: "Expired", variant: "danger" },
  disabled: { label: "Inactive", variant: "neutral" }, cancelled: { label: "Cancelled", variant: "neutral" },
  payment_pending: { label: "Payment pending", variant: "warning" }, payment_failed: { label: "Payment failed", variant: "danger" },
  unavailable: { label: "Needs review", variant: "neutral" },
};
function comparison(current: number, previous: number) {
  if (!previous) return current ? "No collections in the previous period" : "No collections in either period";
  const difference = (current - previous) / previous * 100;
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)}% vs the same period last month`;
}
function HealthBadge({ organization }: { organization: PlatformOrganizationActivity }) {
  const presentation = healthPresentation[organization.status] || healthPresentation.unavailable;
  return <Badge size="sm" variant={presentation.variant} dot className={styles.healthBadge}>{presentation.label}</Badge>;
}
function DashboardSkeleton() {
  return <div role="status" aria-label="Loading platform overview" className={styles.content}>
    <span className="sr-only">Loading platform overview</span>
    <div className={styles.summary}>{Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.metric}><Skeleton width="65%" height="0.875rem" /><Skeleton width="45%" height="1.75rem" className="my-3" /><Skeleton width="90%" height="0.75rem" /></div>)}</div>
    <div className={styles.panelBody}><Skeleton width="40%" /><Skeleton height="14rem" className="mt-4" /></div>
  </div>;
}
function Health({ data }: { data: PlatformDashboardData }) {
  const orgs = data.organizations;
  const categories = [["Active", orgs.active, "bg-success"], ["Trial", orgs.trial, "bg-primary-500"], ["Expired", orgs.expired, "bg-danger"], ["Inactive", orgs.inactive, "bg-text-muted"], ["Payment issue", orgs.paymentIssue, "bg-warning"], ["Cancelled", orgs.cancelled, "bg-text-secondary"], ["Needs review", orgs.unavailable, "bg-border"]] as const;
  return <section aria-label="Organization health" className={styles.health}>
    <div className={styles.panelHeader}><h2>Organization health</h2><p>Subscription access across {count(orgs.total)} organizations.</p></div>
    <div className={styles.panelBody}>
      {orgs.total > 0 && <div aria-hidden="true" className={styles.healthBar}>{categories.map(([label, value, color]) => value > 0 && <div key={label} className={color} style={{ width: `${value / orgs.total * 100}%` }} />)}</div>}
      <dl className={styles.healthList}>{categories.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{count(value)}</dd></div>)}</dl>
      <p className={styles.healthNote}>{count(orgs.paid)} paid with current access · {count(orgs.expiringSoon)} ending within 7 days</p>
      <Link href="/dashboard/admin/billing" className={styles.textLink}>Review subscriptions <ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>
  </section>;
}
function Attention({ data }: { data: PlatformDashboardData }) {
  return <section aria-label="Needs attention" className={styles.attention}>
    <div className={styles.panelHeader}><h2>Needs attention</h2><p>Billing, setup and adoption follow-ups.</p></div>
    <div className={styles.attentionBody}>
      {data.attention.length ? <ul>{data.attention.map(issue => <li key={issue.key}><Link href={issue.destination === "billing" ? "/dashboard/admin/billing" : organizationWorkspaceUrl()}><span className={styles.issueCount}>{count(issue.count)}</span><span>{issue.title}</span><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></li>)}</ul> : <div className={styles.calmState}><CheckCircle2 className="h-5 w-5 text-success-text" /><div><p>No immediate follow-ups</p><small>No billing, setup, or adoption issues were found.</small></div></div>}
    </div>
  </section>;
}
function OrganizationActivity({ data }: { data: PlatformDashboardData }) {
  const [sort, setSort] = useState("most");
  const rows = sort === "most" ? data.organizationActivity.mostActive : data.organizationActivity.leastActive;
  const identity = (org: PlatformOrganizationActivity) => <div className={styles.organizationName}><Link href={organizationWorkspaceUrl(org.id)} className={styles.textLink}>{org.name}</Link><p>{org.city} · {org.planName}</p></div>;
  const collections = (org: PlatformOrganizationActivity) => Object.entries(org.collectionsThisMonth).length ? Object.entries(org.collectionsThisMonth).map(([currency, amount]) => <p key={currency}>{formatCurrency(amount, currency)}</p>) : <span className={styles.muted}>No collections</span>;
  const columns: Column<PlatformOrganizationActivity>[] = [
    { header: "Organization", width: "35%", accessor: identity },
    { header: "Activity this month", width: "20%", accessor: org => <div className={styles.activityCounts}><span>{count(org.bookingsThisMonth)} bookings</span><small>{count(org.doctors)} enabled doctors</small></div> },
    { header: "Collections", width: "21%", accessor: collections },
    { header: "Subscription", width: "24%", accessor: org => <div className={styles.access}><HealthBadge organization={org} /><small>{org.expiresAt ? `Ends ${date(org.expiresAt)}` : "No end date set"}</small></div> },
  ];
  return <section aria-labelledby="organization-activity-title" className={styles.panel}>
    <div className={styles.sectionHeader}><div><h2 id="organization-activity-title">Organization activity</h2><p>Month-to-date bookings and collections · up to 6 organizations.</p></div><Link href={organizationWorkspaceUrl()} className={styles.textLink}>Manage all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    <div className={styles.activityToolbar}>{rows.length > 0 && <Select aria-label="Organization activity order" value={sort} onChange={event => setSort(event.target.value)} options={[{ label: "Most bookings", value: "most" }, { label: "Fewest bookings", value: "least" }]} fullWidth={false} containerClassName={styles.activitySort} />}<Link href="/dashboard/admin/setup-requests" className={styles.textLink}>Setup requests <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    {rows.length > 0 ? <Table className={styles.responsiveTable} caption="Organization activity" columns={columns} data={rows} density="compact" variant="flat" fitContent searchable={false} pagination={false} showColumnVisibility={false}
      renderMobileCard={org => <article className={styles.organizationCard}><div className={styles.organizationHeading}>{identity(org)}<HealthBadge organization={org} /></div><dl className={styles.organizationFacts}><div><dt>Bookings this month</dt><dd>{count(org.bookingsThisMonth)}</dd></div><div><dt>Enabled doctors</dt><dd>{count(org.doctors)}</dd></div><div><dt>Subscription collections</dt><dd>{collections(org)}</dd></div><div><dt>Access ends</dt><dd>{org.expiresAt ? date(org.expiresAt) : "Not set"}</dd></div></dl></article>}
    /> : <div className={styles.panelBody}><EmptyState title="Add your first organization" description="Activity will appear as organizations start booking and subscribing." action={<Link href="/dashboard/organizations?create=1" className={styles.textLink}>Create organization <ArrowRight className="h-3.5 w-3.5" /></Link>} /></div>}
  </section>;
}

export default function PlatformOwnerDashboard() {
  const user = useAuthStore(state => state.user);
  const router = useRouter();
  const [range, setRange] = useState<PlatformRange>("30D");
  const [metric, setMetric] = useState("collections");
  const [selectedCurrency, setCurrency] = useState("");
  const root = user?.role === "root" && !user.impersonatedBy?.id;
  const query = useQuery({
    queryKey: ["platform-dashboard", user?.id, range],
    queryFn: ({ signal }) => getPlatformDashboard(range, signal),
    enabled: root, staleTime: 60000, retry: false, placeholderData: keepPreviousData,
  });
  if (!root) return null;
  const data = query.data;
  const currency = data?.money.currencies.find(item => item.currency === selectedCurrency)?.currency || data?.money.currencies[0]?.currency || "INR";
  const money = data?.money.currencies.find(item => item.currency === currency);
  const chartDays = data?.trend || [];
  // Longer ranges use weekly totals, avoiding 90 tiny bars on a phone.
  const chartData: { label: string; value: number }[] = [];
  const bucketSize = data?.range === "90D" ? 7 : 1;
  for (let index = 0; index < chartDays.length; index += bucketSize) {
    const bucket = chartDays.slice(index, index + bucketSize);
    chartData.push({ label: date(bucket[0].date), value: bucket.reduce((total, day) => total + (metric === "collections" ? day.collections[currency] || 0 : day.bookings), 0) });
  }
  const chartTotal = chartData.reduce((total, point) => total + point.value, 0);
  const totalLabel = metric === "collections" ? formatCurrency(chartTotal, currency) : count(chartTotal);
  const hasChart = chartTotal > 0;
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>Ekavyu overview</h1><p>Business health, adoption and the next follow-ups.</p></div>
      <div className={styles.headerActions}><Button size="sm" aria-label="Create organization" className={styles.primaryAction} onClick={() => router.push("/dashboard/organizations?create=1")}><Plus className="h-4 w-4" /><span className={styles.wideLabel}>Create organization</span><span className={styles.shortLabel}>Add</span></Button><Button variant="outline" size="sm" className={styles.iconAction} disabled={query.isFetching} onClick={() => void query.refetch()} aria-label="Refresh platform overview"><RotateCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button></div>
    </header>
    <div className={styles.contextRow}><p>{data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Platform reporting uses UTC"}</p><Button size="sm" variant="ghost" onClick={() => router.push("/dashboard/admin/billing")}>Plans & billing <ArrowRight className="h-3.5 w-3.5" /></Button></div>
    {!data ? query.isError ? <Alert variant="error" title="Platform overview could not be loaded" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>Check your connection and retry. Financial and usage totals are unavailable.</Alert> : <DashboardSkeleton /> : <>
      {query.isError && <Alert variant="warning" title="Refresh could not be completed" action={<Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>}>Showing the last successful snapshot from {date(data.generatedAt)}. These totals may be out of date.</Alert>}
      <div className={styles.summary}>
        <section aria-label="Subscription collections" className={styles.metric}><div className={styles.metricHeading}><h2>Collections</h2>{data.money.currencies.length > 1 && <Select aria-label="Collections currency" size="sm" value={currency} onChange={event => setCurrency(event.target.value)} options={data.money.currencies.map(item => ({ value: item.currency, label: item.currency }))} fullWidth={false} containerClassName={styles.currency} />}</div><p className={styles.metricValue}>{formatCurrency(money?.month || 0, currency)}</p><p className={styles.metricNote}>{comparison(money?.month || 0, money?.previous || 0)}</p><p className={styles.metricBasis}>Month to date · captured payments, tax included</p></section>
        <section className={styles.metric}><h2>Organizations</h2><p className={styles.metricValue}>{count(data.organizations.total)}</p><p className={styles.metricNote}>{count(data.organizations.active)} active · {count(data.organizations.trial)} trial · {count(data.organizations.expired)} expired</p></section>
        <section className={styles.metric}><h2>Bookings this month</h2><p className={styles.metricValue}>{count(data.usage.bookingsThisMonth)}</p><p className={styles.metricNote}>{count(data.usage.completedVisitsThisMonth)} completed visits scheduled this month</p>{data.usage.previousBookings > 0 && <p className={styles.metricBasis}>{((data.usage.bookingsThisMonth - data.usage.previousBookings) / data.usage.previousBookings * 100).toFixed(1)}% vs prior period</p>}</section>
        <section className={styles.metric}><h2>Organizations using Ekavyu</h2><p className={styles.metricValue}>{count(data.organizations.usingThisMonth)} <span>/ {count(data.organizations.total)}</span></p><p className={styles.metricNote}>{count(data.organizations.newThisMonth)} new this month · usage measured by bookings</p></section>
      </div>
      <div className={styles.insights}>
        <Attention data={data} />
        <section aria-label="Platform trend" className={styles.trend}>
          <div className={styles.panelHeader}><div className={styles.trendHeading}><div><h2>{metric === "collections" ? "Subscription collection trend" : "Booking trend"}</h2><p>{totalLabel} over {data.range === "90D" ? "90 days · weekly totals" : `${parseInt(data.range)} days · daily totals`}</p></div><Select aria-label="Trend metric" value={metric} onChange={event => setMetric(event.target.value)} options={[{ label: "Collections", value: "collections" }, { label: "Bookings", value: "bookings" }]} fullWidth={false} containerClassName={styles.metricSelect} /></div>
            <div className={styles.trendControls}><div role="group" aria-label="Trend range">{(["7D", "30D", "90D"] as const).map(value => <Button key={value} size="sm" variant={range === value ? "secondary" : "ghost"} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</Button>)}</div><span role="status">{query.isFetching ? "Updating overview…" : `${date(data.period.rangeStart)}–${date(data.generatedAt)} · UTC`}</span></div>
          </div>
          <div className={styles.panelBody}>
            {hasChart ? <figure aria-label={`${metric === "collections" ? "Subscription collections" : "Bookings"}: ${totalLabel} over ${data.range}`}>
              <div className={styles.chartScroll} role="region" tabIndex={0} aria-label="Scrollable platform trend"><div style={{ minWidth: Math.max(240, chartData.length * 20 + 72) }}><BarChart data={chartData} series={[{ key: "value", name: metric === "collections" ? `Collections (${currency})` : "Bookings" }]} height={220} showLegend={false} valueFormatter={value => metric === "collections" ? formatCurrency(value, currency, { notation: "compact", maximumFractionDigits: 1 }) : count(value)} /></div></div>
              <figcaption><details className={styles.dailyTotals}><summary>View {data.range === "90D" ? "weekly" : "daily"} totals <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></summary><ul>{chartData.map(point => <li key={point.label}><span>{point.label}</span><span>{metric === "collections" ? formatCurrency(point.value, currency) : count(point.value)}</span></li>)}</ul></details></figcaption>
            </figure> : <div className={styles.emptyChart}><p>{metric === "collections" ? "No subscription collections in this period" : "No bookings created in this period"}</p><small>{metric === "collections" ? "Captured subscription payments will appear here. Check bookings to see product adoption." : "Bookings will appear as organizations start using Ekavyu."}</small>{metric === "collections" && <Button variant="ghost" size="sm" onClick={() => setMetric("bookings")}>View booking trend <ArrowRight className="h-3.5 w-3.5" /></Button>}</div>}
            <p className={styles.chartNote}>{metric === "collections" ? "Refunded and review payments are excluded. This is cash collected, not recurring or recognized revenue." : "Bookings are counted when created, including later cancellations. Unpaid checkout placeholders are excluded."}</p>
          </div>
        </section>
        <Health data={data} />
      </div>
      <section aria-label="Platform usage" className={styles.usage}><dl><div><dt>Patients booked this month</dt><dd>{count(data.usage.patientsBookedThisMonth)}</dd></div><div><dt>Enabled doctors</dt><dd>{count(data.usage.enabledDoctors)}</dd></div><div><dt>Paid organizations</dt><dd>{count(data.organizations.paid)}</dd></div></dl></section>
      {data.money.undatedCaptures > 0 && <Alert variant="warning" title="Some historical collections cannot be dated">{count(data.money.undatedCaptures)} captured payments have no payment timestamp and are excluded from dated totals.</Alert>}
      <OrganizationActivity data={data} />
      <section aria-label="Recent platform activity" className={styles.panel}>
        <div className={styles.sectionHeader}><h2>Recent platform activity</h2><Link href="/dashboard/audit" className={styles.textLink}>View audit log <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className={styles.panelBody}>{data.recentActivity.length ? <ul className={styles.recentActivity}>{data.recentActivity.map(event => <li key={event.id}><div><p>{event.title}</p>{event.organizationId && event.organizationName ? <Link href={organizationWorkspaceUrl(event.organizationId)} className={styles.textLink}>{event.organizationName}</Link> : <span className={styles.muted}>Platform</span>}</div><time dateTime={event.createdAt}>{date(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</time></li>)}</ul> : <p className={styles.muted}>Organization creation, subscription payments, and administrative events will appear here.</p>}</div>
      </section>
    </>}
  </div>;
}
