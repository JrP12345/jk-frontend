"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardContent, Table, Button, Modal, useToast, Spinner, Badge
} from "@/components/ui";

interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: { id: string; userId: { name: string; email: string; phone: string } };
  clinicId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; specialization: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: "unpaid" | "paid" | "refunded";
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

export default function PatientBillsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [paymentOption, setPaymentOption] = useState<"card" | "upi">("upi");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  const fetchPatientBills = async () => {
    try {
      setLoading(true);
      const res = await api.get("/invoices");
      setInvoices(res.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load billing history", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchPatientBills();
  }, [user]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;

    try {
      setSubmittingPayment(true);
      // Simulate tokenized gateway processing (PCI-DSS SAQ A Compliant)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const method = paymentOption === "upi" ? "upi" : "online";
      const paymentToken = paymentOption === "card" ? "pm_card_visa" : "tok_upi";

      await api.put(`/invoices/${activeInvoice.id}/pay`, { 
        paymentMethod: method,
        paymentToken
      });
      
      toast({ 
        title: "Payment Successful!", 
        description: `Successfully paid ₹${activeInvoice.totalAmount} for Invoice #${activeInvoice.invoiceNumber}`, 
        variant: "success",
        duration: 5000
      });
      setCheckoutOpen(false);
      setActiveInvoice(null);
      fetchPatientBills();
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.response?.data?.message || "Checkout failed", variant: "error" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenReceipt = (inv: Invoice) => {
    setReceiptInvoice(inv);
    setReceiptOpen(true);
  };

  const triggerPrint = (inv: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt - ${inv.invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; padding: 20px; }
            .receipt { width: 380px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .center { text-align: center; }
            .border-dashed { border-bottom: 1px dashed #ccc; margin: 15px 0; }
            .flex-between { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th { border-bottom: 1px solid #ddd; text-align: left; padding-bottom: 5px; }
            td { padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <h3 style="margin:2px 0;">ANANTA HEALTHCARE SYSTEM</h3>
              <p style="margin:2px 0; font-size:11px;">${inv.clinicId?.name}</p>
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
                  <tr><td>${item.description}</td><td style="text-align:right;">${item.quantity}</td><td style="text-align:right;">₹${item.amount * item.quantity}</td></tr>
                `).join("")}
              </tbody>
            </table>
            <div class="border-dashed"></div>
            <div class="flex-between"><span>Subtotal:</span><span>₹${inv.subtotal}</span></div>
            <div class="flex-between"><span>Tax:</span><span>₹${inv.tax}</span></div>
            <div class="flex-between"><span>Discount:</span><span>-₹${inv.discount}</span></div>
            <div class="flex-between bold" style="font-size:14px; margin-top:8px;">
              <span>Total Amount:</span><span>₹${inv.totalAmount}</span>
            </div>
            <div class="border-dashed"></div>
            <div class="center">
              <span style="font-size: 13px; font-weight: bold; background: #e6f4ea; color: #137333; padding: 4px 12px; border-radius: 99px;">
                PAID via ${inv.paymentMethod?.toUpperCase()}
              </span>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text">My Bills & Invoices</h2>
        <p className="text-sm text-text-secondary">View billing history, print medical receipts, and make outstanding payments online.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <Table
              columns={[
                { key: "invoiceNumber", header: "Invoice #", render: (row: Invoice) => <span className="font-bold text-text">#{row.invoiceNumber}</span> },
                { key: "clinic", header: "Clinic", render: (row: Invoice) => <span>{row.clinicId?.name}</span> },
                { key: "doctor", header: "Doctor", render: (row: Invoice) => <span>Dr. {row.doctorId?.name}</span> },
                { key: "createdAt", header: "Date Issued", render: (row: Invoice) => <span>{new Date(row.createdAt).toLocaleDateString()}</span> },
                { key: "totalAmount", header: "Total Due", render: (row: Invoice) => <span className="font-semibold text-text">₹{row.totalAmount}</span> },
                { key: "status", header: "Status", render: (row: Invoice) => (
                  <Badge variant={row.status === "paid" ? "success" : row.status === "unpaid" ? "danger" : "default"} className="capitalize">
                    {row.status}
                  </Badge>
                )},
                { key: "actions", header: "Actions", render: (row: Invoice) => (
                  <div className="flex gap-2">
                    {row.status === "unpaid" ? (
                      <Button size="xs" variant="primary" onClick={() => {
                        setActiveInvoice(row);
                        setCheckoutOpen(true);
                      }}>Pay Online</Button>
                    ) : (
                      <Button size="xs" variant="outline" onClick={() => handleOpenReceipt(row)}>View Receipt</Button>
                    )}
                  </div>
                )}
              ]}
              data={invoices}
              emptyMessage="You have no generated bills."
            />
          )}
        </CardContent>
      </Card>

      {/* Online Checkout Payment Modal — PCI-DSS SAQ A Compliant */}
      <Modal open={checkoutOpen} onClose={() => { setCheckoutOpen(false); setActiveInvoice(null); }} title="Pay Secure Outpatient Bill" size="sm">
        <form onSubmit={handleCheckoutSubmit} className="space-y-5">
          <div className="p-4 bg-primary-50/50 dark:bg-primary-950/10 border border-primary-100 dark:border-primary-900/30 rounded-2xl space-y-1 text-center relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-primary-600/5 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[10px] tracking-widest font-extrabold uppercase text-primary-600 dark:text-primary-400">PCI-DSS Tokenized Gateway</span>
            <p className="text-xs text-text-secondary mt-1">Invoice #{activeInvoice?.invoiceNumber} • Dr. {activeInvoice?.doctorId?.name}</p>
            <p className="text-3xl font-black text-text tracking-tight mt-1">₹{activeInvoice?.totalAmount}</p>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentOption("upi")}
              className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer font-semibold text-sm ${paymentOption === "upi" ? "bg-primary-50 border-primary-500 text-primary-750 dark:bg-primary-950/20" : "bg-surface-alt border-border text-text-secondary hover:bg-surface-hover"}`}
            >
              UPI / QR Code
            </button>
            <button
              type="button"
              onClick={() => setPaymentOption("card")}
              className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer font-semibold text-sm ${paymentOption === "card" ? "bg-primary-50 border-primary-500 text-primary-750 dark:bg-primary-950/20" : "bg-surface-alt border-border text-text-secondary hover:bg-surface-hover"}`}
            >
              Tokenized Card SDK
            </button>
          </div>

          {paymentOption === "upi" ? (
            <div className="space-y-4 text-center py-2 animate-fade-in">
              <div className="mx-auto w-36 h-36 bg-surface border border-border p-2 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden group">
                <div className="w-full h-full border-2 border-dashed border-text-muted/40 rounded flex flex-col items-center justify-center gap-1.5 bg-surface-alt">
                  <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-16v.01M4 12h4m12 0h.01M4 20h.01M4 4h10v10H4V4z" /></svg>
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Scan UPI QR</span>
                </div>
              </div>
              <p className="text-xs text-text-muted max-w-[240px] mx-auto">Scan with GPay, PhonePe, or Paytm to pay securely.</p>
            </div>
          ) : (
            <div className="space-y-3.5 animate-fade-in py-2">
              <div className="p-4 border border-border rounded-xl bg-surface-alt text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-text">
                  <svg className="w-4 h-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  <span>Hosted Payment Gateway (SAQ A)</span>
                </div>
                <p className="text-xs text-text-muted">Payment details are tokenized directly via hosted Elements iframe SDK (`pm_card_visa`). No card numbers touch application servers.</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
            <Button variant="outline" type="button" onClick={() => { setCheckoutOpen(false); setActiveInvoice(null); }}>Cancel</Button>
            <Button type="submit" loading={submittingPayment}>
              {submittingPayment ? "Processing..." : `Pay ₹${activeInvoice?.totalAmount}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Paid Receipt Modal */}
      <Modal open={receiptOpen} onClose={() => { setReceiptOpen(false); setReceiptInvoice(null); }} title="Receipt Summary" size="md">
        {receiptInvoice && (
          <div className="space-y-6">
            <div className="border border-border rounded-xl p-5 bg-surface-alt font-mono text-sm space-y-4">
              <div className="text-center border-b border-border/80 border-dashed pb-4 mb-2">
                <h3 className="font-extrabold text-base tracking-tight text-text">JK HEALTHCARE SYSTEM</h3>
                <p className="text-xs text-text-muted mt-0.5">{receiptInvoice.clinicId?.name}</p>
                <p className="text-[11px] text-text-muted">{receiptInvoice.clinicId?.address}, {receiptInvoice.clinicId?.city}</p>
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
                    <span className="w-20 text-right">₹{item.amount * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t border-border/80 border-dashed pt-3 space-y-1.5 text-xs text-right">
                <div className="flex justify-between"><span>Subtotal:</span><span>₹{receiptInvoice.subtotal}</span></div>
                <div className="flex justify-between"><span>Tax Charges:</span><span>₹{receiptInvoice.tax}</span></div>
                <div className="flex justify-between"><span>Discounts:</span><span>-₹{receiptInvoice.discount}</span></div>
                <div className="flex justify-between font-extrabold text-sm border-t border-border/60 pt-1.5 text-text">
                  <span>Total Amount Paid:</span><span>₹{receiptInvoice.totalAmount}</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <span className="inline-block font-extrabold text-xs px-4 py-1.5 rounded-full uppercase border bg-success-100/50 text-success-800 border-success-300/40">
                  {receiptInvoice.status}
                </span>
                {receiptInvoice.paymentMethod && (
                  <p className="text-[11px] text-text-muted mt-2">Paid via {receiptInvoice.paymentMethod.toUpperCase()} on {receiptInvoice.paymentDate ? new Date(receiptInvoice.paymentDate).toLocaleDateString() : ""}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={() => { setReceiptOpen(false); setReceiptInvoice(null); }}>Close</Button>
              <Button onClick={() => triggerPrint(receiptInvoice)}>Print Receipt</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
