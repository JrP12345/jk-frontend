"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  Clock,
  CreditCard,
  Info,
  Package,
  RotateCcw,
  RotateCw,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { Alert, Badge, Button, Card, DatePicker, Skeleton, cn } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import {
  dailyDate,
  dailySourceReports,
  readDailyOverview,
  type DailySection,
  type DailySectionKey,
  type PharmacyDailyOverviewData,
} from "@/lib/pharmacyDailyOverview";
import type { PharmacyReportKind } from "@/lib/pharmacyReports";
import { money } from "./pharmacyWorkspace";

interface Props {
  locationId: string;
  onReport: (kind: PharmacyReportKind, date: string) => void;
  onStock: () => void;
  onDrawer: () => void;
  canViewStock: boolean;
  canViewDrawer: boolean;
}

type MetricTone = "accent" | "success" | "warning" | "danger" | "neutral";

interface MetricRow {
  label: string;
  value: string;
  danger?: boolean;
}

interface MetricCardProps {
  sectionKey: DailySectionKey;
  section: DailySection | undefined;
  data: PharmacyDailyOverviewData | null;
  busy: boolean;
  title: string;
  value: string;
  icon: ReactNode;
  tone?: MetricTone;
  subtitle?: string;
  rows?: MetricRow[];
  action?: ReactNode;
  onReport: (kind: PharmacyReportKind, date: string) => void;
}

const toneClasses: Record<MetricTone, string> = {
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  danger: "bg-danger-subtle text-danger-text",
  neutral: "bg-surface-alt text-text-secondary",
};

const stateSummary = (state: DailySection["state"]) =>
  state === "restricted"
    ? "Permission required for this section."
    : state === "not_tracked"
      ? "Not tracked in billing-only mode."
      : "Source could not be summarized here.";

function MetricCard({
  sectionKey,
  section,
  data,
  busy,
  title,
  value,
  icon,
  tone = "neutral",
  subtitle,
  rows,
  action,
  onReport,
}: MetricCardProps) {
  const ready = section?.state === "ready";
  const unavailable = Boolean(section && !ready);
  const isUnknown = value === "Unknown";
  const loadingInitial = !data && busy;

  return (
    <article
      aria-label={title}
      data-unavailable={unavailable || undefined}
      className={cn(
        "flex min-w-0 flex-col justify-between gap-2.5 rounded-xl border p-3 transition-colors sm:p-4",
        unavailable ? "border-dashed border-border bg-surface-alt/40" : "border-border bg-surface"
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3 sm:block sm:space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                unavailable ? "bg-surface-alt text-text-muted" : toneClasses[tone]
              )}
            >
              {icon}
            </span>
            <h3 className="min-w-0 text-xs font-medium text-text-secondary sm:text-[13px]">{title}</h3>
          </div>
          {loadingInitial ? (
            <Skeleton className="h-6 w-24 shrink-0 sm:h-8 sm:w-32" />
          ) : (
            <strong
              className={cn(
                "shrink-0 text-right font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:block sm:text-left",
                unavailable
                  ? "text-sm text-text-secondary sm:text-base"
                  : isUnknown
                    ? "text-sm text-warning-text sm:text-base"
                    : "text-base text-text sm:text-2xl"
              )}
            >
              {value}
            </strong>
          )}
        </div>

        {loadingInitial ? (
          <Skeleton className="h-3.5 w-36" />
        ) : (
          <>
            {ready && subtitle && <p className="text-xs leading-relaxed text-text-secondary">{subtitle}</p>}
            {unavailable && section && <p className="text-xs leading-relaxed text-text-secondary">{stateSummary(section.state)}</p>}
            {ready && rows && rows.length > 0 && (
              <dl className="space-y-1.5 border-t border-border/60 pt-2 text-xs">
                {rows.map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="min-w-0 text-text-secondary [overflow-wrap:anywhere]">{row.label}</dt>
                    <dd className={cn("shrink-0 font-semibold tabular-nums", row.danger ? "text-danger-text" : "text-text")}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>

      {(action || section) && (
        <div className="space-y-2 pt-0.5">
          {action}
          {section && (
            <details className="group border-t border-border/60 pt-2 text-xs">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-text-secondary transition-colors select-none hover:text-text [&::-webkit-details-marker]:hidden">
                <span>Details and source</span>
                <ChevronDown
                  size={14}
                  className="shrink-0 transition-transform duration-150 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-2 leading-relaxed text-text-secondary">{section.note}</p>
              {data && ready && (
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2.5"
                  onClick={() => onReport(dailySourceReports[sectionKey], data.date)}
                  iconRight={<ArrowUpRight size={13} aria-hidden="true" />}
                >
                  Review {title.toLowerCase()} source
                </Button>
              )}
            </details>
          )}
        </div>
      )}
    </article>
  );
}

export function PharmacyDailyOverview(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <DailySession key={`${scope}:${props.locationId}`} {...props} />;
}

function DailySession({ locationId, onReport, onStock, onDrawer, canViewStock, canViewDrawer }: Props) {
  const [data, setData] = useState<PharmacyDailyOverviewData | null>(null);
  const [date, setDate] = useState("");
  const [applied, setApplied] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const begin = useLatestRead();

  useEffect(() => {
    const request = begin();
    void readDailyOverview(locationId, applied, request.signal)
      .then(value => {
        if (request.isCurrent()) {
          setData(value);
          setError("");
        }
      })
      .catch(failure => {
        if (request.isCurrent()) {
          if ([401, 403, 404].includes((failure as { response?: { status?: number } })?.response?.status || 0)) {
            setData(null);
          }
          setError(failure instanceof Error ? failure.message : "Daily overview could not refresh.");
        }
      })
      .finally(() => {
        if (request.isCurrent()) setBusy(false);
      });
  }, [locationId, applied, attempt, begin]);

  function load(next: string) {
    if (next && !dailyDate(next)) {
      setError("Choose a valid business day.");
      return;
    }
    begin();
    if (next !== applied) setData(null);
    setError("");
    setBusy(true);
    setApplied(next);
    setAttempt(value => value + 1);
  }

  const amount = (section: DailySection | undefined, key: string) =>
    section?.state !== "ready"
      ? section?.state === "restricted"
        ? "Access required"
        : section?.state === "not_tracked"
          ? "Not tracked"
          : "Unavailable"
      : section.values?.[key] === null
        ? "Unknown"
        : money(section.values![key]! / 100);

  const count = (section: DailySection | undefined, key: string) =>
    section?.state !== "ready"
      ? section?.state === "restricted"
        ? "Access required"
        : section?.state === "not_tracked"
          ? "Not tracked"
          : "Unavailable"
      : section.values?.[key] === null
        ? "Unknown"
        : String(section.values![key]);

  const s = data?.sections;
  const showOverviewContent = Boolean(data) || busy;
  const collectionsReady = s?.collections.state === "ready" && s.collections.values?.totalPaise !== null;

  return (
    <section className="min-w-0 space-y-3" aria-label="Pharmacy daily overview" aria-busy={busy}>
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text md:text-base">Daily overview</h2>
            <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
              Sales, money received and credit answer different questions.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              aria-label="Refresh overview"
              title="Refresh overview"
              onClick={() => load(applied)}
              icon={<RotateCw size={14} className={busy ? "animate-spin" : ""} aria-hidden="true" />}
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {canViewDrawer && (
              <Button
                size="xs"
                variant="outline"
                aria-label="Review cash drawer"
                onClick={onDrawer}
                icon={<Wallet size={14} aria-hidden="true" />}
              >
                <span className="sm:hidden">Cash drawer</span>
                <span className="hidden sm:inline">Review cash drawer</span>
              </Button>
            )}
          </div>
        </header>

        <div className="border-b border-border/60 bg-surface-alt/50 px-3 py-2.5 md:px-4">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <form
              className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
              onSubmit={event => {
                event.preventDefault();
                load(date);
              }}
            >
              <div className="col-span-2 sm:w-48">
                <DatePicker
                  size="sm"
                  label="Overview business day"
                  className="[&_label]:sr-only"
                  placeholder="Business day (today)"
                  value={date}
                  onChange={setDate}
                />
              </div>
              <Button size="xs" type="submit" disabled={busy} className="w-full sm:w-auto">
                Load day
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDate("");
                  load("");
                }}
                className="w-full sm:w-auto"
              >
                Today
              </Button>
            </form>

            {!data && busy ? (
              <Skeleton className="h-5 w-44 rounded-full" />
            ) : (
              data && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-secondary">
                  <Badge variant="primary" dot>
                    Business day {data.date}
                  </Badge>
                  <span>
                    {data.timezone} · Snapshot {new Date(data.asOf).toLocaleString("en-IN", { timeZone: data.timezone })}
                  </span>
                </div>
              )
            )}
          </div>

          {data && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-text-secondary">
              <Info size={13} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
              <span>Current dues and stock are as of this snapshot, including when viewing an earlier day.</span>
            </p>
          )}
        </div>

        {(error ||
          (data && ["active", "expired"].includes(data.coverage.offlineSession)) ||
          data?.coverage.offlineSession === "preparing" ||
          (data && data.paymentReview !== null && data.paymentReview > 0)) && (
          <div className={cn("space-y-2.5 px-3 pt-3 md:px-4", !showOverviewContent && "pb-3 md:pb-4")}>
            {error && (
              <Alert
                variant="error"
                title="Overview needs attention"
                action={
                  !data ? (
                    <Button size="xs" variant="outline" onClick={() => load(applied)}>
                      Retry
                    </Button>
                  ) : undefined
                }
              >
                {error}
                {data && <p className="mt-1 text-xs">Showing the last successful snapshot below; these figures have not refreshed.</p>}
              </Alert>
            )}
            {data && ["active", "expired"].includes(data.coverage.offlineSession) && (
              <Alert variant="warning" title="Local counter still needs reconciliation">
                These are cloud records. The local session is still open; any unsynchronized bills are excluded. Complete totals
                require synchronizing and reconciling the original ledger.
                {data.coverage.offlineSession === "expired" && (
                  <p className="mt-1 text-xs">Local billing authority has expired. Expiry does not release branch ownership.</p>
                )}
              </Alert>
            )}
            {data?.coverage.offlineSession === "preparing" && (
              <Alert variant="info" title="Offline preparation in progress">
                The designated PC holds the branch while preparation is reviewed.
              </Alert>
            )}
            {data && data.paymentReview !== null && data.paymentReview > 0 && (
              <Alert variant="warning" title="Online payments need review">
                {data.paymentReview} payment checks need reconciliation. Pending captures are not added to confirmed collections until
                posted.
              </Alert>
            )}
          </div>
        )}

        {showOverviewContent && (
          <>
            <div className="space-y-3 p-3 md:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Today&apos;s branch pulse</h3>
                {data && collectionsReady && (
                  <Badge variant="neutral" size="sm">
                    <span className="tabular-nums">
                      Total collected {money(s.collections.values!.totalPaise! / 100)} · {s.collections.values!.receipts ?? 0} receipts
                    </span>
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                <MetricCard
                  sectionKey="sales"
                  section={s?.sales}
                  data={data}
                  busy={busy}
                  title="Sales issued"
                  value={amount(s?.sales, "grossSalesPaise")}
                  icon={<TrendingUp size={15} />}
                  tone="accent"
                  subtitle={`${count(s?.sales, "bills")} bills · Includes GST.`}
                  onReport={onReport}
                />
                <MetricCard
                  sectionKey="collections"
                  section={s?.collections}
                  data={data}
                  busy={busy}
                  title="Cash collected"
                  value={amount(s?.collections, "cashPaise")}
                  icon={<Banknote size={15} />}
                  tone="success"
                  subtitle="After change; includes older dues."
                  onReport={onReport}
                />
                <MetricCard
                  sectionKey="collections"
                  section={s?.collections}
                  data={data}
                  busy={busy}
                  title="UPI collected"
                  value={amount(s?.collections, "upiPaise")}
                  icon={<Smartphone size={15} />}
                  tone="accent"
                  subtitle="Confirmed UPI receipts; includes older dues."
                  onReport={onReport}
                />
                <MetricCard
                  sectionKey="newCredit"
                  section={s?.newCredit}
                  data={data}
                  busy={busy}
                  title="Customer credit created"
                  value={amount(s?.newCredit, "amountPaise")}
                  icon={<Users size={15} />}
                  tone="warning"
                  subtitle="Captured at issue, before later collections."
                  onReport={onReport}
                />
                <MetricCard
                  sectionKey="margin"
                  section={s?.margin}
                  data={data}
                  busy={busy}
                  title="Gross contribution"
                  value={amount(s?.margin, "contributionPaise")}
                  icon={<TrendingUp size={15} />}
                  tone="success"
                  subtitle="From this day's bills. Excludes overheads; not net profit."
                  onReport={onReport}
                />
                <MetricCard
                  sectionKey="stock"
                  section={s?.stock}
                  data={data}
                  busy={busy}
                  title="Low physical stock"
                  value={count(s?.stock, "lowPhysicalProducts")}
                  icon={<Package size={15} />}
                  tone={Number(s?.stock.values?.lowPhysicalProducts) > 0 ? "warning" : "neutral"}
                  subtitle="Review expiry, holds and saleable availability."
                  action={
                    canViewStock ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={onStock}
                        iconRight={<ArrowUpRight size={13} aria-hidden="true" />}
                      >
                        Review stock &amp; expiry
                      </Button>
                    ) : undefined
                  }
                  onReport={onReport}
                />
              </div>
            </div>

            <div className="border-t border-border/70">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-surface-alt/40 px-3 py-3 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-4 md:text-sm [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">Dues, card payments, returns and expiry</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      6 sections
                    </Badge>
                    <ChevronDown
                      size={16}
                      className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="space-y-4 border-t border-border/60 p-3 md:p-4">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                    <MetricCard
                      sectionKey="collections"
                      section={s?.collections}
                      data={data}
                      busy={busy}
                      title="Card collected"
                      value={amount(s?.collections, "cardPaise")}
                      icon={<CreditCard size={15} />}
                      tone="accent"
                      subtitle="Confirmed card receipts; includes older dues."
                      onReport={onReport}
                    />
                    <MetricCard
                      sectionKey="returns"
                      section={s?.returns}
                      data={data}
                      busy={busy}
                      title="Return credits issued"
                      value={amount(s?.returns, "creditsPaise")}
                      icon={<RotateCcw size={15} />}
                      tone="warning"
                      subtitle="Includes credits for older bills; not cash paid out."
                      onReport={onReport}
                    />
                    <MetricCard
                      sectionKey="cashMovements"
                      section={s?.cashMovements}
                      data={data}
                      busy={busy}
                      title="Other cash out"
                      value={amount(s?.cashMovements, "cashOutPaise")}
                      icon={<Wallet size={15} />}
                      tone="neutral"
                      subtitle="Cash refunds, supplier payments and cash out. Opening float is separate."
                      rows={[
                        { label: "Other cash in", value: amount(s?.cashMovements, "cashInPaise") },
                        { label: "Customer refunds, all methods", value: amount(s?.cashMovements, "refundsPaise") },
                      ]}
                      onReport={onReport}
                    />
                    <MetricCard
                      sectionKey="customerDues"
                      section={s?.customerDues}
                      data={data}
                      busy={busy}
                      title="Customer dues now"
                      value={amount(s?.customerDues, "duePaise")}
                      icon={<Users size={15} />}
                      tone="warning"
                      subtitle="All issue dates, including opening dues."
                      onReport={onReport}
                    />
                    <MetricCard
                      sectionKey="supplierDues"
                      section={s?.supplierDues}
                      data={data}
                      busy={busy}
                      title="Supplier dues now"
                      value={amount(s?.supplierDues, "duePaise")}
                      icon={<Building2 size={15} />}
                      tone="neutral"
                      rows={[{ label: "Claims awaiting credit", value: amount(s?.supplierDues, "pendingCreditPaise") }]}
                      onReport={onReport}
                    />
                    <MetricCard
                      sectionKey="stock"
                      section={s?.stock}
                      data={data}
                      busy={busy}
                      title="Lots expiring in 60 days"
                      value={count(s?.stock, "expiringLots")}
                      icon={<Clock size={15} />}
                      tone={Number(s?.stock.values?.expiringLots) > 0 ? "warning" : "neutral"}
                      rows={[
                        {
                          label: "Already expired lots",
                          value: count(s?.stock, "expiredLots"),
                          danger: Number(s?.stock.values?.expiredLots) > 0,
                        },
                      ]}
                      onReport={onReport}
                    />
                  </div>

                  {s?.stock.items.length ? (
                    <section
                      aria-label="First five low-stock products"
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-surface-alt/60 px-3 py-2.5 md:px-4">
                        <h3 className="text-xs font-semibold text-text">First five low-stock products</h3>
                        {canViewStock && (
                          <Button
                            size="xs"
                            variant="ghost"
                            aria-label="Open stock and expiry alerts"
                            onClick={onStock}
                            iconRight={<ArrowUpRight size={13} aria-hidden="true" />}
                          >
                            Open alerts
                          </Button>
                        )}
                      </div>
                      <ul className="divide-y divide-border/60">
                        {s.stock.items.map(item => (
                          <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs md:px-4">
                            <span className="min-w-0 font-medium text-text [overflow-wrap:anywhere]">{item.label}</span>
                            <Badge variant={item.units === 0 ? "danger" : "warning"} size="sm">
                              <span className="tabular-nums">
                                {item.units} {item.unit}
                              </span>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </details>
            </div>
          </>
        )}

        <footer className="flex items-start gap-1.5 border-t border-border/60 bg-surface-alt/40 px-3 py-2.5 text-[11px] text-text-secondary md:px-4">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Unavailable sections need source review or a larger report export. Access-required sections remain hidden by permission.
            No unknown amount is treated as zero.
          </span>
        </footer>
      </Card>
    </section>
  );
}
