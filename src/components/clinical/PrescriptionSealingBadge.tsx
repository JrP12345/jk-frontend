"use client";

import React, { useState } from "react";
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
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
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
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>NMC Sealed • {doctorRegistrationNumber || "Verified"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-3 text-xs transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <span>NMC COMPLIANT • CRYPTOGRAPHICALLY SEALED</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Doctor Reg: <span className="font-semibold text-emerald-900 dark:text-emerald-200">{doctorRegistrationNumber || "NMC-VERIFIED"}</span> ({doctorCouncil})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
        >
          <span>{showDetails ? "Hide Audit Proof" : "Verify Proof"}</span>
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-1.5 border-t border-emerald-500/20 pt-2.5 font-mono text-[10px] text-emerald-800/90 dark:text-emerald-300/90">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-sans">Sealed At:</span>
            <span>{formattedDate}</span>
          </div>
          {prescriptionHash && (
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500 dark:text-gray-400 font-sans">SHA-256 Payload Hash:</span>
              <span className="break-all bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">
                {prescriptionHash}
              </span>
            </div>
          )}
          {digitalSignature && (
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500 dark:text-gray-400 font-sans">Digital Signature (HMAC-SHA256):</span>
              <span className="truncate bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">
                {digitalSignature}
              </span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
            <Lock className="w-3 h-3" />
            <span>Immutable legal record under National Medical Commission RMP 2023 & IT Act 2000.</span>
          </div>
        </div>
      )}
    </div>
  );
}
