"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownUp, ChevronDown, Lock, Printer, RotateCw, Wallet } from "lucide-react";
import { Alert, Badge, Button, Card, CardDescription, CardTitle, Input, Select, Spinner, cn } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import {
  activeDrawer,
  drawerHistory,
  readDrawer,
  recoverDrawer,
  submitDrawer,
  type CashierDrawer,
  type DrawerKind,
  type DrawerOutcome,
  type DrawerReference,
  type DrawerChannel,
} from "@/lib/pharmacyTill";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import { printElement } from "@/lib/printBrand";

interface Props {
  locationId: string;
  canOpen: boolean;
  canClose: boolean;
  canMove: boolean;
  channel?: DrawerChannel;
  compact?: boolean;
}

function stored(key: string): DrawerReference | null {
  const value = sessionStorage.getItem(key);
  if (!value) return null;
  const ref = JSON.parse(value) as DrawerReference;
  if (
    !ref ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(ref.key) ||
    !["open", "close", "movement"].includes(ref.kind) ||
    (ref.kind !== "open" && !/^[a-f\d]{24}$/i.test(ref.drawerId || ""))
  ) {
    throw new Error("Drawer operation reference needs review");
  }
  return ref;
}

export function PharmacyTill(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <DrawerSession key={`${scope}:${props.locationId}`} {...props} />;
}

function DrawerSession({ locationId, canOpen, canClose, canMove, channel = "pharmacy", compact = false }: Props) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const storageKey = `pharmacy-drawer:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => {
    try {
      return { ref: stored(storageKey), error: "" };
    } catch (failure) {
      return { ref: null, error: pharmacyFinanceMessage(failure) };
    }
  });
  const [pending, setPending] = useState(initial.ref);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DrawerOutcome | null>(null);
  const [review, setReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [drawer, setDrawer] = useState<CashierDrawer | null>(null);
  const [history, setHistory] = useState<CashierDrawer[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const frozen = useRef<{ ref: DrawerReference; input: object } | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const document = useRef<HTMLDivElement>(null);
  const beginRead = useLatestRead();
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const request = beginRead();
    setLoading(true);
    setReadError("");
    try {
      const [active, page] = await Promise.all([
        pending?.drawerId ? readDrawer(locationId, pending.drawerId, channel) : activeDrawer(locationId, request.signal, channel),
        drawerHistory(locationId, undefined, request.signal, channel),
      ]);
      if (request.isCurrent()) {
        setDrawer(active);
        setHistory(page.items);
        setNext(page.nextCursor);
      }
    } catch (failure) {
      if (request.isCurrent()) {
        setDrawer(null);
        setReadError(pharmacyFinanceMessage(failure));
      }
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [beginRead, locationId, channel, pending]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(kind: DrawerKind, input: object, drawerId?: string) {
    if (!current() || lock.current || result || (kind === "open" ? !canOpen : kind === "close" ? !canClose : !canMove)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReview(false);
    try {
      const saved = stored(storageKey);
      if ((saved?.key || null) !== (pending?.key || null) || (pending && (pending.kind !== kind || pending.drawerId !== drawerId))) {
        throw new Error("Resolve the pending drawer operation first");
      }
      const ref = pending || { key: crypto.randomUUID(), kind, ...(drawerId ? { drawerId } : {}) };
      if (!pending) sessionStorage.setItem(storageKey, JSON.stringify(ref));
      setPending(ref);
      const command = frozen.current || { ref, input: JSON.parse(JSON.stringify(input)) as object };
      frozen.current = command;
      setSubmitted(true);
      const outcome = await submitDrawer(locationId, command.ref, command.input, channel);
      if (current()) setResult(outcome);
    } catch (failure) {
      if (current()) {
        setError(pharmacyFinanceMessage(failure));
        setReview([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0));
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function recover() {
    if (!current() || lock.current || !pending) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const outcome = await recoverDrawer(locationId, pending, channel);
      if (current()) setResult(outcome);
    } catch (failure) {
      if (current()) setError(pharmacyFinanceMessage(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  function done() {
    if (!current() || busy || !result) return;
    try {
      if (stored(storageKey)?.key !== result.requestKey) {
        throw new Error("Drawer operation reference changed; recover its original result");
      }
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setResult(null);
      frozen.current = null;
      setSubmitted(false);
      setReview(false);
      void load();
    } catch (failure) {
      setError(pharmacyFinanceMessage(failure));
    }
  }

  async function inspect(id: string) {
    if (busy || pending) return;
    setReadError("");
    try {
      const row = await readDrawer(locationId, id, channel);
      if (current()) setDrawer(row);
    } catch (failure) {
      if (current()) setReadError(pharmacyFinanceMessage(failure));
    }
  }

  async function page() {
    if (!next || busy) return;
    const request = beginRead();
    try {
      const resultPage = await drawerHistory(locationId, next, request.signal, channel);
      if (request.isCurrent()) {
        setHistory(resultPage.items);
        setNext(resultPage.nextCursor);
      }
    } catch (failure) {
      if (request.isCurrent()) setReadError(pharmacyFinanceMessage(failure));
    }
  }

  const locked = busy || Boolean(result) || Boolean(pending && !review && submitted);
  const shownDrawer = result?.drawer || drawer;

  return (
    <section className="min-w-0 space-y-3" aria-label="Physical cash drawer">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0">
            {!compact && <h2 className="text-sm font-semibold text-text md:text-base">Cash drawer</h2>}
            <p className={cn("text-xs text-text-secondary", !compact && "mt-0.5 hidden sm:block")}>
              Open the drawer you actually use. Count opening cash, record actual movements and count cash again at handover.
            </p>
          </div>
          <Button
            size="xs"
            variant="outline"
            disabled={busy || Boolean(pending)}
            aria-label="Refresh drawer"
            title="Refresh drawer"
            onClick={() => {
              void load();
            }}
            icon={<RotateCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />}
          >
            <span className="hidden sm:inline">Refresh drawer</span>
          </Button>
        </header>

        {(error || pending || readError) && (
          <div className="space-y-2.5 px-3 pt-3 md:px-4">
            {error && (
              <Alert variant="error" title="Drawer outcome needs attention">
                {error}
              </Alert>
            )}
            {pending && (
              <Alert variant={result ? "success" : "warning"} title={result ? "Drawer operation confirmed" : "Pending drawer operation"}>
                <div className="space-y-2 text-xs">
                  <p className="break-all font-mono text-[11px]">Reference {pending.key}</p>
                  {result ? (
                    <>
                      <p>
                        {result.drawer.drawerCode}:{" "}
                        {result.kind === "close" ? "closed" : result.kind === "open" ? "opened" : "cash movement recorded"}. This is the
                        original committed result.
                      </p>
                      <div>
                        <Button size="xs" disabled={busy} onClick={done}>
                          Done with drawer operation
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Check this result before another drawer command. Reload retains this reference.</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="xs"
                          disabled={busy}
                          onClick={() => {
                            void recover();
                          }}
                        >
                          Check drawer result
                        </Button>
                        {submitted && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const saved = frozen.current;
                              if (saved) void send(saved.ref.kind, saved.input, saved.ref.drawerId);
                            }}
                          >
                            Retry same drawer operation
                          </Button>
                        )}
                        {(!submitted || review) && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              frozen.current = null;
                              setSubmitted(false);
                              setReview(true);
                              void load();
                            }}
                          >
                            Reload original drawer source
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Alert>
            )}
            {readError && (
              <Alert variant="error" title="Drawer unavailable">
                {readError}
              </Alert>
            )}
          </div>
        )}

        {loading ? (
          <div role="status" className="flex items-center gap-2 p-4 text-xs text-text-secondary">
            <Spinner size="sm" />
            Loading drawer...
          </div>
        ) : (
          <>
            {!readError && !drawer && canOpen && (!pending || pending.kind === "open") && (
              <div className="p-3 md:p-4">
                <DrawerOpen
                  disabled={locked}
                  onSubmit={input => {
                    void send("open", input);
                  }}
                />
              </div>
            )}

            {shownDrawer && (
              <div ref={document} className="p-3 md:p-4">
                <DrawerSummary drawer={shownDrawer} />
              </div>
            )}

            {!readError && drawer?.status === "active" && !result && (
              <div className="border-t border-border/70 p-3 md:p-4">
                <DrawerActions
                  key={`${drawer.id}:${drawer.revision}`}
                  drawer={drawer}
                  canClose={canClose}
                  canMove={canMove}
                  disabled={locked}
                  pending={pending}
                  compact={compact}
                  onSubmit={(kind, input) => {
                    void send(kind, input, drawer.id);
                  }}
                />
              </div>
            )}

            {shownDrawer?.status === "closed" && (
              <div className="px-3 pb-3 md:px-4 md:pb-4">
                <Button
                  size="xs"
                  variant="outline"
                  icon={<Printer size={14} aria-hidden="true" />}
                  onClick={() => {
                    void printElement(document.current, { title: `Drawer ${shownDrawer.drawerCode}`, paper: "A4" }).catch(failure => {
                      if (current()) setError(pharmacyFinanceMessage(failure));
                    });
                  }}
                >
                  Print saved drawer close
                </Button>
              </div>
            )}

            <div className="border-t border-border/70">
              <details open={!compact} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-surface-alt/40 px-3 py-3 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-4 md:text-sm [&::-webkit-details-marker]:hidden">
                  <span>Drawer history</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {history.length}
                      {next ? "+" : ""}
                    </Badge>
                    <ChevronDown
                      size={16}
                      className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="border-t border-border/60">
                  {!history.length ? (
                    <p className="px-3 py-6 text-center text-xs text-text-secondary md:px-4">No drawer shifts recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {history.map(row => (
                        <article
                          className="flex flex-col gap-2 px-3 py-3 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between md:px-4"
                          key={row.id}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <strong className="text-xs font-semibold text-text">{row.drawerCode}</strong>
                              <Badge variant={row.status === "active" ? "success" : "neutral"} size="sm">
                                {row.status === "active" ? "Open" : "Closed"}
                              </Badge>
                              <span className="text-xs text-text-secondary">· {row.cashierName}</span>
                            </div>
                            <p className="text-[11px] text-text-secondary">
                              {new Date(row.startedAt).toLocaleString("en-IN", { timeZone: row.timezone })} ({row.timezone})
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={busy || Boolean(pending)}
                              onClick={() => {
                                void inspect(row.id);
                              }}
                            >
                              View drawer {row.drawerCode}
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {next && (
                    <div className="border-t border-border/60 bg-surface-alt/40 px-3 py-2.5 md:px-4">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || Boolean(pending)}
                        onClick={() => {
                          void page();
                        }}
                      >
                        Next drawer page
                      </Button>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function DrawerOpen({ disabled, onSubmit }: { disabled: boolean; onSubmit: (input: object) => void }) {
  const [code, setCode] = useState("");
  const [float, setFloat] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-surface-alt/30 p-3 md:p-4">
      <div>
        <CardTitle>Open a cash drawer</CardTitle>
        <CardDescription className="mt-1">
          Choose a name for this counter and enter the cash counted at the start of the shift.
        </CardDescription>
      </div>
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          if (disabled) return;
          const amount = parseReceiptPaise(float);
          if (amount === null || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code.trim().toUpperCase())) {
            setError("Enter the actual drawer code and exact counted opening cash");
            return;
          }
          onSubmit({ drawerCode: code.trim().toUpperCase(), openingFloatPaise: amount });
        }}
      >
        <fieldset className="space-y-4" disabled={disabled}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              size="sm"
              label="Physical drawer code"
              placeholder="COUNTER-01"
              hint="Identifies the physical counter used for this shift."
              value={code}
              maxLength={40}
              onChange={event => setCode(event.target.value)}
            />
            <Input
              size="sm"
              label="Counted opening cash"
              hint="Cash already in the drawer before taking payments."
              type="number"
              min="0"
              step="0.01"
              value={float}
              onChange={event => setFloat(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-danger-text">
              {error}
            </p>
          )}
          <div>
            <Button size="sm" type="submit" icon={<Wallet size={14} aria-hidden="true" />}>
              Open physical drawer
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function DrawerActions({
  drawer,
  canClose,
  canMove,
  disabled,
  pending,
  compact,
  onSubmit,
}: {
  drawer: CashierDrawer;
  canClose: boolean;
  canMove: boolean;
  disabled: boolean;
  pending: DrawerReference | null;
  compact: boolean;
  onSubmit: (kind: "close" | "movement", input: object) => void;
}) {
  const [direction, setDirection] = useState("out");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState("");
  const [variance, setVariance] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const showMove = canMove && (!pending || (pending.kind === "movement" && pending.drawerId === drawer.id));
  const showClose = canClose && (!pending || (pending.kind === "close" && pending.drawerId === drawer.id));

  if (!showMove && !showClose) return null;

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="error" title="Check drawer details">
          {error}
        </Alert>
      )}
      <div className={cn("grid grid-cols-1 gap-3", !compact && showMove && showClose && "lg:grid-cols-2")}>
        {showMove && (
          <form
            className="rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4"
            onSubmit={event => {
              event.preventDefault();
              if (disabled) return;
              const paise = parseReceiptPaise(amount);
              if (!paise || reference.trim().length < 3 || reason.trim().length < 3) {
                setError("Confirm the actual cash movement amount, reference and reason");
                return;
              }
              onSubmit("movement", {
                expectedRevision: drawer.revision,
                direction,
                amountPaise: paise,
                referenceNumber: reference.trim(),
                reviewReference: reason.trim(),
              });
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <ArrowDownUp size={15} className="shrink-0 text-accent" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-text md:text-sm">Actual cash movement</h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Select
                  size="sm"
                  label="Cash movement direction"
                  value={direction}
                  onChange={event => setDirection(event.target.value)}
                  options={[
                    { value: "out", label: "Cash taken out" },
                    { value: "in", label: "Cash added" },
                  ]}
                />
                <Input
                  size="sm"
                  label="Actual cash movement amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                />
              </div>
              <Input
                size="sm"
                label="Actual cash movement reference"
                value={reference}
                maxLength={100}
                onChange={event => setReference(event.target.value)}
              />
              <Input
                size="sm"
                label="Cash movement reason"
                value={reason}
                maxLength={500}
                onChange={event => setReason(event.target.value)}
              />
              <div>
                <Button size="xs" variant="outline" type="submit">
                  Record actual cash movement
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        {showClose && (
          <form
            className="rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4"
            onSubmit={event => {
              event.preventDefault();
              if (disabled) return;
              const parsedCounted = parseReceiptPaise(counted);
              if (parsedCounted === null || (parsedCounted !== drawer.drawerTotals.expectedCashPaise && !variance.trim())) {
                setError("Count the actual closing cash and explain any difference");
                return;
              }
              onSubmit("close", {
                expectedRevision: drawer.revision,
                countedCashPaise: parsedCounted,
                varianceReason: variance.trim(),
                handoverNotes: notes.trim(),
              });
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <Lock size={15} className="shrink-0 text-accent" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-text md:text-sm">Count and close drawer</h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  size="sm"
                  label="Actual closing cash counted"
                  type="number"
                  min="0"
                  step="0.01"
                  value={counted}
                  onChange={event => setCounted(event.target.value)}
                />
                <Input
                  size="sm"
                  label="Cash variance explanation"
                  value={variance}
                  maxLength={500}
                  onChange={event => setVariance(event.target.value)}
                />
              </div>
              <Input
                size="sm"
                label="Drawer handover notes"
                value={notes}
                maxLength={1000}
                onChange={event => setNotes(event.target.value)}
              />
              <div>
                <Button size="xs" type="submit">
                  Close physical drawer
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}

export function DrawerSummary({ drawer }: { drawer: CashierDrawer }) {
  const mobile = useMobileViewport();
  const amount = (paise: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: drawer.currency }).format(paise / 100);
  const totals = drawer.drawerTotals;
  const methods = ["cash", "upi", "card", "other"] as const;

  return (
    <section className="space-y-3" aria-label="Drawer reconciliation">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <h3 className="break-words text-sm font-semibold text-text md:text-base">
            {drawer.organizationName} · {drawer.locationName}
          </h3>
          <p className="text-xs text-text-secondary">
            {drawer.drawerCode} · {drawer.cashierName}
          </p>
          <p className="text-[11px] text-text-secondary">
            Opened {new Date(drawer.startedAt).toLocaleString("en-IN", { timeZone: drawer.timezone })} ({drawer.timezone})
          </p>
        </div>
        <Badge variant={drawer.status === "active" ? "success" : "neutral"} dot>
          {drawer.status === "active" ? "Open" : "Closed"}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-border/70 bg-surface-alt/50 p-3">
          <dt className="text-[11px] font-medium text-text-secondary">Opening cash</dt>
          <dd className="mt-1 break-words text-base font-semibold tabular-nums text-text sm:text-lg">
            {amount(drawer.openingFloatPaise)}
          </dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-accent-subtle/40 p-3">
          <dt className="text-[11px] font-medium text-text-secondary">Expected cash</dt>
          <dd className="mt-1 break-words text-base font-semibold tabular-nums text-text sm:text-lg">
            {amount(totals.expectedCashPaise)}
          </dd>
        </div>
      </dl>

      {mobile ? (
        <div className="overflow-hidden rounded-xl border border-border/70" role="region" aria-label="Drawer payment breakdown">
          <div className="border-b border-border/60 bg-surface-alt/60 px-3 py-2 text-[11px] font-semibold text-text-secondary">
            Actual receipts and movements ({drawer.currency})
          </div>
          <div className="divide-y divide-border/60">
            {methods.map(method => (
              <div key={method} className="space-y-1.5 px-3 py-2.5 text-xs">
                <strong className="block font-semibold text-text">{method.toUpperCase()}</strong>
                <dl className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="text-text-secondary">Collections</dt>
                    <dd className="font-medium tabular-nums text-text">{amount(totals.incoming[method])}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Other inflows</dt>
                    <dd className="font-medium tabular-nums text-text">{amount(totals.eventIncoming[method])}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Outflows</dt>
                    <dd className="font-medium tabular-nums text-text">{amount(totals.outgoing[method])}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70" role="region" aria-label="Drawer payment breakdown" tabIndex={0}>
          <table className="w-full border-collapse text-left text-xs">
            <caption className="px-3 py-2 text-left text-[11px] text-text-secondary">
              Actual receipts and movements ({drawer.currency})
            </caption>
            <thead className="border-y border-border/80 bg-surface-alt/70 font-semibold text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Method
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Collections
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Other inflows
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Outflows
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {methods.map(method => (
                <tr key={method}>
                  <th scope="row" className="px-3 py-2 font-semibold text-text">
                    {method.toUpperCase()}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{amount(totals.incoming[method])}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{amount(totals.eventIncoming[method])}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{amount(totals.outgoing[method])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-text-secondary">
        {totals.receiptCount} receipt components · {totals.invoiceCount} invoices · {totals.eventCount} movements
      </p>

      {drawer.status === "closed" && (
        <div className="space-y-1.5 rounded-xl border border-border bg-surface-alt/50 p-3 text-xs">
          <p className="text-text-secondary">
            Closed {new Date(drawer.endedAt!).toLocaleString("en-IN", { timeZone: drawer.timezone })} ({drawer.timezone}) by{" "}
            <strong className="font-medium text-text">{drawer.closedByName}</strong>
          </p>
          <p className="font-medium tabular-nums text-text">
            Counted {amount(Math.round(drawer.actualCashCounted! * 100))} · Variance {amount(Math.round(drawer.cashVariance! * 100))}
          </p>
          {drawer.varianceReason && <p className="text-text-secondary">Variance explanation: {drawer.varianceReason}</p>}
          {drawer.handoverNotes && <p className="text-text-secondary">Handover: {drawer.handoverNotes}</p>}
        </div>
      )}

      <details className="group border-t border-border/60 pt-2 text-[11px] text-text-secondary">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 font-medium select-none hover:text-text [&::-webkit-details-marker]:hidden">
          <span>Record details</span>
          <ChevronDown
            size={14}
            className="shrink-0 transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <p className="mt-1 break-all font-mono">
          Revision {drawer.revision}
          {drawer.evidenceHash && ` · Evidence ${drawer.evidenceHash}`}
        </p>
      </details>
    </section>
  );
}
