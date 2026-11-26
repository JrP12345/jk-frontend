"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Printer, RotateCw, Search } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, Input, QuantityInput, Select, Spinner, cn } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import {
  externalPrescriptions,
  readExternalPrescription,
  readExternalPrescriptionBill,
  cancelExternalPrescription,
  type ExternalPrescription,
  type ExternalPrescriptionSummary,
} from "@/lib/pharmacyExternalPrescriptions";
import {
  counterProducts,
  type CounterProduct,
  issueCounter,
  quoteCounter,
  recoverCounter,
  type CounterQuote,
  type CounterIssueInput,
  type CounterResult,
} from "@/lib/pharmacyCounter";
import { createSaleJournal } from "@/lib/pharmacyCommandJournal";
import { prepareIssuedCheckoutPayment } from "@/lib/pharmacyPayment";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { pickupError } from "@/lib/pharmacyPickup";
import type { CollectionMethod, CounterInvoice } from "@/lib/pharmacyCollections";
import { PharmacyExternalPrescriptionEditor } from "./PharmacyExternalPrescriptionEditor";
import { PharmacySavedBillPrint } from "./PharmacySavedBillPrint";
import { PharmacyCollections } from "./PharmacyCollections";
import { PharmacyPrescriptionAttachments } from "./PharmacyPrescriptionAttachments";

interface Props {
  locationId: string;
  inventoryMode?: "tracked" | "billing_only";
  canSupply: boolean;
  canSell?: boolean;
  canCollect: boolean;
  canOpenTill: boolean;
  canViewSales: boolean;
}

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

type Command = { key: string; input: CounterIssueInput };

const statusVariant = (status: string, expired: boolean) => {
  if (expired || status === "cancelled") return "warning" as const;
  if (status === "approved") return "success" as const;
  return "neutral" as const;
};

export function PharmacyExternalPrescriptions(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return (
    <PrescriptionSession
      key={`${scope}:${props.locationId}:${props.inventoryMode || "tracked"}:${props.canSupply}:${props.canCollect}`}
      {...props}
      scope={scope}
    />
  );
}

function PrescriptionSession({
  scope,
  locationId,
  inventoryMode = "tracked",
  canSupply,
  canSell = false,
  canCollect,
  canOpenTill,
  canViewSales,
}: Props & { scope: string }) {
  const mobile = useMobileViewport();
  const [rows, setRows] = useState<ExternalPrescriptionSummary[]>([]);
  const [selected, setSelected] = useState<ExternalPrescription | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Array<{ product: CounterProduct; quantity: string }>>([]);
  const [extraSearch, setExtraSearch] = useState("");
  const [extraResults, setExtraResults] = useState<CounterProduct[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const extraRead = useLatestRead();
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [editing, setEditing] = useState(false);
  const [quote, setQuote] = useState<CounterQuote | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string | null>(null);
  const [method, setMethod] = useState<CollectionMethod>("cash");
  const [tender, setTender] = useState("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [outcome, setOutcome] = useState<CounterResult | null>(null);
  const [printTarget, setPrintTarget] = useState<{ id: string; document?: CounterInvoice } | null>(null);
  const [invoice, setInvoice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [retryable, setRetryable] = useState(false);
  const [journal] = useState(() => createSaleJournal(scope, locationId, "external-prescription-sale"));
  const begin = useLatestRead();
  const detail = useLatestRead();
  const lock = useRef(false);
  const alive = useRef(true);
  const frozen = useRef<Command | null>(null);
  const quantityFields = useRef(new Map<string, HTMLInputElement>());
  const cashField = useRef<HTMLInputElement>(null);
  const referenceField = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const storageKey = `ekavyu-pharmacy-external-operation:${scope}:${locationId}`;
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const read = begin();
    setLoading(true);
    setListError("");
    try {
      const page = await externalPrescriptions(locationId, cursor, read.signal);
      if (read.isCurrent() && current()) {
        setRows(page.items);
        setNext(page.nextCursor);
      }
    } catch (failure) {
      if (read.isCurrent() && current()) setListError(pickupError(failure));
    } finally {
      if (read.isCurrent() && current()) setLoading(false);
    }
  }, [begin, locationId, cursor, current]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void journal
      .load()
      .then(saved => {
        if (!current()) return;
        const backup = sessionStorage.getItem(storageKey);
        if (
          (saved.value && !saved.value.input.externalPrescription) ||
          (backup && !/^[a-zA-Z0-9_-]{8,100}$/.test(backup)) ||
          (saved.value && backup && saved.value.key !== backup)
        ) {
          throw Error("Saved prescription operation needs review before another bill.");
        }
        frozen.current = saved.value;
        setRetryable(Boolean(saved.value));
        setPending(backup || saved.value?.key || null);
        setReady(true);
      })
      .catch(failure => {
        if (current()) setError(pickupError(failure));
      });
  }, [journal, storageKey, current]);

  function choose(row: ExternalPrescription) {
    extraRead();
    setExtras([]);
    setExtraSearch("");
    setExtraResults([]);
    setExtraCursor(null);
    setSelected(row);
    setQuantities(Object.fromEntries(row.lines.map(line => [line.medicineId, "0"])));
    setQuote(null);
    setReceived(false);
    setReference("");
    setTender("");
  }

  async function open(id: string) {
    if (lock.current || pending || !current()) return;
    const read = detail();
    setOpening(true);
    setError("");
    setQuote(null);
    setSelected(null);
    try {
      const row = await readExternalPrescription(locationId, id, read.signal);
      if (read.isCurrent() && current()) choose(row);
    } catch (failure) {
      if (read.isCurrent() && current()) setError(pickupError(failure));
    } finally {
      if (read.isCurrent() && current()) setOpening(false);
    }
  }

  async function searchExtras(searchCursor?: string) {
    const request = extraRead();
    setError("");
    try {
      const page = await counterProducts(
        locationId,
        { search: extraSearch.trim(), ...(searchCursor ? { cursor: searchCursor } : {}) },
        request.signal
      );
      if (request.isCurrent() && current()) {
        setExtraResults(
          page.items.filter(
            item =>
              item.eligible &&
              !selected?.lines.some(line => line.medicineId === item.id) &&
              !extras.some(line => line.product.id === item.id)
          )
        );
        setExtraCursor(page.nextCursor);
      }
    } catch (e) {
      if (request.isCurrent() && current()) setError(pickupError(e));
    }
  }

  async function prepare() {
    if (!selected || !canSupply || lock.current || pending || !ready || !current()) return;
    if (selected.status !== "approved" || Date.parse(selected.validUntil) < now) {
      setError("Reload a current approved prescription before preparing supply.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setQuote(null);
    setReceived(false);
    try {
      if (selected.lines.some(line => !/^\d+$/.test(quantities[line.medicineId] || "") || Number(quantities[line.medicineId]) > line.quantity - line.supplied)) {
        throw Error("Enter whole quantities within the remaining prescription allowance.");
      }
      const lines = selected.lines
        .filter(line => Number(quantities[line.medicineId]) > 0)
        .map(line => ({
          lineId: crypto.randomUUID(),
          medicineId: line.medicineId,
          quantity: Number(quantities[line.medicineId]),
          expectedUnitVersion: line.expectedUnitVersion,
          discountPaise: 0,
        }));
      if (!lines.length) throw Error("Select a quantity to supply for at least one medicine.");
      if (
        (extras.length && !canSell) ||
        extras.some(
          line =>
            !/^\d+$/.test(line.quantity) ||
            !Number.isSafeInteger(Number(line.quantity)) ||
            Number(line.quantity) <= 0 ||
            !line.product.unitDefinition
        )
      ) {
        throw Error("Check ordinary item quantities and counter-sale permission.");
      }
      lines.push(
        ...extras.map(line => ({
          lineId: crypto.randomUUID(),
          medicineId: line.product.id,
          quantity: Number(line.quantity),
          expectedUnitVersion: line.product.unitDefinition!.version,
          discountPaise: 0,
        }))
      );
      const result = await quoteCounter({
        locationId,
        expectedInventoryMode: inventoryMode,
        externalPrescription: { id: selected.id, revision: selected.revision },
        invoiceDiscountPaise: 0,
        roundOffPaise: 0,
        lines,
      });
      if (current()) {
        setQuote(result);
        setTender(String(result.calculation.totals.payablePaise / 100));
      }
    } catch (failure) {
      if (current()) setError(pickupError(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function accept(result: CounterResult) {
    await journal.save(null);
    sessionStorage.removeItem(storageKey);
    frozen.current = null;
    if (!current()) return;
    setPending(null);
    setRetryable(false);
    setOutcome(result);
    setQuote(null);
    setReceived(false);
    setReference("");
    void load();
    if (selected) {
      const row = await readExternalPrescription(locationId, selected.id);
      if (current()) choose(row);
    }
  }

  async function save(retry = false) {
    if (lock.current || !canSupply || !ready || !current() || (!retry && (!quote || pending))) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!retry) {
        const total = quote!.calculation.totals.payablePaise;
        const payment =
          canCollect && total > 0 && received
            ? prepareIssuedCheckoutPayment(locationId, total, {
                method,
                tender: method === "cash" ? tender : "0",
                referenceNumber: reference,
                expectedTotalPaise: total,
              })
            : null;
        if (canCollect && total > 0 && !payment) {
          throw Error("Confirm actual receipt and check the cash or verified transaction reference before saving.");
        }
        const command: Command = {
          key: crypto.randomUUID(),
          input: { ...quote!.issueInput, includeDocument: true, ...(payment ? { payment } : {}) },
        };
        sessionStorage.setItem(storageKey, command.key);
        frozen.current = command;
        setPending(command.key);
        setRetryable(true);
        await journal.save(command);
      }
      if (!frozen.current) throw Error("Only the operation reference is available. Check its saved result before another bill.");
      const result = await issueCounter(frozen.current.input, frozen.current.key);
      if (current()) await accept(result);
    } catch (failure) {
      if (current()) {
        const status = (failure as { response?: { status?: number } })?.response?.status;
        if (frozen.current && status && [400, 402, 403, 404, 409, 428].includes(status)) {
          await journal.save(null);
          sessionStorage.removeItem(storageKey);
          frozen.current = null;
          setPending(null);
          setRetryable(false);
          setQuote(null);
          setReceived(false);
        }
        setError(pickupError(failure));
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function recover() {
    if (!pending || lock.current || !current()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await recoverCounter(locationId, pending, true);
      if (current()) await accept(result);
    } catch (failure) {
      if (current()) setError(pickupError(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function cancel() {
    if (!selected || busy || pending || !current()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const row = await cancelExternalPrescription(selected);
      if (current()) {
        choose(row);
        void load();
      }
    } catch (failure) {
      if (current()) {
        setQuote(null);
        setError(pickupError(failure));
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function printBill(id: string) {
    if (lock.current || pending || !current()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const document = await readExternalPrescriptionBill(locationId, id);
      if (current()) setPrintTarget({ id, document });
    } catch (failure) {
      if (current()) setError(pickupError(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  const available = selected?.status === "approved" && Date.parse(selected.validUntil) >= now;
  const cashReceived = parseReceiptPaise(tender);
  const cashChange =
    quote && cashReceived !== null && cashReceived >= quote.calculation.totals.payablePaise
      ? cashReceived - quote.calculation.totals.payablePaise
      : null;
  const blocked = busy || Boolean(pending) || !ready || opening;

  useEffect(() => {
    if (!selected || opening || !ready || !canSupply || selected.status !== "approved") return;
    const first = selected.lines.find(line => line.quantity > line.supplied);
    if (first) quantityFields.current.get(first.medicineId)?.focus();
  }, [selected, opening, ready, canSupply]);

  useEffect(() => {
    if (!quote || blocked) return;
    if (canCollect && quote.calculation.totals.payablePaise > 0) (method === "cash" ? cashField : referenceField).current?.focus();
    else saveButton.current?.focus();
  }, [quote, blocked, canCollect, method]);

  return (
    <section
      aria-label="Outside prescriptions"
      className="min-w-0 space-y-3"
      onKeyDown={event => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing || printTarget || invoice || blocked || !available || !canSupply) {
          return;
        }
        if (event.key === "F8") {
          event.preventDefault();
          void prepare();
        }
        if (event.key === "F10") {
          event.preventDefault();
          if (quote && (!canCollect || quote.calculation.totals.payablePaise === 0 || received)) void save();
        }
      }}
    >
      {(error || pending || outcome) && (
        <div className="space-y-2.5">
          {error && (
            <Alert variant="error" title="Prescription needs attention">
              {error}
            </Alert>
          )}
          {pending && (
            <Alert variant="warning" title="Check the pending supply before another bill">
              <div className="space-y-2 text-xs">
                <p className="break-all font-mono text-[11px]">Reference: {pending}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="xs" variant="outline" loading={busy} onClick={() => void recover()}>
                    Check saved result
                  </Button>
                  {retryable && canSupply && (
                    <Button size="xs" disabled={busy} onClick={() => void save(true)}>
                      Retry same supply
                    </Button>
                  )}
                </div>
              </div>
            </Alert>
          )}
          {outcome && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-success/30 bg-success-subtle px-3 py-2.5 text-xs"
            >
              <strong className="font-semibold text-text">
                {outcome.invoiceNumber} · {money(outcome.totalPaise)} · {outcome.status === "paid" ? "Paid" : "Awaiting collection"}
              </strong>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  icon={<Printer size={13} aria-hidden="true" />}
                  onClick={() => setPrintTarget({ id: outcome.invoiceId, document: outcome.document })}
                >
                  Print saved bill
                </Button>
                {canViewSales && (
                  <Button size="xs" variant="outline" onClick={() => setInvoice(outcome.invoiceId)}>
                    View bill / collect
                  </Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => setOutcome(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text md:text-base">Outside prescriptions</h2>
            <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
              Review a prescription brought to this pharmacy. Track each supply and its remaining quantity without creating a clinic visit.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={loading}
              icon={<RotateCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />}
              onClick={() => void load()}
            >
              Refresh
            </Button>
            {canSupply && (
              <Button
                size="xs"
                icon={<Plus size={14} aria-hidden="true" />}
                disabled={blocked}
                onClick={() => {
                  setEditing(true);
                  setError("");
                }}
              >
                Review new prescription
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 divide-y divide-border/70 lg:grid-cols-[minmax(250px,310px)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
          <div className="min-w-0 space-y-2.5 p-3 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text md:text-sm">Prescription history</h3>
              {!loading && (
                <Badge variant="neutral" size="sm">
                  {rows.length}
                  {next ? "+" : ""}
                </Badge>
              )}
            </div>

            {listError && (
              <Alert variant="error" title="History unavailable">
                {listError}
              </Alert>
            )}

            {loading ? (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-border/70 p-3 text-xs text-text-secondary">
                <Spinner size="sm" />
                Loading prescriptions…
              </div>
            ) : !listError && !rows.length ? (
              <p className="rounded-xl border border-border/70 bg-surface-alt/30 px-3 py-5 text-center text-xs text-text-secondary">
                No outside prescriptions recorded at this branch.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
                {rows.map(row => {
                  const expired = row.status === "approved" && Date.parse(row.validUntil) < now;
                  const label = expired ? "Expired" : row.status;
                  const isSelected = selected?.id === row.id;
                  return (
                    <li key={row.id}>
                      <Button
                        variant="ghost"
                        fullWidth
                        aria-label={`Open prescription ${row.reference} for ${row.patientName}`}
                        className={cn("justify-start rounded-none px-3 py-2.5 text-left", isSelected && "bg-accent-subtle/35")}
                        disabled={blocked}
                        onClick={() => void open(row.id)}
                      >
                        <span className="flex w-full min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block break-words text-xs font-semibold text-text">{row.reference}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-text-secondary">
                              {row.patientName} · {label}
                            </span>
                          </span>
                          <Badge variant={statusVariant(row.status, expired)} size="sm">
                            {label}
                          </Badge>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {(cursor || next) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cursor && (
                  <Button size="xs" variant="outline" disabled={loading} onClick={() => setCursor(undefined)}>
                    Newest
                  </Button>
                )}
                {next && (
                  <Button size="xs" variant="outline" disabled={loading} onClick={() => setCursor(next)}>
                    Older
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4 p-3 md:p-4">
            {opening ? (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-border/70 p-4 text-xs text-text-secondary">
                <Spinner size="sm" />
                Loading prescription evidence…
              </div>
            ) : !selected ? (
              <p className="rounded-xl border border-border/70 bg-surface-alt/30 px-4 py-10 text-center text-xs text-text-secondary">
                Open an existing prescription or record a new pharmacist review.
              </p>
            ) : (
              <>
                <header className="flex flex-wrap items-start justify-between gap-2.5 border-b border-border/60 pb-3">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="break-words text-sm font-semibold text-text md:text-base">{selected.reference}</h3>
                    <p className="text-xs text-text-secondary">
                      {selected.patientName} · Supply deadline {new Date(selected.validUntil).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={statusVariant(selected.status, !available && selected.status === "approved")} dot>
                    {!available && selected.status === "approved" ? "Expired" : selected.status}
                  </Badge>
                </header>

                <PharmacyPrescriptionAttachments locationId={locationId} prescriptionId={selected.id} canUpload={canSupply} />

                <details className="group rounded-xl border border-border/70 bg-surface-alt/20 px-3 py-2.5 text-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-text select-none [&::-webkit-details-marker]:hidden">
                    <span>Patient, prescriber and retained source</span>
                    <ChevronDown
                      size={15}
                      className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-text-secondary">
                    <p>
                      {selected.patientName} · {selected.patientAddress} {selected.patientPhone}
                    </p>
                    <p>
                      {selected.prescriberName} · {selected.prescriberRegistration} · {selected.prescriberCouncil}
                    </p>
                    <p>{selected.prescriberAddress}</p>
                    <p>Prescriber evidence: {selected.prescriberReviewReference}</p>
                    <p>
                      Signed prescription: {selected.sourceReference} · {selected.issuedOn}
                    </p>
                  </div>
                </details>

                {mobile ? (
                  <div className="space-y-2.5" role="region" aria-label="Prescribed medicines">
                    {selected.lines.map(line => {
                      const remaining = line.quantity - line.supplied;
                      return (
                        <article key={line.medicineId} className="space-y-2.5 rounded-xl border border-border/70 bg-surface p-3">
                          <div className="min-w-0">
                            <strong className="block text-xs font-semibold text-text">{line.name}</strong>
                            <p className="mt-0.5 text-[11px] text-text-secondary">
                              {line.instructions} · {line.baseUnit}
                            </p>
                          </div>
                          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-surface-alt/30 p-2 text-[11px]">
                            <div>
                              <dt className="text-text-secondary">Permitted</dt>
                              <dd className="font-semibold tabular-nums text-text">{line.quantity}</dd>
                            </div>
                            <div>
                              <dt className="text-text-secondary">Supplied</dt>
                              <dd className="font-semibold tabular-nums text-text">{line.supplied}</dd>
                            </div>
                            <div>
                              <dt className="text-text-secondary">Remaining</dt>
                              <dd className="font-semibold tabular-nums text-text">{remaining}</dd>
                            </div>
                          </dl>
                          {canSupply && available && (
                            <QuantityInput
                              ref={element => {
                                if (element) quantityFields.current.set(line.medicineId, element);
                                else quantityFields.current.delete(line.medicineId);
                              }}
                              onKeyDown={event => {
                                if (event.key !== "Enter" || blocked) return;
                                event.preventDefault();
                                const nextLine = selected.lines.slice(selected.lines.indexOf(line) + 1).find(row => row.quantity > row.supplied);
                                if (nextLine) quantityFields.current.get(nextLine.medicineId)?.focus();
                                else void prepare();
                              }}
                              variant="compact"
                              label={`Supply ${line.name}`}
                              value={quantities[line.medicineId] || "0"}
                              min={0}
                              max={remaining}
                              disabled={blocked}
                              onValueChange={quantity => {
                                setQuantities(currentValues => ({ ...currentValues, [line.medicineId]: quantity }));
                                setQuote(null);
                                setReceived(false);
                              }}
                            />
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="min-w-0 overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="border-b border-border/80 bg-surface-alt/70 font-semibold text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Medicine / directions</th>
                          <th className="px-3 py-2 text-right">Permitted</th>
                          <th className="px-3 py-2 text-right">Supplied</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                          {canSupply && available && <th className="px-3 py-2">Supply now</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selected.lines.map(line => (
                          <tr key={line.medicineId}>
                            <td className="px-3 py-2.5 align-top">
                              <strong className="text-xs font-semibold text-text">{line.name}</strong>
                              <p className="mt-0.5 max-w-md text-[11px] text-text-secondary">
                                {line.instructions} · {line.baseUnit}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right align-top tabular-nums">{line.quantity}</td>
                            <td className="px-3 py-2.5 text-right align-top tabular-nums">{line.supplied}</td>
                            <td className="px-3 py-2.5 text-right align-top tabular-nums">{line.quantity - line.supplied}</td>
                            {canSupply && available && (
                              <td className="px-3 py-2.5 align-top">
                                <QuantityInput
                                  ref={element => {
                                    if (element) quantityFields.current.set(line.medicineId, element);
                                    else quantityFields.current.delete(line.medicineId);
                                  }}
                                  onKeyDown={event => {
                                    if (event.key !== "Enter" || blocked) return;
                                    event.preventDefault();
                                    const nextLine = selected.lines
                                      .slice(selected.lines.indexOf(line) + 1)
                                      .find(row => row.quantity > row.supplied);
                                    if (nextLine) quantityFields.current.get(nextLine.medicineId)?.focus();
                                    else void prepare();
                                  }}
                                  variant="compact"
                                  label={`Supply ${line.name}`}
                                  value={quantities[line.medicineId] || "0"}
                                  min={0}
                                  max={line.quantity - line.supplied}
                                  disabled={blocked}
                                  onValueChange={quantity => {
                                    setQuantities(currentValues => ({ ...currentValues, [line.medicineId]: quantity }));
                                    setQuote(null);
                                    setReceived(false);
                                  }}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {canSupply && canSell && available && (
                  <section
                    className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/25 p-3"
                    aria-label="Additional ordinary products"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-text md:text-sm">Add ordinary products to this bill</h4>
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        These items do not change the prescription&apos;s permitted quantities.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <Input
                          size="sm"
                          icon={<Search size={14} aria-hidden="true" />}
                          aria-label="Find additional ordinary product"
                          placeholder="Search ordinary product"
                          value={extraSearch}
                          disabled={blocked}
                          onChange={e => {
                            extraRead();
                            setExtraSearch(e.target.value);
                            setExtraResults([]);
                            setExtraCursor(null);
                          }}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={blocked}
                        onClick={() => void searchExtras()}
                      >
                        Find ordinary product
                      </Button>
                    </div>

                    {(extraResults.length > 0 || extraCursor) && (
                      <div className="flex flex-wrap gap-2">
                        {extraResults.map(product => (
                          <Button
                            key={product.id}
                            size="xs"
                            variant="outline"
                            disabled={blocked}
                            onClick={() => {
                              extraRead();
                              setExtras(previous => [...previous, { product, quantity: "1" }]);
                              setExtraResults([]);
                              setQuote(null);
                              setReceived(false);
                            }}
                          >
                            Add {product.name}
                          </Button>
                        ))}
                        {extraCursor && (
                          <Button size="xs" variant="outline" disabled={blocked} onClick={() => void searchExtras(extraCursor)}>
                            More ordinary products
                          </Button>
                        )}
                      </div>
                    )}

                    {extras.length > 0 && (
                      <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-surface">
                        {extras.map(line => (
                          <div key={line.product.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="font-semibold text-text">{line.product.name}</strong>
                              <QuantityInput
                                label={`Ordinary quantity ${line.product.name}`}
                                value={line.quantity}
                                min={1}
                                disabled={blocked}
                                onValueChange={quantity => {
                                  setExtras(previous =>
                                    previous.map(row => (row.product.id === line.product.id ? { ...row, quantity } : row))
                                  );
                                  setQuote(null);
                                  setReceived(false);
                                }}
                              />
                              <span className="text-text-secondary">{line.product.unitDefinition?.baseUnit}</span>
                            </div>
                            <Button
                              size="xs"
                              variant="ghost"
                              disabled={blocked}
                              onClick={() => {
                                setExtras(previous => previous.filter(row => row.product.id !== line.product.id));
                                setQuote(null);
                                setReceived(false);
                              }}
                            >
                              Remove {line.product.name}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {canSupply && available && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={quote ? "outline" : "primary"}
                      loading={busy}
                      disabled={Boolean(pending) || !ready}
                      onClick={() => void prepare()}
                    >
                      Prepare bill for selected quantities
                    </Button>
                    <Button size="xs" variant="ghost" disabled={blocked} onClick={() => void open(selected.id)}>
                      Reload remaining quantities
                    </Button>
                  </div>
                )}

                {quote && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4">
                    <div className="border-b border-border/60 pb-2">
                      <h4 className="text-sm font-semibold tabular-nums text-text">
                        Current bill · {money(quote.calculation.totals.payablePaise)}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        GST {money(quote.calculation.totals.cgstPaise + quote.calculation.totals.sgstPaise)} · Stock and prices are checked
                        again when saved.
                      </p>
                    </div>

                    <ul className="space-y-1 text-xs text-text-secondary">
                      {quote.lines.map(line => (
                        <li key={line.lineId}>
                          {line.description} · {line.quantity} {line.unitSnapshot.baseUnit} ·{" "}
                          {line.batches.map(lot => `${lot.batchNumber} (${lot.quantity}), exp ${lot.expiryValue}`).join("; ")}
                        </li>
                      ))}
                    </ul>

                    {canCollect && quote.calculation.totals.payablePaise > 0 && (
                      <fieldset disabled={blocked} className="space-y-3 border-t border-border/60 pt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Select
                            size="sm"
                            label="Payment method"
                            value={method}
                            options={[
                              { value: "cash", label: "Cash" },
                              { value: "upi", label: "UPI" },
                              { value: "card", label: "Card" },
                            ]}
                            onChange={event => {
                              setMethod(event.target.value as CollectionMethod);
                              setReceived(false);
                              setReference("");
                            }}
                          />
                          {method === "cash" ? (
                            <Input
                              size="sm"
                              ref={cashField}
                              label="Cash received (INR)"
                              value={tender}
                              type="number"
                              min="0"
                              step="0.01"
                              onChange={event => {
                                setTender(event.target.value);
                                setReceived(false);
                              }}
                            />
                          ) : (
                            <Input
                              size="sm"
                              ref={referenceField}
                              label="Verified transaction reference"
                              value={reference}
                              maxLength={200}
                              onChange={event => {
                                setReference(event.target.value);
                                setReceived(false);
                              }}
                            />
                          )}
                        </div>
                        {method === "cash" && cashChange !== null && (
                          <p className="text-xs font-semibold tabular-nums text-accent">Change to return: {money(cashChange)}</p>
                        )}
                        <Checkbox
                          label="I confirmed this payment was actually received."
                          checked={received}
                          onChange={event => setReceived(event.target.checked)}
                        />
                      </fieldset>
                    )}

                    {!canCollect && (
                      <p className="text-xs text-text-secondary">
                        This creates an unpaid bill. An authorized cashier must collect payment before handover.
                      </p>
                    )}

                    <div>
                      <Button
                        ref={saveButton}
                        size="sm"
                        loading={busy}
                        disabled={Boolean(pending) || (canCollect && quote.calculation.totals.payablePaise > 0 && !received)}
                        onClick={() => void save()}
                      >
                        {canCollect ? "Save supply and payment" : "Issue bill for collection"}
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-text-secondary">
                  Enter: next quantity / prepare bill. F8: prepare bill. F10: save after payment confirmation.
                </p>

                <div className="space-y-2 border-t border-border/60 pt-3">
                  <h4 className="text-xs font-semibold text-text md:text-sm">Supplies and linked bills</h4>
                  {!selected.supplies.length ? (
                    <p className="text-xs text-text-secondary">No supplies yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                      {selected.supplies.map(supply => (
                        <li
                          key={supply.invoiceId}
                          className="flex flex-col gap-2 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-semibold text-text">{supply.invoiceNumber}</p>
                            <p className="text-[11px] text-text-secondary">{new Date(supply.suppliedAt).toLocaleString("en-IN")}</p>
                            <p className="text-[11px] text-text-secondary">
                              {supply.lines
                                .map(line => `${selected.lines.find(item => item.medicineId === line.medicineId)?.name}: ${line.quantity}`)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              icon={<Printer size={13} aria-hidden="true" />}
                              disabled={blocked}
                              onClick={() => void printBill(supply.invoiceId)}
                            >
                              Print bill
                            </Button>
                            {canViewSales && (
                              <Button size="xs" variant="outline" disabled={blocked} onClick={() => setInvoice(supply.invoiceId)}>
                                View saved bill
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="text-[11px] text-text-secondary">
                  Record each supply on the original prescription as required. Returns do not restore its permitted quantity. This record
                  tracks supplies at this branch.
                </p>

                {selected.status === "approved" && (
                  <details className="group rounded-xl border border-border/70 bg-surface-alt/20 p-3 text-xs">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-text-secondary select-none hover:text-text [&::-webkit-details-marker]:hidden">
                      <span>Close remaining allowance</span>
                      <ChevronDown
                        size={14}
                        className="shrink-0 transition-transform duration-150 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="my-2 text-[11px] text-text-secondary">
                      Cancelling preserves previous supplies and bills. Correct billed items through Returns.
                    </p>
                    <Button size="xs" variant="outline" disabled={blocked} onClick={() => void cancel()}>
                      Cancel remaining prescription allowance
                    </Button>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {editing && canSupply && (
        <PharmacyExternalPrescriptionEditor
          locationId={locationId}
          onClose={() => setEditing(false)}
          onSaved={row => {
            setEditing(false);
            choose(row);
            void load();
          }}
        />
      )}

      {printTarget && (
        <PharmacySavedBillPrint
          key={printTarget.id}
          invoiceId={printTarget.id}
          locationId={locationId}
          savedDocument={printTarget.document}
          onClose={() => setPrintTarget(null)}
        />
      )}

      {invoice && canViewSales && (
        <PharmacyCollections
          locationId={locationId}
          canCollect={canCollect}
          canOpenTill={canOpenTill}
          initialInvoiceId={invoice}
          focusOnly
          onInvoiceClose={() => setInvoice("")}
        />
      )}
    </section>
  );
}
