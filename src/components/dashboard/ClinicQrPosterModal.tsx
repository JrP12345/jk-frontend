"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import Modal from "@/components/ui/Modal";
import { Button, Badge, cn } from "@/components/ui";
import {
  Printer,
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Building2,
  ExternalLink,
  Download,
  Copy,
} from "lucide-react";

interface ClinicQrPosterModalProps {
  open: boolean;
  onClose: () => void;
  clinic: {
    id?: string;
    _id?: string;
    name: string;
    city?: string;
    address?: string;
    phone?: string;
    organizationName?: string;
    timings?: string;
  } | null;
}

export default function ClinicQrPosterModal({
  open,
  onClose,
  clinic,
}: ClinicQrPosterModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const clinicId = clinic?.id || clinic?._id || "";
  const joinUrl = typeof window !== "undefined" && clinicId
    ? `${window.location.origin}/join/${clinicId}`
    : "";

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 600,
        margin: 1.5,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Poster generation failed:", err));
    }
  }, [joinUrl]);

  if (!clinic) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clinic Queue QR Poster (A4 Standee)"
      description="Print and display this QR poster at your front desk, reception, or entrance. Patients scan it with their phone camera to self-register and get a live queue token."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              className="rounded-xl font-semibold gap-1.5 cursor-pointer text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Link Copied! ✓" : "Copy Join Link"}
            </Button>
            <span className="text-[11px] text-text-muted hidden sm:inline">
              Recommended: Print in High Quality (Color)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="rounded-xl font-semibold cursor-pointer text-xs"
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl font-bold gap-1.5 cursor-pointer shadow-xs bg-primary-600 hover:bg-primary-700 text-white text-xs"
            >
              <Printer className="w-4 h-4" />
              Print Poster (A4 Standee)
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Printable Poster Container */}
        <div
          ref={posterRef}
          id="clinic-qr-poster-print"
          className="bg-white text-zinc-900 rounded-3xl p-8 border-2 border-zinc-200 shadow-md max-w-lg mx-auto text-center relative overflow-hidden"
        >
          {/* Subtle decorative top gradient bar */}
          <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-r from-primary-600 via-teal-500 to-emerald-500" />

          {/* Header Branding */}
          <div className="pt-2 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-[11px] font-bold text-primary-700 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              Live OPD Smart Queue
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 pt-1">
              {clinic.name}
            </h1>
            {clinic.city && (
              <p className="text-xs font-semibold text-zinc-500">
                {clinic.address ? `${clinic.address}, ` : ""}{clinic.city}
              </p>
            )}
          </div>

          {/* Main Call to Action Headline */}
          <div className="my-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
            <h2 className="text-base sm:text-lg font-black text-zinc-900">
              Scan to Join the Queue & Track Your Token
            </h2>
            <p className="text-xs text-zinc-500 leading-snug">
              Point your smartphone camera at the QR code below. Zero app download or account creation needed.
            </p>
          </div>

          {/* High-Resolution QR Code Frame */}
          <div className="inline-block p-4 bg-white rounded-3xl border-4 border-zinc-900 shadow-lg relative my-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code to join live queue at ${clinic.name}`}
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-zinc-100 rounded-2xl">
                <span className="text-xs font-bold text-zinc-400">Generating Poster QR...</span>
              </div>
            )}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              Scan with Camera
            </div>
          </div>

          {/* 3-Step Visual Patient Guide */}
          <div className="grid grid-cols-3 gap-2 text-center mt-6 pt-5 border-t border-zinc-200">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-black text-xs flex items-center justify-center mx-auto">
                1
              </div>
              <p className="text-[11px] font-bold text-zinc-800">Scan QR</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Use any phone camera</p>
            </div>

            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-black text-xs flex items-center justify-center mx-auto">
                2
              </div>
              <p className="text-[11px] font-bold text-zinc-800">Enter Details</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Name & choose doctor</p>
            </div>

            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center mx-auto">
                3
              </div>
              <p className="text-[11px] font-bold text-zinc-800">Track Live</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Follow token on your screen</p>
            </div>
          </div>

          {/* Facility Footer */}
          <div className="mt-6 pt-4 border-t border-zinc-200/80 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="font-semibold text-zinc-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Healthcare Facility
            </span>
            <span>Powered by ANANTA Health</span>
          </div>
        </div>
      </div>

      {/* Embedded Print Isolation Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #clinic-qr-poster-print,
          #clinic-qr-poster-print * {
            visibility: visible;
          }
          #clinic-qr-poster-print {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            max-width: 650px;
            box-shadow: none !important;
            border: 2px solid #e4e4e7 !important;
            padding: 36px 32px !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </Modal>
  );
}
