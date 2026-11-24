"use client";
import { useRef, useState } from "react";
import { Alert, Button, DatePicker } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import api from "@/lib/api";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
type Item = { paymentId: string; invoiceId: string; settlementId: string | null; amountPaise: number | null; creditPaise: number | null; debitPaise: number | null; feePaise: number | null; taxPaise: number | null; ledgerState: string; matched: boolean };
type Page = { locationId: string; date: string; currency: string; items: Item[]; nextSkip: number | null; scanned: number; basis: string };
export function PharmacyMerchantSettlements({ locationId }: { locationId: string }) {
  const [date, setDate] = useState(""), [page, setPage] = useState<Page | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const begin = useLatestRead(), lock = useRef(false);
  async function load(skip = 0) {
    if (lock.current || !date) return; lock.current = true; const request = begin(); setBusy(true); setPage(null); setError("");
    try {
      const value = (await api.get("/pharmacy/merchant-settlements", { params: { locationId, date, skip }, signal: request.signal })).data?.data as Page;
      if (!value || value.locationId !== locationId || value.date !== date || value.currency !== "INR" || !Array.isArray(value.items) || value.items.length > 100 || !Number.isSafeInteger(value.scanned) || value.scanned < 0 || value.scanned > 100 || typeof value.basis !== "string" || value.nextSkip !== null && value.nextSkip !== skip + 100 || value.items.some(row => !row.paymentId || !row.invoiceId || typeof row.matched !== "boolean" || [row.amountPaise, row.creditPaise, row.debitPaise, row.feePaise, row.taxPaise].some(amount => amount !== null && (!Number.isSafeInteger(amount) || amount < 0)))) throw Error("Settlement report could not be confirmed");
      if (request.isCurrent()) setPage(value);
    } catch (failure) { if (request.isCurrent()) setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure as Error).message); }
    finally { lock.current = false; if (request.isCurrent()) setBusy(false); }
  }
  const amount = (value: number | null) => value === null ? "Needs review" : money(value / 100);
  return <details className={styles.card}><summary>Reconcile pharmacy merchant settlements</summary><div className={styles.form}><DatePicker label="Merchant settlement date" value={date} onChange={value => { begin(); setDate(value); setPage(null); setBusy(false); setError(""); }} /><Button size="sm" disabled={busy || !date} onClick={() => { void load(); }}>Load merchant settlement page</Button></div>{error && <Alert variant="error" title="Settlement report unavailable">{error}</Alert>}{busy && <p role="status">Checking merchant settlement records...</p>}{page && <><p>{page.basis}</p><p>{page.scanned} merchant source records checked; {page.items.length} matched to this branch.</p>{page.items.map(row => <article key={row.paymentId} className={styles.card}><strong>{row.paymentId}</strong><p>Settlement {row.settlementId || "Needs review"} · {row.matched ? "Matches posted pharmacy receipt" : "Reconciliation required"}</p><p>Amount {amount(row.amountPaise)} · Credit {amount(row.creditPaise)} · Debit {amount(row.debitPaise)} · Fee {amount(row.feePaise)} · Tax {amount(row.taxPaise)}</p></article>)}{page.nextSkip !== null && <Button size="sm" disabled={busy} onClick={() => { void load(page.nextSkip!); }}>Next merchant settlement page</Button>}</>}</details>;
}
