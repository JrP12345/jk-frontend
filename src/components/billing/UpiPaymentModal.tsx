"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import api from "@/lib/api";
import Modal from "@/components/ui/Modal";
import { Button, Badge, useToast, cn } from "@/components/ui";
import {
  QrCode,
  CheckCircle2,
  Copy,
  Receipt,
  Smartphone,
  Banknote,
  CreditCard,
  Building2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export interface UpiPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId?: string;
  appointmentId?: string;
  patientName: string;
  tokenNumber?: number | string;
  doctorName?: string;
  clinicName?: string;
  upiVpa?: string;
  merchantName?: string;
  amount: number;
  invoiceNumber?: string;
  items?: Array<{ description: string; amount: number; quantity?: number }>;
  onPaymentSuccess?: (paymentMethod: string) => void;
}

export default function UpiPaymentModal({
  open,
  onClose,
  invoiceId,
  appointmentId,
  patientName,
  tokenNumber,
  doctorName,
  clinicName = "Ananta Health Clinic",
  upiVpa,
  merchantName,
  amount,
  invoiceNumber = "INV-OPD",
  items = [],
  onPaymentSuccess,
}: UpiPaymentModalProps) {
  const { toast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamic NPCI UPI VPA & Merchant Name
  const vpa = upiVpa?.trim() || "ananta.health@icici";
  const businessName = merchantName?.trim() || clinicName || "Ananta Health Clinic";
  const note = `Token #${tokenNumber || "OPD"} ${patientName} Consultation`;
  const upiPayload = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    businessName
  )}&am=${amount.toFixed(2)}&tr=${encodeURIComponent(
    invoiceNumber
  )}&tn=${encodeURIComponent(note)}&cu=INR`;

  useEffect(() => {
    if (!open) {
      setPaidSuccess(false);
      return;
    }

    QRCode.toDataURL(upiPayload, {
      width: 280,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("UPI QR Generation Error:", err));
  }, [open, upiPayload]);

  const triggerSoundboxAnnouncement = (amt: number, token?: number | string) => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const speechMsg = `Payment of Rupees ${Math.round(amt)} received on UPI for Token ${token || ""}`;
        const utterance = new SpeechSynthesisUtterance(speechMsg);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = "en-IN";
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn("Soundbox voice announcement notice:", err);
    }
  };

  const handleRecordPayment = async (
    method: "upi" | "cash" | "card" | "net-banking"
  ) => {
    if (!invoiceId && !appointmentId) {
      toast({
        title: "Missing Reference",
        description: "Cannot record payment without a valid invoice or appointment reference.",
        variant: "error",
      });
      return;
    }

    try {
      setSubmitting(true);
      if (appointmentId) {
        await api.post(`/appointment-payments/collect-counter`, {
          appointmentId,
          paymentMethod: method,
          amount,
        });
      } else if (invoiceId) {
        await api.post(`/invoices/${invoiceId}/payments`, {
          amount,
          paymentMethod: method,
        });
      }

      setPaidSuccess(true);
      triggerSoundboxAnnouncement(amount, tokenNumber);

      toast({
        title: "Payment Collected Successfully! ✅",
        description: `₹${amount.toFixed(2)} received via ${method.toUpperCase()} (${vpa}). Consultation marked as Paid.`,
        variant: "success",
      });

      if (onPaymentSuccess) {
        onPaymentSuccess(method);
      }
    } catch (err: any) {
      toast({
        title: "Payment Recording Failed",
        description:
          err.response?.data?.message || "Could not record payment on invoice.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyUpiLink = () => {
    navigator.clipboard.writeText(upiPayload);
    setCopied(true);
    toast({
      title: "UPI Link Copied",
      description: "Direct UPI payment URI copied to clipboard.",
      variant: "info",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Counter-Top Dynamic BharatPe/NPCI UPI Settlement"
      size="lg"
    >
      <div className="space-y-6">
        {paidSuccess ? (
          <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 animate-fade-in space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                Payment Confirmed & Settled!
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                ₹{amount.toFixed(2)} collected via UPI &bull; Token #{tokenNumber} ({patientName}).
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-xs">
                <span>📢</span> Soundbox Voice Verified
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {appointmentId && (
                <a
                  href={`/api/public/track/${appointmentId}/prescription/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Receipt className="w-4 h-4 text-primary" />
                  Print Receipt Slip
                </a>
              )}
              <Button variant="primary" size="sm" onClick={onClose} className="rounded-xl font-bold">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left: Dynamic BharatPe / NPCI UPI QR */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-sm text-foreground">
                  Scan to Pay (Instant UPI)
                </span>
              </div>

              {qrDataUrl ? (
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <img
                    src={qrDataUrl}
                    alt="UPI Payment QR Code"
                    className="w-52 h-52 object-contain"
                  />
                </div>
              ) : (
                <div className="w-52 h-52 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-muted">
                  Generating UPI QR...
                </div>
              )}

              <div className="mt-2 text-[11px] font-mono font-semibold text-text-muted text-center truncate max-w-full px-2">
                VPA: <strong className="text-primary">{vpa}</strong>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Supports GPay, PhonePe, Paytm, BHIM</span>
              </div>

              {/* Mobile 1-Tap Intent Deep Link */}
              <a
                href={upiPayload}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2 px-3 text-xs font-bold text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Pay via UPI App (GPay / PhonePe)
              </a>

              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400"
                onClick={copyUpiLink}
              >
                <Copy className="w-3 h-3 mr-1" />
                {copied ? "Copied UPI URI!" : "Copy UPI Link"}
              </Button>
            </div>

            {/* Right: Bill Breakdown & One-Click Settlement */}
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Patient:</span>
                  <span className="text-xs font-bold text-foreground">
                    {patientName} {tokenNumber ? `(Token #${tokenNumber})` : ""}
                  </span>
                </div>
                {doctorName && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Doctor:</span>
                    <span className="text-xs text-foreground font-medium">
                      {doctorName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Invoice Ref:</span>
                  <span className="text-xs font-mono text-foreground font-medium">
                    {invoiceNumber}
                  </span>
                </div>

                {/* Itemized Services Breakdown */}
                {items && items.length > 0 && (
                  <div className="pt-2 pb-1 border-t border-primary/20 space-y-1 text-xs">
                    <div className="font-semibold text-muted text-[10px] uppercase tracking-wider mb-1">
                      Bill Breakdown:
                    </div>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-foreground">
                        <span className="truncate max-w-[180px]">{item.description}</span>
                        <span className="font-mono font-medium">₹{item.amount.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Total Amount Due:
                  </span>
                  <span className="text-2xl font-black text-primary font-mono">
                    ₹{amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Countertop Settlement Action:
                </span>

                <Button
                  variant="primary"
                  className="w-full justify-between h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold"
                  onClick={() => handleRecordPayment("upi")}
                  disabled={submitting}
                >
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Verified Patient UPI Transfer
                  </span>
                  <Badge variant="info" className="bg-white/20 text-white border-0 font-mono">
                    ₹{amount.toFixed(0)}
                  </Badge>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-between h-11 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold"
                  onClick={() => handleRecordPayment("cash")}
                  disabled={submitting}
                >
                  <span className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Received Cash at Counter
                  </span>
                  <span className="text-xs font-bold font-mono">₹{amount.toFixed(0)}</span>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-between h-11 border-border hover:bg-muted/10 text-foreground font-bold"
                  onClick={() => handleRecordPayment("card")}
                  disabled={submitting}
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Swiped Card / POS Machine
                  </span>
                  <span className="text-xs text-muted">Visa/Mastercard</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {paidSuccess ? "Close" : "Cancel / Settle Later"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
