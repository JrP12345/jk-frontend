"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, Search } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, QuantityInput, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { readShortbook, saveShortbook, shortbookError, type ShortbookEntry, type ShortbookDraftSeed } from "@/lib/pharmacyShortbook";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";

interface Props {
  locationId: string;
  canManage: boolean;
  initialProduct?: PurchaseProduct;
  onDraft: (seed: ShortbookDraftSeed) => void;
  onOrder?: (seed: ShortbookDraftSeed) => void;
}

type Form = {
  product: PurchaseProduct;
  entry: ShortbookEntry | null;
  quantity: string;
  note: string;
  status: "open" | "resolved";
};

export function PharmacyShortbook(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <ShortbookSession key={`${scope}:${props.locationId}:${props.canManage}`} {...props} />;
}

function ShortbookSession({ locationId, canManage, initialProduct, onDraft, onOrder }: Props) {
  const [rows, setRows] = useState<ShortbookEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState("open");
  const [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [productKey, setProductKey] = useState("");
  const read = useLatestRead();
  const productRead = useLatestRead();
  const selectionRead = useLatestRead();
  const alive = useRef(true);
  const lock = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const readKey = `${locationId}:${status}:${cursor || ""}:${retry}`;
  const loading = loadedKey !== readKey;

  useEffect(() => {
    const request = read();
    void readShortbook(locationId, { status, ...(cursor ? { cursor } : {}) }, request.signal)
      .then(page => {
        if (request.isCurrent()) {
          setRows(page.items);
          setNext(page.nextCursor);
          setError("");
          setSelected([]);
          setLoadedKey(readKey);
        }
      })
      .catch(failure => {
        if (request.isCurrent()) {
          setRows([]);
          setNext(null);
          setError(shortbookError(failure));
          setLoadedKey(readKey);
        }
      });
  }, [locationId, status, cursor, readKey, read]);

  useEffect(() => {
    const request = productRead();
    if (!canManage || !search.trim()) return;
    const timer = setTimeout(() => {
      void purchasePage<PurchaseProduct>("purchase-products", locationId, { search: search.trim() }, request.signal)
        .then(page => {
          if (request.isCurrent()) {
            setProducts(page.items.filter(product => product.unitDefinition));
            setProductKey(search.trim());
            setLookupError("");
          }
        })
        .catch(failure => {
          if (request.isCurrent()) setLookupError(shortbookError(failure));
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [locationId, search, canManage, productRead]);

  const choose = useCallback(
    async (product: PurchaseProduct) => {
      if (lock.current || !canManage) return;
      const request = selectionRead();
      setForm(null);
      setLookupError("");
      setNotice("");
      try {
        const page = await readShortbook(locationId, { medicineId: product.id }, request.signal);
        const entry = page.items[0] || null;
        if (entry && !entry.product?.unitDefinition) {
          throw new Error("Product is unavailable. Resolve its original shortage or choose an active product.");
        }
        const latest = entry?.product || product;
        if (request.isCurrent()) {
          setForm({
            product: latest,
            entry,
            quantity: entry ? (entry.unitVersion === latest.unitDefinition.version ? String(entry.quantity) : "") : "1",
            note: entry?.note || "",
            status: "open",
          });
        }
      } catch (failure) {
        if (request.isCurrent()) setLookupError(shortbookError(failure));
      }
    },
    [canManage, locationId, selectionRead]
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active && initialProduct) void choose(initialProduct);
    });
    return () => {
      active = false;
    };
  }, [initialProduct, choose]);

  async function save() {
    if (!form || !canManage || lock.current) return;
    const quantity = /^\d+$/.test(form.quantity) ? Number(form.quantity) : NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
      setLookupError("Enter 1 to 1,000,000 whole base units.");
      return;
    }
    selectionRead();
    lock.current = true;
    setBusy(true);
    setLookupError("");
    setNotice("");
    try {
      await saveShortbook(locationId, form.product.id, {
        quantity,
        note: form.note.trim(),
        status: form.status,
        expectedRevision: form.entry?.revision || 0,
        expectedUnitVersion: form.product.unitDefinition.version,
      });
      if (alive.current) {
        setForm(null);
        setRetry(value => value + 1);
        setNotice("Shortbook saved. Stock and supplier balances are unchanged.");
      }
    } catch (failure) {
      if (alive.current) setLookupError(shortbookError(failure));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function resolve(row: ShortbookEntry) {
    if (!canManage || lock.current) return;
    lock.current = true;
    setBusy(true);
    setLookupError("");
    try {
      await saveShortbook(locationId, row.medicineId, {
        quantity: row.quantity,
        expectedRevision: row.revision,
        expectedUnitVersion: row.unitVersion,
        note: row.note,
        status: "resolved",
      });
      if (alive.current) {
        setForm(null);
        setRetry(value => value + 1);
      }
    } catch (failure) {
      if (alive.current) setLookupError(shortbookError(failure));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const visibleRows = loading ? [] : rows;
  const ready = visibleRows.filter(
    row => selected.includes(row.id) && row.status === "open" && row.product?.unitDefinition?.version === row.unitVersion
  );

  return (
    <section className="min-w-0 text-xs" aria-label="Pharmacy shortbook">
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 px-3 py-3 md:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">Shortbook</h3>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Record products to replenish in base units. Copy quantities into a supplier invoice draft when the invoice arrives; review its
            prices, tax and receiving as usual.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-end gap-2 sm:w-auto">
          <div className="w-44 flex-1 sm:flex-none">
            <Select
              size="sm"
              label="Shortbook status"
              value={status}
              onChange={event => {
                setStatus(event.target.value);
                setCursor(undefined);
              }}
              options={[
                { value: "open", label: "Open shortages" },
                { value: "resolved", label: "Resolved shortages" },
              ]}
            />
          </div>
          <Button
            size="xs"
            variant="outline"
            icon={<RotateCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />}
            onClick={() => setRetry(value => value + 1)}
          >
            Refresh shortbook
          </Button>
        </div>
      </header>

      {canManage && (
        <div className="space-y-2.5 border-b border-border/60 bg-surface-alt/40 p-3 md:px-4">
          <Input
            size="sm"
            icon={<Search size={14} aria-hidden="true" />}
            label="Find product for shortbook"
            value={search}
            maxLength={100}
            onChange={event => setSearch(event.target.value)}
          />
          {search.trim() && productKey === search.trim() && products.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {products.map(product => (
                <Button
                  key={product.id}
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => {
                    void choose(product);
                  }}
                >
                  Choose {product.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2.5 px-3 pt-3 empty:hidden md:px-4">
        {!loading && error && (
          <Alert variant="error" title="Shortbook unavailable">
            {error}
          </Alert>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-border/70 bg-surface-alt/50 px-3 py-2 text-xs font-medium text-text">
            {notice}
          </p>
        )}
        {lookupError && (
          <Alert
            variant="error"
            title="Shortbook entry needs attention"
            action={
              form ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void choose(form.product);
                  }}
                >
                  Reload current shortbook entry
                </Button>
              ) : undefined
            }
          >
            {lookupError}
          </Alert>
        )}
      </div>

      {form && canManage && (
        <fieldset className="m-3 space-y-3 rounded-xl border border-border bg-surface-alt/40 p-3 md:mx-4" disabled={busy}>
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <h4 className="text-xs font-semibold text-text">{form.product.name}</h4>
            <Badge variant="neutral" size="sm">
              {form.product.unitDefinition.baseUnit}
            </Badge>
          </div>
          {form.entry && form.entry.unitVersion !== form.product.unitDefinition.version && (
            <p className="text-warning-text">Units changed. Re-enter the quantity in the current base unit.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <QuantityInput
              label={`Shortbook quantity (${form.product.unitDefinition.baseUnit})`}
              value={form.quantity}
              min={1}
              max={1_000_000}
              onValueChange={quantity => setForm({ ...form, quantity })}
            />
            <Input
              size="sm"
              label="Shortbook note"
              value={form.note}
              maxLength={300}
              onChange={event => setForm({ ...form, note: event.target.value })}
            />
            <Select
              size="sm"
              label="Entry status"
              value={form.status}
              onChange={event => setForm({ ...form, status: event.target.value as Form["status"] })}
              options={[
                { value: "open", label: "Open" },
                { value: "resolved", label: "Resolved after review" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="xs" variant="outline" onClick={() => setForm(null)}>
              Cancel entry
            </Button>
            <Button
              size="xs"
              loading={busy}
              onClick={() => {
                void save();
              }}
            >
              Save shortbook entry
            </Button>
          </div>
        </fieldset>
      )}

      {loading ? (
        <div role="status" className="flex items-center gap-2 px-3 py-4 text-text-secondary md:px-4">
          <Spinner size="sm" />
          Loading shortbook...
        </div>
      ) : !error && !visibleRows.length ? (
        <p className="px-3 py-10 text-center text-text-secondary md:px-4">No {status} entries on this shortbook page.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {visibleRows.map(row => {
            const usable = Boolean(row.product?.unitDefinition && row.product.unitDefinition.version === row.unitVersion);
            return (
              <article
                className="flex flex-col gap-2.5 px-3 py-3 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between md:px-4"
                key={row.id}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xs font-semibold text-text">{row.product?.name || "Unavailable product"}</strong>
                    {row.product?.rackLocation && (
                      <Badge variant="neutral" size="sm">
                        Rack {row.product.rackLocation}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Requested {row.quantity}{" "}
                    {usable ? row.product!.unitDefinition.baseUnit : "base units — product or units need review"}
                  </p>
                  {row.note && <p className="text-[11px] text-text-secondary">{row.note}</p>}
                  {canManage && row.status === "open" && usable && (
                    <div className="pt-1">
                      <Checkbox
                        label={`Include ${row.product!.name} in purchase draft`}
                        checked={selected.includes(row.id)}
                        onChange={event =>
                          setSelected(previous => (event.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id)))
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {canManage && row.product?.unitDefinition && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void choose(row.product!);
                      }}
                    >
                      Edit shortbook {row.product.name}
                    </Button>
                  )}
                  {canManage && row.status === "open" && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void resolve(row);
                      }}
                    >
                      Resolve shortage {row.product?.name || row.medicineId}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(canManage || cursor || (!loading && next)) && (
        <footer className="space-y-2.5 border-t border-border/70 bg-surface-alt/40 px-3 py-3 md:px-4">
          {canManage && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {onOrder && (
                  <Button
                    size="xs"
                    disabled={busy || loading || !ready.length}
                    onClick={() =>
                      onOrder({
                        lines: ready.map(row => ({ product: row.product!, quantity: row.quantity })),
                        notes: `Shortbook ${ready.map(row => row.id).join(", ")}`,
                      })
                    }
                  >
                    Copy selected to purchase order
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy || loading || !ready.length}
                  onClick={() =>
                    onDraft({
                      lines: ready.map(row => ({ product: row.product!, quantity: row.quantity })),
                      notes: `Shortbook ${ready.map(row => row.id).join(", ")}`,
                    })
                  }
                >
                  Copy selected to purchase draft
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Copying keeps entries open. Resolve shortages after checking stock received. Copying alone changes no order, stock or
                financial entry.
              </p>
            </>
          )}
          {(cursor || (!loading && next)) && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {cursor ? (
                <Button size="xs" variant="outline" onClick={() => setCursor(undefined)}>
                  First shortbook page
                </Button>
              ) : (
                <span />
              )}
              {!loading && next && (
                <Button size="xs" variant="outline" onClick={() => setCursor(next)}>
                  Next shortbook page
                </Button>
              )}
            </div>
          )}
        </footer>
      )}
    </section>
  );
}
