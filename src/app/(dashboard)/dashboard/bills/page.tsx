"use client";

import PrintDialogActions from "@/components/ui/PrintDialogActions";

import PrintButton from "@/components/ui/PrintButton";

import { getPrintBrandStyles, printHtml } from "@/lib/printBrand";
import { formatCurrency } from "@/lib/currency";

import { useState, useEffect, useRef } from "react";
import { loadRazorpayScript } from "@/lib/razorpay";
import { userFacingError } from "@/lib/userFacingError";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Alert, Table, Button, Modal, useToast, Badge } from "@/components/ui";
import { RotateCw, CreditCard } from "lucide-react";

interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  appointmentId?: string | { id?: string; _id?: string };
  currency?: string;
  patientId: { id: string; userId: { name: string; email: string; phone: string } };
  locationId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; specialization: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded" | "cancelled";
  amountPaid?: number;
  balanceDue?: number;
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

type PaymentProof = { appointmentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string };
type CheckoutResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
function appointmentId(invoice: Invoice) { return typeof invoice.appointmentId === "string" ? invoice.appointmentId : invoice.appointmentId?.id || invoice.appointmentId?._id; }
function canPayOnline(invoice: Invoice) {
  return !!appointmentId(invoice) && invoice.status === "unpaid" && (!invoice.currency || invoice.currency === "INR") && !(invoice.amountPaid && invoice.amountPaid > 0) && invoice.totalAmount > 0 && (invoice.balanceDue === undefined || invoice.balanceDue === invoice.totalAmount);
}

export default function PatientBillsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const paymentBusy = useRef(false);
  const mounted = useRef(true);
  const verifying = useRef(false);
  const [pendingProof, setPendingProof] = useState<PaymentProof | null>(null);
  const [paymentIssue, setPaymentIssue] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  const fetchPatientBills = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/invoices");
      setInvoices(res.data.data || []);
    } catch (err) {
      setLoadError("Your invoices could not be loaded. Please try again.");
      toast({ title: "Unable to load invoices", description: "We could not fetch your billing statements. Please refresh the page.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (user) fetchPatientBills();
    return () => { mounted.current = false; };
  }, [user]);

  const releasePayment = () => { paymentBusy.current = false; setSubmittingPayment(false); };
  const verifyPayment = async (proof: PaymentProof) => {
    if (verifying.current) return;
    verifying.current = true; paymentBusy.current = true; setSubmittingPayment(true);
    setPendingProof(proof);
    try {
      const result = await api.post("/appointment-payments/verify", proof);
      if (result.data?.success !== true) throw new Error("Payment confirmation is unavailable.");
      setPendingProof(null); setCheckoutOpen(false); setActiveInvoice(null);
      toast({ title: "Payment confirmed", description: "Your payment was verified. Refreshing your invoices.", variant: "success" });
      await fetchPatientBills();
    } catch {
      toast({ title: "Payment confirmation pending", description: "Check confirmation again. Do not make another payment for this invoice.", variant: "warning" });
    } finally { verifying.current = false; releasePayment(); }
  };
  const handleCheckoutSubmit = async () => {
    if (!activeInvoice || !canPayOnline(activeInvoice) || paymentBusy.current || pendingProof || paymentIssue) return;
    const invoice = activeInvoice;
    const visitId = appointmentId(invoice)!;
    paymentBusy.current = true; setSubmittingPayment(true);
    try {
      const result = await api.post("/appointment-payments/create-order", { appointmentId: visitId });
      if (!mounted.current) return;
      const order = result.data?.data as { keyId: string; razorpayOrderId: string; amount: number; currency: string; appointmentId: string };
      if (!order?.keyId || !order.razorpayOrderId || order.appointmentId !== visitId || order.currency !== "INR" || !Number.isFinite(order.amount) || Math.round(order.amount * 100) !== Math.round(invoice.totalAmount * 100)) {
        throw new Error("Invoice details have changed. Refresh your invoices before paying.");
      }
      if (!await loadRazorpayScript()) throw new Error("Checkout could not be loaded. Please try again.");
      if (!mounted.current) return;
      let handled = false;
      const checkout = new (window as any).Razorpay({
        key: order.keyId, order_id: order.razorpayOrderId, amount: Math.round(order.amount * 100), currency: order.currency,
        name: invoice.locationId?.name || "Ekavyu", description: `Invoice ${invoice.invoiceNumber}`,
        prefill: { name: user?.name || "", email: user?.email || "" },
        handler: (response: CheckoutResult) => {
          if (handled) return;
          handled = true;
          if (response.razorpay_order_id !== order.razorpayOrderId || !response.razorpay_payment_id || !response.razorpay_signature) {
            setPaymentIssue(order.razorpayOrderId);
            releasePayment(); toast({ title: "Payment response could not be verified", description: "Contact reception with your payment reference before retrying.", variant: "error" }); return;
          }
          void verifyPayment({ appointmentId: visitId, razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature });
        },
        modal: { ondismiss: () => { if (!verifying.current) releasePayment(); } },
      });
      checkout.on("payment.failed", () => { if (!verifying.current) { releasePayment(); toast({ title: "Payment not completed", description: "Review the payment status before retrying.", variant: "warning" }); } });
      checkout.open();
    } catch (error: unknown) {
      releasePayment();
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || (error as Error).message;
      toast({ title: "Checkout unavailable", description: userFacingError(message, "Refresh your invoices or contact reception."), variant: "error" });
    }
  };

  const handleOpenReceipt = (inv: Invoice) => {
    setReceiptInvoice(inv);
    setReceiptOpen(true);
  };

  const triggerPrint = async (inv: Invoice) => {
    await printHtml(`
      <html>
        <head>
          <title>Payment Receipt - ${inv.invoiceNumber}</title>
          <style>${getPrintBrandStyles()}
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; padding: 20px; }
            .receipt { width: 380px; padding: 20px; border: 1px solid var(--print-border); border-radius: 8px; }
            .center { text-align: center; }
            .border-dashed { border-bottom: 1px dashed var(--print-border); margin: 15px 0; }
            .flex-between { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th { border-bottom: 1px solid var(--print-border); text-align: left; padding-bottom: 5px; }
            td { padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <h3 style="margin:2px 0;">Ekavyu HEALTHCARE SYSTEM</h3>
              <p style="margin:2px 0; font-size:11px;">${inv.locationId?.name}</p>
            </div>
            <div class="border-dashed"></div>
            <div class="flex-between"><span class="bold">Invoice No:</span><span>${inv.invoiceNumber}</span></div>
            <div class="flex-between"><span class="bold">Date Paid:</span><span>${inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : ""}</span></div>
            <div class="flex-between"><span class="bold">Patient:</span><span>${inv.patientId?.userId?.name}</span></div>
            <div class="flex-between"><span class="bold">Doctor:</span><span>Dr. ${inv.doctorId?.name}</span></div>
            <div class="border-dashed"></div>
            <table>
              <thead>
                <tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Amt</th></tr>
              </thead>
              <tbody>
                ${inv.items.map(item => `
                  <tr><td>${item.description}</td><td style="text-align:right;">${item.quantity}</td><td style="text-align:right;">${formatCurrency(item.amount * item.quantity, inv.currency)}</td></tr>
                `).join("")}
              </tbody>
            </table>
            <div class="border-dashed"></div>
            <div class="flex-between"><span>Subtotal:</span><span>${formatCurrency(inv.subtotal, inv.currency)}</span></div>
            <div class="flex-between"><span>Tax:</span><span>${formatCurrency(inv.tax, inv.currency)}</span></div>
            <div class="flex-between"><span>Discount:</span><span>-${formatCurrency(inv.discount, inv.currency)}</span></div>
            <div class="flex-between bold" style="font-size:14px; margin-top:8px;">
              <span>Total Amount:</span><span>${formatCurrency(inv.totalAmount, inv.currency)}</span>
            </div>
            <div class="border-dashed"></div>
            <div class="center">
              <span style="font-size: 13px; font-weight: bold; background: var(--print-success-subtle); color: var(--print-success); padding: 4px 12px; border-radius: 99px;">
                PAID via ${inv.paymentMethod?.toUpperCase()}
              </span>
            </div>
          </div>
        </body>
      </html>
    `);
  };

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                My Bills & Invoices
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Patient Billing
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              View invoices and receipts. Eligible appointment invoices can be paid online; other payments are handled at reception.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPatientBills}
              disabled={loading}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
             loading={loading}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {pendingProof && <Alert variant="warning" title="Payment confirmation pending" action={<Button variant="outline" loading={submittingPayment} disabled={submittingPayment} onClick={() => void verifyPayment(pendingProof)}>Check confirmation</Button>}>Do not pay again while confirmation is pending. Payment reference: <span className="break-all">{pendingProof.razorpayPaymentId}</span>. If you leave this page, share this reference with reception.</Alert>}
      {paymentIssue && <Alert variant="warning" title="Payment needs review">Contact reception before paying again. Order reference: <span className="break-all">{paymentIssue}</span>.</Alert>}
      <div>
        <Table
          error={loadError}
          onRetry={fetchPatientBills}
          loading={loading}
          mobileCardView
          columns={[
            { key: "invoiceNumber", header: "Invoice #", render: (row: Invoice) => <span className="font-bold text-text">#{row.invoiceNumber}</span> },
            { key: "location", header: "Location", render: (row: Invoice) => <span>{row.locationId?.name}</span> },
            { key: "doctor", header: "Doctor", render: (row: Invoice) => <span>Dr. {row.doctorId?.name}</span> },
            { key: "createdAt", header: "Date Issued", render: (row: Invoice) => <span>{new Date(row.createdAt).toLocaleDateString()}</span> },
            { key: "totalAmount", header: "Total Due", render: (row: Invoice) => {
              const balance = row.balanceDue !== undefined ? row.balanceDue : (row.status === "paid" ? 0 : row.totalAmount);
              return (
                <div className="space-y-0.5">
                  <span className="font-semibold text-text">{formatCurrency(row.totalAmount, row.currency)}</span>
                  {row.status === "partially_paid" && (
                    <span className="block text-[10px] text-warning-text dark:text-warning-text font-bold">
                      Bal: {formatCurrency(balance, row.currency)}
                    </span>
                  )}
                </div>
              );
            }},
            { key: "status", header: "Status", render: (row: Invoice) => (
              <Badge
                variant={
                  row.status === "paid" ? "success" :
                  row.status === "partially_paid" ? "warning" :
                  row.status === "unpaid" ? "danger" : "default"
                }
                className="capitalize font-semibold"
              >
                {row.status.replace("_", " ")}
              </Badge>
            )},
            { key: "actions", header: "Actions", render: (row: Invoice) => (
              <div className="flex gap-2">
                {canPayOnline(row) ? (
                  <Button size="xs" variant="primary" disabled={submittingPayment || !!pendingProof || !!paymentIssue} className="min-h-[36px] px-3.5 font-bold cursor-pointer" onClick={() => {
                    setActiveInvoice(row);
                    setCheckoutOpen(true);
                  }}>
                    Pay Online
                  </Button>
                ) : row.status === "paid" ? (
                  <PrintButton size="xs" variant="outline" className="min-h-[36px] px-3.5 font-bold cursor-pointer" onPrint={() => handleOpenReceipt(row)} documentName="receipt" preview>
              </PrintButton>
                ) : <span className="text-xs text-text-muted">{row.status === "unpaid" || row.status === "partially_paid" ? "Pay at reception" : "No payment due"}</span>}
              </div>
            )}
          ]}
          renderMobileCard={(row: Invoice) => {
            const balance = row.balanceDue !== undefined ? row.balanceDue : (row.status === "paid" ? 0 : row.totalAmount);
            return (
              <div
                key={row.id}
                className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-sm text-text">#{row.invoiceNumber}</span>
                    <p className="text-xs text-text-muted mt-0.5">{new Date(row.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge
                    variant={
                      row.status === "paid" ? "success" :
                      row.status === "partially_paid" ? "warning" :
                      row.status === "unpaid" ? "danger" : "default"
                    }
                    size="sm"
                    className="capitalize font-semibold text-[10px]"
                  >
                    {row.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Facility</span>
                    <span className="font-semibold text-text truncate mt-0.5 block">{row.locationId?.name || "Location"}</span>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Practitioner</span>
                    <span className="font-semibold text-text truncate mt-0.5 block">Dr. {row.doctorId?.name?.replace(/^dr\.?\s+/i, "") || "Doctor"}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border/40 flex items-center justify-between">
                    <div>
                      <span className="text-text-muted text-[10px] uppercase font-bold block">Total Amount</span>
                      <span className="font-bold text-sm text-text mt-0.5 block">{formatCurrency(row.totalAmount, row.currency)}</span>
                    </div>
                    {row.status === "partially_paid" && (
                      <div className="text-right">
                        <span className="text-warning-text dark:text-warning-text text-[10px] uppercase font-bold block">Balance Due</span>
                        <span className="font-bold text-sm text-warning-text dark:text-warning-text mt-0.5 block">{formatCurrency(balance, row.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  {canPayOnline(row) ? (
                    <Button
                      disabled={submittingPayment || !!pendingProof || !!paymentIssue}
                      size="sm"
                      variant="primary"
                      className="w-full min-h-[44px] font-bold text-xs rounded-xl shadow-xs justify-center cursor-pointer"
                      onClick={() => {
                        setActiveInvoice(row);
                        setCheckoutOpen(true);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      {`Pay Online (${formatCurrency(row.totalAmount, row.currency)})`}
                    </Button>
                  ) : row.status === "paid" ? (
                    <PrintButton
                      size="sm"
                      variant="outline"
                      className="w-full min-h-[44px] font-bold text-xs rounded-xl justify-center cursor-pointer"
                      onPrint={() => handleOpenReceipt(row)} documentName="receipt" preview
                    >
              </PrintButton>
                  ) : <p className="text-xs text-text-muted text-center">{row.status === "unpaid" || row.status === "partially_paid" ? "Pay at reception" : "No payment due"}</p>}
                </div>
              </div>
            );
          }}
          data={invoices}
          emptyMessage="You have no generated bills."
        />
      </div>

      <Modal open={checkoutOpen} onClose={() => { if (!submittingPayment) { setCheckoutOpen(false); setActiveInvoice(null); } }} title="Pay appointment invoice" size="sm" busy={submittingPayment}
        footer={<div className="flex flex-wrap gap-3 justify-end w-full"><Button variant="outline" disabled={submittingPayment} onClick={() => { setCheckoutOpen(false); setActiveInvoice(null); }}>Close</Button><Button loading={submittingPayment} disabled={!!pendingProof || !!paymentIssue} onClick={handleCheckoutSubmit}>Continue to payment</Button></div>}>
        <div className="space-y-4">
          <div><p className="text-sm text-text-muted">Invoice #{activeInvoice?.invoiceNumber}</p><p className="text-2xl font-semibold mt-1">{formatCurrency(activeInvoice?.totalAmount, activeInvoice?.currency)}</p></div>
          <p className="text-sm text-text-secondary">Choose your payment method in Razorpay checkout. Your invoice is marked paid after the server verifies the payment.</p>
          {pendingProof && <p className="text-sm text-warning-text">Payment confirmation is pending. Use Check confirmation on the invoices page before making another payment.</p>}
        </div>
      </Modal>

      {/* View Paid Receipt Modal */}
      <Modal open={receiptOpen} onClose={() => { setReceiptOpen(false); setReceiptInvoice(null); }} title="Receipt Summary" size="md"
        footer={<PrintDialogActions documentName="receipt" onPrint={() => triggerPrint(receiptInvoice!)} onClose={() => { setReceiptOpen(false); setReceiptInvoice(null); }} disabled={!receiptInvoice} />}>
        {receiptInvoice && (
          <div className="space-y-6">
            <div className="border border-border rounded-xl p-5 bg-surface-alt font-mono text-sm space-y-4">
              <div className="text-center border-b border-border/80 border-dashed pb-4 mb-2">
                <h3 className="font-extrabold text-base tracking-tight text-text">Ekavyu</h3>
                <p className="text-xs text-text-muted mt-0.5">{receiptInvoice.locationId?.name}</p>
                <p className="text-[11px] text-text-muted">{receiptInvoice.locationId?.address}, {receiptInvoice.locationId?.city}</p>
              </div>

              <div className="space-y-1 border-b border-border/80 border-dashed pb-3">
                <div className="flex justify-between"><span className="text-text-muted">Invoice No:</span><span className="font-bold text-text">#{receiptInvoice.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Invoice Date:</span><span>{new Date(receiptInvoice.createdAt).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Patient:</span><span className="font-semibold text-text">{receiptInvoice.patientId?.userId?.name}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Doctor:</span><span>Dr. {receiptInvoice.doctorId?.name}</span></div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex justify-between font-bold border-b border-border pb-1">
                  <span>Item Description</span>
                  <span className="w-12 text-right">Qty</span>
                  <span className="w-20 text-right">Amount</span>
                </div>
                {receiptInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-0.5">
                    <span className="truncate max-w-[200px]">{item.description}</span>
                    <span className="w-12 text-right">{item.quantity}</span>
                    <span className="w-20 text-right">{formatCurrency(item.amount * item.quantity, receiptInvoice.currency)}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t border-border/80 border-dashed pt-3 space-y-1.5 text-xs text-right">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(receiptInvoice.subtotal, receiptInvoice.currency)}</span></div>
                <div className="flex justify-between"><span>Tax Charges:</span><span>{formatCurrency(receiptInvoice.tax, receiptInvoice.currency)}</span></div>
                <div className="flex justify-between"><span>Discounts:</span><span>-{formatCurrency(receiptInvoice.discount, receiptInvoice.currency)}</span></div>
                <div className="flex justify-between font-extrabold text-sm border-t border-border/60 pt-1.5 text-text">
                  <span>Total Amount Paid:</span><span>{formatCurrency(receiptInvoice.totalAmount, receiptInvoice.currency)}</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <span className="inline-block font-extrabold text-xs px-4 py-1.5 rounded-full uppercase border bg-success-subtle/50 text-success-text border-success/40">
                  {receiptInvoice.status}
                </span>
                {receiptInvoice.paymentMethod && (
                  <p className="text-[11px] text-text-muted mt-2">Paid via {receiptInvoice.paymentMethod.toUpperCase()} on {receiptInvoice.paymentDate ? new Date(receiptInvoice.paymentDate).toLocaleDateString() : ""}</p>
                )}
              </div>
            </div>


          </div>
        )}
      </Modal>
    </div>
  );
}
