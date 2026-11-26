"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { reportError, type PharmacyReportKind, type ReportFilters } from "@/lib/pharmacyReports";
import { money } from "./pharmacyWorkspace";

type Prepared = {
  id: string;
  locationId: string;
  requestKey: string;
  kind: string;
  state: string;
  digest?: string;
  expiresAt: string;
  failureReason?: string;
  summary: null | {
    label: string;
    timezone: string;
    asOf: string;
    startDate: string;
    endDate: string;
    rows: number;
    scanned: number;
    totals: Record<string, number | null>;
    amountColumns: Array<{ key: string; label: string }>;
    basis: string;
    totalScope: string;
  };
};

const stateBadgeVariant = (state: string) =>
  state === "ready" ? "success" : ["failed", "expired"].includes(state) ? "danger" : "info";

export function PharmacyReportExport({ kind, filters }: { kind: PharmacyReportKind; filters: ReportFilters }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const storageKey = `pharmacy-report-export:${scope}:${filters.locationId}`;
  const alive = useRef(true);
  const lock = useRef(false);
  const frozen = useRef<{ key: string; input: { kind: PharmacyReportKind; filters: ReportFilters } } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [missing, setMissing] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    try {
      const key = sessionStorage.getItem(storageKey);
      if (key && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw Error("Saved export reference needs review");
      setPending(key);
    } catch (failure) {
      setError((failure as Error).message);
    }
    return () => {
      alive.current = false;
    };
  }, [storageKey]);

  async function request() {
    if (lock.current || (pending && !frozen.current)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!frozen.current) {
        const command = { key: crypto.randomUUID(), input: { kind, filters: { ...filters, cursor: undefined } } };
        sessionStorage.setItem(storageKey, command.key);
        frozen.current = command;
        setPending(command.key);
        setCanRetry(true);
      }
      const command = frozen.current;
      const result = (await api.post("/pharmacy/report-exports", command.input, { headers: { "Idempotency-Key": command.key } })).data
        ?.data;
      if (!result || result.requestKey !== command.key || result.locationId !== filters.locationId || typeof result.id !== "string") {
        throw Error("Export request acceptance could not be confirmed. Keep the same reference");
      }
      if (current()) setCanRetry(false);
    } catch (failure) {
      const message = await reportError(failure);
      if (current()) setError(message);
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function check() {
    if (!pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMissing(false);
    try {
      const data = (await api.get(`/pharmacy/report-exports/${pending}`, { params: { locationId: filters.locationId } })).data
        ?.data as Prepared;
      if (
        !data ||
        data.locationId !== filters.locationId ||
        data.requestKey !== pending ||
        !["queued", "processing", "ready", "failed", "expired"].includes(data.state) ||
        !Number.isFinite(Date.parse(data.expiresAt)) ||
        (data.state === "ready" &&
          (!/^[a-f\d]{64}$/.test(data.digest || "") ||
            !data.summary ||
            data.summary.totalScope !== "complete" ||
            !Number.isSafeInteger(data.summary.rows) ||
            data.summary.rows < 0 ||
            data.summary.rows > 50000 ||
            !Number.isSafeInteger(data.summary.scanned) ||
            data.summary.scanned > 25000 ||
            !Array.isArray(data.summary.amountColumns) ||
            data.summary.amountColumns.length > 25))
      ) {
        throw Error("Prepared report summary could not be confirmed");
      }
      if (current()) {
        setPrepared(data);
        setCanRetry(false);
      }
    } catch (failure) {
      const message = await reportError(failure);
      if (current()) {
        setError(message);
        setMissing((failure as { response?: { status?: number } }).response?.status === 404);
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function download() {
    if (!pending || !prepared?.digest || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.get(`/pharmacy/report-exports/${pending}/download`, {
        params: { locationId: filters.locationId, expectedDigest: prepared.digest },
        responseType: "blob",
      });
      if (
        !(result.data instanceof Blob) ||
        !String(result.headers["content-type"] || "").startsWith("text/csv") ||
        result.headers["x-report-digest"] !== prepared.digest
      ) {
        throw Error("Prepared download does not match the reviewed report");
      }
      if (!current()) return;
      const url = URL.createObjectURL(result.data);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `pharmacy-${prepared.kind}-prepared.csv`;
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
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  return (
    <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-surface-alt/40 px-3 py-2.5 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-4 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Prepare a larger report in the background</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {pending && (
              <Badge variant={prepared ? stateBadgeVariant(prepared.state) : "info"} size="sm">
                {prepared ? prepared.state : "Pending"}
              </Badge>
            )}
            <ChevronDown
              size={15}
              className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>

        <div className="space-y-3 border-t border-border/60 p-3 text-xs md:p-4">
          <p className="leading-relaxed text-text-secondary">
            Uses the selected report and dates. The worker prepares one consistent snapshot, up to 25,000 source records, 50,000 rows
            and 16 MB. Requests exceeding the safe budget fail explicitly. Prepared copies expire after seven days; original business
            records remain available.
          </p>

          {error && (
            <Alert variant="error" title="Prepared export needs attention">
              {error}
            </Alert>
          )}

          {!pending && (
            <div>
              <Button
                size="xs"
                disabled={busy}
                onClick={() => {
                  void request();
                }}
              >
                Prepare background CSV export
              </Button>
            </div>
          )}

          {pending && (
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/50 p-3">
              <p className="break-all font-mono text-[11px] text-text-secondary">Request reference: {pending}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void check();
                  }}
                >
                  Check background export
                </Button>
                {canRetry && (
                  <Button
                    size="xs"
                    disabled={busy}
                    onClick={() => {
                      void request();
                    }}
                  >
                    Retry same export request
                  </Button>
                )}
                {((prepared && ["ready", "failed", "expired"].includes(prepared.state)) || missing) && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      sessionStorage.removeItem(storageKey);
                      frozen.current = null;
                      setPending(null);
                      setPrepared(null);
                      setCanRetry(false);
                      setMissing(false);
                    }}
                  >
                    Review a separate export request
                  </Button>
                )}
              </div>
            </div>
          )}

          {busy && (
            <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
              <Spinner size="sm" />
              Checking export request...
            </div>
          )}

          {prepared && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-text">
                  Status: {prepared.state}.{prepared.failureReason ? ` ${prepared.failureReason}` : ""}
                </p>
                <Badge variant={stateBadgeVariant(prepared.state)} size="sm">
                  {prepared.state}
                </Badge>
              </div>

              {prepared.summary && (
                <>
                  <div className="space-y-1 text-text-secondary">
                    <h3 className="text-xs font-semibold text-text">{prepared.summary.label}</h3>
                    <p>
                      {prepared.summary.startDate} to {prepared.summary.endDate} · {prepared.summary.rows} rows from{" "}
                      {prepared.summary.scanned} source records · Snapshot{" "}
                      {new Date(prepared.summary.asOf).toLocaleString("en-IN", { timeZone: prepared.summary.timezone })}
                    </p>
                    <p>{prepared.summary.basis}</p>
                  </div>

                  {prepared.summary.amountColumns.length > 0 && (
                    <dl className="grid grid-cols-1 gap-2 border-t border-border/60 pt-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {prepared.summary.amountColumns.map(column => (
                        <div key={column.key} className="flex items-center justify-between gap-2 rounded-lg bg-surface-alt/60 px-2.5 py-2">
                          <dt className="text-text-secondary">{column.label}</dt>
                          <dd className="font-semibold tabular-nums text-text">
                            {prepared.summary!.totals[column.key] === null
                              ? "Needs review"
                              : money(prepared.summary!.totals[column.key]! / 100)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <div>
                    <Button
                      size="xs"
                      icon={<Download size={14} aria-hidden="true" />}
                      disabled={busy}
                      onClick={() => {
                        void download();
                      }}
                    >
                      Download prepared reviewed CSV
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
