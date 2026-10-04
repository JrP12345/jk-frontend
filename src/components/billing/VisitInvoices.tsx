"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Modal, Pagination, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";

interface Invoice { id: string; invoiceNumber: string; totalAmount: number; amountPaid?: number; balanceDue?: number; currency?: string; status: string }
export function VisitInvoices({ appointmentId, patientName, clinicId, onClose, onPaid }: { appointmentId: string; patientName: string; clinicId: string; onClose: () => void; onPaid: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [method, setMethod] = useState("cash");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError("");
    try {
      const response = await api.get("/invoices", { params: { appointmentId, clinicId, page, limit: 10 }, signal: request.signal });
      if (request.isCurrent()) { setInvoices(response.data?.data || []); setPages(Number(response.headers["x-total-pages"]) || 1); }
    } catch { if (request.isCurrent()) setError("Invoices could not be loaded. Retry before recording payment."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [appointmentId, clinicId, page, beginRead]);
  useEffect(() => { void load(); }, [load]);
  async function collect(invoice: Invoice) {
    setBusy(invoice.id); setError("");
    try {
      await api.post(`/invoices/${invoice.id}/payments`, { amount: invoice.balanceDue ?? invoice.totalAmount - (invoice.amountPaid || 0), paymentMethod: method });
      onPaid(); await load();
    } catch (failure: unknown) {
      setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Payment could not be confirmed. Refresh invoices before retrying.");
    } finally { setBusy(""); }
  }
  return <Modal open title={`Payments · ${patientName}`} size="md" busy={Boolean(busy)} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4">{error && <Alert variant="error" action={<Button disabled={Boolean(busy)} onClick={load}>Refresh</Button>}>{error}</Alert>}
      {loading ? <Spinner label="Loading visit invoices" /> : <>
        {invoices.length === 0 && <p className="text-sm text-text-muted">No invoice has been issued for this visit. Free visits need no collection. Use billing for fee review or additional charges.</p>}
        <Select label="Payment received by" value={method} onChange={e => setMethod(e.target.value)} disabled={Boolean(busy)} options={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "upi", label: "UPI (INR clinics only)" }]} />
        {invoices.map(invoice => {
          const balance = invoice.balanceDue ?? Math.max(0, invoice.totalAmount - (invoice.amountPaid || 0));
          const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.currency || "INR" }).format(balance);
          const payable = ["unpaid", "partially_paid"].includes(invoice.status) && balance > 0;
          return <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="font-medium">{invoice.invoiceNumber}</p><p className="text-sm text-text-muted">{payable ? `${amount} outstanding` : invoice.status.replaceAll("_", " ")}</p></div>{payable && <Button disabled={Boolean(busy) || (method === "upi" && invoice.currency !== "INR")} loading={busy === invoice.id} onClick={() => collect(invoice)}>Record {amount}</Button>}</div>;
        })}
        <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
        <p className="text-xs text-text-muted">Record money only after receiving it. Payments settle the existing invoice. Receipts, partial payments and fee changes are available in billing.</p>
        <Link href="/dashboard/billing" className="inline-flex min-h-11 items-center text-sm font-medium text-accent">Open billing and receipts →</Link>
      </>}
    </div>
  </Modal>;
}
