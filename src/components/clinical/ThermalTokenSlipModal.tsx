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
  Users,
  Copy,
  Receipt,
  Scissors,
} from "lucide-react";

export interface ThermalTokenSlipData {
  appointmentId: string;
  tokenNumber: number | string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  doctorName: string;
  doctorSpecialization?: string;
  patientName: string;
  appointmentTime?: string;
  estimatedCallTime?: string | null;
  patientsAhead?: number;
  date?: string;
}

interface ThermalTokenSlipModalProps {
  open: boolean;
  onClose: () => void;
  tokenData: ThermalTokenSlipData | null;
}

export default function ThermalTokenSlipModal({
  open,
  onClose,
  tokenData,
}: ThermalTokenSlipModalProps) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const slipRef = useRef<HTMLDivElement>(null);

  const trackingUrl = typeof window !== "undefined" && tokenData?.appointmentId
    ? `${window.location.origin}/track/${tokenData.appointmentId}`
    : "";

  useEffect(() => {
    if (trackingUrl) {
      QRCode.toDataURL(trackingUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Thermal QR generation failed:", err));
    }
  }, [trackingUrl]);

  if (!tokenData) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = tokenData.date || new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = tokenData.appointmentTime || new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Print Official Thermal Token Slip"
      description="Compatible with standard 58mm and 80mm POS receipt printers. High-contrast layout designed for thermal heat printing."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* Width Selection Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-alt border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer",
                paperWidth === "80mm"
                  ? "bg-surface text-text shadow-xs border border-border/80"
                  : "text-text-muted hover:text-text"
              )}
            >
              80mm (Standard)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer",
                paperWidth === "58mm"
                  ? "bg-surface text-text shadow-xs border border-border/80"
                  : "text-text-muted hover:text-text"
              )}
            >
              58mm (Compact)
            </button>
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
              className="rounded-xl font-bold gap-1.5 cursor-pointer shadow-xs bg-zinc-900 hover:bg-zinc-800 text-white text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip ({paperWidth})
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center py-2">
        {/* Thermal Slip Preview Frame */}
        <div
          ref={slipRef}
          id="thermal-token-slip-print"
          data-width={paperWidth}
          className={cn(
            "bg-white text-black p-4 rounded-xl border border-zinc-300 shadow-md font-mono text-center transition-all",
            paperWidth === "80mm" ? "w-[320px]" : "w-[240px]"
          )}
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Header */}
          <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              *** OPD QUEUE TOKEN ***
            </p>
            <h3 className="font-black text-sm sm:text-base leading-tight text-black uppercase">
              {tokenData.clinicName}
            </h3>
            {tokenData.clinicAddress && (
              <p className="text-[10px] text-zinc-700 leading-tight">
                {tokenData.clinicAddress}
              </p>
            )}
            {tokenData.clinicPhone && (
              <p className="text-[10px] text-zinc-700">
                Ph: {tokenData.clinicPhone}
              </p>
            )}
          </div>

          {/* Date & Attending Doctor */}
          <div className="text-left text-[11px] py-1 border-b border-dashed border-black space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">Date:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Time:</span>
              <span>{formattedTime}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="font-bold">Doctor:</span>
              <span className="font-bold uppercase truncate max-w-[150px]">
                Dr. {tokenData.doctorName}
              </span>
            </div>
            {tokenData.doctorSpecialization && (
              <div className="flex justify-between text-[10px] text-zinc-700">
                <span>Dept:</span>
                <span>{tokenData.doctorSpecialization}</span>
              </div>
            )}
            <div className="flex justify-between pt-0.5">
              <span className="font-bold">Patient:</span>
              <span className="font-bold uppercase truncate max-w-[150px]">
                {tokenData.patientName}
              </span>
            </div>
          </div>

          {/* Massive Token Number Display */}
          <div className="py-4 my-1 border-b-2 border-black space-y-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-700">
              YOUR TOKEN NUMBER
            </p>
            <div className="text-5xl sm:text-6xl font-black tracking-tighter text-black py-1">
              #{tokenData.tokenNumber}
            </div>
            {tokenData.patientsAhead !== undefined && (
              <p className="text-[11px] font-bold text-zinc-800">
                Patients Ahead: {tokenData.patientsAhead}
              </p>
            )}
            {tokenData.estimatedCallTime && (
              <p className="text-[11px] font-bold text-zinc-800">
                Est. Call: {new Date(tokenData.estimatedCallTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Live Mobile Tracker QR Code */}
          <div className="py-3 border-b border-dashed border-black space-y-1.5 flex flex-col items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-black">
              Scan to Track Live on Phone
            </p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan to track queue live"
                className={cn(
                  "object-contain mx-auto",
                  paperWidth === "80mm" ? "w-28 h-28" : "w-24 h-24"
                )}
              />
            ) : (
              <div className="w-24 h-24 bg-zinc-200 flex items-center justify-center text-[9px]">
                Loading QR...
              </div>
            )}
            <p className="text-[9px] text-zinc-600 max-w-[220px] leading-tight pt-0.5">
              Live wait-time countdown & chime alert when your token is called
            </p>
          </div>

          {/* Footer Cut Line */}
          <div className="pt-2 text-[9px] text-zinc-600 space-y-0.5">
            <p>Please wait in the lounge until your token is announced.</p>
            <div className="flex items-center justify-center gap-1 text-[8px] text-zinc-500 pt-1">
              <Scissors className="w-3 h-3" />
              <span>------------------------------</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Thermal Printing CSS Rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-token-slip-print,
          #thermal-token-slip-print * {
            visibility: visible;
          }
          #thermal-token-slip-print {
            position: fixed;
            left: 0;
            top: 0;
            margin: 0 !important;
            padding: 8px !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          #thermal-token-slip-print[data-width="80mm"] {
            width: 76mm !important;
            max-width: 76mm !important;
          }
          #thermal-token-slip-print[data-width="58mm"] {
            width: 52mm !important;
            max-width: 52mm !important;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>
    </Modal>
  );
}
