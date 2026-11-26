"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Alert, Button, Input, Spinner } from "@/components/ui";
import type { OrderResponseLine, PurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
import {
  canImportSupplierResponse,
  parseSupplierResponse,
  supplierResponseTemplate,
  SUPPLIER_RESPONSE_MAX_BYTES,
} from "@/lib/pharmacySupplierExchange";

export function PharmacySupplierResponseFile({
  order,
  disabled,
  onReview,
  onBusyChange,
}: {
  order: PurchaseOrder;
  disabled: boolean;
  onReview: (lines: OrderResponseLine[], name: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const lock = useRef(false);
  useEffect(
    () => () => {
      epoch.current++;
    },
    []
  );

  function download() {
    const url = URL.createObjectURL(new Blob([supplierResponseTemplate(order)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `supplier-response-${order.id}-r${order.revision}.csv`;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  async function inspect(file?: File) {
    if (!file || disabled || lock.current || !canImportSupplierResponse(order)) return;
    const request = ++epoch.current;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      if (!/\.csv$/i.test(file.name) || file.size > SUPPLIER_RESPONSE_MAX_BYTES) {
        throw Error("Choose a UTF-8 .csv supplier response smaller than 256 KB.");
      }
      const source = await file.text();
      if (request !== epoch.current) return;
      const lines = parseSupplierResponse(order, source);
      onReview(lines, file.name);
    } catch (failure) {
      if (request === epoch.current) setError(failure instanceof Error ? failure.message : "Review the supplier response file.");
    } finally {
      lock.current = false;
      if (request === epoch.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  if (!canImportSupplierResponse(order)) return null;

  return (
    <details className="group overflow-hidden rounded-xl border border-border/70 bg-surface-alt/30">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span>Supplier response CSV</span>
        <ChevronDown
          size={14}
          className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-3 border-t border-border/60 p-3 text-xs">
        <p className="leading-relaxed text-text-secondary">
          Send this template to your supplier. Ask them to fill accepted base units for every product, an optional INR price per base unit
          and a note. Keep the other columns unchanged. Review the returned quantities below before recording the supplier response.
        </p>
        <div>
          <Button
            size="xs"
            variant="outline"
            icon={<Download size={13} aria-hidden="true" />}
            disabled={disabled || busy}
            onClick={download}
          >
            Download supplier response template
          </Button>
        </div>
        <Input
          size="sm"
          label="Returned supplier response CSV"
          className="min-w-0 max-w-full"
          type="file"
          accept=".csv,text/csv"
          disabled={disabled || busy}
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void inspect(file);
          }}
        />
        {busy && (
          <div role="status" className="flex items-center gap-2 text-text-secondary">
            <Spinner size="sm" />
            Reading supplier response...
          </div>
        )}
        {error && (
          <Alert variant="error" title="Supplier file needs review">
            {error}
          </Alert>
        )}
      </div>
    </details>
  );
}
