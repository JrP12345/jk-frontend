"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, Plus, Printer, RotateCcw, RotateCw, Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Checkbox, DatePicker, Input, QuantityInput, Select, Spinner } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { packDescription } from "@/lib/pharmacyUnits";
import {
  createOrderJournal,
  listOrders,
  orderError,
  orderHistory,
  readOrder,
  recoverOrderCommand,
  sendOrderCommand,
  type OrderActionInput,
  type OrderCommand,
  type OrderDraftInput,
  type OrderSummary,
  type PurchaseOrder,
} from "@/lib/pharmacyPurchaseOrders";
import { purchasePage, type PharmacyParty, type PurchaseDraft, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import type { ShortbookDraftSeed } from "@/lib/pharmacyShortbook";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import api from "@/lib/api";
import { money } from "./pharmacyWorkspace";
import { PharmacyPackQuantity } from "./PharmacyPackQuantity";
import { PharmacyPurchaseOrderDocument } from "./PharmacyPurchaseOrderDocument";
import { PharmacySupplierCollaboration } from "./PharmacySupplierCollaboration";
import { PharmacySupplierResponseFile } from "./PharmacySupplierResponseFile";

interface Props {
  locationId: string;
  canManage: boolean;
  seed?: ShortbookDraftSeed;
  initialOrderId?: string;
  onSeedClosed: () => void;
  onOpenInvoice: (id: string) => void;
}

const orderStatusVariant = (status: string) =>
  status === "received"
    ? "success"
    : ["partially_received", "dispatched", "accepted", "partially_accepted"].includes(status)
      ? "primary"
      : status === "cancelled" || status === "rejected"
        ? "danger"
        : "neutral";

export function PharmacyPurchaseOrders(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <OrderSession key={`${scope}:${props.locationId}`} {...props} />;
}

function OrderSession({ locationId, canManage, seed, initialOrderId, onSeedClosed, onOpenInvoice }: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const [journal] = useState(() => createOrderJournal(scope, locationId));
  const [pending, setPending] = useState<OrderCommand | null>(null);
  const [ready, setReady] = useState(false);
  const [durable, setDurable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState(false);
  const [reviewable, setReviewable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [page, setPage] = useState<{ items: OrderSummary[]; nextCursor: string | null }>({ items: [], nextCursor: null });
  const [loaded, setLoaded] = useState("");
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(seed ? "new" : null);
  const [copySeed, setCopySeed] = useState(seed);
  const [document, setDocument] = useState<PurchaseOrder | null>(null);
  const read = useLatestRead();
  const detailRead = useLatestRead();
  const lock = useRef(false);
  const alive = useRef(true);
  const [collaboration, setCollaboration] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    if (!initialOrderId) return;
    const request = detailRead();
    void readOrder(initialOrderId, locationId, request.signal)
      .then(row => {
        if (request.isCurrent()) setSelected(row);
      })
      .catch(failure => {
        if (request.isCurrent()) setError(orderError(failure));
      });
    return () => {
      detailRead();
    };
  }, [initialOrderId, locationId, detailRead]);

  const suppliers = useLookup<PharmacyParty>(locationId, "parties", supplierSearch);
  const key = `${query}:${cursor || ""}:${supplierId}:${attempt}`;
  const loading = loaded !== key;
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;

  useEffect(() => {
    alive.current = true;
    journal
      .load()
      .then(value => {
        if (alive.current) {
          setPending(value.value);
          setDurable(value.durable);
          setReady(true);
        }
      })
      .catch(failure => {
        if (alive.current) setError(orderError(failure));
      });
    return () => {
      alive.current = false;
    };
  }, [journal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursor(undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const request = read();
    listOrders(locationId, query, cursor, supplierId || undefined, request.signal)
      .then(value => {
        if (request.isCurrent()) {
          setPage(value);
          setListError("");
          setLoaded(key);
        }
      })
      .catch(failure => {
        if (request.isCurrent()) {
          setPage({ items: [], nextCursor: null });
          setListError(orderError(failure));
          setLoaded(key);
        }
      });
  }, [locationId, query, cursor, supplierId, attempt, key, read]);

  async function open(id: string) {
    const request = detailRead();
    try {
      const result = await readOrder(id, locationId, request.signal);
      if (request.isCurrent()) {
        setSelected(result);
        setError("");
      }
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    }
  }

  async function accepted(result: PurchaseOrder) {
    await journal.save(null);
    if (current()) {
      setPending(null);
      setRejected(false);
      setReviewable(false);
      setError("");
      setEditing(null);
      setSelected(result);
      setCopySeed(undefined);
      onSeedClosed();
      setAttempt(value => value + 1);
    }
  }

  async function execute(command: OrderCommand) {
    if (lock.current || !ready || !canManage || !current()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReviewable(false);
    setRejected(false);
    try {
      if (pending && pending.key !== command.key) throw new Error("Resolve the original order command first");
      const frozen = JSON.parse(JSON.stringify(command)) as OrderCommand;
      const saved = await journal.save(frozen);
      if (!current()) return;
      setPending(frozen);
      setDurable(saved.durable);
      await accepted(await sendOrderCommand(frozen));
    } catch (failure) {
      if (current()) {
        setError(orderError(failure));
        setRejected([400, 409, 428].includes((failure as { response?: { status?: number } })?.response?.status || 0));
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
      await accepted(await recoverOrderCommand(pending));
    } catch (failure) {
      if (current()) {
        setError(orderError(failure));
        setReviewable(rejected && (failure as { response?: { status?: number } })?.response?.status === 404);
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  async function reviewRejected() {
    if (!reviewable || busy) return;
    try {
      await journal.save(null);
      if (current()) {
        setPending(null);
        setReviewable(false);
        setError("");
      }
    } catch (failure) {
      if (current()) setError(orderError(failure));
    }
  }

  const recovery = (
    <div className="space-y-2.5 empty:hidden">
      {!durable && (
        <Alert variant="warning" title="Local recovery is memory only">
          Keep this tab open while resolving a request. Saved server drafts remain available in order history.
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Order needs attention">
          {error}
        </Alert>
      )}
      {pending && (
        <Alert variant="warning" title="Resolve original order request">
          <p className="break-all text-xs">Reference {pending.key}. Retrying sends the same details and never creates stock.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              disabled={busy}
              onClick={() => {
                void recover();
              }}
            >
              Check saved order result
            </Button>
            {canManage && (
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void execute(pending);
                }}
              >
                Retry original order request
              </Button>
            )}
            {reviewable && (
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void reviewRejected();
                }}
              >
                Return to rejected details
              </Button>
            )}
          </div>
        </Alert>
      )}
    </div>
  );

  const disabled = busy || !ready || Boolean(pending);

  return (
    <section className="min-w-0" aria-label="Supplier purchase orders">
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 px-3 py-3 md:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">Purchase orders</h3>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Request supply, record actual supplier communication, then link posted invoices. Availability and prices are not live.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            icon={<RotateCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />}
            disabled={busy}
            onClick={() => setAttempt(value => value + 1)}
          >
            Refresh orders
          </Button>
          {canManage && (
            <Button
              size="xs"
              icon={<Plus size={14} aria-hidden="true" />}
              disabled={disabled}
              onClick={() => {
                setCopySeed(undefined);
                setEditing("new");
              }}
            >
              New purchase order
            </Button>
          )}
        </div>
      </header>

      {!editing && !selected && <div className="px-3 pt-3 empty:hidden md:px-4">{recovery}</div>}

      <div className="space-y-2.5 border-b border-border/60 bg-surface-alt/40 p-3 md:px-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Input
            size="sm"
            type="search"
            icon={<Search size={14} aria-hidden="true" />}
            label="Find order or supplier"
            maxLength={100}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <Input
            size="sm"
            type="search"
            icon={<Search size={14} aria-hidden="true" />}
            label="Find supplier for order history"
            maxLength={100}
            value={supplierSearch}
            onChange={event => setSupplierSearch(event.target.value)}
          />
          <Select
            size="sm"
            label="Order history supplier"
            value={supplierId}
            options={[
              { value: "", label: "All suppliers" },
              ...suppliers.rows.filter(row => row.kinds.includes("supplier")).map(row => ({ value: row.id, label: row.name })),
            ]}
            onChange={event => {
              setSupplierId(event.target.value);
              setCursor(undefined);
            }}
          />
        </div>
        {(suppliers.error || suppliers.next) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {suppliers.error && (
              <p role="alert" className="text-xs text-danger-text">
                {suppliers.error}
              </p>
            )}
            {suppliers.next && (
              <Button size="xs" variant="outline" onClick={suppliers.more}>
                More history suppliers
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div role="status" className="flex items-center gap-2 px-3 py-4 text-xs text-text-secondary md:px-4">
          <Spinner size="sm" />
          Loading orders…
        </div>
      ) : listError ? (
        <div className="p-3 md:px-4">
          <Alert variant="error" title="Orders unavailable">
            {listError}
          </Alert>
        </div>
      ) : !page.items.length ? (
        <p className="px-3 py-10 text-center text-xs text-text-secondary md:px-4">No orders match these filters.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {page.items.map(row => (
            <article
              key={row.id}
              className="flex flex-col gap-2.5 px-3 py-3 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between md:px-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="text-xs font-semibold text-text">{row.reference}</strong>
                  <Badge variant={orderStatusVariant(row.status)} size="sm">
                    Fulfilment: {row.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="text-[11px] text-text-secondary">
                  {row.supplierSnapshot.name} · {new Date(row.createdAt).toLocaleDateString("en-IN")}
                </p>
                <p className="text-[11px] text-text-secondary">
                  Supplier stage: {row.state.replaceAll("_", " ")} · {row.invoiceCount} linked invoices
                </p>
              </div>
              <div className="shrink-0">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void open(row.id);
                  }}
                >
                  Open order {row.reference}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(cursor || (!loading && page.nextCursor)) && (
        <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-surface-alt/40 px-3 py-2.5 md:px-4">
          {cursor ? (
            <Button size="xs" variant="outline" onClick={() => setCursor(undefined)}>
              Latest orders
            </Button>
          ) : (
            <span />
          )}
          {!loading && page.nextCursor && (
            <Button size="xs" variant="outline" onClick={() => setCursor(page.nextCursor!)}>
              Older orders
            </Button>
          )}
        </footer>
      )}

      {editing && canManage && (
        <OrderForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.revision}`}
          locationId={locationId}
          order={editing === "new" ? undefined : editing}
          seed={copySeed}
          disabled={disabled}
          recovery={recovery}
          busy={busy}
          onClose={() => {
            setEditing(null);
            setCopySeed(undefined);
            onSeedClosed();
          }}
          onSave={(input, orderId) => {
            void execute({ key: crypto.randomUUID(), kind: "save", orderId, input });
          }}
        />
      )}

      {selected && !editing && !document && !collaboration && (
        <OrderDetail
          key={`${selected.id}:${selected.revision}`}
          order={selected}
          canManage={canManage}
          disabled={disabled}
          busy={busy}
          recovery={recovery}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            void open(selected.id);
          }}
          onDocument={() => setDocument(selected)}
          onCollaboration={() => setCollaboration(selected)}
          onEdit={() => setEditing(selected)}
          onReorder={() => {
            setCopySeed({
              lines: selected.lines.map(line => ({
                product: {
                  id: line.medicineId,
                  name: line.medicineSnapshot.name,
                  price: 0,
                  unitDefinition: line.unitSnapshot,
                },
                quantity: line.quantity,
              })),
              notes: `Reorder of ${selected.reference}; recheck supplier terms and current product units.`,
            });
            setEditing("new");
          }}
          onOpenInvoice={id => {
            setSelected(null);
            onOpenInvoice(id);
          }}
          onAction={input => {
            void execute({ key: crypto.randomUUID(), kind: "action", orderId: selected.id, input });
          }}
        />
      )}

      {document && <PharmacyPurchaseOrderDocument order={document} onClose={() => setDocument(null)} />}
      {collaboration && (
        <PharmacySupplierCollaboration
          order={collaboration}
          canManage={canManage && !disabled}
          onClose={() => {
            setCollaboration(null);
            void open(collaboration.id);
            setAttempt(value => value + 1);
          }}
        />
      )}
    </section>
  );
}

function useLookup<T>(locationId: string, kind: "parties" | "purchase-products", search: string) {
  const [cursor, setCursor] = useState<string>();
  const [rows, setRows] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState("");
  const read = useLatestRead();
  const key = `${kind}:${search}:${cursor || ""}`;

  useEffect(() => {
    const request = read();
    const timer = setTimeout(() => {
      purchasePage<T>(kind, locationId, { search, cursor }, request.signal)
        .then(page => {
          if (request.isCurrent()) {
            setRows(page.items);
            setNext(page.nextCursor);
            setError("");
            setLoaded(key);
          }
        })
        .catch(failure => {
          if (request.isCurrent()) {
            setError(orderError(failure));
            setRows([]);
            setNext(null);
            setLoaded(key);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      read();
    };
  }, [locationId, kind, search, cursor, key, read]);

  return {
    rows: loaded === key ? rows : [],
    next: loaded === key ? next : null,
    error: loaded === key ? error : "",
    more: () => setCursor(next || undefined),
    reset: () => setCursor(undefined),
  };
}

type FormLine = { product: PurchaseProduct; lineId: string; packs: string; loose: string };

function OrderForm({
  locationId,
  order,
  seed,
  disabled,
  busy,
  recovery,
  onClose,
  onSave,
}: {
  locationId: string;
  order?: PurchaseOrder;
  seed?: ShortbookDraftSeed;
  disabled: boolean;
  busy: boolean;
  recovery: ReactNode;
  onClose: () => void;
  onSave: (input: OrderDraftInput, id?: string) => void;
}) {
  const [reference, setReference] = useState(order?.reference || "");
  const [notes, setNotes] = useState(order?.notes || seed?.notes || "");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [supplierId, setSupplierId] = useState(order?.supplierId || "");
  const [productId, setProductId] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<PharmacyParty | null>(null);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<FormLine[]>(
    () =>
      order
        ? order.lines.map(line => ({
            lineId: line.lineId,
            product: { id: line.medicineId, name: line.medicineSnapshot.name, price: 0, unitDefinition: line.unitSnapshot },
            packs: String(line.packs),
            loose: String(line.looseUnits),
          }))
        : seed?.lines.map(line => ({
            lineId: crypto.randomUUID(),
            product: line.product,
            packs: String(Math.floor(line.quantity / line.product.unitDefinition.unitsPerPack)),
            loose: String(line.quantity % line.product.unitDefinition.unitsPerPack),
          })) || []
  );

  const suppliers = useLookup<PharmacyParty>(locationId, "parties", supplierSearch);
  const products = useLookup<PurchaseProduct>(locationId, "purchase-products", productSearch);
  const read = useLatestRead();

  useEffect(() => {
    const request = read();
    if (!order) return;
    api
      .get(`/pharmacy/parties/${order.supplierId}?${new URLSearchParams({ locationId })}`, { signal: request.signal })
      .then(({ data }) => {
        if (request.isCurrent()) setSelectedSupplier(data?.data);
      })
      .catch(failure => {
        if (request.isCurrent()) setError(orderError(failure));
      });
  }, [locationId, order, read]);

  const supplierRows = [
    ...suppliers.rows,
    ...(selectedSupplier && !suppliers.rows.some(row => row.id === selectedSupplier.id) ? [selectedSupplier] : []),
  ].filter(row => row.kinds.includes("supplier"));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled) return;
    const supplier = supplierRows.find(row => row.id === supplierId);
    if (!supplier || supplier.archived || !lines.length) {
      setError("Select an active supplier and at least one product.");
      return;
    }
    const captured = lines.map(line => ({
      lineId: line.lineId,
      medicineId: line.product.id,
      expectedUnitVersion: line.product.unitDefinition.version,
      packs: /^\d+$/.test(line.packs) ? Number(line.packs) : NaN,
      looseUnits: /^\d+$/.test(line.loose) ? Number(line.loose) : NaN,
    }));
    if (
      captured.some(
        (line, index) =>
          !Number.isSafeInteger(line.packs) ||
          !Number.isSafeInteger(line.looseUnits) ||
          line.packs < 0 ||
          line.looseUnits < 0 ||
          line.looseUnits >= lines[index].product.unitDefinition.unitsPerPack ||
          line.packs * lines[index].product.unitDefinition.unitsPerPack + line.looseUnits < 1
      )
    ) {
      setError("Enter whole packs and loose units smaller than one pack, with a positive quantity for each product.");
      return;
    }
    onSave(
      {
        locationId,
        supplierId,
        expectedSupplierRevision: supplier.revision,
        ...(order ? { expectedRevision: order.revision } : {}),
        reference: reference.trim(),
        notes: notes.trim(),
        lines: captured,
      },
      order?.id
    );
  }

  return (
    <Modal
      open
      title={order ? "Edit purchase order" : "New purchase order"}
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>
            Close order form
          </Button>
          <Button size="sm" type="submit" form="purchase-order-form" disabled={disabled} loading={busy}>
            Save order draft
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {recovery}
        {error && (
          <Alert variant="error" title="Review order details">
            {error}
          </Alert>
        )}
        <form id="purchase-order-form" onSubmit={submit} className="space-y-4">
          <fieldset disabled={disabled} className="space-y-4">
            <p className="rounded-xl border border-border/70 bg-surface-alt/50 p-3 leading-relaxed text-text-secondary">
              This is a request for goods. Invoice rates, schemes and delivered batches are recorded when the supplier provides them.
            </p>

            <div className="space-y-3 rounded-xl border border-border/70 bg-surface p-3">
              <Input
                size="sm"
                label="Order reference (optional)"
                value={reference}
                maxLength={80}
                onChange={event => setReference(event.target.value)}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  size="sm"
                  label="Search order supplier"
                  value={supplierSearch}
                  maxLength={100}
                  onChange={event => {
                    suppliers.reset();
                    setSupplierSearch(event.target.value);
                  }}
                />
                <Select
                  size="sm"
                  label="Order supplier"
                  value={supplierId}
                  options={[
                    { value: "", label: "Choose actual supplier" },
                    ...supplierRows.map(row => ({ value: row.id, label: row.name })),
                  ]}
                  onChange={event => {
                    setSupplierId(event.target.value);
                    setSelectedSupplier(supplierRows.find(row => row.id === event.target.value) || null);
                  }}
                />
              </div>
              {suppliers.error && (
                <p role="alert" className="text-danger-text">
                  {suppliers.error}
                </p>
              )}
              {suppliers.next && (
                <Button size="xs" variant="outline" onClick={suppliers.more}>
                  More order suppliers
                </Button>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input
                  size="sm"
                  label="Search products for order"
                  maxLength={100}
                  value={productSearch}
                  onChange={event => {
                    products.reset();
                    setProductSearch(event.target.value);
                  }}
                />
                <Select
                  size="sm"
                  label="Order product"
                  value={productId}
                  options={[
                    { value: "", label: "Select branch product" },
                    ...products.rows
                      .filter(row => row.unitDefinition && !lines.some(line => line.product.id === row.id))
                      .map(row => ({ value: row.id, label: row.name })),
                  ]}
                  onChange={event => setProductId(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!productId || lines.length >= 100}
                  onClick={() => {
                    const product = products.rows.find(row => row.id === productId);
                    if (product && !lines.some(line => line.product.id === product.id)) {
                      setLines(previous => [...previous, { product, lineId: crypto.randomUUID(), packs: "1", loose: "0" }]);
                      setProductId("");
                    }
                  }}
                >
                  Add order product
                </Button>
              </div>
              {(products.error || products.next) && (
                <div className="flex flex-wrap items-center gap-2">
                  {products.error && (
                    <p role="alert" className="text-danger-text">
                      {products.error}
                    </p>
                  )}
                  {products.next && (
                    <Button size="xs" variant="outline" onClick={products.more}>
                      More order products
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {lines.map((line, index) => (
                <div className="space-y-3 rounded-xl border border-border bg-surface p-3" key={line.lineId}>
                  <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-text">{line.product.name}</strong>
                      <p className="mt-0.5 text-[11px] text-text-secondary">{packDescription(line.product.unitDefinition)}</p>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="shrink-0 text-error-text"
                      icon={<Trash2 size={13} aria-hidden="true" />}
                      onClick={() => setLines(previous => previous.filter((_, n) => n !== index))}
                    >
                      Remove {line.product.name}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <PharmacyPackQuantity
                      size="sm"
                      label={`Order packs ${line.product.name}`}
                      unit={line.product.unitDefinition}
                      value={line.packs}
                      onChange={packs => setLines(previous => previous.map((row, n) => (n === index ? { ...row, packs } : row)))}
                      onError={setError}
                    />
                    <QuantityInput
                      label={`Order loose units ${line.product.name}`}
                      value={line.loose}
                      min={0}
                      max={line.product.unitDefinition.unitsPerPack - 1}
                      onValueChange={loose => setLines(previous => previous.map((row, n) => (n === index ? { ...row, loose } : row)))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Input
              size="sm"
              label="Purchase order notes"
              value={notes}
              maxLength={1000}
              onChange={event => setNotes(event.target.value)}
            />
          </fieldset>
        </form>
      </div>
    </Modal>
  );
}

function OrderDetail({
  order,
  canManage,
  disabled,
  busy,
  recovery,
  onClose,
  onRefresh,
  onDocument,
  onCollaboration,
  onEdit,
  onReorder,
  onOpenInvoice,
  onAction,
}: {
  order: PurchaseOrder;
  canManage: boolean;
  disabled: boolean;
  busy: boolean;
  recovery: ReactNode;
  onClose: () => void;
  onRefresh: () => void;
  onDocument: () => void;
  onCollaboration: () => void;
  onEdit: () => void;
  onReorder: () => void;
  onOpenInvoice: (id: string) => void;
  onAction: (input: OrderActionInput) => void;
}) {
  const [responseFile, setResponseFile] = useState("");
  const [responseFileBusy, setResponseFileBusy] = useState(false);
  const [action, setAction] = useState<OrderActionInput["action"]>(
    order.state === "draft"
      ? "submit"
      : !order.invoiceCount && ["submitted", "accepted", "partially_accepted", "rejected"].includes(order.state)
        ? "respond"
        : ["submitted", "accepted", "partially_accepted"].includes(order.state)
          ? "dispatch"
          : "link_invoice"
  );
  const [reference, setReference] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [date, setDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [variance, setVariance] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(() =>
    order.lines.map(line => {
      const prior = order.response?.lines.find(row => row.lineId === line.lineId);
      return {
        lineId: line.lineId,
        quantity: String(prior?.acceptedQuantity ?? 0),
        price: prior?.quotedUnitPricePaise === undefined ? "" : String(prior.quotedUnitPricePaise / 100),
        note: prior?.note || "",
      };
    })
  );
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoices, setInvoices] = useState<PurchaseDraft[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceCursor, setInvoiceCursor] = useState<string>();
  const [nextInvoice, setNextInvoice] = useState<string | null>(null);
  const [invoiceLoaded, setInvoiceLoaded] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof orderHistory>>>({ items: [], nextCursor: null });
  const [historyCursor, setHistoryCursor] = useState<string>();
  const [historyError, setHistoryError] = useState("");
  const readInvoices = useLatestRead();
  const readHistory = useLatestRead();
  const invoiceKey = `${invoiceSearch}:${invoiceCursor || ""}`;

  useEffect(() => {
    const request = readInvoices();
    if (action !== "link_invoice") return;
    const timer = setTimeout(() => {
      purchasePage<PurchaseDraft>(
        "purchases",
        order.locationId,
        { supplierId: order.supplierId, status: "posted", unlinked: true, search: invoiceSearch, cursor: invoiceCursor },
        request.signal
      )
        .then(page => {
          if (request.isCurrent()) {
            setInvoices(page.items);
            setNextInvoice(page.nextCursor);
            setInvoiceLoaded(invoiceKey);
          }
        })
        .catch(failure => {
          if (request.isCurrent()) setError(orderError(failure));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      readInvoices();
    };
  }, [action, order.locationId, order.supplierId, invoiceSearch, invoiceCursor, invoiceKey, readInvoices]);

  useEffect(() => {
    const request = readHistory();
    orderHistory(order.id, order.locationId, historyCursor, request.signal)
      .then(value => {
        if (request.isCurrent()) {
          setHistory(value);
          setHistoryError("");
        }
      })
      .catch(failure => {
        if (request.isCurrent()) setHistoryError(orderError(failure));
      });
  }, [order.id, order.locationId, historyCursor, readHistory]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || disabled || responseFileBusy || !canManage) return;
    if (reference.trim().length < 3) {
      setError("Record the actual communication or review reference.");
      return;
    }
    const lines = response.map(line => ({
      lineId: line.lineId,
      acceptedQuantity: /^\d+$/.test(line.quantity) ? Number(line.quantity) : NaN,
      ...(line.price.trim() ? { quotedUnitPricePaise: parseReceiptPaise(line.price)! } : {}),
      note: line.note.trim(),
    }));
    if (
      action === "respond" &&
      lines.some(
        line =>
          !Number.isSafeInteger(line.acceptedQuantity) ||
          line.acceptedQuantity < 0 ||
          line.acceptedQuantity > order.lines.find(source => source.lineId === line.lineId)!.quantity ||
          line.quotedUnitPricePaise === null
      )
    ) {
      setError("Enter actual accepted base units and valid supplier prices; leave unknown prices blank.");
      return;
    }
    if (action === "link_invoice" && (!invoiceId || invoiceLoaded !== invoiceKey || !invoices.some(invoice => invoice.id === invoiceId))) {
      setError("Select a current unlinked posted invoice from this supplier.");
      return;
    }
    onAction({
      locationId: order.locationId,
      expectedRevision: order.revision,
      action,
      reference: reference.trim(),
      confirmed: true,
      ...(action === "submit" ? { channel } : {}),
      ...(action === "respond" ? { lines } : {}),
      ...(action === "dispatch" && date ? { expectedDelivery: date } : {}),
      ...(action === "link_invoice" ? { purchaseId: invoiceId, confirmVariance: variance } : {}),
    });
  }

  const options = [
    ...(order.state === "draft" ? [{ value: "submit", label: "Record order sent" }] : []),
    ...(["submitted", "accepted", "partially_accepted", "rejected"].includes(order.state) && !order.invoiceCount
      ? [{ value: "respond", label: "Record supplier response" }]
      : []),
    ...(["submitted", "accepted", "partially_accepted", "dispatched"].includes(order.state)
      ? [{ value: "dispatch", label: "Record actual dispatch" }]
      : []),
    ...(!["draft", "cancelled", "rejected", "closed"].includes(order.state)
      ? [{ value: "link_invoice", label: "Link posted supplier invoice" }]
      : []),
    ...(!["cancelled", "closed"].includes(order.state) && !order.invoiceCount
      ? [{ value: "cancel", label: "Cancel unbilled order" }]
      : []),
    ...(!["closed", "cancelled"].includes(order.state) &&
    order.invoiceCount > 0 &&
    order.comparison.every(line => line.pendingReceipt === 0) &&
    order.comparison.some(line => line.pendingInvoice > 0)
      ? [{ value: "close_remainder", label: "Close unfilled remainder" }]
      : []),
  ];

  return (
    <Modal open title={`Purchase order ${order.reference}`} description={order.supplierSnapshot.name} onClose={onClose} busy={busy} size="xl">
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-alt/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={orderStatusVariant(order.status)} size="sm">
              {order.status.replaceAll("_", " ")}
            </Badge>
            <strong className="text-xs font-semibold text-text">{order.supplierSnapshot.name}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              icon={<ExternalLink size={13} aria-hidden="true" />}
              disabled={disabled}
              onClick={onCollaboration}
            >
              Supplier link and documents
            </Button>
            <Button
              size="xs"
              variant="outline"
              icon={<RotateCw size={13} aria-hidden="true" />}
              disabled={busy}
              onClick={onRefresh}
            >
              Refresh order
            </Button>
            <Button size="xs" variant="outline" icon={<Printer size={13} aria-hidden="true" />} onClick={onDocument}>
              Print / share order
            </Button>
            {canManage && order.state === "draft" && (
              <Button size="xs" disabled={disabled} onClick={onEdit}>
                Edit order draft
              </Button>
            )}
            {canManage && (
              <Button size="xs" icon={<RotateCcw size={13} aria-hidden="true" />} disabled={disabled} onClick={onReorder}>
                Reorder products
              </Button>
            )}
          </div>
        </div>

        {recovery}

        <p className="leading-relaxed text-text-secondary">
          Quantities below are base units. Invoiced and received quantities include billed and free goods. Supplier responses come from a
          delegated supplier link or staff-recorded communication. Verify them before posting.
        </p>

        <div className="space-y-2.5">
          {order.comparison.map(line => {
            const terms = order.response?.lines.find(row => row.lineId === line.lineId);
            return (
              <article key={line.lineId} className="space-y-1.5 rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-xs font-semibold text-text">{line.name}</strong>
                  <span className="text-[11px] font-medium tabular-nums text-text-secondary">{line.baseUnit}</span>
                </div>
                <p className="text-text-secondary">
                  Ordered {line.ordered} · Accepted {line.accepted ?? "Not confirmed"} · Invoiced {line.invoiced} · Received{" "}
                  {line.received} {line.baseUnit}
                </p>
                <p className="text-[11px] text-text-secondary">
                  Still to invoice {line.pendingInvoice} · Still to receive {line.pendingReceipt}
                  {line.shortAccepted ? ` · Supplier short ${line.shortAccepted}` : ""}
                  {line.overInvoiced ? ` · Over invoice ${line.overInvoiced}` : ""}
                </p>
                {terms?.quotedUnitPricePaise !== undefined && (
                  <p className="text-[11px] text-text-secondary">
                    Supplier quoted <strong className="tabular-nums text-text">{money(terms.quotedUnitPricePaise / 100)}</strong> per{" "}
                    {line.baseUnit} · Recorded {new Date(order.response!.recordedAt).toLocaleString()}
                  </p>
                )}
                {terms?.note && <p className="text-[11px] text-text-secondary">{terms.note}</p>}
              </article>
            );
          })}
        </div>

        {(order.notes || order.sent || order.response || order.dispatch) && (
          <div className="space-y-1 rounded-xl border border-border/60 bg-surface-alt/40 p-3 text-[11px] text-text-secondary">
            {order.notes && <p className="text-xs text-text">{order.notes}</p>}
            {order.sent && (
              <p>
                Sent via {order.sent.channel} · {order.sent.reference} · {new Date(order.sent.recordedAt).toLocaleString()}
              </p>
            )}
            {order.response && (
              <p>
                Supplier response: {order.response.reference} · {new Date(order.response.recordedAt).toLocaleString()}
              </p>
            )}
            {order.dispatch && (
              <p>
                Dispatch: {order.dispatch.reference}
                {order.dispatch.expectedDelivery ? ` · Supplier expected delivery ${order.dispatch.expectedDelivery}` : ""}
              </p>
            )}
          </div>
        )}

        {order.closure && (
          <Alert variant="info" title="Unfilled remainder closed">
            {order.closure.reference}. Unfilled quantities remain visible above; linked invoices, payments and stock are unchanged.
          </Alert>
        )}

        <section className="space-y-2.5 border-t border-border/70 pt-3">
          <h4 className="text-xs font-semibold text-text">Linked supplier invoices</h4>
          {order.invoices.map(invoice => (
            <article
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <div>
                <strong className="text-xs font-semibold text-text">{invoice.number}</strong>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  <span className="tabular-nums">{money(invoice.payablePaise / 100)}</span> · {invoice.receiptCount} confirmed deliveries
                </p>
              </div>
              <Button size="xs" variant="outline" disabled={busy} onClick={() => onOpenInvoice(invoice.id)}>
                Review / receive {invoice.number}
              </Button>
            </article>
          ))}
          {!order.invoices.length && (
            <p className="text-[11px] text-text-secondary">
              Import or enter the actual supplier invoice in Supplier invoices, post it after review, then link it here. These steps do
              not receive stock.
            </p>
          )}
        </section>

        {canManage && (
          <PharmacySupplierResponseFile
            key={`${order.id}:${order.revision}`}
            order={order}
            disabled={disabled}
            onBusyChange={setResponseFileBusy}
            onReview={(lines, name) => {
              setResponse(
                lines.map(line => ({
                  lineId: line.lineId,
                  quantity: String(line.acceptedQuantity),
                  price: line.quotedUnitPricePaise === undefined ? "" : (line.quotedUnitPricePaise / 100).toFixed(2),
                  note: line.note,
                }))
              );
              setAction("respond");
              setConfirmed(false);
              setReference("");
              setResponseFile(name);
              setError("");
            }}
          />
        )}

        {responseFile && (
          <Alert variant="info" title="Supplier file ready for review">
            {responseFile}: quantities were copied into the response form. Check the values and record the actual communication reference
            before confirming.
          </Alert>
        )}

        {error && (
          <Alert variant="error" title="Check order action">
            {error}
          </Alert>
        )}

        {canManage && options.length > 0 && (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
            <fieldset className="space-y-3" disabled={disabled || responseFileBusy}>
              <Select
                size="sm"
                label="Order action"
                value={options.some(option => option.value === action) ? action : ""}
                options={[{ value: "", label: "Select an action" }, ...options]}
                onChange={event => {
                  setAction(event.target.value as OrderActionInput["action"]);
                  setConfirmed(false);
                  setError("");
                }}
              />

              {action === "submit" && (
                <div className="space-y-2.5">
                  <p className="text-text-secondary">
                    Share the document yourself, then record the actual communication. This button does not send a message.
                  </p>
                  <Select
                    size="sm"
                    label="Order communication channel"
                    value={channel}
                    options={["whatsapp", "email", "phone", "other"].map(value => ({ value, label: value }))}
                    onChange={event => {
                      setChannel(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </div>
              )}

              {action === "respond" && (
                <div className="space-y-2.5">
                  {response.map((line, index) => (
                    <div key={line.lineId} className="space-y-2.5 rounded-xl border border-border bg-surface p-3">
                      <strong className="block text-xs font-semibold text-text">
                        {order.lines[index].medicineSnapshot.name}
                      </strong>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <QuantityInput
                          label={`Accepted base units ${order.lines[index].medicineSnapshot.name}`}
                          min={0}
                          max={order.lines[index].quantity}
                          value={line.quantity}
                          onValueChange={quantity => {
                            setResponse(previous => previous.map((row, n) => (n === index ? { ...row, quantity } : row)));
                            setConfirmed(false);
                          }}
                        />
                        <Input
                          size="sm"
                          label={`Supplier price per base unit ${index + 1} (INR, optional)`}
                          inputMode="decimal"
                          value={line.price}
                          onChange={event => {
                            setResponse(previous => previous.map((row, n) => (n === index ? { ...row, price: event.target.value } : row)));
                            setConfirmed(false);
                          }}
                        />
                      </div>
                      <Input
                        size="sm"
                        label={`Supplier availability / scheme note ${index + 1}`}
                        maxLength={300}
                        value={line.note}
                        onChange={event => {
                          setResponse(previous => previous.map((row, n) => (n === index ? { ...row, note: event.target.value } : row)));
                          setConfirmed(false);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {action === "dispatch" && (
                <DatePicker
                  size="sm"
                  label="Supplier expected delivery (optional)"
                  value={date}
                  onChange={value => {
                    setDate(value);
                    setConfirmed(false);
                  }}
                />
              )}

              {action === "close_remainder" && (
                <p className="text-text-secondary">
                  Close only the outstanding order request after checking all linked deliveries. This does not mark missing goods as
                  received or cancel supplier invoice balances.
                </p>
              )}

              {action === "link_invoice" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Input
                      size="sm"
                      label="Find posted supplier invoice"
                      value={invoiceSearch}
                      maxLength={100}
                      onChange={event => {
                        setInvoiceSearch(event.target.value);
                        setInvoiceCursor(undefined);
                        setInvoiceId("");
                        setConfirmed(false);
                      }}
                    />
                    <Select
                      size="sm"
                      label="Posted invoice for this supplier"
                      value={invoiceId}
                      options={[
                        { value: "", label: "Select actual posted invoice" },
                        ...(invoiceLoaded === invoiceKey ? invoices : []).map(invoice => ({
                          value: invoice.id,
                          label: invoice.supplierInvoiceNumber,
                        })),
                      ]}
                      onChange={event => {
                        setInvoiceId(event.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </div>
                  {nextInvoice && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setInvoiceCursor(nextInvoice);
                        setInvoiceId("");
                        setConfirmed(false);
                      }}
                    >
                      More posted invoices
                    </Button>
                  )}
                  <Checkbox
                    label="I reviewed any over-invoiced quantities and accept that variance"
                    checked={variance}
                    onChange={event => {
                      setVariance(event.target.checked);
                      setConfirmed(false);
                    }}
                  />
                  <p className="text-[11px] text-text-secondary">
                    Exact product and unit matches only. Substitutions need separate product review. Invoice linking never creates stock.
                  </p>
                </div>
              )}

              <Input
                size="sm"
                label="Actual communication / review reference"
                value={reference}
                maxLength={300}
                onChange={event => {
                  setReference(event.target.value);
                  setConfirmed(false);
                }}
              />
              <Checkbox
                label="I verified this order action against the actual supplier communication or invoice"
                checked={confirmed}
                onChange={event => setConfirmed(event.target.checked)}
              />
              <div>
                <Button size="sm" type="submit" disabled={!confirmed || !options.some(option => option.value === action)}>
                  Record order action
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        <details className="group overflow-hidden rounded-xl border border-border/70 bg-surface-alt/30">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
            <span>Order history</span>
            <ChevronDown
              size={14}
              className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-2 border-t border-border/60 p-3">
            {historyError && (
              <p role="alert" className="text-danger-text">
                {historyError}
              </p>
            )}
            {history.items.map(event => (
              <p key={event.id} className="text-[11px] text-text-secondary">
                {new Date(event.createdAt).toLocaleString()} · {event.action.replace("PHARMACY_ORDER_", "").toLowerCase().replaceAll("_", " ")} ·{" "}
                {event.details?.reference || "Saved draft"}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {history.nextCursor && (
                <Button size="xs" variant="outline" onClick={() => setHistoryCursor(history.nextCursor!)}>
                  Older order events
                </Button>
              )}
              {historyCursor && (
                <Button size="xs" variant="outline" onClick={() => setHistoryCursor(undefined)}>
                  Latest order events
                </Button>
              )}
            </div>
          </div>
        </details>
      </div>
    </Modal>
  );
}
