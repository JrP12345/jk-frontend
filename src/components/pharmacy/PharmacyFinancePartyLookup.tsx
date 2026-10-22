"use client";
import { useState } from "react";
import { Alert, Button, Input, Checkbox } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { financeParties, type FinanceParty } from "@/lib/pharmacyFinance";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import styles from "./PharmacyWorkspace.module.css";
export function PharmacyFinancePartyLookup({ locationId, kind, disabled, onSelect }: { locationId: string; kind: "customer" | "supplier"; disabled: boolean; onSelect: (party: FinanceParty) => void }) {
  const [search, setSearch] = useState(""), [includeArchived, setIncludeArchived] = useState(false), [items, setItems] = useState<FinanceParty[]>([]), [next, setNext] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const beginRead = useLatestRead();
  async function load(cursor?: string) { const request = beginRead(); setBusy(true); setError(""); try { const page = await financeParties(locationId, kind, search, includeArchived, cursor, request.signal); if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); } } catch (failure) { if (request.isCurrent()) setError(pharmacyFinanceMessage(failure)); } finally { if (request.isCurrent()) setBusy(false); } }
  return <fieldset className={styles.form} disabled={disabled}><form className={styles.actions} onSubmit={event => { event.preventDefault(); void load(); }}><Input label={`Find finance ${kind}`} value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setItems([]); setNext(null); }} /><Button size="sm" type="submit" disabled={busy}>Search {kind} statements</Button></form><Checkbox label="Include archived parties with retained balances" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />
    {error && <Alert variant="error" title="Party lookup unavailable">{error}</Alert>}{items.map(party => <article className={styles.card} key={party.id}><div className={styles.identity}><strong>{party.name}</strong><small>{party.address}{party.archived ? " · Archived" : ""}</small></div><Button size="sm" onClick={() => onSelect(party)}>Open {kind} statement {party.name}</Button></article>)}{next && <Button size="sm" disabled={busy} onClick={() => { void load(next); }}>Next {kind} statement page</Button>}
  </fieldset>;
}
