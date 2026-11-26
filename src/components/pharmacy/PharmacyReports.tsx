"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Info } from "lucide-react";
import { Alert, Badge, Button, Card, DatePicker, Select, Spinner, cn } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { hasAnyPermission } from "@/lib/permissions";
import {
  readReportChoices,
  readPharmacyReport,
  downloadReport,
  reportError,
  type PharmacyReportKind,
  type PharmacyReportPage,
  type ReportFilters,
  type ReportChoice,
  type ReportColumn,
} from "@/lib/pharmacyReports";
import { PharmacyAccountingExport } from "./PharmacyAccountingExport";
import { PharmacyMerchantSettlements } from "./PharmacyMerchantSettlements";
import { PharmacyReportExport } from "./PharmacyReportExport";

const currentKinds = new Set([
  "stock",
  "low_stock",
  "expiry",
  "valuation",
  "dead_stock",
  "stock_velocity",
  "expiry_value",
  "supplier_dues",
  "customer_dues",
]);

const elapsedDayKinds = new Set(["expiry", "expiry_value", "dead_stock", "stock_velocity"]);

export function PharmacyReports({
  locationId,
  initial,
}: {
  locationId: string;
  initial?: { kind: PharmacyReportKind; date: string };
}) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <ReportSession key={`${scope}:${locationId}:${initial?.kind || ""}:${initial?.date || ""}`} locationId={locationId} initial={initial} />;
}

function ReportSession({ locationId, initial }: { locationId: string; initial?: { kind: PharmacyReportKind; date: string } }) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const mobile = useMobileViewport();
  const alive = useRef(true);
  const beginRead = useLatestRead();
  const [choices, setChoices] = useState<ReportChoice[]>([]);
  const [kind, setKind] = useState<PharmacyReportKind | "">("");
  const [catalogueBusy, setCatalogueBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const [start, setStart] = useState(initial && !currentKinds.has(initial.kind) ? initial.date : "");
  const [end, setEnd] = useState(initial && !currentKinds.has(initial.kind) ? initial.date : "");
  const [days, setDays] = useState("90");
  const [limit, setLimit] = useState("25");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<{ page: PharmacyReportPage; filters: ReportFilters } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const request = beginRead();
    void readReportChoices(locationId, request.signal)
      .then(items => {
        if (request.isCurrent()) {
          setChoices(items);
          setKind(items.find(item => item.kind === initial?.kind)?.kind || items[0]?.kind || "");
        }
      })
      .catch(async failure => {
        const message = await reportError(failure);
        if (request.isCurrent()) setError(message);
      })
      .finally(() => {
        if (request.isCurrent()) setCatalogueBusy(false);
      });
  }, [beginRead, locationId, retry, initial?.kind]);

  function change(action: () => void) {
    beginRead();
    setLoaded(null);
    setBusy(false);
    setError("");
    action();
  }

  async function load(cursor?: string, complete = false) {
    if (!kind || exporting) return;
    const request = beginRead();
    setBusy(true);
    setLoaded(null);
    setError("");
    const filters: ReportFilters = {
      locationId,
      days: Number(days),
      limit: Number(limit),
      ...(!currentKinds.has(kind) && (start || end) ? { startDate: start, endDate: end } : {}),
      ...(cursor ? { cursor } : {}),
    };
    try {
      const page = await readPharmacyReport(kind, filters, request.signal, complete);
      if (request.isCurrent()) setLoaded({ page, filters });
    } catch (failure) {
      const message = await reportError(failure);
      if (request.isCurrent()) setError(message);
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function exportPage() {
    if (!loaded || busy || exporting || !current()) return;
    setExporting(true);
    setError("");
    try {
      const blob = await downloadReport(loaded.page, loaded.filters);
      if (!current()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `pharmacy-${loaded.page.kind}-${loaded.page.endDate}.csv`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (failure) {
      const message = await reportError(failure);
      if (current()) setError(message);
    } finally {
      if (current()) setExporting(false);
    }
  }

  const page = loaded?.page;
  const showDates = Boolean(kind) && !currentKinds.has(kind);
  const showElapsed = Boolean(kind) && elapsedDayKinds.has(kind);
  const canSettlements = hasAnyPermission(
    user,
    "PHARMACY_VIEW_FINANCE",
    "PHARMACY_APPROVE_REFUND",
    "PHARMACY_PURCHASE",
    "MANAGE_ORGANIZATION"
  );

  return (
    <section className="min-w-0 space-y-3" aria-label="Pharmacy operational reports">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text md:text-base">Operational reports</h2>
            <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
              Source records stay separate: supply, receipts, credits, dues and physical stock answer different questions.
            </p>
          </div>
          {choices.length > 0 && (
            <Badge variant="neutral" size="sm" className="shrink-0">
              {choices.length} reports
            </Badge>
          )}
        </header>

        {error && (
          <div className="px-3 pt-3 md:px-4">
            <Alert variant="error" title="Report unavailable">
              {error}
            </Alert>
          </div>
        )}

        {catalogueBusy ? (
          <div role="status" className="flex items-center gap-2 p-4 text-xs text-text-secondary">
            <Spinner size="sm" />
            Checking report access...
          </div>
        ) : !choices.length ? (
          <div className="space-y-3 p-4 text-xs text-text-secondary">
            <p>No report source is available with your current permissions.</p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setCatalogueBusy(true);
                setError("");
                setRetry(value => value + 1);
              }}
            >
              Recheck report access
            </Button>
          </div>
        ) : (
          <>
            <form
              className="border-b border-border/60 bg-surface-alt/40 p-3 md:px-4"
              onSubmit={event => {
                event.preventDefault();
                void load();
              }}
            >
              <fieldset className="min-w-0 space-y-3" disabled={exporting}>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-12 md:items-end md:gap-3">
                  <div
                    className={cn(
                      "col-span-2",
                      showDates ? "md:col-span-5" : showElapsed ? "md:col-span-6" : "md:col-span-8"
                    )}
                  >
                    <Select
                      size="sm"
                      label="Operational report"
                      value={kind}
                      onChange={event => change(() => setKind(event.target.value as PharmacyReportKind))}
                      options={choices.map(row => ({ value: row.kind, label: row.label }))}
                    />
                  </div>

                  {showDates && (
                    <div className="col-span-2 md:col-span-4">
                      <DatePicker
                        size="sm"
                        mode="range"
                        label="Report dates"
                        placeholder="Last 30 days (or pick range)"
                        startDate={start}
                        endDate={end}
                        onRangeChange={range =>
                          change(() => {
                            setStart(range.startDate);
                            setEnd(range.endDate);
                          })
                        }
                      />
                    </div>
                  )}

                  {showElapsed && (
                    <div className="col-span-1 md:col-span-3">
                      <Select
                        size="sm"
                        label="Report elapsed-day window"
                        value={days}
                        onChange={event => change(() => setDays(event.target.value))}
                        options={[30, 60, 90, 180, 365].map(value => ({ value: String(value), label: `${value} days` }))}
                      />
                    </div>
                  )}

                  <div
                    className={cn(
                      showElapsed ? "col-span-1 md:col-span-3" : showDates ? "col-span-2 md:col-span-3" : "col-span-2 md:col-span-4"
                    )}
                  >
                    <Select
                      size="sm"
                      label="Source page size"
                      value={limit}
                      onChange={event => change(() => setLimit(event.target.value))}
                      options={[1, 5, 10, 25].map(value => ({ value: String(value), label: `${value} source records` }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                    <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      {showDates
                        ? "Choose both local dates, up to 93 calendar days, or leave both empty for the last 30 days. "
                        : ""}
                      Complete reports use one snapshot up to 2,000 source records and result rows.
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                    <Button size="xs" type="submit" disabled={busy} className="w-full sm:w-auto">
                      Load report
                    </Button>
                    <Button
                      size="xs"
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="w-full sm:w-auto"
                      onClick={() => {
                        void load(undefined, true);
                      }}
                    >
                      Load complete report
                    </Button>
                  </div>
                </div>
              </fieldset>
            </form>

            {busy && (
              <div role="status" className="flex items-center gap-2 border-b border-border/60 px-3 py-3 text-xs text-text-secondary md:px-4">
                <Spinner size="sm" />
                Loading report sources...
              </div>
            )}

            {page && (
              <section aria-label="Reviewed report page">
                <header className="space-y-1.5 border-b border-border/60 px-3 py-3 md:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text">{page.label}</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={page.totalScope === "complete" ? "success" : "primary"} size="sm">
                        {page.totalScope === "complete" ? "Complete snapshot" : "Current page"}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        <span className="tabular-nums">
                          {page.rows.length} rows · {page.scanned} scanned
                        </span>
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{page.basis}</p>
                  <p className="text-[11px] text-text-secondary">
                    Read {new Date(page.asOf).toLocaleString("en-IN", { timeZone: page.timezone })} ({page.timezone}).{" "}
                    {currentKinds.has(page.kind) ? "Current balances and stock." : `Period ${page.startDate} to ${page.endDate}.`}
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    {page.rows.length} result rows from {page.scanned} source records.{" "}
                    {page.totalScope === "complete"
                      ? "Complete result and totals from one snapshot."
                      : "Amount subtotals cover this page only. Pages are separate live snapshots."}
                  </p>
                </header>

                {!page.rows.length ? (
                  <p className="px-3 py-8 text-center text-xs text-text-secondary md:px-4">
                    {page.nextCursor ? "No matches on this source page. Continue to the next page." : "No matching source rows on this page."}
                  </p>
                ) : mobile ? (
                  <div className="divide-y divide-border/60">
                    {page.rows.map(row => {
                      const [firstColumn, ...restColumns] = page.columns;
                      return (
                        <article key={row.id} className="space-y-2 px-3 py-3">
                          {firstColumn && (
                            <p className="text-xs font-semibold text-text [overflow-wrap:anywhere]">
                              {cell(row[firstColumn.key], firstColumn, page.timezone)}
                            </p>
                          )}
                          {restColumns.length > 0 && (
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              {restColumns.map(column => {
                                const formatted = cell(row[column.key], column, page.timezone);
                                const needsReview = formatted === "Needs review";
                                return (
                                  <div key={column.key} className="min-w-0">
                                    <dt className="text-[11px] text-text-secondary">{column.label}</dt>
                                    <dd
                                      className={cn(
                                        "font-medium [overflow-wrap:anywhere]",
                                        needsReview ? "text-warning-text" : "text-text",
                                        ["paise", "integer"].includes(column.format) && "tabular-nums"
                                      )}
                                    >
                                      {formatted}
                                    </dd>
                                  </div>
                                );
                              })}
                            </dl>
                          )}
                        </article>
                      );
                    })}

                    {Object.keys(page.totals).length > 0 && (
                      <div className="space-y-2 bg-surface-alt/60 px-3 py-3">
                        <p className="text-[11px] font-semibold tracking-wide text-text-secondary uppercase">
                          {page.totalScope === "complete" ? "Complete result totals" : "This page only totals"}
                        </p>
                        <dl className="space-y-1.5 text-xs">
                          {page.columns
                            .filter(column => Object.hasOwn(page.totals, column.key))
                            .map(column => {
                              const formatted = cell(page.totals[column.key], column, page.timezone);
                              return (
                                <div key={column.key} className="flex items-center justify-between gap-3">
                                  <dt className="text-text-secondary">{column.label}</dt>
                                  <dd
                                    className={cn(
                                      "font-semibold tabular-nums",
                                      formatted === "Needs review" ? "text-warning-text" : "text-text"
                                    )}
                                  >
                                    {formatted}
                                  </dd>
                                </div>
                              );
                            })}
                        </dl>
                      </div>
                    )}
                  </div>
                ) : (
                  <div tabIndex={0} role="region" aria-label="Report data table" className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <caption className="sr-only">
                        {page.label} · {page.currency} · {page.totalScope === "complete" ? "complete result" : "current page"}
                      </caption>
                      <thead>
                        <tr className="border-b border-border/80 bg-surface-alt/70 font-semibold text-text-secondary">
                          {page.columns.map(column => (
                            <th
                              key={column.key}
                              scope="col"
                              className={cn(
                                "min-w-[6.5rem] px-3 py-2.5 align-top",
                                ["paise", "integer"].includes(column.format) && "text-right"
                              )}
                            >
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {page.rows.map(row => (
                          <tr key={row.id} className="hover:bg-surface-hover/50">
                            {page.columns.map(column => {
                              const formatted = cell(row[column.key], column, page.timezone);
                              return (
                                <td
                                  key={column.key}
                                  className={cn(
                                    "min-w-[6.5rem] px-3 py-2.5 align-top [overflow-wrap:anywhere]",
                                    ["paise", "integer"].includes(column.format) && "text-right tabular-nums",
                                    formatted === "Needs review" ? "font-medium text-warning-text" : "text-text"
                                  )}
                                >
                                  {formatted}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-border/80 bg-surface-alt/60 font-semibold text-text">
                        <tr>
                          {page.columns.map((column, index) => {
                            const hasTotal = Object.hasOwn(page.totals, column.key);
                            const formatted = hasTotal
                              ? cell(page.totals[column.key], column, page.timezone)
                              : index === 0
                                ? page.totalScope === "complete"
                                  ? "Complete result"
                                  : "This page only"
                                : "";
                            return (
                              <td
                                key={column.key}
                                className={cn(
                                  "min-w-[6.5rem] px-3 py-2.5 align-top",
                                  ["paise", "integer"].includes(column.format) && "text-right tabular-nums",
                                  formatted === "Needs review" && "text-warning-text"
                                )}
                              >
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <footer className="space-y-2.5 border-t border-border/70 bg-surface-alt/40 px-3 py-3 md:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || exporting}
                        onClick={() => {
                          void load();
                        }}
                      >
                        First report page
                      </Button>
                      {page.nextCursor && (
                        <Button
                          size="xs"
                          disabled={busy || exporting}
                          onClick={() => {
                            void load(page.nextCursor!);
                          }}
                        >
                          Next report page
                        </Button>
                      )}
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      icon={<Download size={14} aria-hidden="true" />}
                      disabled={busy || exporting || !page.rows.length}
                      className="w-full sm:w-auto"
                      onClick={() => {
                        void exportPage();
                      }}
                    >
                      {exporting
                        ? "Preparing reviewed export..."
                        : page.totalScope === "complete"
                          ? "Export complete reviewed CSV"
                          : "Export reviewed page CSV"}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-text-secondary">
                    Export requires the page to remain unchanged and records an audit. Refresh and review if the source changes. Choose
                    Load complete report for all matching sources within the safe read budget. Ordinary page exports include only that
                    reviewed page.
                  </p>
                </footer>
              </section>
            )}
          </>
        )}
      </Card>

      {!catalogueBusy && choices.length > 0 && kind && (
        <PharmacyReportExport
          key={locationId}
          kind={kind}
          filters={{
            locationId,
            days: Number(days),
            limit: Number(limit),
            ...(showDates && (start || end) ? { startDate: start, endDate: end } : {}),
          }}
        />
      )}

      {loaded && page && <PharmacyAccountingExport key={page.digest} page={page} filters={loaded.filters} />}

      {canSettlements && <PharmacyMerchantSettlements locationId={locationId} />}
    </section>
  );
}

function cell(value: string | number | null | undefined, column: ReportColumn, timezone: string) {
  if (value === null || value === undefined) return "Needs review";
  if (column.format === "paise") {
    const paise = BigInt(value);
    const absolute = paise < BigInt(0) ? -paise : paise;
    return `${paise < BigInt(0) ? "−" : ""}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(absolute / BigInt(100))}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
  }
  if (column.format === "date") return new Date(String(value)).toLocaleString("en-IN", { timeZone: timezone });
  return String(value) || "—";
}
