"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { historicalFileDownload, readPrescriptionFileHistory, type PrescriptionFilePage } from "@/lib/pharmacyFileHistory";
import { orderError } from "@/lib/pharmacyPurchaseOrders";
import { PharmacyFileCustody } from "./PharmacyFileCustody";

export function PharmacyFileHistory(props: { locationId: string; canManage: boolean; embedded?: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <FileHistorySession key={`${scope}:${props.locationId}:${props.canManage}`} {...props} />;
}

function FileHistorySession({ locationId, canManage, embedded = false }: { locationId: string; canManage: boolean; embedded?: boolean }) {
  const [kind, setKind] = useState("");
  const [source, setSource] = useState("");
  const [data, setData] = useState<PrescriptionFilePage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const begin = useLatestRead();

  function invalidate() {
    begin();
    setBusy(false);
    setData(null);
    setError("");
    setChanged(false);
  }

  async function load(cursor?: string) {
    const request = begin();
    setBusy(true);
    setData(null);
    setError("");
    setChanged(false);
    try {
      const value = await readPrescriptionFileHistory(locationId, kind, source.trim(), cursor, request.signal);
      if (request.isCurrent()) setData(value);
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function download(fileId: string) {
    const request = begin();
    setBusy(true);
    setError("");
    try {
      const value = await historicalFileDownload(locationId, fileId, request.signal);
      if (!request.isCurrent()) return;
      const link = document.createElement("a");
      try {
        link.href = value.url;
        link.download = value.name;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
      }
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
          Browse retained originals, including superseded or archived prescription sources. Historical files do not authorize a new medicine
          supply.
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/25 p-3 md:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            size="sm"
            label="Prescription file source"
            value={kind}
            disabled={busy}
            options={[
              { value: "", label: "Clinic and outside prescriptions" },
              { value: "clinic", label: "Clinic prescriptions" },
              { value: "outside", label: "Outside prescriptions" },
            ]}
            onChange={event => {
              invalidate();
              setKind(event.target.value);
            }}
          />
          <Input
            size="sm"
            label="Original prescription reference (optional)"
            value={source}
            maxLength={24}
            disabled={busy}
            onChange={event => {
              invalidate();
              setSource(event.target.value);
            }}
          />
        </div>
        <div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => {
              void load();
            }}
          >
            Load prescription file history
          </Button>
        </div>
      </div>

      {busy && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-border/70 p-3 text-xs text-text-secondary">
          <Spinner size="sm" />
          Loading retained file evidence…
        </div>
      )}

      {error && (
        <Alert variant="error" title="File history needs attention">
          {error}
        </Alert>
      )}

      {changed && (
        <Alert variant="info" title="Custody changed">
          Reload file history for updated file status before downloading.
        </Alert>
      )}

      {data && (
        <div className="space-y-3">
          {!data.uploadsAvailable && (
            <Alert variant="warning" title="Private storage unavailable">
              Private storage is unavailable. File history remains visible.
            </Alert>
          )}

          {!data.items.length ? (
            <p className="rounded-xl border border-border/70 bg-surface-alt/30 px-3 py-5 text-center text-xs text-text-secondary">
              No retained file records match these filters.
            </p>
          ) : (
            <div className="space-y-3">
              {data.items.map(row => {
                const statusText =
                  row.custody.state === "purged"
                    ? "File bytes removed; audit record retained"
                    : row.custody.state === "purging"
                      ? "File removal pending; access blocked"
                      : row.state === "pending"
                        ? "Upload pending; original-file retry required"
                        : "Original file retained";
                const statusVariant =
                  row.custody.state === "purged"
                    ? "neutral"
                    : row.custody.state === "purging" || row.state === "pending"
                      ? "warning"
                      : "success";

                return (
                  <article key={row.id} className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-surface p-3 md:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5 break-words">
                        <h3 className="text-sm font-semibold text-text">{row.name}</h3>
                        <p className="text-xs text-text-secondary">
                          {row.sourceKind === "clinic" ? "Clinic" : "Outside"} prescription · {new Date(row.createdAt).toLocaleString()} ·{" "}
                          {Math.ceil(row.size / 1024)} KB
                        </p>
                        <p className="font-mono text-[11px] text-text-secondary">Original source: {row.prescriptionId}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusVariant} size="sm">
                          {statusText}
                        </Badge>
                        {row.custody.legalHold && (
                          <Badge variant="warning" size="sm">
                            Legal hold
                          </Badge>
                        )}
                      </div>
                    </div>

                    {row.state === "attached" && row.custody.state === "retained" && (
                      <div>
                        <Button
                          size="xs"
                          variant="outline"
                          icon={<Download size={13} aria-hidden="true" />}
                          disabled={busy || changed || !data.uploadsAvailable}
                          onClick={() => {
                            void download(row.id);
                          }}
                        >
                          Download historical file {row.name}
                        </Button>
                      </div>
                    )}

                    {canManage && <PharmacyFileCustody locationId={locationId} fileId={row.id} onChanged={() => setChanged(true)} />}
                  </article>
                );
              })}
            </div>
          )}

          {data.nextCursor && (
            <div>
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void load(data.nextCursor!);
                }}
              >
                Next prescription file page
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section aria-label="Retained prescription file history" className="min-w-0">
        {body}
      </section>
    );
  }

  return (
    <section aria-label="Retained prescription file history" className="min-w-0">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="border-b border-border/70 px-3 py-3 md:px-4">
          <h2 className="text-sm font-semibold text-text md:text-base">Prescription file history</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Browse retained originals, including superseded or archived prescription sources. Historical files do not authorize a new
            medicine supply.
          </p>
        </header>
        <div className="p-3 md:p-4">{body}</div>
      </Card>
    </section>
  );
}
