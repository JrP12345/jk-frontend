"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import PrintDialogActions from "@/components/ui/PrintDialogActions";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import Modal from "@/components/ui/Modal";
import { Button, cn } from "@/components/ui";
import { Scissors } from "lucide-react";
import { printElement } from "@/lib/printBrand";

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
  const [qrError, setQrError] = useState(false);
  const [qrRetry, setQrRetry] = useState(0);
  const slipRef = useRef<HTMLDivElement>(null);

  const trackingUrl = typeof window !== "undefined" && tokenData?.appointmentId
    ? `${window.location.origin}/track/${tokenData.appointmentId}`
    : "";

  useEffect(() => {
    let active = true;
    setQrDataUrl(""); setQrError(false);
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
        .then((url) => { if (active) setQrDataUrl(url); })
        .catch(() => { if (active) setQrError(true); });
    }
    return () => { active = false; };
  }, [trackingUrl, open, qrRetry]);

  if (!tokenData) return null;

  const handlePrint = async () => {
    await printElement(slipRef.current, { title: "Appointment token slip", paper: paperWidth, css: "body * { color: black !important; }" });
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
      title="Token slip preview"
      description="Compatible with standard 58mm and 80mm POS receipt printers. High-contrast layout designed for thermal heat printing."
      size="md"
      footer={<PrintDialogActions documentName="token slip" onPrint={handlePrint} onClose={onClose} disabled={!qrDataUrl || qrError} />}
    >
      <div className="space-y-3">
        {qrError && <div role="alert" className="text-xs text-danger-text flex items-center justify-between gap-2"><span>The tracking code could not load.</span><Button variant="outline" size="sm" onClick={() => setQrRetry(value => value + 1)}>Try again</Button></div>}
        {!qrError && !qrDataUrl && <p role="status" className="text-xs text-text-secondary">Preparing tracking code…</p>}
        <div role="group" aria-label="Paper width" className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-alt border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")} aria-pressed={paperWidth === "80mm"}
              className={cn(
                "min-h-11 px-3 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer",
                paperWidth === "80mm"
                  ? "bg-surface text-text shadow-xs border border-border/80"
                  : "text-text-muted hover:text-text"
              )}
            >
              80mm (Standard)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")} aria-pressed={paperWidth === "58mm"}
              className={cn(
                "min-h-11 px-3 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer",
                paperWidth === "58mm"
                  ? "bg-surface text-text shadow-xs border border-border/80"
                  : "text-text-muted hover:text-text"
              )}
            >
              58mm (Compact)
            </button>
          </div>
          <div className="flex flex-col items-center py-2">
        {/* Thermal Slip Preview Frame */}
        <div
          ref={slipRef}
          id="thermal-token-slip-print"
          data-width={paperWidth}
          className={cn(
            "bg-white text-black max-w-full p-4 rounded-xl border border-border shadow-md font-mono text-center transition-all",
            paperWidth === "80mm" ? "w-[320px]" : "w-[240px]"
          )}
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Header */}
          <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              *** OPD QUEUE TOKEN ***
            </p>
            <h3 className="font-black text-sm sm:text-base leading-tight text-black uppercase">
              {tokenData.clinicName}
            </h3>
            {tokenData.clinicAddress && (
              <p className="text-[10px] text-text-secondary leading-tight">
                {tokenData.clinicAddress}
              </p>
            )}
            {tokenData.clinicPhone && (
              <p className="text-[10px] text-text-secondary">
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
              <div className="flex justify-between text-[10px] text-text-secondary">
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
            <p className="text-[11px] font-black uppercase tracking-widest text-text-secondary">
              YOUR TOKEN NUMBER
            </p>
            <div className="text-5xl sm:text-6xl font-black tracking-tighter text-black py-1">
              #{tokenData.tokenNumber}
            </div>
            {tokenData.patientsAhead !== undefined && (
              <p className="text-[11px] font-bold text-text">
                Patients Ahead: {tokenData.patientsAhead}
              </p>
            )}
            {tokenData.estimatedCallTime && (
              <p className="text-[11px] font-bold text-text">
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
              <LoadingImage
                src={qrDataUrl}
                alt="Scan to track queue live"
                className={cn(
                  "object-contain mx-auto",
                  paperWidth === "80mm" ? "w-28 h-28" : "w-24 h-24"
                )}
              />
            ) : (
              <div className="w-24 h-24 bg-surface-alt flex items-center justify-center text-[9px]">
                Loading QR...
              </div>
            )}
            <p className="text-[9px] text-text-secondary max-w-[220px] leading-tight pt-0.5">
              Live wait-time countdown & chime alert when your token is called
            </p>
          </div>

          {/* Footer Cut Line */}
          <div className="pt-2 text-[9px] text-text-secondary space-y-0.5">
            <p>Please wait in the lounge until your token is announced.</p>
            <div className="flex items-center justify-center gap-1 text-[8px] text-text-muted pt-1">
              <Scissors className="w-3 h-3" />
              <span>------------------------------</span>
            </div>
          </div>
        </div>
      </div>


      </div>
    </Modal>
  );
}
