"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Alert, Button, Checkbox, Input, Select, cn } from "@/components/ui";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import {
  customerStatement,
  refundSource,
  refundInvoicePage,
  type CustomerStatement,
  type RefundSource,
} from "@/lib/pharmacyFinance";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyFinancePartyLookup } from "./PharmacyFinancePartyLookup";
import { PharmacyCollections } from "./PharmacyCollections";
import type { FinanceCommand } from "./PharmacyFinance";
import { money } from "./pharmacyWorkspace";

export function PharmacyCustomerFinance({
  locationId,
  command,
  canSettle,
  canCollect,
  canViewSales,
  locked,
  resume,
}: {
  locationId: string;
  command: FinanceCommand;
  canSettle: boolean;
  canCollect: boolean;
  canViewSales: boolean;
  locked: boolean;
  resume: number;
}) {
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [refund, setRefund] = useState<RefundSource | null>(null);
  const [error, setError] = useState("");
  const [collectId, setCollectId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [number, setNumber] = useState("");
  const [invoices, setInvoices] = useState<Array<{ id: string; invoiceNumber: string }>>([]);
  const [next, setNext] = useState<string | null>(null);
  const beginRead = useLatestRead();
  const beginRefund = useLatestRead();
  const beginSearch = useLatestRead();

  const openRefund = useCallback(
    async (id: string) => {
      const request = beginRefund();
      setError("");
      setRefund(null);
      try {
        const value = await refundSource(id, locationId, request.signal);
        if (request.isCurrent()) setRefund(value);
      } catch (failure) {
        if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
      }
    },
    [beginRefund, locationId]
  );

  async function openStatement(id: string) {
    const request = beginRead();
    setError("");
    setStatement(null);
    setRefund(null);
    setCollectId(null);
    setPage(0);
    try {
      const value = await customerStatement(id, locationId, request.signal);
      if (request.isCurrent()) setStatement(value);
    } catch (failure) {
      if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
    }
  }

  useEffect(() => {
    if (resume && command.pending?.kind === "customer_refund") void openRefund(command.pending.sourceId);
  }, [resume, command.pending, openRefund]);

  async function searchInvoices(cursor?: string) {
    const request = beginSearch();
    setError("");
    try {
      const result = await refundInvoicePage(locationId, number.trim(), cursor, request.signal);
      if (request.isCurrent()) {
        setInvoices(result.items);
        setNext(result.nextCursor);
      }
    } catch (failure) {
      if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
    }
  }

  const statementMetrics = statement
    ? [
        { label: "Due", value: statement.totals.duePaise, highlight: true },
        { label: "Refund payable", value: statement.totals.refundPayablePaise },
        { label: "Already refunded", value: statement.totals.refundedPaise },
      ]
    : [];

  return (
    <section className="min-w-0 space-y-4" aria-label="Customer dues and refunds">
      <PharmacyFinancePartyLookup
        locationId={locationId}
        kind="customer"
        disabled={locked || Boolean(command.pending)}
        onSelect={party => {
          void openStatement(party.id);
        }}
      />

      {error && (
        <Alert variant="error" title="Customer balance unavailable">
          {error}
        </Alert>
      )}

      {statement && (
        <section
          aria-label="Customer balance statement"
          className="space-y-3 rounded-xl border border-border/70 bg-surface p-3 md:p-4"
        >
          <div className="space-y-2.5">
            <h3 className="break-words text-sm font-semibold text-text md:text-base">{statement.customerName}</h3>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {statementMetrics.map(item => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-xl border border-border/70 p-2.5",
                    item.highlight ? "bg-accent-subtle/40" : "bg-surface-alt/40"
                  )}
                >
                  <dt className="text-[11px] font-medium text-text-secondary">{item.label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-text sm:text-base">
                    {money(item.value / 100)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {statement.invoices.length > 0 && (
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
              {statement.invoices.slice(page * 25, (page + 1) * 25).map(row => (
                <article
                  key={row.invoiceId}
                  className="flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between md:px-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <strong className="block break-all text-xs font-semibold text-text">
                      {row.documentVersion === 3 ? "Opening balance statement " : "Invoice "}
                      {row.invoiceNumber}
                    </strong>
                    <small className="block text-[11px] tabular-nums text-text-secondary">
                      Due {money(row.balancePaise / 100)} · Refund payable {money(row.refundPayablePaise / 100)}
                    </small>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canViewSales && (
                      <Button
                        size="xs"
                        disabled={locked || Boolean(command.pending)}
                        onClick={() => setCollectId(row.invoiceId)}
                      >
                        Open document receipts {row.invoiceNumber}
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={locked || Boolean(command.pending)}
                      onClick={() => {
                        void openRefund(row.invoiceId);
                      }}
                    >
                      Review refund {row.invoiceNumber}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {(page > 0 || (page + 1) * 25 < statement.invoices.length) && (
            <div className="flex flex-wrap items-center gap-2">
              {page > 0 && (
                <Button size="xs" variant="outline" onClick={() => setPage(value => value - 1)}>
                  Previous customer balance page
                </Button>
              )}
              {(page + 1) * 25 < statement.invoices.length && (
                <Button size="xs" variant="outline" onClick={() => setPage(value => value + 1)}>
                  Next customer balance page
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/25 p-3 md:p-3.5">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={event => {
            event.preventDefault();
            void searchInvoices();
          }}
        >
          <div className="min-w-0 flex-1 sm:max-w-md">
            <Input
              size="sm"
              icon={<Search size={15} aria-hidden="true" />}
              label="Find refund bill number"
              placeholder="Search bill number with refundable credit"
              value={number}
              maxLength={50}
              disabled={locked || Boolean(command.pending)}
              onChange={event => setNumber(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            type="submit"
            className="w-full shrink-0 sm:w-auto"
            disabled={locked || Boolean(command.pending)}
          >
            Find refundable bills
          </Button>
        </form>

        {(invoices.length > 0 || next) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {invoices.map(row => (
              <Button
                size="xs"
                variant="outline"
                key={row.id}
                disabled={locked || Boolean(command.pending)}
                onClick={() => {
                  void openRefund(row.id);
                }}
              >
                Review refund bill {row.invoiceNumber}
              </Button>
            ))}
            {next && (
              <Button
                size="xs"
                variant="outline"
                disabled={locked || Boolean(command.pending)}
                onClick={() => {
                  void searchInvoices(next);
                }}
              >
                Next refund bill page
              </Button>
            )}
          </div>
        )}
      </div>

      {refund && (
        <CustomerRefundForm
          key={`${refund.invoiceId}:${refund.paymentRevision}`}
          source={refund}
          disabled={
            locked ||
            !canSettle ||
            Boolean(command.pending && (command.pending.kind !== "customer_refund" || command.pending.sourceId !== refund.invoiceId))
          }
          onSubmit={input => {
            void command.submit("customer_refund", refund.invoiceId, input);
          }}
        />
      )}

      {collectId && (
        <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-3 md:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <h4 className="text-xs font-semibold text-text md:text-sm">Document receipts</h4>
            <Button size="xs" variant="outline" onClick={() => setCollectId(null)}>
              Close document receipts
            </Button>
          </div>
          <PharmacyCollections key={collectId} locationId={locationId} canCollect={canCollect} initialInvoiceId={collectId} />
        </div>
      )}
    </section>
  );
}

function CustomerRefundForm({
  source,
  disabled,
  onSubmit,
}: {
  source: RefundSource;
  disabled: boolean;
  onSubmit: (input: object) => void;
}) {
  const [drawerReady, setDrawerReady] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [review, setReview] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || !drawerReady) return;
    const amountPaise = parseReceiptPaise(amount);
    if (
      !confirmed ||
      amountPaise === null ||
      amountPaise <= 0 ||
      amountPaise > source.refundPayablePaise ||
      reference.trim().length < 3 ||
      review.trim().length < 3
    ) {
      setError("Confirm actual payout, its reference and an exact amount within the refund payable.");
      return;
    }
    onSubmit({
      locationId: source.locationId,
      invoiceId: source.invoiceId,
      expectedPaymentRevision: source.paymentRevision,
      expectedRefundPayablePaise: source.refundPayablePaise,
      amountPaise,
      paymentMethod: method,
      referenceNumber: reference.trim(),
      reviewReference: review.trim(),
      manualConfirmed: true,
    });
  }

  const refundMetrics = [
    { label: "Actual received", value: source.paidPaise },
    { label: "Credits", value: source.creditedPaise },
    { label: "Refunded", value: source.refundedPaise },
    { label: "Refund payable", value: source.refundPayablePaise, highlight: true },
  ];

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4"
      aria-label="Customer refund source"
    >
      <div className="space-y-2.5">
        <h3 className="break-words text-sm font-semibold text-text">
          {source.invoiceNumber} · {source.customerName}
        </h3>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {refundMetrics.map(item => (
            <div
              key={item.label}
              className={cn(
                "rounded-xl border border-border/70 p-2.5",
                item.highlight ? "bg-accent-subtle/40" : "bg-surface"
              )}
            >
              <dt className="text-[11px] font-medium text-text-secondary">{item.label}</dt>
              <dd className="mt-0.5 break-words text-xs font-semibold tabular-nums text-text sm:text-sm">
                {money(item.value / 100)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {error && (
        <Alert variant="error" title="Check actual payout">
          {error}
        </Alert>
      )}

      <PharmacyDrawerGate locationId={source.locationId} onReady={setDrawerReady} />

      <form onSubmit={submit}>
        <fieldset disabled={disabled || !drawerReady || source.refundPayablePaise === 0} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              size="sm"
              label="Actual customer refund (INR)"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
            <Select
              size="sm"
              label="Customer refund method"
              value={method}
              onChange={event => setMethod(event.target.value)}
              options={["cash", "upi", "card", "bank"].map(value => ({ value, label: value.toUpperCase() }))}
            />
            <Input
              size="sm"
              label="Actual customer refund reference"
              value={reference}
              maxLength={200}
              onChange={event => setReference(event.target.value)}
            />
            <Input
              size="sm"
              label="Customer payout review reference"
              value={review}
              maxLength={200}
              onChange={event => setReview(event.target.value)}
            />
          </div>

          <Checkbox
            label="I confirmed that this refund was actually paid"
            checked={confirmed}
            onChange={event => setConfirmed(event.target.checked)}
          />

          <div>
            <Button size="xs" type="submit">
              Record actual customer refund
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
