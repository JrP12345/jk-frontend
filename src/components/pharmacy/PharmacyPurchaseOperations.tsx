"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Alert, Badge, Button, DatePicker, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { readPurchase, type PharmacyParty, type PurchaseDraft } from "@/services/pharmacyPurchase.service";
import {
  purchaseDeliveryPayload,
  purchaseReceivingPlan,
  remainingDeliveryLines,
  type PurchaseDeliveryLine as DeliveryLine,
} from "@/lib/pharmacyReceiving";
import { orderSeedFromPurchase } from "@/lib/pharmacyPurchaseOrders";
import type { ShortbookDraftSeed } from "@/lib/pharmacyShortbook";
import { money } from "./pharmacyWorkspace";
import { PharmacyDeliveryManifest } from "./PharmacyDeliveryManifest";

type Pending = { key: string; kind: "post" | "receipt" };
type Receipt = {
  id: string;
  deliveryReference: string;
  receivedAt: string;
  lines: Array<{
    lineId: string;
    batchNumber: string;
    billedBaseUnits: number;
    freeBaseUnits: number;
    costPaise: number;
    expiry: { value: string };
  }>;
};

const message = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error instanceof Error ? error.message : "Outcome could not be confirmed. Keep the same reference.");

function stored(key: string): Pending | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as Pending;
  if (!["post", "receipt"].includes(value.kind) || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.key)) {
    throw new Error("Purchase reference needs review before another operation.");
  }
  return value;
}

export function PharmacyPurchaseOperations({
  purchase: initialPurchase,
  canManage,
  canReceive,
  onClose,
  onChanged,
  onReorder,
}: {
  purchase: PurchaseDraft;
  canManage: boolean;
  canReceive: boolean;
  onClose: () => void;
  onChanged: () => void;
  onReorder?: (seed: ShortbookDraftSeed) => void;
}) {
  const [purchase, setPurchase] = useState(initialPurchase);
  const scope = authScopeKey(useAuthStore(state => state.user));
  const storageKey = `pharmacy-purchase-operation:${scope}:${purchase.locationId}:${purchase.id}`;
  const [initial] = useState(() => {
    try {
      return { pending: stored(storageKey), error: "" };
    } catch (error) {
      return { pending: null, error: message(error) };
    }
  });
  const [pending, setPending] = useState(initial.pending);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ requestKey: string; receiptId?: string; payablePaise?: number } | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [canCorrect, setCanCorrect] = useState(false);
  const [readingManifest, setReadingManifest] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const frozen = useRef<{ ref: Pending; payload: object } | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function validateResult(value: unknown, ref: Pending) {
    const result = value as {
      purchaseId?: unknown;
      requestKey?: unknown;
      payablePaise?: unknown;
      receiptId?: unknown;
    } | null;
    if (
      !result ||
      result.purchaseId !== purchase.id ||
      result.requestKey !== ref.key ||
      (ref.kind === "post"
        ? typeof result.payablePaise !== "number" || !Number.isSafeInteger(result.payablePaise) || result.payablePaise < 0
        : typeof result.receiptId !== "string" || !result.receiptId)
    ) {
      throw new Error("Purchase outcome could not be confirmed. Check the saved reference.");
    }
    return result as { requestKey: string; receiptId?: string; payablePaise?: number };
  }

  const [party, setParty] = useState<PharmacyParty | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [posting, setPosting] = useState({ state: "", taxMode: "", cost: "", round: "0", review: "" });
  const [deliveryReference, setDeliveryReference] = useState("");
  const plan = useMemo(() => {
    try {
      return { rows: purchaseReceivingPlan(purchase), error: "" };
    } catch (failure) {
      return { rows: [], error: message(failure) };
    }
  }, [purchase]);
  const outstanding = plan.rows.filter(row => row.billed + row.free > 0);
  const addLine = (): DeliveryLine => ({
    lineId: crypto.randomUUID(),
    purchaseLineId: outstanding[0]?.source.lineId || "",
    billed: "0",
    free: "0",
    batch: "",
    precision: "month",
    expiry: "",
  });
  const [lines, setLines] = useState<DeliveryLine[]>(() => {
    if (purchase.status !== "posted") return [];
    try {
      return initial.pending?.kind === "receipt" ? [addLine()] : remainingDeliveryLines(purchase);
    } catch {
      return [];
    }
  });
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const beginHistory = useRef(0);

  const fetchHistory = useCallback(
    async (after?: string) => {
      const response = await api.get(
        `/pharmacy/purchases/${purchase.id}/receipts?locationId=${encodeURIComponent(purchase.locationId)}${after ? `&cursor=${encodeURIComponent(after)}` : ""}`
      );
      const page = response.data?.data;
      if (!page || !Array.isArray(page.items) || page.items.length > 10 || (page.nextCursor !== null && typeof page.nextCursor !== "string")) {
        throw new Error("Delivery history could not be loaded completely.");
      }
      return page as { items: Receipt[]; nextCursor: string | null };
    },
    [purchase.id, purchase.locationId]
  );

  async function loadHistory(after?: string) {
    const sequence = ++beginHistory.current;
    setHistoryError("");
    try {
      const page = await fetchHistory(after);
      if (current() && sequence === beginHistory.current) {
        setReceipts(page.items);
        setCursor(page.nextCursor);
      }
    } catch (failure) {
      if (current() && sequence === beginHistory.current) setHistoryError(message(failure));
    }
  }

  useEffect(() => {
    let active = true;
    if (purchase.status === "draft") {
      void api
        .get(`/pharmacy/parties/${purchase.supplierId}?locationId=${encodeURIComponent(purchase.locationId)}`)
        .then(response => {
          if (active) setParty(response.data.data);
        })
        .catch(() => {
          if (active) setLookupError("Supplier could not be loaded. Reopen before posting.");
        });
    } else {
      void fetchHistory()
        .then(page => {
          if (active) {
            setReceipts(page.items);
            setCursor(page.nextCursor);
          }
        })
        .catch(failure => {
          if (active) setHistoryError(message(failure));
        });
    }
    return () => {
      active = false;
    };
  }, [purchase.status, purchase.supplierId, purchase.locationId, fetchHistory]);

  async function send(kind: Pending["kind"], payload: object) {
    if (lock.current || !current() || !canManage || (kind === "receipt" && !canReceive) || confirmed) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setCanCorrect(false);
    try {
      const existing = stored(storageKey);
      if ((pending?.key || null) !== (existing?.key || null) || (existing && existing.kind !== kind)) {
        throw new Error("Purchase reference changed. Check its result before continuing.");
      }
      const ref = pending || { kind, key: crypto.randomUUID() };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref));
      setPending(ref);
      const pinned = frozen.current?.ref.key === ref.key ? frozen.current.payload : (JSON.parse(JSON.stringify(payload)) as object);
      frozen.current = { ref, payload: pinned };
      setHasSubmitted(true);
      const response = await api.post(`/pharmacy/purchases/${purchase.id}/${kind === "post" ? "post" : "receipts"}`, pinned, {
        headers: { "Idempotency-Key": ref.key },
      });
      const result = validateResult(response.data?.data, ref);
      if (current()) setConfirmed(result);
    } catch (failure) {
      if (current()) {
        setError(message(failure));
        setCanCorrect([400, 409].includes((failure as { response?: { status?: number } })?.response?.status || 0));
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function check() {
    if (!pending || lock.current || !current()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.get(
        `/pharmacy/purchases/${purchase.id}/operations/${pending.kind}/${pending.key}?locationId=${encodeURIComponent(purchase.locationId)}`
      );
      const result = validateResult(response.data?.data, pending);
      if (current()) setConfirmed(result);
    } catch (failure) {
      if (current()) setError(message(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  function acknowledge() {
    if (!pending || !confirmed || busy || !current()) return;
    try {
      if (stored(storageKey)?.key !== confirmed.requestKey) {
        throw new Error("Purchase reference changed. Reopen before continuing.");
      }
      sessionStorage.removeItem(storageKey);
      onChanged();
    } catch (failure) {
      setError(message(failure));
    }
  }

  async function continueReceiving() {
    if (!pending || pending.kind !== "post" || !confirmed || lock.current || !current() || !canManage || !canReceive) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const fresh = await readPurchase(purchase.id, purchase.locationId);
      if (!current()) return;
      if (fresh.status !== "posted" || fresh.revision < purchase.revision || (purchase.status === "draft" && fresh.revision === purchase.revision)) {
        throw new Error("The posted purchase could not be refreshed. Retry continuing to receiving.");
      }
      const remaining = remainingDeliveryLines(fresh);
      const saved = stored(storageKey);
      if (saved?.kind !== "post" || saved.key !== confirmed.requestKey) {
        throw new Error("Purchase reference changed. Reopen before continuing.");
      }
      sessionStorage.removeItem(storageKey);
      frozen.current = null;
      setPending(null);
      setConfirmed(null);
      setHasSubmitted(false);
      setCanCorrect(false);
      setPurchase(fresh);
      setLines(remaining);
      setDeliveryReference("");
      setLookupError("");
    } catch (failure) {
      if (current()) setError(message(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  function post(event: React.FormEvent) {
    event.preventDefault();
    const absolute = parseReceiptPaise(posting.round.replace(/^-/, ""));
    const roundOffPaise = absolute === null ? null : posting.round.startsWith("-") ? -absolute : absolute;
    if (
      !party ||
      !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(posting.state) ||
      !posting.taxMode ||
      !posting.cost ||
      posting.review.trim().length < 3 ||
      roundOffPaise === null ||
      Math.abs(roundOffPaise) > 99
    ) {
      setError("Record the actual review, supplier state, tax split, cost treatment and round-off within INR 0.99.");
      return;
    }
    void send("post", {
      locationId: purchase.locationId,
      expectedRevision: purchase.revision,
      expectedSupplierRevision: party.revision,
      supplierStateCode: posting.state,
      taxMode: posting.taxMode,
      costTreatment: posting.cost,
      roundOffPaise,
      reviewReference: posting.review.trim(),
    });
  }

  function receive(event: React.FormEvent) {
    event.preventDefault();
    if (readingManifest) return;
    try {
      const payload = purchaseDeliveryPayload(purchase, deliveryReference, lines);
      void send("receipt", payload);
    } catch (failure) {
      setError(message(failure));
    }
  }

  const postingMode = purchase.status === "draft";
  const disabled = busy || readingManifest || Boolean(confirmed) || Boolean(hasSubmitted && pending);
  const allowed = canManage && (postingMode || canReceive);

  return (
    <Modal
      open
      title={postingMode ? "Post saved supplier invoice" : "Receive purchase delivery"}
      description={`${purchase.supplierInvoiceNumber} · ${purchase.supplierSnapshot.name}`}
      onClose={onClose}
      busy={busy}
      size="xl"
      footer={
        <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>
          Close purchase
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-alt/50 p-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-text">
              {purchase.supplierInvoiceNumber} · {purchase.supplierSnapshot.name}. Supplier stated total:{" "}
              <span className="tabular-nums">{money(purchase.statedTotalPaise / 100)}</span>.
            </p>
            {purchase.posting && (
              <p className="text-text-secondary">
                Posted payable: <strong className="tabular-nums text-text">{money(purchase.posting.payablePaise / 100)}</strong>.
                Delivery receipts do not create another payable.
              </p>
            )}
            {postingMode && (
              <p className="leading-relaxed text-text-secondary">
                Only the saved draft is posted. This freezes the supplier bill and establishes its payable; stock is received separately.
                Review source tax and supplier eligibility before posting.
              </p>
            )}
          </div>
          {!postingMode && canManage && onReorder && (
            <Button
              size="xs"
              variant="outline"
              icon={<RotateCcw size={13} aria-hidden="true" />}
              disabled={busy || Boolean(pending)}
              onClick={() => {
                try {
                  onReorder(orderSeedFromPurchase(purchase));
                } catch (failure) {
                  setError(message(failure));
                }
              }}
            >
              Reorder from this invoice
            </Button>
          )}
        </div>

        {(error || lookupError) && (
          <Alert variant="error" title="Purchase needs attention">
            {error || lookupError}
          </Alert>
        )}
        {plan.error && (
          <Alert variant="error" title="Purchase quantities unavailable">
            {plan.error}
          </Alert>
        )}

        {pending && (
          <Alert variant={confirmed ? "success" : "warning"} title={confirmed ? "Purchase operation confirmed" : "Pending purchase operation"}>
            <div className="space-y-2 text-xs">
              <p className="break-all font-mono text-[11px]">Reference: {pending.key}</p>
              {confirmed ? (
                <>
                  <p>
                    {confirmed.receiptId
                      ? "Delivery recorded."
                      : `Supplier payable posted: ${money((confirmed.payablePaise || 0) / 100)}.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {pending.kind === "post" && canManage && canReceive && (
                      <Button
                        size="xs"
                        loading={busy}
                        onClick={() => {
                          void continueReceiving();
                        }}
                      >
                        Continue to receiving
                      </Button>
                    )}
                    <Button size="xs" variant="outline" disabled={busy} onClick={acknowledge}>
                      Done with purchase operation
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Check the result before another operation. Retry uses the same saved reference and submitted details. After reload,
                    re-enter the original details only if no committed result is visible.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void check();
                      }}
                    >
                      Check purchase result
                    </Button>
                    {hasSubmitted && allowed && (
                      <Button
                        size="xs"
                        disabled={busy}
                        onClick={() => {
                          if (frozen.current) void send(frozen.current.ref.kind, frozen.current.payload);
                        }}
                      >
                        Retry same purchase operation
                      </Button>
                    )}
                    {canCorrect && allowed && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          frozen.current = null;
                          setHasSubmitted(false);
                          setCanCorrect(false);
                        }}
                      >
                        Correct details using same reference
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Alert>
        )}

        {!postingMode && !plan.error && !outstanding.length && (
          <p role="status" className="rounded-xl border border-border/70 bg-surface-alt/50 px-3 py-2.5 text-xs font-medium text-text">
            All invoice quantities have been received. Recorded deliveries remain available below.
          </p>
        )}

        {allowed &&
          !plan.error &&
          (postingMode || outstanding.length > 0) &&
          (!pending || (!hasSubmitted && pending.kind === (postingMode ? "post" : "receipt"))) &&
          !confirmed &&
          (postingMode ? (
            <form onSubmit={post} className="space-y-4" noValidate>
              <fieldset className="space-y-3 rounded-xl border border-border p-3" disabled={disabled}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    size="sm"
                    label="Reviewed supplier state code"
                    maxLength={2}
                    value={posting.state}
                    onChange={event => setPosting({ ...posting, state: event.target.value })}
                  />
                  <Select
                    size="sm"
                    label="Reviewed supplier GST split"
                    value={posting.taxMode}
                    onChange={event => setPosting({ ...posting, taxMode: event.target.value })}
                    options={[
                      { value: "", label: "Choose reviewed tax split" },
                      { value: "sgst", label: "CGST + SGST" },
                      { value: "utgst", label: "CGST + UTGST" },
                      { value: "igst", label: "IGST" },
                    ]}
                  />
                  <Select
                    size="sm"
                    label="Reviewed acquisition cost treatment"
                    value={posting.cost}
                    onChange={event => setPosting({ ...posting, cost: event.target.value })}
                    options={[
                      { value: "", label: "Choose reviewed cost treatment" },
                      { value: "exclude_tax", label: "Exclude supplier GST from stock cost" },
                      { value: "include_tax", label: "Include supplier GST in stock cost" },
                    ]}
                  />
                  <Input
                    size="sm"
                    label="Reviewed invoice round-off (INR)"
                    value={posting.round}
                    onChange={event => setPosting({ ...posting, round: event.target.value })}
                  />
                </div>
                <Input
                  size="sm"
                  label="Supplier eligibility and tax review reference"
                  maxLength={200}
                  value={posting.review}
                  onChange={event => setPosting({ ...posting, review: event.target.value })}
                />
                <div className="pt-1">
                  <Button size="sm" type="submit" disabled={!party || Boolean(lookupError)} loading={busy}>
                    Post saved supplier invoice
                  </Button>
                </div>
              </fieldset>
            </form>
          ) : (
            <form onSubmit={receive} className="space-y-4" noValidate>
              {!pending && (
                <PharmacyDeliveryManifest
                  key={`${scope}:${purchase.id}:${purchase.revision}`}
                  purchase={purchase}
                  disabled={busy}
                  onReading={setReadingManifest}
                  onReview={rows => {
                    setLines(rows);
                    setError("");
                  }}
                />
              )}
              <fieldset className="space-y-3" disabled={disabled}>
                <p className="leading-relaxed text-text-secondary">
                  Remaining invoice quantities are prefilled. Adjust to the actual delivery for partial receipts, or split a product into
                  separate batch lots. Record each printed batch and expiry.
                </p>
                <Input
                  size="sm"
                  label="Actual delivery reference"
                  maxLength={100}
                  value={deliveryReference}
                  onChange={event => setDeliveryReference(event.target.value)}
                />

                <div className="space-y-2.5">
                  {lines.map((line, index) => {
                    const remaining = plan.rows.find(row => row.source.lineId === line.purchaseLineId)!;
                    const edit = (field: keyof DeliveryLine, value: string) =>
                      setLines(previous => previous.map(row => (row.lineId === line.lineId ? { ...row, [field]: value } : row)));
                    const fields = (
                      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-3" aria-label={`Delivery line ${index + 1}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="min-w-0 flex-1">
                            <Select
                              size="sm"
                              label={`Source purchase line ${index + 1}`}
                              value={line.purchaseLineId}
                              onChange={event => edit("purchaseLineId", event.target.value)}
                              options={outstanding.map((row, number) => ({
                                value: row.source.lineId,
                                label: `${number + 1}. ${row.source.medicineSnapshot.name}`,
                              }))}
                            />
                            <p className="mt-1.5 text-[11px] text-text-secondary">
                              Remaining: {remaining.billed} billed, {remaining.free} free {remaining.source.unitSnapshot.baseUnit}.
                            </p>
                          </div>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-error-text"
                            icon={<Trash2 size={13} aria-hidden="true" />}
                            onClick={() => setLines(previous => previous.filter(row => row.lineId !== line.lineId))}
                          >
                            Remove delivery line {index + 1}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <Input
                            size="sm"
                            label={`Received billed base units ${index + 1}`}
                            type="number"
                            min="0"
                            step="1"
                            value={line.billed}
                            onChange={event => edit("billed", event.target.value)}
                          />
                          <Input
                            size="sm"
                            label={`Received free base units ${index + 1}`}
                            type="number"
                            min="0"
                            step="1"
                            value={line.free}
                            onChange={event => edit("free", event.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <Input
                            size="sm"
                            label={`Printed batch ${index + 1}`}
                            value={line.batch}
                            maxLength={100}
                            onChange={event => edit("batch", event.target.value)}
                          />
                          <Select
                            size="sm"
                            label={`Expiry precision ${index + 1}`}
                            value={line.precision}
                            onChange={event => {
                              edit("precision", event.target.value);
                              edit("expiry", "");
                            }}
                            options={[
                              { value: "month", label: "Printed month" },
                              { value: "day", label: "Printed day" },
                            ]}
                          />
                          <DatePicker
                            size="sm"
                            label={`Printed expiry ${index + 1}`}
                            mode={line.precision === "month" ? "month" : "date"}
                            value={line.expiry}
                            onChange={value => edit("expiry", value)}
                          />
                        </div>
                      </fieldset>
                    );

                    return lines.length > 5 ? (
                      <details key={line.lineId} className="group overflow-hidden rounded-xl border border-border bg-surface">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 bg-surface-alt/40 px-3 py-2 text-xs font-medium text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0">
                            {index + 1}. {remaining.source.medicineSnapshot.name} · {line.billed} billed + {line.free} free · Batch{" "}
                            {line.batch || "required"} · Expiry {line.expiry || "required"}
                          </span>
                          <ChevronDown
                            size={14}
                            className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="border-t border-border/60 p-2 [&>fieldset]:border-0 [&>fieldset]:p-1">{fields}</div>
                      </details>
                    ) : (
                      <div key={line.lineId}>{fields}</div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    icon={<Plus size={13} aria-hidden="true" />}
                    disabled={lines.length >= 100}
                    onClick={() => setLines(previous => [...previous, addLine()])}
                  >
                    Add delivery lot
                  </Button>
                  <Button size="sm" type="submit" loading={busy}>
                    Record purchase delivery
                  </Button>
                </div>
              </fieldset>
            </form>
          ))}

        {!postingMode && (
          <section aria-label="Recorded purchase deliveries" className="space-y-2.5 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text">Recorded deliveries</h3>
              {receipts.length > 0 && (
                <Badge variant="neutral" size="sm">
                  {receipts.length} shown
                </Badge>
              )}
            </div>
            {historyError && (
              <Alert
                variant="error"
                title="Delivery history unavailable"
                action={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      void loadHistory();
                    }}
                  >
                    Retry delivery history
                  </Button>
                }
              >
                {historyError}
              </Alert>
            )}
            <div className="space-y-2">
              {receipts.map(receipt => (
                <article key={receipt.id} className="space-y-1.5 rounded-xl border border-border bg-surface-alt/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-xs font-semibold text-text">{receipt.deliveryReference}</strong>
                    <span className="text-[11px] text-text-secondary">{receipt.receivedAt}</span>
                  </div>
                  {receipt.lines.map(line => (
                    <p key={line.lineId} className="text-[11px] text-text-secondary">
                      Batch {line.batchNumber}: {line.billedBaseUnits} billed + {line.freeBaseUnits} free. Printed expiry{" "}
                      {line.expiry.value}. Cost <span className="tabular-nums text-text">{money(line.costPaise / 100)}</span>.
                    </p>
                  ))}
                </article>
              ))}
            </div>
            {cursor && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  void loadHistory(cursor);
                }}
              >
                Next delivery page
              </Button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
