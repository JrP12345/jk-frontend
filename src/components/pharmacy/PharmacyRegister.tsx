"use client";

import { useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, DatePicker, Input, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import {
  exportRegister,
  readRegister,
  registerCsv,
  type RegisterFilters,
  type RegisterKind,
  type RegisterPage,
} from "@/lib/pharmacyRegister";
import { orderError } from "@/lib/pharmacyPurchaseOrders";

const evidenceLabels: Record<string, string> = {
  _id: "Register reference",
  patientName: "Recipient name",
  patientAddress: "Recipient address",
  doctorName: "Prescriber name",
  doctorAddress: "Prescriber address",
  doctorRegNumber: "Prescriber registration",
  dispensedByName: "Pharmacist name",
  pharmacistRegNumber: "Pharmacist registration",
  batchNumber: "Batch",
  captured_supply_evidence: "Original supply linkage",
  expiryDate: "Expiry cutoff",
  manufacturer: "Manufacturer",
  doctorCouncil: "Prescriber council",
  doctorReviewReference: "Prescriber review",
  pharmacistCouncil: "Pharmacist council",
  pharmacistReviewReference: "Pharmacist review",
  classificationReviewReference: "Medicine classification review",
  signatureMode: "Signature evidence",
  invoiceId: "Bill reference",
  dispenseId: "Supply reference",
  prescriptionId: "Clinic prescription reference",
  externalPrescriptionId: "Outside prescription reference",
};

const EVIDENCE_KEYS = [
  "_id",
  "expiryDate",
  "manufacturer",
  "doctorCouncil",
  "doctorReviewReference",
  "pharmacistCouncil",
  "pharmacistReviewReference",
  "classificationReviewReference",
  "signatureMode",
  "invoiceId",
  "dispenseId",
  "prescriptionId",
  "externalPrescriptionId",
] as const;

export function PharmacyRegister(props: { locationId: string; canExport: boolean; embedded?: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <RegisterSession key={`${scope}:${props.locationId}:${props.canExport}`} {...props} />;
}

function RegisterSession({ locationId, canExport, embedded = false }: { locationId: string; canExport: boolean; embedded?: boolean }) {
  const [kind, setKind] = useState<RegisterKind>("schedule_h1");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<{ result: RegisterPage; filters: RegisterFilters } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [exported, setExported] = useState("");
  const begin = useLatestRead();

  function change(action: () => void) {
    begin();
    setLoaded(null);
    setBusy(false);
    setError("");
    setReviewed(false);
    setExported("");
    action();
  }

  async function load(page = 1) {
    const request = begin();
    const filters: RegisterFilters = { locationId, scheduleType: kind, startDate: start, endDate: end, search: search.trim() };
    setLoaded(null);
    setBusy(true);
    setError("");
    setReviewed(false);
    setExported("");
    try {
      const result = await readRegister(filters, page, request.signal);
      if (request.isCurrent()) setLoaded({ result, filters });
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function download() {
    if (!loaded || !reviewed || !canExport || busy) return;
    const request = begin();
    setBusy(true);
    setError("");
    setExported("");
    try {
      const result = await exportRegister(loaded.filters, request.signal);
      if (!request.isCurrent()) return;
      const url = URL.createObjectURL(new Blob([registerCsv(result.records)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `pharmacy-${kind}-${result.generatedAt.slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
      setExported(`Exported ${result.records.length} records matching these filters. Generated ${new Date(result.generatedAt).toLocaleString()}.`);
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  const body = (
    <div className="space-y-4">
      {embedded && (
        <p className="text-xs text-text-secondary">
          Read captured dispensing records. Schedule H1 and Schedule H are separate registers. Entries cannot be edited here; missing
          evidence stays flagged for review.
        </p>
      )}

      <form
        className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/25 p-3 md:p-4"
        onSubmit={event => {
          event.preventDefault();
          void load();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            size="sm"
            label="Register type"
            value={kind}
            onChange={event => change(() => setKind(event.target.value as RegisterKind))}
            options={[
              { value: "schedule_h1", label: "Schedule H1" },
              { value: "schedule_h", label: "Schedule H prescription register" },
            ]}
          />
          <DatePicker
            size="sm"
            mode="range"
            label="Register dates"
            placeholder="All dates (or pick range)"
            startDate={start}
            endDate={end}
            onRangeChange={range =>
              change(() => {
                setStart(range.startDate);
                setEnd(range.endDate);
              })
            }
          />
          <Input
            size="sm"
            icon={<Search size={14} aria-hidden="true" />}
            label="Search medicine, recipient, prescriber or batch"
            maxLength={200}
            value={search}
            onChange={event => change(() => setSearch(event.target.value))}
          />
        </div>

        <div>
          <Button size="sm" type="submit" disabled={busy} className="w-full sm:w-auto">
            Load register
          </Button>
        </div>
      </form>

      {busy && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-border/70 p-3 text-xs text-text-secondary">
          <Spinner size="sm" />
          Reading register…
        </div>
      )}

      {error && (
        <Alert variant="error" title="Register unavailable">
          {error}
        </Alert>
      )}

      {loaded && (
        <section aria-label="Reviewed register page" className="space-y-3">
          <p className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2 text-xs text-text-secondary">
            {loaded.result.pagination.total} matching records · This page has {loaded.result.entries.length} records. Date filters use the
            selected branch’s business day. Displayed times use this device’s timezone.
          </p>

          {!loaded.result.entries.length ? (
            <p className="rounded-xl border border-border/70 bg-surface-alt/30 px-3 py-5 text-center text-xs text-text-secondary">
              No matching dispensing records.
            </p>
          ) : (
            <div className="space-y-2.5">
              {loaded.result.entries.map(entry => (
                <article key={entry._id} className="space-y-2.5 rounded-xl border border-border/70 bg-surface p-3 md:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <strong className="block break-words text-sm font-semibold text-text">{entry.medicineName}</strong>
                      <p className="text-xs text-text-secondary">
                        Batch {entry.batchNumber} · Quantity {entry.quantityDispensed} base units ·{" "}
                        {new Date(entry.dispensedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={entry.requiresReview ? "warning" : "success"} size="sm">
                      {entry.requiresReview ? "Needs review" : "Evidence complete"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-border/60 bg-surface-alt/25 p-2.5 text-xs text-text-secondary sm:grid-cols-2">
                    <span>
                      Recipient: {entry.patientName} · {entry.patientAddress || "Address not recorded"}
                    </span>
                    <span>
                      Prescriber: {entry.doctorName || "Not recorded"} · {entry.doctorRegNumber || "Registration not recorded"}
                    </span>
                    <span>Prescriber address: {entry.doctorAddress || "Not recorded"}</span>
                    <span>
                      Supplied by: {entry.dispensedByName || "Not recorded"} ·{" "}
                      {entry.pharmacistRegNumber || "Registration not recorded"}
                    </span>
                  </div>

                  {entry.requiresReview && (
                    <Alert variant="warning" title="Captured evidence needs review">
                      Missing: {entry.missingEvidence.map(key => evidenceLabels[key] || "Additional captured evidence").join(", ")}
                    </Alert>
                  )}

                  <details className="group rounded-lg border border-border/60 bg-surface-alt/20 px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-text select-none [&::-webkit-details-marker]:hidden">
                      <span>Source and professional evidence</span>
                      <ChevronDown
                        size={14}
                        className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <dl className="mt-2 grid grid-cols-1 gap-2 border-t border-border/60 pt-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                      {EVIDENCE_KEYS.map(key => (
                        <div key={key} className="min-w-0">
                          <dt className="font-medium text-text-secondary">{evidenceLabels[key]}</dt>
                          <dd className="mt-0.5 break-all font-mono text-text">{String(entry[key] ?? "Not recorded")}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={busy || loaded.result.pagination.page <= 1}
                onClick={() => {
                  void load(loaded.result.pagination.page - 1);
                }}
              >
                Previous register page
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={
                  busy || loaded.result.pagination.page >= loaded.result.pagination.totalPages || loaded.result.pagination.page >= 400
                }
                onClick={() => {
                  void load(loaded.result.pagination.page + 1);
                }}
              >
                Next register page
              </Button>
            </div>
            <span className="text-[11px] tabular-nums text-text-secondary">
              Page {loaded.result.pagination.page} of {Math.max(1, loaded.result.pagination.totalPages)}
            </span>
          </div>

          {canExport && (
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
              <Checkbox
                label="I reviewed the branch, register and filters and will keep the exported patient records secure"
                checked={reviewed}
                onChange={event => setReviewed(event.target.checked)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  icon={<Download size={13} aria-hidden="true" />}
                  disabled={!reviewed || busy}
                  onClick={() => {
                    void download();
                  }}
                >
                  Export all matching register records
                </Button>
              </div>
              <p className="text-[11px] text-text-secondary">
                Exports contain sensitive patient information and all matching records, up to 10,000 rows. A fresh export is recorded in the
                audit trail.
              </p>
            </div>
          )}
        </section>
      )}

      {exported && (
        <p role="status" className="rounded-xl border border-success/30 bg-success-subtle px-3 py-2 text-xs font-medium text-text">
          {exported}
        </p>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section className="min-w-0" aria-label="Pharmacy prescription register">
        {body}
      </section>
    );
  }

  return (
    <section className="min-w-0" aria-label="Pharmacy prescription register">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="border-b border-border/70 px-3 py-3 md:px-4">
          <h2 className="text-sm font-semibold text-text md:text-base">Prescription registers</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Read captured dispensing records. Schedule H1 and Schedule H are separate registers. Entries cannot be edited here; missing
            evidence stays flagged for review.
          </p>
        </header>
        <div className="p-3 md:p-4">{body}</div>
      </Card>
    </section>
  );
}
