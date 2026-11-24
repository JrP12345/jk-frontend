"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import api from "@/lib/api";
import { counterCustomerHistory, type CustomerSale } from "@/lib/pharmacyCollections";
import styles from "./PharmacyWorkspace.module.css";
type Reminder = { id: string; kind: "refill" | "dues"; dueAt: string; status: string; deliveryStatus: string | null; suppressionReason?: string };
type Page = { locationId: string; partyId: string; customerName: string; email: string; archived: boolean; emailConfigured: boolean; items: Reminder[]; nextCursor: string | null };
type ReminderInput = { locationId: string; partyId: string; kind: string; invoiceId?: string; dueAt: string; expectedEmail: string; consentConfirmed: true; consentReference: string };
const problem = (failure: unknown) => (failure as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (failure as Error).message || "Reminder could not be confirmed";
export function PharmacyCustomerReminders({ locationId, partyId, onClose }: { locationId: string; partyId: string; onClose: () => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-reminder:${scope}:${locationId}:${partyId}`;
  const begin = useLatestRead(), alive = useRef(true), lock = useRef(false), frozen = useRef<{ key: string; input: ReminderInput } | null>(null);
  const [page, setPage] = useState<Page | null>(null), [cursor, setCursor] = useState<string | undefined>(), [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const [kind, setKind] = useState("refill"), [date, setDate] = useState(""), [consent, setConsent] = useState(false), [reference, setReference] = useState(""), [invoiceId, setInvoiceId] = useState(""), [invoices, setInvoices] = useState<CustomerSale[]>([]), [invoiceCursor, setInvoiceCursor] = useState<string | undefined>();
  const [nextInvoice, setNextInvoice] = useState<string | null>(null), [pending, setPending] = useState<string | null>(null), [notRecorded, setNotRecorded] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [reenter, setReenter] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; try { const key = sessionStorage.getItem(storageKey); if (key && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw Error("Saved reminder reference needs review"); setPending(key); } catch (failure) { setError(problem(failure)); } return () => { alive.current = false; }; }, [storageKey]);
  useEffect(() => {
    const request = begin(); setPage(null); setError("");
    void api.get("/pharmacy/customer-reminders", { params: { locationId, partyId, cursor }, signal: request.signal }).then(response => {
      const value = response.data?.data as Page;
      if (!value || value.locationId !== locationId || value.partyId !== partyId || !Array.isArray(value.items) || value.items.length > 25 || typeof value.email !== "string" || typeof value.emailConfigured !== "boolean" || value.nextCursor !== null && typeof value.nextCursor !== "string") throw Error("Reminder history could not be confirmed");
      if (request.isCurrent()) setPage(value);
    }).catch(failure => { if (request.isCurrent()) setError(problem(failure)); });
  }, [begin, locationId, partyId, cursor, retry]);
  useEffect(() => {
    if (kind !== "dues") return; let active = true; const controller = new AbortController(); setInvoices([]); setInvoiceId(""); setNextInvoice(null);
    void counterCustomerHistory(partyId, locationId, invoiceCursor, controller.signal).then(value => { if (active) { setInvoices(value.items.filter(row => row.balanceDue > 0)); setNextInvoice(value.nextCursor); } }).catch(failure => { if (active) setError(problem(failure)); });
    return () => { active = false; controller.abort(); };
  }, [kind, partyId, locationId, invoiceCursor]);
  async function save() {
    if (lock.current || pending && !frozen.current && !reenter) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!frozen.current) {
        if (!page?.email || !consent || reference.trim().length < 3 || !date || kind === "dues" && !invoiceId) throw Error("Choose a date, invoice where applicable, and record the customer's consent");
        const due = new Date(`${date}T09:00:00+05:30`); if (!Number.isFinite(due.getTime())) throw Error("Choose a valid follow-up date");
        const command = { key: pending || crypto.randomUUID(), input: { locationId, partyId, kind, ...(kind === "dues" ? { invoiceId } : {}), dueAt: due.toISOString(), expectedEmail: page.email, consentConfirmed: true as const, consentReference: reference.trim() } };
        sessionStorage.setItem(storageKey, command.key); frozen.current = command; setPending(command.key); setCanRetry(true); setReenter(false);
      }
      const command = frozen.current, result = (await api.post("/pharmacy/customer-reminders", command.input, { headers: { "Idempotency-Key": command.key } })).data?.data;
      if (!result || result.requestKey !== command.key || result.locationId !== locationId || result.partyId !== partyId || typeof result.id !== "string") throw Error("Reminder outcome could not be confirmed. Check the saved reference");
      if (current()) { sessionStorage.removeItem(storageKey); setPending(null); frozen.current = null; setCanRetry(false); setConsent(false); setReference(""); setDate(""); setRetry(value => value + 1); }
    } catch (failure) { if (current()) setError(problem(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!pending || lock.current) return; lock.current = true; setBusy(true); setError(""); setNotRecorded(false);
    try {
      const result = (await api.get(`/pharmacy/customer-reminder-operations/${pending}`, { params: { locationId } })).data?.data;
      if (!result || result.requestKey !== pending || result.partyId !== partyId || result.locationId !== locationId) throw Error("Reminder result does not match the saved reference");
      if (current()) { sessionStorage.removeItem(storageKey); setPending(null); frozen.current = null; setCanRetry(false); setRetry(value => value + 1); }
    } catch (failure) { if (current()) { setError(problem(failure)); const missing = (failure as { response?: { status?: number } }).response?.status === 404; setNotRecorded(missing); if (missing) { frozen.current = null; setCanRetry(false); } } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function cancel(id: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await api.post(`/pharmacy/customer-reminders/${id}/cancel`, { locationId }); if (current()) setRetry(value => value + 1); }
    catch (failure) { if (current()) setError(problem(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <Modal open title="Customer follow-up reminders" size="lg" busy={busy} onClose={onClose}><section className={styles.list} aria-label="Customer reminders">
    {error && <Alert variant="error" title="Reminder needs attention">{error}</Alert>}
    {pending && <Alert variant="warning" title="Check earlier reminder"><p>Reference: {pending}</p><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check reminder result</Button>{canRetry && <Button size="sm" disabled={busy} onClick={() => { void save(); }}>Retry same reminder</Button>}{notRecorded && !canRetry && <Button size="sm" disabled={busy} onClick={() => { setReenter(true); setNotRecorded(false); setConsent(false); setRetry(value => value + 1); }}>Review original reminder details</Button>}</Alert>}
    {page && <><h3>{page.customerName}</h3><p>Send to {page.email || "email not recorded"}. Each follow-up needs the customer's permission. Refill dates are explicitly agreed with the customer; dosage is never inferred.</p>{!page.emailConfigured && <Alert variant="info" title="Email delivery is not configured">Scheduled reminders remain pending until the email service and outbound worker are available.</Alert>}
      <fieldset className={styles.form} disabled={busy || Boolean(pending && !reenter) || page.archived || !page.email}><Select label="Follow-up purpose" value={kind} options={[{ value: "refill", label: "Requested refill follow-up" }, { value: "dues", label: "Outstanding invoice follow-up" }]} onChange={event => setKind(event.target.value)} />
        {kind === "dues" && <><Select label="Outstanding customer invoice" value={invoiceId} onChange={event => setInvoiceId(event.target.value)} options={[{ value: "", label: "Choose invoice" }, ...invoices.map(row => ({ value: row.id, label: `${row.invoiceNumber} · INR ${row.balanceDue.toFixed(2)}` }))]} />{!invoices.length && <p>No outstanding invoices on this page.</p>}{nextInvoice && <Button size="sm" variant="outline" onClick={() => setInvoiceCursor(nextInvoice)}>Next customer invoice page</Button>}{invoiceCursor && <Button size="sm" variant="outline" onClick={() => setInvoiceCursor(undefined)}>First customer invoice page</Button>}</>}
        <DatePicker label="Follow-up date (09:00 India time)" value={date} onChange={setDate} /><Input label="Customer consent reference" value={reference} maxLength={200} onChange={event => setReference(event.target.value)} /><Checkbox label="The customer agreed to this email follow-up at their recorded address" checked={consent} onChange={event => setConsent(event.target.checked)} /><Button size="sm" disabled={!consent} onClick={() => { void save(); }}>Schedule email follow-up</Button>
      </fieldset>
      {page.items.map(row => <article className={styles.card} key={row.id}><strong>{row.kind === "dues" ? "Invoice follow-up" : "Refill follow-up"}</strong><p>{new Date(row.dueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {row.status}{row.deliveryStatus ? ` · delivery ${row.deliveryStatus}` : ""}</p>{row.suppressionReason && <p>{row.suppressionReason}</p>}{["scheduled", "queued"].includes(row.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void cancel(row.id); }}>Cancel follow-up</Button>}</article>)}<p>Cancellation stops pending work. A message already handed to the email provider cannot be recalled.</p><div className={styles.actions}><Button size="sm" variant="outline" disabled={busy} onClick={() => setRetry(value => value + 1)}>Refresh reminders</Button>{cursor && <Button size="sm" disabled={busy} onClick={() => setCursor(undefined)}>First reminder page</Button>}{page.nextCursor && <Button size="sm" disabled={busy} onClick={() => setCursor(page.nextCursor!)}>Next reminder page</Button>}</div>
    </>}
  </section></Modal>;
}
