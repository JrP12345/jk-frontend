"use client";

import { useRef, useState } from "react";
import { BookOpen, ChevronDown, Download } from "lucide-react";
import { Alert, Button, Card, Input } from "@/components/ui";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { reportError, type PharmacyReportPage, type ReportFilters } from "@/lib/pharmacyReports";

const defaults = {
  receivable: "Pharmacy receivables",
  sales: "Pharmacy sales",
  cgst: "Output CGST",
  sgst: "Output SGST",
  utgst: "Output UTGST",
  igst: "Output IGST",
  rounding: "Pharmacy round off",
};

export function PharmacyAccountingExport({ page, filters }: { page: PharmacyReportPage; filters: ReportFilters }) {
  const [ledgers, setLedgers] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const scope = authScopeKey(useAuthStore(state => state.user));

  if (page.totalScope !== "complete" || !["tax", "sales_returns"].includes(page.kind)) return null;

  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(
        `/pharmacy/reports/${page.kind}/accounting-export`,
        { filters: { ...filters, expectedDigest: page.digest }, ledgers },
        { responseType: "blob" }
      );
      if (authScopeKey(useAuthStore.getState().user) !== scope) return;
      if (
        !(response.data instanceof Blob) ||
        !String(response.headers["content-type"] || "").startsWith("application/xml") ||
        response.headers["x-report-digest"] !== page.digest
      ) {
        throw Error("Accounting export does not match the reviewed report");
      }
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `pharmacy-${page.kind}-${page.endDate}-tally.xml`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (failure) {
      const message = await reportError(failure);
      if (authScopeKey(useAuthStore.getState().user) === scope) setError(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-surface-alt/40 px-3 py-2.5 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover md:px-4 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <BookOpen size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Tally accounting export</span>
          </span>
          <ChevronDown
            size={15}
            className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-3 border-t border-border/60 p-3 text-xs md:p-4">
          <p className="leading-relaxed text-text-secondary">
            Match these names to existing ledgers in the accountant&apos;s Tally company. The file contains accounting vouchers for this
            complete report. Receipts, inventory and GST filing need separate reconciliation. Review credit notes before tax adjustment,
            and check Tally&apos;s import results before importing a file again.
          </p>

          <fieldset className="space-y-3" disabled={busy}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(ledgers).map(([key, value]) => (
                <Input
                  key={key}
                  size="sm"
                  label={`Tally ${key} ledger`}
                  value={value}
                  maxLength={100}
                  onChange={event => setLedgers(previous => ({ ...previous, [key]: event.target.value }))}
                />
              ))}
            </div>

            <div>
              <Button
                size="xs"
                icon={<Download size={14} aria-hidden="true" />}
                disabled={busy || !page.rows.length}
                loading={busy}
                onClick={() => {
                  void download();
                }}
              >
                {busy ? "Preparing accounting file..." : "Download reviewed Tally XML"}
              </Button>
            </div>
          </fieldset>

          {error && (
            <Alert variant="error" title="Accounting export unavailable">
              {error}
            </Alert>
          )}
        </div>
      </details>
    </Card>
  );
}
