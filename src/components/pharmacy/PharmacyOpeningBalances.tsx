"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Input, Select, Checkbox, DatePicker } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { pharmacyFinanceMessage } from "@/hooks/usePharmacyFinanceCommand";
import { financeOpeningParty, type FinanceParty } from "@/lib/pharmacyFinance";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyFinancePartyLookup } from "./PharmacyFinancePartyLookup";
import type { FinanceCommand } from "./PharmacyFinance";
import styles from "./PharmacyWorkspace.module.css";
export function PharmacyOpeningBalances({ locationId, command, locked, resume }: { locationId: string; command: FinanceCommand; locked: boolean; resume: number }) {
  const [kind, setKind] = useState<"supplier" | "customer">("customer"), [party, setParty] = useState<FinanceParty | null>(null), [amount, setAmount] = useState(""), [date, setDate] = useState(""), [source, setSource] = useState(""), [review, setReview] = useState(""), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const beginRead = useLatestRead();
  useEffect(() => { if (!resume || command.pending?.kind !== "opening_balance") return; const request = beginRead(); void financeOpeningParty(command.pending.sourceId, locationId, request.signal).then(value => { if (request.isCurrent()) { setParty(value); setKind(value.kinds.includes("customer") ? "customer" : "supplier"); } }).catch(failure => { if (request.isCurrent()) setError(pharmacyFinanceMessage(failure)); }); }, [resume, command.pending, beginRead, locationId]);
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (locked || !party) return; const amountPaise = parseReceiptPaise(amount);
    if (!confirmed || party.archived || amountPaise === null || amountPaise <= 0 || !date || source.trim().length < 3 || review.trim().length < 3) { setError("Confirm an actual dated source, active party, positive exact due and review reference."); return; }
    void command.submit("opening_balance", party.id, { locationId, partyId: party.id, kind: `${kind}_due`, expectedPartyRevision: party.revision, amountPaise, sourceDate: date, sourceReference: source.trim(), reviewReference: review.trim(), confirmedSource: true });
  }
  return <section className={styles.list} aria-label="Reviewed opening dues"><p>Record only a real, reviewed opening debt. Customer collections use a separate opening balance statement; this creates no current supply, tax or stock movement.</p><Select label="Opening due party kind" value={kind} disabled={locked || Boolean(command.pending)} onChange={event => { setKind(event.target.value as typeof kind); setParty(null); }} options={[{ value: "customer", label: "Customer owes this pharmacy" }, { value: "supplier", label: "This pharmacy owes a supplier" }]} /><PharmacyFinancePartyLookup key={kind} locationId={locationId} kind={kind} disabled={locked || Boolean(command.pending)} onSelect={setParty} />
    {error && <Alert variant="error" title="Check opening source">{error}</Alert>}{party && <form onSubmit={submit}><fieldset className={styles.form} disabled={locked || Boolean(command.pending && command.pending.sourceId !== party.id)}><h3>{party.name}</h3><p>{party.address}</p><Input label="Actual opening due (INR)" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /><DatePicker label="Opening source date" value={date} onChange={value => setDate(value)} /><Input label="Actual dated opening source reference" value={source} maxLength={200} onChange={event => setSource(event.target.value)} /><Input label="Opening source review reference" value={review} maxLength={200} onChange={event => setReview(event.target.value)} /><Checkbox label="I reviewed this actual dated opening debt source" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><Button size="sm" type="submit" disabled={party.archived}>Record reviewed opening due</Button></fieldset></form>}
  </section>;
}
