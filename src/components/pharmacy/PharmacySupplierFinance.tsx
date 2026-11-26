"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Checkbox, DatePicker, Input, Select, cn } from "@/components/ui";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import {
  supplierStatement,
  supplierReturnSource,
  supplierReturnQuote,
  type FinanceKind,
  type SupplierStatement,
  type SupplierReturnSource,
  type SupplierReturnQuote,
} from "@/lib/pharmacyFinance";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyFinancePartyLookup } from "./PharmacyFinancePartyLookup";
import { PharmacyExpiryReturnPreparation } from "./PharmacyExpiryReturnPreparation";
import type { FinanceCommand } from "./PharmacyFinance";
import { money } from "./pharmacyWorkspace";

const SETTLEMENT_TITLES = {
  supplier_payment: "Confirm actual supplier payment",
  supplier_credit: "Record actual supplier credit note",
  supplier_refund: "Confirm supplier refund received",
} as const;

export function PharmacySupplierFinance({
  locationId,
  command,
  canSettle,
  canReturn,
  locked,
  resume,
  initialReturn,
}: {
  locationId: string;
  command: FinanceCommand;
  canSettle: boolean;
  canReturn: boolean;
  locked: boolean;
  resume: number;
  refresh?: number;
  initialReturn?: { purchaseId: string; batchId: string };
}) {
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [source, setSource] = useState<SupplierReturnSource | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<FinanceKind>(
    canReturn && (!canSettle || initialReturn) ? "supplier_return" : "supplier_payment"
  );
  const [page, setPage] = useState(0);
  const beginRead = useLatestRead();
  const beginSource = useLatestRead();
  const [expirySeed, setExpirySeed] = useState<{
    purchaseId: string;
    quantities: Record<string, string>;
    serial: number;
  } | null>(null);

  const loadStatement = useCallback(
    async (id: string) => {
      const request = beginRead();
      setError("");
      setStatement(null);
      try {
        const value = await supplierStatement(id, locationId, request.signal);
        if (request.isCurrent()) {
          setStatement(value);
          setPage(0);
        }
      } catch (failure) {
        if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
      }
    },
    [beginRead, locationId]
  );

  const loadSource = useCallback(
    async (id: string) => {
      const request = beginSource();
      setError("");
      setSource(null);
      try {
        const value = await supplierReturnSource(id, locationId, request.signal);
        if (request.isCurrent()) {
          setSource(value);
          await loadStatement(value.supplierId);
        }
      } catch (failure) {
        if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
      }
    },
    [beginSource, loadStatement, locationId]
  );

  useEffect(() => {
    const ref = command.pending;
    if (!resume || !ref || !ref.kind.startsWith("supplier_")) return;
    setMode(ref.kind);
    if (ref.kind === "supplier_return") void loadSource(ref.sourceId);
    else void loadStatement(ref.sourceId);
  }, [resume, command.pending, loadSource, loadStatement]);

  const initialLoaded = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || initialLoaded.current || !initialReturn || !canReturn || locked || command.pending) return;
      initialLoaded.current = true;
      void loadSource(initialReturn.purchaseId);
    });
    return () => {
      active = false;
    };
  }, [initialReturn, canReturn, locked, command.pending, loadSource]);

  const metrics = statement
    ? [
        { label: "Due", value: statement.totals.duePaise, highlight: true },
        { label: "Total obligations", value: statement.totals.payablePaise },
        { label: "Paid", value: statement.totals.paidPaise },
        { label: "Actual credits", value: statement.totals.confirmedCreditPaise },
        { label: "Opening dues", value: statement.totals.openingDuePaise || 0 },
        { label: "Pending supplier credits", value: statement.totals.pendingCreditPaise },
        { label: "Refund receivable", value: statement.totals.supplierRefundReceivablePaise },
      ]
    : [];

  return (
    <section className="min-w-0 space-y-4" aria-label="Supplier finance">
      {canReturn && (
        <PharmacyExpiryReturnPreparation
          locationId={locationId}
          disabled={locked || Boolean(command.pending)}
          onReviewInvoice={(purchaseId, quantities) => {
            setExpirySeed(previous => ({ purchaseId, quantities, serial: (previous?.serial || 0) + 1 }));
            setMode("supplier_return");
            void loadSource(purchaseId);
          }}
        />
      )}

      <PharmacyFinancePartyLookup
        locationId={locationId}
        kind="supplier"
        disabled={locked || Boolean(command.pending)}
        onSelect={party => {
          setSource(null);
          void loadStatement(party.id);
        }}
      />

      {error && (
        <Alert variant="error" title="Supplier balance unavailable">
          {error}
        </Alert>
      )}

      {statement && (
        <div className="space-y-4">
          <section
            aria-label="Supplier balance statement"
            className="space-y-3 rounded-xl border border-border/70 bg-surface p-3 md:p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_19rem] md:items-end">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3 className="break-words text-sm font-semibold text-text md:text-base">{statement.supplierName}</h3>
                <Badge variant="neutral" size="sm">
                  {statement.currency}
                </Badge>
              </div>
              <Select
                size="sm"
                label="Supplier financial action"
                value={mode}
                disabled={locked || Boolean(command.pending)}
                onChange={event => {
                  setMode(event.target.value as FinanceKind);
                  setSource(null);
                }}
                options={[
                  { value: "supplier_payment", label: "Confirm actual supplier payment" },
                  { value: "supplier_credit", label: "Record actual supplier credit note" },
                  { value: "supplier_refund", label: "Confirm supplier refund received" },
                  { value: "supplier_return", label: "Return original received stock" },
                ].filter(option => (option.value === "supplier_return" ? canReturn : canSettle))}
              />
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {metrics.map(item => (
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
          </section>

          {mode === "supplier_return" ? (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Returned goods leave on-hand stock. Expected credit remains pending until the supplier note is recorded.
              </p>

              {statement.purchases.length > 0 && (
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
                  {statement.purchases.slice(page * 25, (page + 1) * 25).map(row => (
                    <article
                      key={row.purchaseId}
                      className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between md:px-4"
                    >
                      <div className="min-w-0">
                        <strong className="text-xs font-semibold text-text">{row.supplierInvoiceNumber}</strong>
                        <p className="text-[11px] tabular-nums text-text-secondary">Due {money(row.duePaise / 100)}</p>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={locked || !canReturn || Boolean(command.pending && command.pending.sourceId !== row.purchaseId)}
                        onClick={() => {
                          void loadSource(row.purchaseId!);
                        }}
                      >
                        Review supplier return {row.supplierInvoiceNumber}
                      </Button>
                    </article>
                  ))}
                </div>
              )}

              {(page > 0 || (page + 1) * 25 < statement.purchases.length) && (
                <div className="flex flex-wrap items-center gap-2">
                  {page > 0 && (
                    <Button size="xs" variant="outline" onClick={() => setPage(value => value - 1)}>
                      Previous supplier purchase page
                    </Button>
                  )}
                  {(page + 1) * 25 < statement.purchases.length && (
                    <Button size="xs" variant="outline" onClick={() => setPage(value => value + 1)}>
                      Next supplier purchase page
                    </Button>
                  )}
                </div>
              )}

              {source && (
                <SupplierReturnEditor
                  key={`${source.purchaseId}:${source.settlementRevision}:${source.purchaseRevision}:${expirySeed?.serial || 0}`}
                  source={source}
                  initialQuantities={expirySeed?.purchaseId === source.purchaseId ? expirySeed.quantities : undefined}
                  initialBatchId={initialReturn?.purchaseId === source.purchaseId ? initialReturn.batchId : undefined}
                  disabled={locked || !canReturn}
                  onSubmit={input => {
                    void command.submit("supplier_return", source.purchaseId, input);
                  }}
                />
              )}
            </div>
          ) : (
            <SupplierSettlementForm
              key={`${statement.supplierId}:${mode}:${statement.purchases.map(row => row.settlementRevision).join(",")}:${statement.openingBalances.map(row => row.settlementRevision).join(",")}`}
              statement={statement}
              kind={mode as "supplier_payment" | "supplier_credit" | "supplier_refund"}
              disabled={
                locked ||
                !canSettle ||
                Boolean(command.pending && (command.pending.kind !== mode || command.pending.sourceId !== statement.supplierId))
              }
              onSubmit={input => {
                void command.submit(mode, statement.supplierId, input);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

type Target = {
  id: string;
  field: "purchaseId" | "purchaseReturnId" | "openingBalanceId";
  label: string;
  maximum: number;
  revision: number;
};

function SupplierSettlementForm({
  statement,
  kind,
  disabled,
  onSubmit,
}: {
  statement: SupplierStatement;
  kind: "supplier_payment" | "supplier_credit" | "supplier_refund";
  disabled: boolean;
  onSubmit: (input: object) => void;
}) {
  const [drawerReady, setDrawerReady] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [actual, setActual] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [review, setReview] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  const credit = kind === "supplier_credit";
  const targets: Target[] = credit
    ? statement.returns.map(row => ({
        id: row.id,
        field: "purchaseReturnId",
        label: `Return ${row.id}`,
        maximum: row.expectedCreditPaise - row.confirmedCreditPaise,
        revision: statement.purchases.find(purchase => purchase.purchaseId === row.purchaseId)?.settlementRevision ?? -1,
      }))
    : statement.purchases.map(row => ({
        id: row.purchaseId!,
        field: "purchaseId",
        label: row.supplierInvoiceNumber!,
        maximum: kind === "supplier_payment" ? row.duePaise : row.supplierRefundReceivablePaise,
        revision: row.settlementRevision,
      }));

  targets.push(
    ...statement.openingBalances.map(row => ({
      id: row.openingBalanceId!,
      field: "openingBalanceId" as const,
      label: `Opening ${row.statementNumber}`,
      maximum: credit
        ? row.payablePaise - row.confirmedCreditPaise
        : kind === "supplier_payment"
          ? row.duePaise
          : row.supplierRefundReceivablePaise,
      revision: row.settlementRevision,
    }))
  );

  const available = targets.filter(row => row.maximum > 0 && row.revision >= 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || (kind !== "supplier_credit" && !drawerReady)) return;
    const amountPaise = parseReceiptPaise(actual);
    const allocations: Array<Record<string, string | number>> = [];
    let total = BigInt(0);
    for (const target of available) {
      const value = amounts[`${target.field}:${target.id}`];
      if (!value || value === "0") continue;
      const amount = parseReceiptPaise(value);
      if (amount === null || amount <= 0 || amount > target.maximum) {
        setError("Allocate exact positive amounts within each remaining source.");
        return;
      }
      total += BigInt(amount);
      allocations.push({ [target.field]: target.id, amountPaise: amount, expectedSettlementRevision: target.revision });
    }
    if (
      !confirmed ||
      amountPaise === null ||
      amountPaise <= 0 ||
      BigInt(amountPaise) !== total ||
      !allocations.length ||
      allocations.length > 100 ||
      reference.trim().length < 3 ||
      review.trim().length < 3 ||
      (credit && !sourceDate)
    ) {
      setError(
        "Confirm the actual evidence and allocate its exact total to 1 to 100 sources. Supplier credit requires its real note date."
      );
      return;
    }
    onSubmit({
      locationId: statement.locationId,
      supplierId: statement.supplierId,
      amountPaise,
      paymentMethod: credit ? "none" : method,
      referenceNumber: reference.trim(),
      reviewReference: review.trim(),
      manualConfirmed: true,
      ...(credit ? { sourceDate } : {}),
      allocations,
    });
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4"
      aria-label="Supplier settlement allocation"
    >
      <div className="border-b border-border/60 pb-2">
        <h4 className="text-xs font-semibold text-text md:text-sm">{SETTLEMENT_TITLES[kind]}</h4>
      </div>

      {error && (
        <Alert variant="error" title="Check supplier evidence">
          {error}
        </Alert>
      )}

      {!credit && <PharmacyDrawerGate locationId={statement.locationId} onReady={setDrawerReady} />}

      <form onSubmit={submit}>
        <fieldset className="space-y-3" disabled={disabled || (!credit && !drawerReady)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              size="sm"
              label="Actual supplier amount (INR)"
              type="number"
              min="0.01"
              step="0.01"
              value={actual}
              onChange={event => setActual(event.target.value)}
            />
            {!credit && (
              <Select
                size="sm"
                label="Supplier money method"
                value={method}
                onChange={event => setMethod(event.target.value)}
                options={["cash", "upi", "card", "bank"].map(value => ({ value, label: value.toUpperCase() }))}
              />
            )}
            <Input
              size="sm"
              label="Actual supplier document/payment reference"
              value={reference}
              maxLength={200}
              onChange={event => setReference(event.target.value)}
            />
            {credit && (
              <DatePicker
                size="sm"
                label="Actual supplier credit date"
                value={sourceDate}
                onChange={value => setSourceDate(value)}
              />
            )}
            <Input
              size="sm"
              label="Supplier settlement review reference"
              value={review}
              maxLength={200}
              onChange={event => setReview(event.target.value)}
            />
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs font-semibold text-text">Allocate across open sources</p>
            {available.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {available.slice(page * 25, (page + 1) * 25).map(target => (
                  <div key={`${target.field}:${target.id}`} className="rounded-xl border border-border/70 bg-surface p-2.5">
                    <Input
                      size="sm"
                      label={`Allocate ${target.label} (INR)`}
                      hint={`Remaining ${money(target.maximum / 100)}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[`${target.field}:${target.id}`] || ""}
                      onChange={event =>
                        setAmounts(previous => ({ ...previous, [`${target.field}:${target.id}`]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border/60 bg-surface px-3 py-3 text-xs text-text-secondary">
                No remaining source balance supports this action.
              </p>
            )}

            {(page > 0 || (page + 1) * 25 < available.length) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {page > 0 && (
                  <Button size="xs" variant="outline" onClick={() => setPage(value => value - 1)}>
                    Previous allocation page
                  </Button>
                )}
                {(page + 1) * 25 < available.length && (
                  <Button size="xs" variant="outline" onClick={() => setPage(value => value + 1)}>
                    Next allocation page
                  </Button>
                )}
              </div>
            )}
          </div>

          <Checkbox
            label={credit ? "I verified this actual supplier credit note" : "I confirmed this supplier money movement actually completed"}
            checked={confirmed}
            onChange={event => setConfirmed(event.target.checked)}
          />

          <div>
            <Button size="xs" type="submit" disabled={!available.length}>
              {credit
                ? "Record confirmed supplier credit"
                : kind === "supplier_payment"
                  ? "Record actual supplier payment"
                  : "Record supplier refund received"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function SupplierReturnEditor({
  source,
  disabled,
  onSubmit,
  initialBatchId,
  initialQuantities,
}: {
  source: SupplierReturnSource;
  disabled: boolean;
  onSubmit: (input: object) => void;
  initialBatchId?: string;
  initialQuantities?: Record<string, string>;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(initialQuantities || {});
  const [reason, setReason] = useState(initialQuantities ? "Near-expiry goods" : "");
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<SupplierReturnQuote | null>(null);
  const [page, setPage] = useState(() =>
    Math.floor(Math.max(0, source.lines.findIndex(row => row.batchId === initialBatchId)) / 25)
  );
  const beginRead = useLatestRead();
  const revision = useRef(0);

  function invalidate() {
    revision.current++;
    setQuote(null);
    setError("");
  }

  async function preview() {
    if (disabled) return;
    const request = beginRead();
    const version = revision.current;
    setQuote(null);
    setError("");
    try {
      const sourceKeys = new Set(source.lines.map(row => `${row.receiptId}:${row.receiptLineId}`));
      if (Object.keys(quantities).some(key => !sourceKeys.has(key) && quantities[key] && quantities[key] !== "0")) {
        throw new Error("A selected lot is no longer in the current invoice source. Refresh the expiry preparation.");
      }
      const lines = source.lines
        .filter(row => quantities[`${row.receiptId}:${row.receiptLineId}`] && quantities[`${row.receiptId}:${row.receiptLineId}`] !== "0")
        .map(row => {
          const value = quantities[`${row.receiptId}:${row.receiptLineId}`];
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0 || Number(value) > row.remainingQuantity) {
            throw new Error("Return whole base units within received and on-hand quantities");
          }
          return { receiptId: row.receiptId, receiptLineId: row.receiptLineId, quantity: Number(value) };
        });
      if (!lines.length || lines.length > 100 || reason.trim().length < 3 || review.trim().length < 3) {
        throw new Error("Select actual returned lots and record the supplier return reason/reference");
      }
      const value = await supplierReturnQuote(
        source.purchaseId,
        { locationId: source.locationId, lines, reason: reason.trim(), reviewReference: review.trim() },
        request.signal
      );
      if (request.isCurrent() && version === revision.current) setQuote(value);
    } catch (failure) {
      if (request.isCurrent() && version === revision.current) setError(pharmacyFinanceMessage(failure));
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4"
      aria-label="Supplier received return source"
    >
      <div className="border-b border-border/60 pb-2">
        <h3 className="text-sm font-semibold text-text">{source.supplierInvoiceNumber}</h3>
      </div>

      {error && (
        <Alert variant="error" title="Check supplier return">
          {error}
        </Alert>
      )}

      <fieldset className="space-y-3" disabled={disabled}>
        <div className="space-y-2.5">
          {source.lines.slice(page * 25, (page + 1) * 25).map(row => (
            <fieldset
              key={`${row.receiptId}:${row.receiptLineId}`}
              className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface p-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <strong className="block text-xs font-semibold text-text">
                  {row.description} · {row.batchNumber}
                </strong>
                <p className="text-[11px] text-text-secondary">
                  Received {row.receivedQuantity} · Already returned {row.returnedQuantity} · On hand {row.onHandQuantity} · Returnable{" "}
                  {row.remainingQuantity} {row.unitSnapshot.baseUnit}. Expiry {row.expiryValue}.
                </p>
              </div>
              <div className="w-full shrink-0 sm:w-48">
                <Input
                  size="sm"
                  label={`Supplier return quantity ${row.batchNumber}`}
                  type="number"
                  min="0"
                  max={row.remainingQuantity}
                  step="1"
                  value={quantities[`${row.receiptId}:${row.receiptLineId}`] || "0"}
                  onChange={event => {
                    invalidate();
                    setQuantities(previous => ({ ...previous, [`${row.receiptId}:${row.receiptLineId}`]: event.target.value }));
                  }}
                />
              </div>
            </fieldset>
          ))}
        </div>

        {(page > 0 || (page + 1) * 25 < source.lines.length) && (
          <div className="flex flex-wrap items-center gap-2">
            {page > 0 && (
              <Button size="xs" variant="outline" onClick={() => setPage(value => value - 1)}>
                Previous received lot page
              </Button>
            )}
            {(page + 1) * 25 < source.lines.length && (
              <Button size="xs" variant="outline" onClick={() => setPage(value => value + 1)}>
                Next received lot page
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
          <Input
            size="sm"
            label="Actual supplier return reason"
            value={reason}
            maxLength={500}
            onChange={event => {
              invalidate();
              setReason(event.target.value);
            }}
          />
          <Input
            size="sm"
            label="Supplier return review/reference"
            value={review}
            maxLength={200}
            onChange={event => {
              invalidate();
              setReview(event.target.value);
            }}
          />
        </div>

        <div>
          <Button
            size="xs"
            variant={quote ? "outline" : "primary"}
            onClick={() => {
              void preview();
            }}
          >
            Review expected supplier credit
          </Button>
        </div>

        {quote && (
          <section
            aria-label="Supplier return credit review"
            className="space-y-2 rounded-xl border border-border/80 bg-accent-subtle/30 p-3"
          >
            <p className="text-xs font-medium text-text">
              Expected supplier credit <span className="font-semibold tabular-nums">{money(quote.expectedCreditPaise / 100)}</span>. Actual
              supplier note confirmation is a separate action.
            </p>
            <Button size="xs" onClick={() => onSubmit(quote.issueInput)}>
              Confirm supplier goods return
            </Button>
          </section>
        )}
      </fieldset>
    </section>
  );
}
