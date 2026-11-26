"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Alert, Button, Checkbox, DatePicker, Input, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import {
  readFileCustody,
  updateFileCustody,
  reconcileFileUploads,
  removeFileBytes,
  retentionTimestamp,
  type FileCustodyRecord,
  type FileRemovalInput,
} from "@/lib/pharmacyFileCustody";
import { orderError } from "@/lib/pharmacyPurchaseOrders";

export function PharmacyFileCustody({
  locationId,
  fileId,
  onChanged,
}: {
  locationId: string;
  fileId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<FileCustodyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const [indefinite, setIndefinite] = useState(true);
  const [until, setUntil] = useState("");
  const [hold, setHold] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [policy, setPolicy] = useState("");
  const [review, setReview] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [removeConfirmed, setRemoveConfirmed] = useState(false);
  const begin = useLatestRead();
  const lock = useRef(false);
  const original = useRef<{ key: string; input: FileRemovalInput } | null>(null);

  function accept(value: FileCustodyRecord) {
    setData(value);
    setReviewTime(Date.now());
    setIndefinite(value.retainUntil === null);
    setUntil(value.retainUntil?.slice(0, 16) || "");
    setHold(value.legalHold);
    setHoldReason(value.holdReason);
    setPolicy(value.policyReference);
    setReview(value.reviewReference);
    setConfirmed(false);
    setRemoveConfirmed(false);
    setSettled(false);
    if (value.removal) original.current = value.removal;
    else if (value.state === "purged" || (value.state === "retained" && original.current && value.revision !== original.current.input.expectedRevision)) {
      original.current = null;
    }
    setRecovery(Boolean(original.current));
  }

  async function load() {
    if (lock.current) return;
    const request = begin();
    setBusy(true);
    setError("");
    try {
      const value = await readFileCustody(locationId, fileId, request.signal);
      if (request.isCurrent()) accept(value);
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function save() {
    if (!data || lock.current || !confirmed) return;
    const request = begin();
    lock.current = true;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const value = await updateFileCustody(locationId, fileId, {
        expectedRevision: data.revision,
        retainUntil: indefinite ? null : retentionTimestamp(until),
        legalHold: hold,
        holdReason,
        policyReference: policy,
        reviewReference: review,
        confirmed: true,
      });
      if (request.isCurrent()) {
        accept(value);
        setSaved("Reviewed retention and legal hold saved.");
        onChanged();
      }
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      lock.current = false;
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function reconcile() {
    if (!data || lock.current || !settled) return;
    const request = begin();
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await reconcileFileUploads(locationId, fileId, data.revision, review);
      if (request.isCurrent()) {
        accept(value);
        setSaved("Provider request completion evidence recorded.");
        onChanged();
      }
    } catch (failure) {
      if (request.isCurrent()) setError(orderError(failure));
    } finally {
      lock.current = false;
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function remove() {
    if (!data || lock.current || !removeConfirmed) return;
    const request = begin();
    lock.current = true;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      if (!original.current && review.trim().length < 3) throw Error("Record the actual file removal approval/reference.");
      if (!original.current) {
        original.current = {
          key: crypto.randomUUID(),
          input: { locationId, expectedRevision: data.revision, confirmedIrreversibleRemoval: true, reviewReference: review },
        };
      }
      setRecovery(true);
      await removeFileBytes(fileId, original.current.key, original.current.input);
      const value = await readFileCustody(locationId, fileId, request.signal);
      if (request.isCurrent()) {
        accept(value);
        setSaved("File bytes removed from active storage. The original audit record is retained.");
        onChanged();
      }
    } catch (failure) {
      if (request.isCurrent()) {
        if ((failure as { response?: { status?: number } })?.response?.status === 400) {
          original.current = null;
          setRecovery(false);
        }
        setError(orderError(failure));
        try {
          const value = await readFileCustody(locationId, fileId, request.signal);
          if (request.isCurrent()) accept(value);
        } catch {
          /* Retain original in-memory command and error for same-reference recovery. */
        }
      }
    } finally {
      lock.current = false;
      if (request.isCurrent()) setBusy(false);
    }
  }

  const removable =
    data &&
    data.state === "retained" &&
    !data.legalHold &&
    data.retainUntil !== null &&
    Date.parse(data.retainUntil) <= reviewTime &&
    !data.pendingUploads &&
    Boolean(data.policyReference);

  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-border/70 bg-surface-alt/20">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-text transition-colors select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span>Retention, legal hold and file removal</span>
        <ChevronDown
          size={15}
          className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <section aria-label="Original file custody controls" className="space-y-3 border-t border-border/60 bg-surface p-3">
        <p className="text-xs text-text-secondary">
          Use your approved retention policy. Files are retained indefinitely until a reviewed date is recorded. A legal hold prevents
          removal. Removing file bytes is irreversible; audit metadata and separately retained backups are not erased by this action.
        </p>

        <div>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void load();
            }}
          >
            Load file custody
          </Button>
        </div>

        {busy && (
          <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
            <Spinner size="sm" />
            Checking original file custody…
          </div>
        )}

        {error && (
          <Alert variant="error" title="File custody needs review">
            {error}
          </Alert>
        )}

        {saved && (
          <p role="status" className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs font-medium text-text">
            {saved}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <p className="rounded-lg border border-border/60 bg-surface-alt/40 px-3 py-2 text-xs font-medium text-text">
              State: {data.state}. Revision {data.revision}. Unresolved storage requests: {data.pendingUploads}.
            </p>

            {data.state === "retained" ? (
              <fieldset disabled={busy || recovery} className="space-y-3">
                <Checkbox
                  label="Retain this file indefinitely"
                  checked={indefinite}
                  onChange={event => {
                    setIndefinite(event.target.checked);
                    setConfirmed(false);
                  }}
                />

                {!indefinite && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DatePicker
                      size="sm"
                      label="Retain until (UTC date)"
                      value={until.split("T")[0] || ""}
                      onChange={value => {
                        setUntil(`${value}T${until.split("T")[1] || ""}`);
                        setConfirmed(false);
                      }}
                    />
                    <DatePicker
                      size="sm"
                      label="Retain until (UTC time)"
                      mode="time"
                      value={until.split("T")[1] || ""}
                      onChange={value => {
                        setUntil(`${until.split("T")[0] || ""}T${value}`);
                        setConfirmed(false);
                      }}
                    />
                  </div>
                )}

                <Checkbox
                  label="Legal hold prevents file removal"
                  checked={hold}
                  onChange={event => {
                    setHold(event.target.checked);
                    setConfirmed(false);
                  }}
                />

                {hold && (
                  <Input
                    size="sm"
                    label="Actual legal hold reason"
                    value={holdReason}
                    maxLength={1000}
                    onChange={event => {
                      setHoldReason(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    size="sm"
                    label="Approved retention policy/reference"
                    value={policy}
                    maxLength={1000}
                    onChange={event => {
                      setPolicy(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                  <Input
                    size="sm"
                    label="Records review or removal approval/reference"
                    value={review}
                    maxLength={1000}
                    onChange={event => {
                      setReview(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </div>

                <Checkbox
                  label="I checked this retention policy and actual hold status"
                  checked={confirmed}
                  onChange={event => setConfirmed(event.target.checked)}
                />

                <div>
                  <Button
                    size="xs"
                    disabled={!confirmed}
                    onClick={() => {
                      void save();
                    }}
                  >
                    Save reviewed file custody
                  </Button>
                </div>

                {data.pendingUploads > 0 && (
                  <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
                    <p className="text-xs text-text-secondary">
                      An upload timeout can leave an unresolved provider request. Verify that every original provider request has finished;
                      elapsed time alone is insufficient.
                    </p>
                    <Checkbox
                      label="I verified all original storage requests have finished at the provider"
                      checked={settled}
                      onChange={event => setSettled(event.target.checked)}
                    />
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={!settled}
                      onClick={() => {
                        void reconcile();
                      }}
                    >
                      Record provider completion review
                    </Button>
                  </div>
                )}
              </fieldset>
            ) : (
              <p className="rounded-lg border border-border/60 bg-surface-alt/30 px-3 py-2 text-xs text-text-secondary">
                {data.state === "purged"
                  ? "The file bytes were removed. Original source and audit evidence remain."
                  : "Removal has been reserved. New uploads and downloads are blocked; recover the original removal command."}
              </p>
            )}

            {(removable || (data.state === "purging" && recovery)) && (
              <fieldset disabled={busy} className="space-y-3 rounded-xl border border-danger/30 bg-danger-subtle/30 p-3">
                <p className="text-xs text-text-secondary">
                  Only remove the file after checking its elapsed retention, legal holds and actual approval. A failed storage response
                  remains pending and must use the same original reference.
                </p>
                <Checkbox
                  label="I approve irreversible removal of this original file's bytes"
                  checked={removeConfirmed}
                  onChange={event => setRemoveConfirmed(event.target.checked)}
                />
                <div>
                  <Button
                    size="xs"
                    variant="danger"
                    disabled={!removeConfirmed || (review.trim().length < 3 && !recovery)}
                    onClick={() => {
                      void remove();
                    }}
                  >
                    {recovery ? "Retry original file removal" : "Remove retained file bytes"}
                  </Button>
                </div>
              </fieldset>
            )}
          </div>
        )}
      </section>
    </details>
  );
}
