"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BadgeVariant } from "@/components/ui/Badge";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, RotateCw, ArrowRight, CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, StatCard, Table, BarChart, Select, type Column } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/lib/currency";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { getPlatformDashboard, type OrganizationHealth, type PlatformDashboardData, type PlatformOrganizationActivity, type PlatformRange } from "@/services/platformDashboard.service";

const count = (value: number) => value.toLocaleString("en-IN");
const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const navigationClass = "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg";
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
  return <Badge size="sm" variant={presentation.variant} dot>{presentation.label}</Badge>;
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading platform overview" className="space-y-4">
    <span className="sr-only">Loading platform overview</span>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <Card key={index} className={index === 0 || index === 3 ? "col-span-2 sm:col-span-1" : ""}><Skeleton width="65%" height="0.875rem" /><Skeleton width="45%" height="1.75rem" className="my-3" /><Skeleton width="90%" height="0.75rem" /></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><Skeleton width="40%" /><Skeleton height="12rem" className="mt-4" /></Card><Card><Skeleton width="60%" /><Skeleton height="12rem" className="mt-4" /></Card></div>
    <Card><Skeleton width="35%" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height="2.5rem" className="mt-3" />)}</Card>
  </div>;
}

function Health({ data }: { data: PlatformDashboardData }) {
  const orgs = data.organizations;
  const categories = [
    ["Active", orgs.active, "bg-success"], ["Trial", orgs.trial, "bg-primary-500"],
    ["Expired", orgs.expired, "bg-danger"], ["Inactive", orgs.inactive, "bg-text-muted"],
    ["Payment issue", orgs.paymentIssue, "bg-warning"], ["Cancelled", orgs.cancelled, "bg-text-secondary"],
    ["Needs review", orgs.unavailable, "bg-border"],
  ] as const;
  return <section aria-label="Organization health" className="min-w-0">
    <Card className="h-full shadow-none" padding="md">
      <CardHeader><CardTitle as="h2">Organization health</CardTitle><p className="text-xs text-text-muted">Current subscription access across {count(orgs.total)} organizations</p></CardHeader>
      <CardContent>
        {orgs.total > 0 && <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-surface-alt mb-4">{categories.map(([label, value, color]) => value > 0 && <div key={label} className={color} style={{ width: `${value / orgs.total * 100}%` }} />)}</div>}
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">{categories.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-2 text-sm"><dt className="text-text-secondary">{label}</dt><dd className="font-semibold tabular-nums">{count(value)}</dd></div>)}</dl>
        <div className="mt-4 border-t border-border pt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary"><span><strong className="text-text">{count(orgs.paid)}</strong> paid with current access</span><span><strong className="text-text">{count(orgs.expiringSoon)}</strong> ending within 7 days</span></div>
        <Link href="/dashboard/admin/billing" className={`${navigationClass} mt-1`}>Review subscriptions <ArrowRight className="h-3.5 w-3.5" /></Link>
      </CardContent>
    </Card>
  </section>;
}

function Attention({ data }: { data: PlatformDashboardData }) {
  return <section aria-label="Needs attention" className="min-w-0">
    <Card padding="md" className="h-full shadow-none">
      <CardHeader><CardTitle as="h2">Needs attention</CardTitle><p className="text-xs text-text-muted">Follow up on billing, setup, and adoption</p></CardHeader>
      <CardContent>
        {data.attention.length ? <ul className="divide-y divide-border">{data.attention.map(issue => <li key={issue.key}><Link href={issue.destination === "billing" ? "/dashboard/admin/billing" : organizationWorkspaceUrl()} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg"><span className="min-w-7 text-center font-semibold tabular-nums text-text">{count(issue.count)}</span><span className="flex-1 min-w-0">{issue.title}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" /></Link></li>)}</ul> : <div className="flex gap-3 py-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-success-text" /><div><p className="text-sm font-medium">No immediate follow-ups</p><p className="text-xs text-text-muted mt-1">No billing, setup, or adoption issues were found.</p></div></div>}
      </CardContent>
    </Card>
  </section>;
}

function OrganizationActivity({ data }: { data: PlatformDashboardData }) {
  const [sort, setSort] = useState("most");
  const rows = sort === "most" ? data.organizationActivity.mostActive : data.organizationActivity.leastActive;
  const columns: Column<PlatformOrganizationActivity>[] = [
    { header: "Organization", accessor: org => <div className="min-w-0"><Link href={organizationWorkspaceUrl(org.id)} className={`${navigationClass} text-sm font-semibold`}>{org.name}</Link><p className="text-xs text-text-muted">{org.city} · {org.planName}</p></div> },
    { header: "Subscription", accessor: org => <HealthBadge organization={org} /> },
    { header: "Doctors", align: "right", accessor: org => count(org.doctors) },
    { header: "Bookings", align: "right", accessor: org => count(org.bookingsThisMonth) },
    { header: "Collections", align: "right", accessor: org => Object.entries(org.collectionsThisMonth).length ? <div>{Object.entries(org.collectionsThisMonth).map(([currency, amount]) => <p key={currency}>{formatCurrency(amount, currency)}</p>)}</div> : <span className="text-text-muted">No collections</span> },
    { header: "Access ends", accessor: org => org.expiresAt ? <time dateTime={org.expiresAt}>{date(org.expiresAt)}</time> : <span className="text-text-muted">Not set</span> },
  ];
  return <section aria-labelledby="organization-activity-title" className="min-w-0">
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3"><div><h2 id="organization-activity-title" className="text-base font-semibold">Organization activity</h2><p className="text-xs text-text-muted mt-1">Month-to-date bookings and subscription collections · up to 6 organizations</p></div><div className="flex flex-wrap items-center gap-3">{rows.length > 0 && <Select aria-label="Organization activity order" value={sort} onChange={event => setSort(event.target.value)} options={[{ label: "Most bookings", value: "most" }, { label: "Fewest bookings", value: "least" }]} fullWidth={false} containerClassName="w-40" />}<Link href="/dashboard/admin/setup-requests" className={navigationClass}>Setup requests <ArrowRight className="h-3.5 w-3.5" /></Link><Link href={organizationWorkspaceUrl()} className={navigationClass}>Manage all <ArrowRight className="h-3.5 w-3.5" /></Link></div></div>
    {rows.length > 0 ? <Table columns={columns} data={rows} density="compact" searchable={false} pagination={false} showColumnVisibility={false} mobileCardView
      emptyMessage="Your first organization will appear here. Create one to start onboarding."
      renderMobileCard={org => <div className="p-3 border border-border rounded-xl bg-surface space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><Link href={organizationWorkspaceUrl(org.id)} className={`${navigationClass} text-sm font-semibold`}>{org.name}</Link><p className="text-xs text-text-muted">{org.planName} · {org.city}</p></div><HealthBadge organization={org} /></div><dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-text-muted">Bookings this month</dt><dd className="font-semibold mt-1">{count(org.bookingsThisMonth)}</dd></div><div><dt className="text-text-muted">Enabled doctors</dt><dd className="font-semibold mt-1">{count(org.doctors)}</dd></div><div><dt className="text-text-muted">Subscription collections</dt><dd className="font-semibold mt-1">{Object.entries(org.collectionsThisMonth).map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ") || "No collections"}</dd></div><div><dt className="text-text-muted">Access ends</dt><dd className="mt-1">{org.expiresAt ? date(org.expiresAt) : "Not set"}</dd></div></dl></div>} /> : <Card padding="sm" className="shadow-none"><EmptyState title="Add your first organization" description="Activity will appear as organizations start booking and subscribing." action={<Link href="/dashboard/organizations?create=1" className={navigationClass}>Create organization <ArrowRight className="h-3.5 w-3.5" /></Link>} /></Card>}
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
  return <div className="space-y-4 sm:space-y-5 min-w-0 text-text">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><h1 className="page-title">Ekavyu overview</h1><Badge variant="outline" size="sm">Platform owner</Badge></div><p className="text-sm text-text-muted mt-1">Business health, adoption, and the next follow-ups.</p><p className="text-xs text-text-muted mt-1">{data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Platform reporting uses UTC"}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label="Refresh platform overview"><RotateCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button><Button size="sm" onClick={() => router.push("/dashboard/organizations?create=1")}><Plus className="h-3.5 w-3.5" />Create organization</Button><Button size="sm" variant="outline" onClick={() => router.push("/dashboard/admin/billing")}>Plans & billing</Button></div>
    </header>
    {!data ? query.isError ? <Alert variant="error" title="Platform overview could not be loaded" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>Check your connection and retry. Financial and usage totals are unavailable.</Alert> : <DashboardSkeleton /> : <>
      {query.isError && <Alert variant="warning" title="Refresh could not be completed" action={<Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>}>Showing the last successful snapshot from {date(data.generatedAt)}. These totals may be out of date.</Alert>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <section aria-label="Subscription collections" className="col-span-2 sm:col-span-1"><Card className="h-full shadow-none" padding="sm"><div className="flex flex-wrap justify-between items-center gap-2"><p className="text-xs sm:text-sm font-medium text-text-secondary">Subscription collections</p>{data.money.currencies.length > 1 && <Select aria-label="Collections currency" value={currency} onChange={event => setCurrency(event.target.value)} options={data.money.currencies.map(item => ({ value: item.currency, label: item.currency }))} fullWidth={false} containerClassName="w-24" />}</div><p className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums break-words">{formatCurrency(money?.month || 0, currency)}</p><p className="text-xs text-text-secondary mt-2">{comparison(money?.month || 0, money?.previous || 0)}</p><p className="text-[11px] text-text-muted mt-2">Month to date · captured payments, tax included</p></Card></section>
        <StatCard title="Organizations" value={count(data.organizations.total)} description={`${count(data.organizations.active)} active · ${count(data.organizations.trial)} trial · ${count(data.organizations.expired)} expired`} className="shadow-none h-full" />
        <StatCard title="Bookings this month" value={count(data.usage.bookingsThisMonth)} change={data.usage.previousBookings ? { value: `${((data.usage.bookingsThisMonth - data.usage.previousBookings) / data.usage.previousBookings * 100).toFixed(1)}% vs prior period`, positive: data.usage.bookingsThisMonth >= data.usage.previousBookings } : undefined} description={`${count(data.usage.completedVisitsThisMonth)} completed visits scheduled this month`} className="shadow-none h-full [&_p:first-child]:whitespace-normal" />
        <StatCard title="Organizations using Ekavyu" value={`${count(data.organizations.usingThisMonth)} / ${count(data.organizations.total)}`} description={`${count(data.organizations.newThisMonth)} new this month · usage measured by bookings`} className="col-span-2 sm:col-span-1 shadow-none h-full" />
      </div>
      {/* Mobile presents health and follow-ups before the trend; desktop keeps the trend prominent. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 flex flex-col gap-3">
          <section aria-label="Platform trend" className="order-2 lg:order-1"><Card padding="md" className="shadow-none">
            <CardHeader><div className="flex flex-wrap justify-between items-start gap-3"><div><CardTitle as="h2">{metric === "collections" ? "Subscription collection trend" : "Booking trend"}</CardTitle><p className="text-xs text-text-muted mt-1">{totalLabel} over {data.range === "90D" ? "90 days · weekly totals" : `${parseInt(data.range)} days · daily totals`}</p></div><Select aria-label="Trend metric" value={metric} onChange={event => setMetric(event.target.value)} options={[{ label: "Collections", value: "collections" }, { label: "Bookings", value: "bookings" }]} fullWidth={false} containerClassName="w-36" /></div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3"><div role="group" aria-label="Trend range" className="flex gap-1">{(["7D", "30D", "90D"] as const).map(value => <Button key={value} size="sm" variant={range === value ? "secondary" : "ghost"} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</Button>)}</div><span role="status" className="text-xs text-text-muted">{query.isFetching ? "Updating overview…" : `${date(data.period.rangeStart)}–${date(data.generatedAt)} · UTC`}</span></div>
            </CardHeader>
            <CardContent>{hasChart ? <figure aria-label={`${metric === "collections" ? "Subscription collections" : "Bookings"}: ${totalLabel} over ${data.range}`}><BarChart data={chartData} series={[{ key: "value", name: metric === "collections" ? `Collections (${currency})` : "Bookings" }]} height={220} showLegend={false} valueFormatter={value => metric === "collections" ? formatCurrency(value, currency, { notation: "compact", maximumFractionDigits: 1 }) : count(value)} /><figcaption className="sr-only"><ul>{chartData.map(point => <li key={point.label}>{point.label}: {metric === "collections" ? formatCurrency(point.value, currency) : count(point.value)}</li>)}</ul></figcaption></figure> : <div className="py-5"><p className="text-sm font-medium">{metric === "collections" ? "No subscription collections in this period" : "No bookings created in this period"}</p><p className="text-xs text-text-muted mt-1">{metric === "collections" ? "Captured subscription payments will appear here. Check bookings to see product adoption." : "Bookings will appear as organizations start using Ekavyu."}</p>{metric === "collections" && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setMetric("bookings")}>View booking trend <ArrowRight className="h-3.5 w-3.5" /></Button>}</div>}
              <p className="text-[11px] text-text-muted mt-3">{metric === "collections" ? "Refunded and review payments are excluded. This is cash collected, not recurring or recognized revenue." : "Bookings are counted when created, including later cancellations. Unpaid checkout placeholders are excluded."}</p>
            </CardContent>
          </Card></section>
          <section aria-label="Platform usage" className="order-1 lg:order-2"><Card padding="sm" className="shadow-none"><dl className="grid grid-cols-3 gap-3"><div><dt className="text-xs text-text-muted">Patients booked this month</dt><dd className="mt-1 font-semibold tabular-nums">{count(data.usage.patientsBookedThisMonth)}</dd></div><div><dt className="text-xs text-text-muted">Enabled doctors</dt><dd className="mt-1 font-semibold tabular-nums">{count(data.usage.enabledDoctors)}</dd></div><div><dt className="text-xs text-text-muted">Paid organizations</dt><dd className="mt-1 font-semibold tabular-nums">{count(data.organizations.paid)}</dd></div></dl></Card></section>
        </div>
        <div className="order-1 lg:order-2 min-w-0 space-y-4"><Health data={data} /><Attention data={data} /></div>
      </div>
      {data.money.undatedCaptures > 0 && <Alert variant="warning" title="Some historical collections cannot be dated">{count(data.money.undatedCaptures)} captured payments have no payment timestamp and are excluded from dated totals.</Alert>}
      <OrganizationActivity data={data} />
      <section aria-label="Recent platform activity"><Card padding="md" className="shadow-none"><CardHeader><div className="flex flex-wrap justify-between items-center gap-2"><CardTitle as="h2">Recent platform activity</CardTitle><Link href="/dashboard/audit" className={navigationClass}>View audit log <ArrowRight className="h-3.5 w-3.5" /></Link></div></CardHeader><CardContent>{data.recentActivity.length ? <ul className="divide-y divide-border">{data.recentActivity.map(event => <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"><div className="min-w-0"><p className="text-sm capitalize">{event.title}</p>{event.organizationId && event.organizationName ? <Link href={organizationWorkspaceUrl(event.organizationId)} className={`${navigationClass} text-xs`}>{event.organizationName}</Link> : <p className="text-xs text-text-muted mt-1">Platform</p>}</div><time className="text-xs text-text-muted" dateTime={event.createdAt}>{date(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</time></li>)}</ul> : <p className="text-sm text-text-muted py-2">Organization creation, subscription payments, and administrative events will appear here.</p>}</CardContent></Card></section>
    </>}
  </div>;
}
