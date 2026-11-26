"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { financeParties, type FinanceParty } from "@/lib/pharmacyFinance";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";

export function PharmacyFinancePartyLookup({
  locationId,
  kind,
  disabled,
  onSelect,
}: {
  locationId: string;
  kind: "customer" | "supplier";
  disabled: boolean;
  onSelect: (party: FinanceParty) => void;
}) {
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [items, setItems] = useState<FinanceParty[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const beginRead = useLatestRead();

  async function load(cursor?: string) {
    const request = beginRead();
    setBusy(true);
    setError("");
    try {
      const page = await financeParties(locationId, kind, search, includeArchived, cursor, request.signal);
      if (request.isCurrent()) {
        setItems(page.items);
        setNext(page.nextCursor);
      }
    } catch (failure) {
      if (request.isCurrent()) setError(pharmacyFinanceMessage(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  return (
    <fieldset className="min-w-0 space-y-2.5 rounded-xl border border-border/70 bg-surface-alt/25 p-3 md:p-3.5" disabled={disabled}>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={event => {
          event.preventDefault();
          void load();
        }}
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            size="sm"
            icon={<Search size={15} aria-hidden="true" />}
            label={`Find finance ${kind}`}
            placeholder={`Search ${kind} name or address`}
            value={search}
            maxLength={100}
            onChange={event => {
              setSearch(event.target.value);
              setItems([]);
              setNext(null);
            }}
          />
        </div>
        <Button size="sm" type="submit" disabled={busy} className="w-full shrink-0 sm:w-auto">
          Search {kind} statements
        </Button>
      </form>

      <Checkbox
        label="Include archived parties with retained balances"
        checked={includeArchived}
        onChange={event => setIncludeArchived(event.target.checked)}
      />

      {error && (
        <Alert variant="error" title="Party lookup unavailable">
          {error}
        </Alert>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
          {items.map(party => (
            <article
              key={party.id}
              className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="truncate text-xs font-semibold text-text">{party.name}</strong>
                  {party.archived && (
                    <Badge variant="neutral" size="sm">
                      Archived
                    </Badge>
                  )}
                </div>
                <p className="truncate text-[11px] text-text-secondary">{party.address}</p>
              </div>
              <Button
                size="xs"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => onSelect(party)}
              >
                Open {kind} statement {party.name}
              </Button>
            </article>
          ))}
        </div>
      )}

      {next && (
        <div>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void load(next);
            }}
          >
            Next {kind} statement page
          </Button>
        </div>
      )}
    </fieldset>
  );
}
