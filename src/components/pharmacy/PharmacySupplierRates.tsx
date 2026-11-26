"use client";

import { useState } from "react";
import { Info, Search } from "lucide-react";
import { Alert, Badge, Button, DatePicker, Input, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { dailyDate } from "@/lib/pharmacyDailyOverview";
import { readSupplierRates, unitRate, type SupplierRates } from "@/lib/pharmacySupplierRates";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { orderError } from "@/lib/pharmacyPurchaseOrders";

export function PharmacySupplierRates(props: { locationId: string; onInvoice: (id: string) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <RatesSession key={`${scope}:${props.locationId}`} {...props} />;
}

function RatesSession({ locationId, onInvoice }: { locationId: string; onInvoice: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [selected, setSelected] = useState<PurchaseProduct | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<SupplierRates | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const begin = useLatestRead();

  function change(action: () => void) {
    begin();
    setData(null);
    setBusy(false);
    setError("");
    action();
  }

  async function find() {
    const request = begin();
    setBusy(true);
    setError("");
    setProducts([]);
    setSelected(null);
    setData(null);
    setSearched(false);
    try {
      const page = await purchasePage<PurchaseProduct>("purchase-products", locationId, { search }, request.signal);
      if (request.isCurrent()) {
        setProducts(page.items);
        setSearched(true);
      }
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function compare() {
    if (!selected) return;
    if ((start && !dailyDate(start)) || (end && !dailyDate(end)) || (start && end && start > end)) {
      setError("Choose a valid purchase-date range.");
      return;
    }
    const request = begin();
    setBusy(true);
    setError("");
    setData(null);
    try {
      const result = await readSupplierRates(locationId, selected.id, start, end, request.signal);
      if (request.isCurrent()) setData(result);
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  return (
    <section className="min-w-0 text-xs" aria-label="Supplier purchase-rate comparison">
      <header className="border-b border-border/60 px-3 py-3 md:px-4">
        <h3 className="text-sm font-semibold text-text">Compare supplier rates</h3>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Compare each supplier&apos;s latest posted invoice in the selected period. Historical prices do not confirm a current offer or stock
          availability.
        </p>
      </header>

      <div className="space-y-3 border-b border-border/60 bg-surface-alt/40 p-3 md:px-4">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={event => {
            event.preventDefault();
            void find();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              size="sm"
              icon={<Search size={14} aria-hidden="true" />}
              label="Find medicine for rate comparison"
              value={search}
              maxLength={100}
              onChange={event =>
                change(() => {
                  setSearch(event.target.value);
                  setProducts([]);
                  setSelected(null);
                  setSearched(false);
                })
              }
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            Find medicine
          </Button>
        </form>

        {searched && !products.length && (
          <p className="text-text-secondary">No matching products. Try a more specific medicine name.</p>
        )}

        {!selected && products.length > 0 && (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
            {products.map(product => (
              <article
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                key={product.id}
              >
                <span className="font-medium text-text">
                  {product.name} {product.strength}
                </span>
                <Button size="xs" variant="outline" onClick={() => change(() => setSelected(product))}>
                  Compare {product.name}
                </Button>
              </article>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-xs font-semibold text-text">Selected: {selected.name}</strong>
              <Badge variant="primary" size="sm">
                Selected product
              </Badge>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <DatePicker
                  size="sm"
                  mode="range"
                  label="Purchase rate dates"
                  placeholder="Last year (or pick range)"
                  startDate={start}
                  endDate={end}
                  onRangeChange={range =>
                    change(() => {
                      setStart(range.startDate);
                      setEnd(range.endDate);
                    })
                  }
                />
              </div>
              <Button
                size="sm"
                className="w-full shrink-0 sm:w-auto"
                disabled={busy}
                onClick={() => {
                  void compare();
                }}
              >
                Load supplier comparison
              </Button>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-text-secondary">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Leave dates empty for the last year. Up to 366 calendar days can be compared.</span>
            </p>
          </div>
        )}
      </div>

      {busy && (
        <div role="status" className="flex items-center gap-2 px-3 py-4 text-text-secondary md:px-4">
          <Spinner size="sm" />
          Reading purchase history…
        </div>
      )}

      {error && (
        <div className="p-3 md:px-4">
          <Alert variant="error" title="Comparison unavailable">
            {error}
          </Alert>
        </div>
      )}

      {data && (
        <section aria-label="Reviewed supplier rates" className="space-y-3 p-3 md:p-4">
          <div className="space-y-1 rounded-xl border border-border/70 bg-surface-alt/50 px-3 py-2.5 text-[11px] text-text-secondary">
            <p className="font-medium text-text">
              {data.startDate} to {data.endDate} · Read {new Date(data.asOf).toLocaleString()} · Ranked by net cost excluding GST
            </p>
            <p>{data.note}</p>
          </div>

          {!data.items.length && (
            <p className="py-6 text-center text-text-secondary">No posted purchases for this medicine in this period.</p>
          )}

          <div className="space-y-2.5">
            {data.items.map(item => (
              <article
                key={item.supplierId}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <strong className="block text-xs font-semibold text-text">{item.supplierName}</strong>
                  <small className="block text-[11px] text-text-secondary">
                    Invoice {item.invoiceNumber} · {item.invoiceDate}
                  </small>
                  {item.state === "comparable" ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs">
                      <span className="font-semibold tabular-nums text-text">
                        Net {unitRate(item.netPaise, item.billedUnits + item.freeUnits)} / {item.baseUnit}
                      </span>
                      <span className="tabular-nums text-text-secondary">
                        Including GST {unitRate(item.grossPaise, item.billedUnits + item.freeUnits)} / {item.baseUnit}
                      </span>
                    </div>
                  ) : (
                    <strong className="block text-warning-text">Unit review required — excluded from ranking</strong>
                  )}
                  <small className="block text-[11px] text-text-secondary">
                    {item.billedUnits} billed + {item.freeUnits} free · {item.receivedUnits} received base units
                  </small>
                  <small className="block text-[11px] text-text-secondary">
                    Recorded inventory cost {item.costTreatment === "include_tax" ? "includes" : "excludes"} GST
                  </small>
                  <small className="block text-[11px] text-text-secondary">{item.note}</small>
                </div>
                <div className="shrink-0">
                  <Button size="xs" variant="outline" onClick={() => onInvoice(item.purchaseId)}>
                    Open source invoice {item.invoiceNumber}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
