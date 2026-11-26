"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, RotateCw, Search } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Select, Spinner, cn } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import {
  listTransfers,
  readTransfer,
  readTransferLots,
  searchTransferProducts,
  submitTransfer,
  recoverTransfer,
  parseTransferReference,
  transferError,
  type PharmacyTransfer,
  type TransferAction,
  type TransferReference,
  type TransferProduct,
  type TransferLot,
} from "@/lib/pharmacyTransfers";

interface Props {
  locationId: string;
  locations: Array<{ id: string; name: string }>;
  canStart: boolean;
}

const STATUS_BADGE = {
  draft: "neutral",
  approved: "info",
  in_transit: "warning",
  closed: "success",
  cancelled: "danger",
} as const;

export function PharmacyTransfers(props: Props) {
  const user = useAuthStore(state => state.user);
  if (
    !user ||
    ["patient", "family_member", "guest"].includes(user.role) ||
    !hasAnyPermission(user, "PHARMACY_TRANSFER", "MANAGE_ORGANIZATION") ||
    !hasAnyPermission(user, "PHARMACY_VIEW_COST", "MANAGE_MEDICINES")
  ) {
    return (
      <Alert variant="warning" title="Transfer access required">
        Current transfer and acquisition-cost permissions are required at this branch.
      </Alert>
    );
  }
  return <TransferSession key={`${authScopeKey(user)}:${props.locationId}`} {...props} />;
}

function TransferSession({ locationId, locations, canStart }: Props) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const storageKey = `pharmacy-transfer:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => {
    try {
      return { reference: parseTransferReference(sessionStorage.getItem(storageKey)), error: "" };
    } catch (failure) {
      return { reference: null, error: transferError(failure) };
    }
  });
  const [pending, setPending] = useState(initial.reference);
  const [outcome, setOutcome] = useState<PharmacyTransfer | null>(null);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [hasFrozen, setHasFrozen] = useState(false);
  const [rows, setRows] = useState<PharmacyTransfer[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<PharmacyTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [destination, setDestination] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [sourceProducts, setSourceProducts] = useState<TransferProduct[]>([]);
  const [destinationProducts, setDestinationProducts] = useState<TransferProduct[]>([]);
  const [sourceProduct, setSourceProduct] = useState("");
  const [destinationProduct, setDestinationProduct] = useState("");
  const [lots, setLots] = useState<TransferLot[]>([]);
  const [lotCursor, setLotCursor] = useState<string | null>(null);
  const [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transport, setTransport] = useState("");
  const [review, setReview] = useState("");
  const [stageQuantity, setStageQuantity] = useState("");
  const [disposition, setDisposition] = useState("saleable");
  const [stageReview, setStageReview] = useState("");
  const alive = useRef(true);
  const lock = useRef(false);
  const frozen = useRef<{ reference: TransferReference; input: object } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listTransfers(locationId)
      .then(page => {
        if (!cancelled) {
          setRows(page.items);
          setCursor(page.nextCursor);
        }
      })
      .catch(failure => {
        if (!cancelled) setError(transferError(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const clearPrivate = () => {
    setRows([]);
    setSelected(null);
    setSourceProducts([]);
    setDestinationProducts([]);
    setLots([]);
  };

  async function read<T>(work: () => Promise<T>, accept: (value: T) => void) {
    if (!current() || lock.current) return;
    lock.current = true;
    setReading(true);
    setError("");
    try {
      const result = await work();
      if (current()) accept(result);
    } catch (failure) {
      if (current()) {
        if ((failure as { response?: { status?: number } })?.response?.status === 403) clearPrivate();
        setError(transferError(failure));
      }
    } finally {
      lock.current = false;
      if (current()) setReading(false);
    }
  }

  function history(older = false) {
    return read(() => listTransfers(locationId, older ? cursor || undefined : undefined), page => {
      setRows(page.items);
      setCursor(page.nextCursor);
    });
  }

  function open(id: string, eventCursor?: string) {
    return read(() => readTransfer(locationId, id, eventCursor), row => {
      setSelected(row);
      setRows(previous =>
        previous.some(item => item.id === row.id) ? previous.map(item => (item.id === row.id ? row : item)) : [row, ...previous].slice(0, 20)
      );
      setStageQuantity("");
      setStageReview("");
      setDisposition(row.sourceLocationId === locationId ? "return_to_source" : "saleable");
    });
  }

  function sourceLots(id: string, older = false) {
    setSourceProduct(id);
    setLotId("");
    setLots([]);
    return read(() => readTransferLots(locationId, id, older ? lotCursor || undefined : undefined), page => {
      setLots(page.items);
      setLotCursor(page.nextCursor);
    });
  }

  async function command(action: TransferAction, input: object, transferId?: string) {
    if (!current() || lock.current || outcome || initial.error) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setCanReview(false);
    setReviewing(false);
    try {
      const saved = parseTransferReference(sessionStorage.getItem(storageKey));
      if ((saved?.key || null) !== (pending?.key || null) || (pending && (pending.action !== action || pending.transferId !== transferId))) {
        throw new Error("Resolve the saved transfer stage before starting another command");
      }
      const reference = pending || { key: crypto.randomUUID(), action, ...(transferId ? { transferId } : {}) };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(reference));
      setPending(reference);
      const request = frozen.current || { reference, input: JSON.parse(JSON.stringify(input)) as object };
      frozen.current = request;
      setHasFrozen(true);
      const result = await submitTransfer(locationId, request.reference, request.input);
      if (current()) setOutcome(result);
    } catch (failure) {
      if (current()) {
        setError(transferError(failure));
        setCanReview([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0));
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
      const result = await recoverTransfer(locationId, pending);
      if (current()) setOutcome(result);
    } catch (failure) {
      if (current()) setError(transferError(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  function acknowledge() {
    if (!outcome || !current() || lock.current) return;
    try {
      if (parseTransferReference(sessionStorage.getItem(storageKey))?.key !== outcome.requestKey) {
        throw new Error("Transfer reference changed. Check the saved outcome");
      }
      sessionStorage.removeItem(storageKey);
      const transferId = outcome.id;
      setPending(null);
      setOutcome(null);
      setReviewing(false);
      setCanReview(false);
      frozen.current = null;
      setHasFrozen(false);
      void open(transferId);
    } catch (failure) {
      setError(transferError(failure));
    }
  }

  const locked = busy || reading || loading || Boolean(outcome || initial.error || (pending && !reviewing));
  const sourceBranch = selected?.sourceLocationId === locationId;
  const draftQuantity = Number(quantity);
  const actualStageQuantity = Number(stageQuantity);
  const whole = (value: number) => Number.isSafeInteger(value) && value > 0;

  const stage = (action: TransferAction) => {
    if (selected) {
      void command(
        action,
        {
          expectedRevision: selected.revision,
          reviewReference: stageReview.trim(),
          ...(["receive", "resolve"].includes(action) ? { quantity: actualStageQuantity, disposition } : {}),
        },
        selected.id
      );
    }
  };

  const selectedMetrics = selected
    ? [
        { label: "Approved", value: `${selected.quantity} ${selected.unit.baseUnit}` },
        { label: "In transit", value: String(selected.inTransitQuantity), highlight: selected.inTransitQuantity > 0 },
        { label: "Dispatched", value: String(selected.dispatchedQuantity) },
        { label: "Saleable receipt", value: String(selected.receivedQuantity) },
        { label: "Quarantine", value: String(selected.quarantinedQuantity) },
        { label: "Loss / returned", value: `${selected.lostQuantity} lost · ${selected.returnedQuantity} returned` },
      ]
    : [];

  return (
    <section aria-label="Pharmacy stock transfers" className="min-w-0 space-y-3">
      {(error || pending || outcome) && (
        <div className="space-y-2.5">
          {error && (
            <Alert variant="error" title="Transfer requires attention">
              {error}
            </Alert>
          )}
          {pending && (
            <Alert variant="warning" title="Transfer stage reference">
              <div className="space-y-2 text-xs">
                <p className="break-all font-mono text-[11px]">
                  {pending.action}: {pending.key}. Keep this reference until the outcome is confirmed.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs" variant="outline" disabled={busy || reading} onClick={() => void recover()}>
                    Check transfer outcome
                  </Button>
                  {hasFrozen && !outcome && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy || reading}
                      onClick={() => {
                        const request = frozen.current;
                        if (request) void command(request.reference.action, request.input, request.reference.transferId);
                      }}
                    >
                      Retry same transfer stage
                    </Button>
                  )}
                  {canReview && !outcome && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        frozen.current = null;
                        setHasFrozen(false);
                        setCanReview(false);
                        setReviewing(true);
                        setError("");
                      }}
                    >
                      Review rejected stage
                    </Button>
                  )}
                </div>
              </div>
            </Alert>
          )}
          {outcome && (
            <Alert variant="success" title="Transfer stage recorded">
              <div className="space-y-2 text-xs">
                <p>
                  {outcome.transportReference}: revision {outcome.revision}; dispatched {outcome.dispatchedQuantity}, received{" "}
                  {outcome.receivedQuantity}, quarantined {outcome.quarantinedQuantity}, lost {outcome.lostQuantity}, returned{" "}
                  {outcome.returnedQuantity}, in transit {outcome.inTransitQuantity}.
                </p>
                <div>
                  <Button size="xs" onClick={acknowledge}>
                    Acknowledge recorded transfer stage
                  </Button>
                </div>
              </div>
            </Alert>
          )}
        </div>
      )}

      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text md:text-base">Stock transfers</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Move an approved source batch between reviewed branches of the same legal issuer, state and GST registration. Use the actual
              delivery document reference. Separate GST registrations and interstate transfers need their own tax-document workflow.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={locked}
              icon={<RotateCw size={14} className={loading || reading ? "animate-spin" : ""} aria-hidden="true" />}
              onClick={() => void history()}
            >
              Refresh transfers
            </Button>
            {cursor && (
              <Button size="xs" variant="outline" disabled={locked} onClick={() => void history(true)}>
                Older transfers
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 p-3 md:p-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text md:text-sm">Recorded transfers</h3>
              {!loading && (
                <Badge variant="neutral" size="sm">
                  {rows.length}
                  {cursor ? "+" : ""}
                </Badge>
              )}
            </div>

            {loading ? (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-border/70 p-3 text-xs text-text-secondary">
                <Spinner size="sm" />
                Loading transfers...
              </div>
            ) : !rows.length ? (
              <p className="rounded-xl border border-border/70 bg-surface-alt/30 px-3 py-5 text-center text-xs text-text-secondary">
                No branch stock transfers recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
                {rows.map(row => {
                  const isSelected = selected?.id === row.id;
                  const direction = row.sourceLocationId === locationId ? "Outgoing" : "Incoming";
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => void open(row.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
                          isSelected && "bg-accent-subtle/35"
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="break-all text-xs font-semibold text-text">{row.transportReference}</strong>
                            <Badge variant={STATUS_BADGE[row.status]} size="sm">
                              {row.status}
                            </Badge>
                            <Badge variant={row.sourceLocationId === locationId ? "info" : "neutral"} size="sm">
                              {direction}
                            </Badge>
                          </div>
                          <p className="truncate text-[11px] text-text-secondary">
                            {row.sourceName} → {row.destinationName}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-text">
                          {row.quantity} {row.unit.baseUnit}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selected && (
              <section
                aria-label="Selected stock transfer"
                className="space-y-3 rounded-xl border border-border bg-surface-alt/25 p-3 md:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="break-words text-sm font-semibold text-text">
                      {selected.transportReference}: {selected.sourceName}
                    </h3>
                    <p className="text-[11px] text-text-secondary">
                      Batch {selected.lot.batchNumber} · Expiry {new Date(selected.lot.expiryDate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={STATUS_BADGE[selected.status]} size="sm">
                      {selected.status}
                    </Badge>
                    <Badge variant={sourceBranch ? "info" : "neutral"} size="sm">
                      {sourceBranch ? "Outgoing" : "Incoming"}
                    </Badge>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedMetrics.map(item => (
                    <div
                      key={item.label}
                      className={cn(
                        "rounded-xl border border-border/70 p-2.5",
                        item.highlight ? "bg-accent-subtle/40" : "bg-surface"
                      )}
                    >
                      <dt className="text-[11px] font-medium text-text-secondary">{item.label}</dt>
                      <dd className="mt-0.5 break-words text-xs font-semibold tabular-nums text-text sm:text-sm">{item.value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-[11px] text-text-secondary">
                  Acquisition basis: {selected.lot.costBasis.totalPaise} paise per {selected.lot.costBasis.receivedBaseUnits} base units.
                  Each partial lot retains this exact fraction.
                </p>

                {selected.events && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text">Custody stages</p>
                    <ol
                      aria-label="Transfer stage history"
                      className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface"
                    >
                      {selected.events.map(event => (
                        <li key={event.id} className="space-y-1 px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-text">
                              {event.action} · revision {event.revision}
                            </span>
                            <span className="tabular-nums text-[11px] text-text-secondary">
                              {event.quantity} units {event.disposition || ""}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary">{event.reviewReference}</p>
                        </li>
                      ))}
                    </ol>
                    {selected.nextEventsCursor && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={locked}
                        onClick={() => void open(selected.id, selected.nextEventsCursor!)}
                      >
                        Older transfer stages
                      </Button>
                    )}
                  </div>
                )}

                <fieldset disabled={locked} className="space-y-3 border-t border-border/60 pt-3">
                  <Input
                    size="sm"
                    label="Transfer stage review reference *"
                    minLength={10}
                    maxLength={300}
                    value={stageReview}
                    onChange={event => setStageReview(event.target.value)}
                  />
                  {sourceBranch && ["draft", "approved"].includes(selected.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="xs"
                        disabled={!canStart || stageReview.trim().length < 10}
                        onClick={() => stage(selected.status === "draft" ? "approve" : "dispatch")}
                      >
                        {selected.status === "draft" ? "Approve both branches" : "Dispatch approved batch"}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={stageReview.trim().length < 10}
                        onClick={() => stage("cancel")}
                      >
                        Cancel unshipped transfer
                      </Button>
                    </div>
                  )}
                  {selected.status === "in_transit" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <Input
                          size="sm"
                          label="Physical stage quantity"
                          type="number"
                          min="1"
                          max={selected.inTransitQuantity}
                          step="1"
                          value={stageQuantity}
                          onChange={event => setStageQuantity(event.target.value)}
                        />
                        <Select
                          size="sm"
                          label="Physical stock disposition"
                          value={disposition}
                          onChange={event => setDisposition(event.target.value)}
                          options={
                            sourceBranch
                              ? [
                                  { value: "return_to_source", label: "Returned to source quarantine" },
                                  { value: "lost", label: "Reviewed in-transit loss (both branches)" },
                                ]
                              : [
                                  { value: "saleable", label: "Received saleable" },
                                  { value: "quarantined", label: "Received into quarantine" },
                                ]
                          }
                        />
                      </div>
                      <Button
                        size="xs"
                        disabled={
                          !whole(actualStageQuantity) ||
                          actualStageQuantity > selected.inTransitQuantity ||
                          stageReview.trim().length < 10 ||
                          (sourceBranch && !["lost", "return_to_source"].includes(disposition))
                        }
                        onClick={() => stage(sourceBranch ? "resolve" : "receive")}
                      >
                        Record physical stage
                      </Button>
                    </div>
                  )}
                </fieldset>
              </section>
            )}
          </div>

          <form
            aria-label="New reviewed stock transfer"
            className="space-y-3 rounded-xl border border-border bg-surface-alt/25 p-3 md:p-4"
            onSubmit={event => {
              event.preventDefault();
              if (canStart && whole(draftQuantity) && draftQuantity <= (lots.find(lot => lot.id === lotId)?.quantity || 0)) {
                void command("create", {
                  destinationLocationId: destination,
                  sourceMedicineId: sourceProduct,
                  destinationMedicineId: destinationProduct,
                  sourceBatchId: lotId,
                  quantity: draftQuantity,
                  transportReference: transport.trim(),
                  reviewReference: review.trim(),
                });
              }
            }}
          >
            <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
              <ArrowLeftRight size={15} className="shrink-0 text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text">Prepare a transfer</h3>
            </div>

            {!canStart && (
              <p className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs text-text-secondary">
                New transfer preparation, approval and dispatch require active pharmacy access at both branches. Existing dispatched goods
                remain available for authorized receipt or resolution.
              </p>
            )}

            <fieldset disabled={locked || !canStart} className="space-y-3">
              <Select
                size="sm"
                label="Destination branch"
                value={destination}
                options={[
                  { value: "", label: "Choose destination" },
                  ...locations.filter(location => location.id !== locationId).map(location => ({ value: location.id, label: location.name })),
                ]}
                onChange={event => {
                  setDestination(event.target.value);
                  setDestinationProduct("");
                  setDestinationProducts([]);
                }}
              />

              <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Input
                      size="sm"
                      icon={<Search size={14} aria-hidden="true" />}
                      label="Find source product"
                      maxLength={100}
                      value={sourceSearch}
                      onChange={event => setSourceSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      setSourceProduct("");
                      setLots([]);
                      setLotId("");
                      void read(() => searchTransferProducts(locationId, sourceSearch), setSourceProducts);
                    }}
                  >
                    Search source products
                  </Button>
                </div>

                <Select
                  size="sm"
                  label="Source product"
                  value={sourceProduct}
                  options={[
                    { value: "", label: "Choose source product" },
                    ...sourceProducts.map(product => ({ value: product.id, label: `${product.name} / ${product.identity}` })),
                  ]}
                  onChange={event => {
                    if (event.target.value) void sourceLots(event.target.value);
                    else {
                      setSourceProduct("");
                      setLots([]);
                      setLotId("");
                    }
                  }}
                />

                <Select
                  size="sm"
                  label="Source batch"
                  value={lotId}
                  options={[
                    { value: "", label: "Choose actual batch" },
                    ...lots.map(lot => ({
                      value: lot.id,
                      label: `${lot.batchNumber} / ${lot.quantity} / ${new Date(lot.expiryDate).toLocaleDateString("en-IN")}`,
                    })),
                  ]}
                  onChange={event => setLotId(event.target.value)}
                />

                {lotCursor && (
                  <Button type="button" size="xs" variant="outline" onClick={() => void sourceLots(sourceProduct, true)}>
                    Older source batches
                  </Button>
                )}
              </div>

              <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Input
                      size="sm"
                      icon={<Search size={14} aria-hidden="true" />}
                      label="Find destination product"
                      maxLength={100}
                      value={destinationSearch}
                      onChange={event => setDestinationSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={!destination}
                    onClick={() => {
                      setDestinationProduct("");
                      void read(() => searchTransferProducts(destination, destinationSearch), setDestinationProducts);
                    }}
                  >
                    Search destination products
                  </Button>
                </div>

                <Select
                  size="sm"
                  label="Destination product"
                  value={destinationProduct}
                  options={[
                    { value: "", label: "Confirm matching destination product" },
                    ...destinationProducts.map(product => ({ value: product.id, label: `${product.name} / ${product.identity}` })),
                  ]}
                  onChange={event => setDestinationProduct(event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  size="sm"
                  label="Transfer base quantity"
                  type="number"
                  min="1"
                  max={lots.find(lot => lot.id === lotId)?.quantity || 1_000_000}
                  step="1"
                  required
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                />
                <Input
                  size="sm"
                  label="Delivery document reference *"
                  minLength={3}
                  maxLength={120}
                  required
                  value={transport}
                  onChange={event => setTransport(event.target.value)}
                />
              </div>

              <Input
                size="sm"
                label="Transfer preparation review reference *"
                minLength={10}
                maxLength={300}
                required
                value={review}
                onChange={event => setReview(event.target.value)}
              />

              <Button
                type="submit"
                size="sm"
                className="w-full sm:w-auto"
                disabled={
                  !destination ||
                  !sourceProduct ||
                  !destinationProduct ||
                  !lotId ||
                  !whole(draftQuantity) ||
                  draftQuantity > 1_000_000 ||
                  draftQuantity > (lots.find(lot => lot.id === lotId)?.quantity || 0) ||
                  review.trim().length < 10 ||
                  transport.trim().length < 3
                }
              >
                Prepare reviewed transfer
              </Button>
            </fieldset>
          </form>
        </div>
      </Card>
    </section>
  );
}
