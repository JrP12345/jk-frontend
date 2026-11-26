"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Alert, Badge, Button, Checkbox, DatePicker, Input, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import { financeOpeningParty, type FinanceParty } from "@/lib/pharmacyFinance";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyFinancePartyLookup } from "./PharmacyFinancePartyLookup";
import type { FinanceCommand } from "./PharmacyFinance";

export function PharmacyOpeningBalances({
  locationId,
  command,
  locked,
  resume,
}: {
  locationId: string;
  command: FinanceCommand;
  locked: boolean;
  resume: number;
}) {
  const [kind, setKind] = useState<"supplier" | "customer">("customer");
  const [party, setParty] = useState<FinanceParty | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [source, setSource] = useState("");
  const [review, setReview] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const beginRead = useLatestRead();

  useEffect(() => {
    if (!resume || command.pending?.kind !== "opening_balance") return;
    const request = beginRead();
    void financeOpeningParty(command.pending.sourceId, locationId, request.signal)
      .then(value => {
        if (request.isCurrent()) {
          setParty(value);
          setKind(value.kinds.includes("customer") ? "customer" : "supplier");
        }
      })
      .catch(failure => {
        if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
      });
  }, [resume, command.pending, beginRead, locationId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || !party) return;
    const amountPaise = parseReceiptPaise(amount);
    if (
      !confirmed ||
      party.archived ||
      amountPaise === null ||
      amountPaise <= 0 ||
      !date ||
      source.trim().length < 3 ||
      review.trim().length < 3
    ) {
      setError("Confirm an actual dated source, active party, positive exact due and review reference.");
      return;
    }
    void command.submit("opening_balance", party.id, {
      locationId,
      partyId: party.id,
      kind: `${kind}_due`,
      expectedPartyRevision: party.revision,
      amountPaise,
      sourceDate: date,
      sourceReference: source.trim(),
      reviewReference: review.trim(),
      confirmedSource: true,
    });
  }

  return (
    <section className="min-w-0 space-y-4" aria-label="Reviewed opening dues">
      <p className="flex items-start gap-2 rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5 text-xs text-text-secondary">
        <Info size={14} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
        <span>
          Record only a real, reviewed opening debt. Customer collections use a separate opening balance statement; this creates no current
          supply, tax or stock movement.
        </span>
      </p>

      <div className="sm:max-w-xs">
        <Select
          size="sm"
          label="Opening due party kind"
          value={kind}
          disabled={locked || Boolean(command.pending)}
          onChange={event => {
            setKind(event.target.value as typeof kind);
            setParty(null);
          }}
          options={[
            { value: "customer", label: "Customer owes this pharmacy" },
            { value: "supplier", label: "This pharmacy owes a supplier" },
          ]}
        />
      </div>

      <PharmacyFinancePartyLookup
        key={kind}
        locationId={locationId}
        kind={kind}
        disabled={locked || Boolean(command.pending)}
        onSelect={setParty}
      />

      {error && (
        <Alert variant="error" title="Check opening source">
          {error}
        </Alert>
      )}

      {party && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-surface-alt/30 p-3 md:p-4">
          <fieldset
            className="space-y-3"
            disabled={locked || Boolean(command.pending && command.pending.sourceId !== party.id)}
          >
            <div className="border-b border-border/60 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-text">{party.name}</h3>
                {party.archived && (
                  <Badge variant="neutral" size="sm">
                    Archived
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">{party.address}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                size="sm"
                label="Actual opening due (INR)"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
              />
              <DatePicker
                size="sm"
                label="Opening source date"
                value={date}
                onChange={value => setDate(value)}
              />
              <Input
                size="sm"
                label="Actual dated opening source reference"
                value={source}
                maxLength={200}
                onChange={event => setSource(event.target.value)}
              />
              <Input
                size="sm"
                label="Opening source review reference"
                value={review}
                maxLength={200}
                onChange={event => setReview(event.target.value)}
              />
            </div>

            <Checkbox
              label="I reviewed this actual dated opening debt source"
              checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)}
            />

            <div>
              <Button size="xs" type="submit" disabled={party.archived}>
                Record reviewed opening due
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
