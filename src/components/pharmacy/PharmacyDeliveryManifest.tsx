"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Alert, Button, Checkbox, Input, Spinner } from "@/components/ui";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { deliveryManifestTemplate, parseDeliveryManifest } from "@/lib/pharmacyDeliveryManifest";
import type { PurchaseDeliveryLine } from "@/lib/pharmacyReceiving";
import { readPharmacyImportFile } from "@/lib/pharmacyImportFile";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";

export function PharmacyDeliveryManifest({
  purchase,
  disabled,
  onReading,
  onReview,
}: {
  purchase: PurchaseDraft;
  disabled: boolean;
  onReading: (reading: boolean) => void;
  onReview: (lines: PurchaseDeliveryLine[]) => void;
}) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const [rows, setRows] = useState<PurchaseDeliveryLine[] | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const active = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current++;
    };
  }, []);

  function template() {
    try {
      const url = URL.createObjectURL(new Blob([deliveryManifestTemplate(purchase)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `purchase-delivery-${purchase.id}-r${purchase.revision}.csv`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Delivery template is unavailable.");
    }
  }

  async function read(file?: File) {
    if (!file || disabled || reading) return;
    const request = ++active.current;
    const current = () => alive.current && active.current === request && authScopeKey(useAuthStore.getState().user) === scope;
    setReading(true);
    onReading(true);
    setRows(null);
    setConfirmed(false);
    setError("");
    try {
      const text = await readPharmacyImportFile(file);
      const result = parseDeliveryManifest(purchase, text);
      if (current()) setRows(result);
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : "Delivery file could not be reviewed.");
    } finally {
      if (current()) {
        setReading(false);
        onReading(false);
      }
    }
  }

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs" aria-label="Bulk batch and expiry review">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-text">Bulk batch and expiry entry</h3>
          <p className="leading-relaxed text-text-secondary">
            Download the saved invoice&apos;s template, fill the actual batches and printed expiry, then review it here. Rows can be split
            for multiple batches or removed for partial deliveries. Quantities are base units.
          </p>
        </div>
        <Button
          size="xs"
          variant="outline"
          icon={<Download size={13} aria-hidden="true" />}
          disabled={disabled || reading}
          onClick={template}
        >
          Download delivery template
        </Button>
      </div>

      <Input
        size="sm"
        label="Reviewed delivery CSV or values-only Excel"
        type="file"
        accept=".csv,.xlsx"
        disabled={disabled || reading}
        onChange={event => {
          void read(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {reading && (
        <div role="status" className="flex items-center gap-2 text-text-secondary">
          <Spinner size="sm" />
          Checking batches, expiry and source allowances…
        </div>
      )}
      {error && (
        <Alert variant="error" title="Delivery file needs review">
          {error}
        </Alert>
      )}
      {rows && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <p className="font-medium text-text">{rows.length} received lots checked against this saved invoice. This preview has not received stock.</p>
          <details className="group overflow-hidden rounded-lg border border-border/70">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 bg-surface-alt/40 px-3 py-2 font-medium text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
              <span>Review all imported lots</span>
              <ChevronDown
                size={14}
                className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="divide-y divide-border/60 border-t border-border/60">
              {rows.map((row, index) => (
                <p key={row.lineId} className="px-3 py-2 text-[11px] text-text-secondary">
                  {index + 1}. {purchase.lines.find(source => source.lineId === row.purchaseLineId)?.medicineSnapshot.name} ·{" "}
                  {row.billed} billed + {row.free} free · Batch {row.batch} · Printed expiry {row.expiry}
                </p>
              ))}
            </div>
          </details>
          <Checkbox
            label="I checked the physical batches, expiry and billed/free quantities against this delivery"
            checked={confirmed}
            disabled={disabled || reading}
            onChange={event => setConfirmed(event.target.checked)}
          />
          <div>
            <Button
              size="xs"
              variant="outline"
              disabled={!confirmed || disabled || reading}
              onClick={() => {
                onReview(rows);
                setRows(null);
                setConfirmed(false);
              }}
            >
              Use reviewed delivery lots
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
