"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import {
  expiryDraftCsv,
  prepareSupplierExpiryDrafts,
  readExpiryReturnPreparation,
  type ExpiryReturnPreparation,
} from "@/lib/pharmacyExpiryReturns";
import { packDescription } from "@/lib/pharmacyUnits";

export function PharmacyExpiryReturnPreparation({
  locationId,
  disabled,
  onReviewInvoice,
}: {
  locationId: string;
  disabled: boolean;
  onReviewInvoice: (purchaseId: string, quantities: Record<string, string>) => void;
}) {
  const [days, setDays] = useState("60");
  const [data, setData] = useState<ExpiryReturnPreparation | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<ReturnType<typeof prepareSupplierExpiryDrafts> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const begin = useLatestRead();

  async function load() {
    if (disabled) return;
    const request = begin();
    setData(null);
    setSelected({});
    setDrafts(null);
    setError("");
    setBusy(true);
    try {
      const result = await readExpiryReturnPreparation(locationId, Number(days), request.signal);
      if (request.isCurrent()) setData(result);
    } catch (failure) {
      if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  function download(group: NonNullable<typeof drafts>[number]) {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([expiryDraftCsv(group, data.asOf)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = `expiry-return-draft-${group.supplierId}.csv`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-border/70 bg-surface-alt/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-3.5 md:text-sm [&::-webkit-details-marker]:hidden">
        <span>Prepare expiry returns by supplier</span>
        <ChevronDown
          size={16}
          className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <section
        aria-label="Supplier-grouped expiry return preparation"
        className="space-y-3 border-t border-border/60 bg-surface p-3 md:p-4"
      >
        <p className="text-xs text-text-secondary">
          Find near-expiry stock, choose actual quantities and prepare supplier-specific packing lists. Final goods returns are reviewed
          against each original invoice; supplier credit and refunds remain separate.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <Select
              size="sm"
              label="Expiry return window"
              value={days}
              disabled={disabled || busy}
              onChange={event => {
                begin();
                setDays(event.target.value);
                setData(null);
                setSelected({});
                setDrafts(null);
              }}
              options={[30, 60, 90, 180, 365].map(value => ({
                value: String(value),
                label: `${value} days, including expired stock`,
              }))}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            disabled={disabled || busy}
            onClick={() => {
              void load();
            }}
          >
            Find expiry return sources
          </Button>
        </div>

        {busy && (
          <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
            <Spinner size="sm" />
            Checking original supplier allowances…
          </div>
        )}

        {error && (
          <Alert variant="error" title="Expiry preparation needs review">
            {error}
          </Alert>
        )}

        {data && (
          <div className="space-y-3">
            <p className="rounded-lg border border-border/60 bg-surface-alt/40 px-3 py-2 text-[11px] text-text-secondary">
              Snapshot {new Date(data.asOf).toLocaleString()}. {data.note}
            </p>

            {!data.documents.length && (
              <p className="rounded-xl border border-border/60 bg-surface-alt/30 px-3 py-4 text-center text-xs text-text-secondary">
                No purchase-linked lots with a remaining return allowance in this window.
              </p>
            )}

            {data.review.map(row => (
              <Alert key={row.batchId} variant="warning" title={`${row.product} · Batch ${row.batch}`}>
                {row.units} physical base units. {row.reason}
              </Alert>
            ))}

            <div className="space-y-3">
              {data.documents.map(doc => (
                <fieldset
                  key={doc.purchaseId}
                  disabled={disabled || busy}
                  className="min-w-0 space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/25 p-3"
                >
                  <legend className="px-1 text-xs font-semibold text-text">
                    {doc.supplierName} · Invoice {doc.supplierInvoiceNumber}
                  </legend>
                  <div className="divide-y divide-border/60">
                    {doc.lines.map(row => (
                      <div key={row.batchId} className="space-y-2 py-2.5 first:pt-0 last:pb-0">
                        <Checkbox
                          label={`${row.description} · Batch ${row.batchNumber} · Expiry ${row.expiryValue}`}
                          checked={Object.hasOwn(selected, row.batchId)}
                          onChange={event => {
                            setDrafts(null);
                            setSelected(previous => {
                              const next = { ...previous };
                              if (event.target.checked) next[row.batchId] = String(row.remainingQuantity);
                              else delete next[row.batchId];
                              return next;
                            });
                          }}
                        />
                        <p className="pl-6 text-[11px] text-text-secondary">
                          {packDescription(row.unitSnapshot)} · Available for source return: {row.remainingQuantity}{" "}
                          {row.unitSnapshot.baseUnit}
                        </p>
                        {Object.hasOwn(selected, row.batchId) && (
                          <div className="pl-6 sm:max-w-52">
                            <Input
                              size="sm"
                              label={`Return base units ${row.batchNumber}`}
                              type="number"
                              min="1"
                              max={row.remainingQuantity}
                              step="1"
                              value={selected[row.batchId]}
                              onChange={event => {
                                setDrafts(null);
                                setSelected(previous => ({ ...previous, [row.batchId]: event.target.value }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            {data.documents.length > 0 && (
              <div>
                <Button
                  size="xs"
                  disabled={disabled || busy || !Object.keys(selected).length}
                  onClick={() => {
                    try {
                      setDrafts(prepareSupplierExpiryDrafts(data, selected));
                      setError("");
                    } catch (failure) {
                      setError(pharmacyFinanceMessage(failure));
                    }
                  }}
                >
                  Prepare selected supplier drafts
                </Button>
              </div>
            )}
          </div>
        )}

        {drafts && (
          <section aria-label="Prepared supplier expiry drafts" className="space-y-3 border-t border-border/60 pt-3">
            <p className="text-xs font-medium text-text">
              {drafts.length} supplier drafts prepared locally. Goods and financial balances have not changed.
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {drafts.map(group => (
                <article
                  key={group.supplierId}
                  className="space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/30 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-text md:text-sm">{group.supplierName}</h3>
                    <Button
                      size="xs"
                      variant="outline"
                      icon={<Download size={13} aria-hidden="true" />}
                      onClick={() => download(group)}
                    >
                      Download packing list {group.supplierName}
                    </Button>
                  </div>
                  <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-surface">
                    {group.documents.map(({ source, quantities }) => (
                      <div
                        key={source.purchaseId}
                        className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-xs">
                          <p className="font-medium text-text">Original invoice {source.supplierInvoiceNumber}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Badge variant="neutral" size="sm">
                              {Object.keys(quantities).length} selected lots
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="xs"
                          className="w-full shrink-0 sm:w-auto"
                          disabled={disabled}
                          onClick={() => onReviewInvoice(source.purchaseId, quantities)}
                        >
                          Review goods return {source.supplierInvoiceNumber}
                        </Button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </details>
  );
}
