"use client";

import { useState } from "react";
import { ShieldCheck, Lock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface PrescriptionSealingBadgeProps {
  isSealed?: boolean;
  prescriptionHash?: string;
  digitalSignature?: string;
  doctorRegistrationNumber?: string;
  doctorCouncil?: string;
  sealedAt?: string | Date;
  compact?: boolean;
}

export function PrescriptionSealingBadge({
  isSealed = false,
  prescriptionHash,
  digitalSignature,
  doctorRegistrationNumber,
  doctorCouncil = "State Medical Council",
  sealedAt,
  compact = false,
}: PrescriptionSealingBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isSealed) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning-text border border-warning/20">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Draft • Unsealed</span>
      </div>
    );
  }

  const formattedDate = sealedAt
    ? new Date(sealedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Timestamped";

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success-text dark:text-success-text border border-success/20">
        <ShieldCheck className="w-3.5 h-3.5 text-success-text" />
        <span>NMC Sealed • {doctorRegistrationNumber || "Verified"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-success/20 bg-success/5 dark:bg-success/20 p-3 text-xs transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/20 text-success-text dark:text-success-text">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-success-text dark:text-success-text">
              <span>NMC COMPLIANT • CRYPTOGRAPHICALLY SEALED</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
            </div>
            <p className="text-[11px] text-success-text/80 dark:text-success-text/80">
              Doctor Reg: <span className="font-semibold text-success-text dark:text-success-text">{doctorRegistrationNumber || "NMC-VERIFIED"}</span> ({doctorCouncil})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[11px] font-medium text-success-text hover:text-success-text dark:text-success-text dark:hover:text-success-text"
        >
          <span>{showDetails ? "Hide Audit Proof" : "Verify Proof"}</span>
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-1.5 border-t border-success/20 pt-2.5 font-mono text-[10px] text-success-text/90 dark:text-success-text/90">
          <div className="flex justify-between">
            <span className="text-text-muted dark:text-text-muted font-sans">Sealed At:</span>
            <span>{formattedDate}</span>
          </div>
          {prescriptionHash && (
            <div className="flex flex-col gap-0.5">
              <span className="text-text-muted dark:text-text-muted font-sans">SHA-256 Payload Hash:</span>
              <span className="break-all bg-success/10 px-1.5 py-0.5 rounded text-[9px]">
                {prescriptionHash}
              </span>
            </div>
          )}
          {digitalSignature && (
            <div className="flex flex-col gap-0.5">
              <span className="text-text-muted dark:text-text-muted font-sans">Digital Signature (HMAC-SHA256):</span>
              <span className="truncate bg-success/10 px-1.5 py-0.5 rounded text-[9px]">
                {digitalSignature}
              </span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-1 text-[10px] text-success-text dark:text-success-text font-sans">
            <Lock className="w-3 h-3" />
            <span>Immutable legal record under National Medical Commission RMP 2023 & IT Act 2000.</span>
          </div>
        </div>
      )}
    </div>
  );
}
