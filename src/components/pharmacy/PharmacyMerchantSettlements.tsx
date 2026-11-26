"use client";

import { useRef, useState } from "react";
import { ChevronDown, CreditCard } from "lucide-react";
import { Alert, Badge, Button, Card, DatePicker, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import api from "@/lib/api";
import { money } from "./pharmacyWorkspace";

type Item = {
  paymentId: string;
  invoiceId: string;
  settlementId: string | null;
  amountPaise: number | null;
  creditPaise: number | null;
  debitPaise: number | null;
  feePaise: number | null;
  taxPaise: number | null;
  ledgerState: string;
  matched: boolean;
};

type Page = {
  locationId: string;
  date: string;
  currency: string;
  items: Item[];
  nextSkip: number | null;
  scanned: number;
  basis: string;
};

export function PharmacyMerchantSettlements({ locationId }: { locationId: string }) {
  const [date, setDate] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const begin = useLatestRead();
  const lock = useRef(false);

  async function load(skip = 0) {
    if (lock.current || !date) return;
    lock.current = true;
    const request = begin();
    setBusy(true);
    setPage(null);
    setError("");
    try {
      const value = (await api.get("/pharmacy/merchant-settlements", { params: { locationId, date, skip }, signal: request.signal }))
        .data?.data as Page;
      if (
        !value ||
        value.locationId !== locationId ||
        value.date !== date ||
        value.currency !== "INR" ||
        !Array.isArray(value.items) ||
        value.items.length > 100 ||
        !Number.isSafeInteger(value.scanned) ||
        value.scanned < 0 ||
        value.scanned > 100 ||
        typeof value.basis !== "string" ||
        (value.nextSkip !== null && value.nextSkip !== skip + 100) ||
        value.items.some(
          row =>
            !row.paymentId ||
            !row.invoiceId ||
            typeof row.matched !== "boolean" ||
            [row.amountPaise, row.creditPaise, row.debitPaise, row.feePaise, row.taxPaise].some(
              amount => amount !== null && (!Number.isSafeInteger(amount) || amount < 0)
            )
        )
      ) {
        throw Error("Settlement report could not be confirmed");
      }
      if (request.isCurrent()) setPage(value);
    } catch (failure) {
      if (request.isCurrent()) {
        setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure as Error).message);
      }
    } finally {
      lock.current = false;
      if (request.isCurrent()) setBusy(false);
    }
  }

  const amount = (value: number | null) => (value === null ? "Needs review" : money(value / 100));

  return (
    <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-surface-alt/40 px-3 py-3 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-4 md:text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <CreditCard size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Reconcile pharmacy merchant settlements</span>
          </span>
          <ChevronDown
            size={16}
            className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-3 border-t border-border/60 p-3 md:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <DatePicker
                size="sm"
                label="Merchant settlement date"
                placeholder="Choose settlement date"
                value={date}
                onChange={value => {
                  begin();
                  setDate(value);
                  setPage(null);
                  setBusy(false);
                  setError("");
                }}
              />
            </div>
            <Button
              size="xs"
              disabled={busy || !date}
              loading={busy}
              onClick={() => {
                void load();
              }}
            >
              Load merchant settlement page
            </Button>
          </div>

          {error && (
            <Alert variant="error" title="Settlement report unavailable">
              {error}
            </Alert>
          )}

          {busy && (
            <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
              <Spinner size="sm" />
              Checking merchant settlement records...
            </div>
          )}

          {page && (
            <div className="space-y-3">
              <div className="space-y-1 rounded-xl border border-border/60 bg-surface-alt/50 px-3 py-2.5 text-xs text-text-secondary">
                <p>{page.basis}</p>
                <p>
                  {page.scanned} merchant source records checked; {page.items.length} matched to this branch.
                </p>
              </div>

              {page.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-text-secondary">
                  No merchant settlements matched this branch on {page.date}.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {page.items.map(row => (
                    <article key={row.paymentId} className="space-y-2.5 rounded-xl border border-border bg-surface p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <strong className="block break-all text-xs font-semibold text-text">{row.paymentId}</strong>
                          <p className="mt-0.5 text-[11px] text-text-secondary">
                            Settlement {row.settlementId || "Needs review"}
                          </p>
                        </div>
                        <Badge variant={row.matched ? "success" : "warning"} size="sm">
                          {row.matched ? "Matches posted pharmacy receipt" : "Reconciliation required"}
                        </Badge>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/60 pt-2 text-xs sm:grid-cols-3">
                        {[
                          { label: "Amount", value: amount(row.amountPaise) },
                          { label: "Credit", value: amount(row.creditPaise) },
                          { label: "Debit", value: amount(row.debitPaise) },
                          { label: "Fee", value: amount(row.feePaise) },
                          { label: "Tax", value: amount(row.taxPaise) },
                        ].map(metric => (
                          <div key={metric.label}>
                            <dt className="text-[11px] text-text-secondary">{metric.label}</dt>
                            <dd className="font-semibold tabular-nums text-text">{metric.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              )}

              {page.nextSkip !== null && (
                <div>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void load(page.nextSkip!);
                    }}
                  >
                    Next merchant settlement page
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
