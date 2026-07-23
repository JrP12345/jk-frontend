"use client";

import { Badge } from "@/components/ui";

export interface PatientHeaderData {
  id: string;
  mrn?: string;
  name: string;
  gender?: string;
  dob?: string;
  age?: number;
  allergies?: string[];
  conditions?: string[];
  recentNews2Score?: number;
  recentNews2Risk?: string;
}

interface PatientHeaderProps {
  patient: PatientHeaderData;
  onOpenSearch?: () => void;
}

export function PatientHeader({ patient, onOpenSearch }: PatientHeaderProps) {
  const allergies = patient.allergies && patient.allergies.length > 0 ? patient.allergies : ["No Known Drug Allergies (NKDA)"];
  const conditions = patient.conditions && patient.conditions.length > 0 ? patient.conditions : ["No Active Conditions"];

  const getRiskBadge = (risk?: string, score?: number) => {
    if (score === undefined && !risk) return null;
    if (risk === "High" || (score !== undefined && score >= 7)) {
      return <Badge variant="error">NEWS2: {score} (High Risk)</Badge>;
    }
    if (risk === "Medium" || (score !== undefined && score >= 5)) {
      return <Badge variant="warning">NEWS2: {score} (Medium Risk)</Badge>;
    }
    return <Badge variant="success">NEWS2: {score ?? 0} (Low Risk)</Badge>;
  };

  return (
    <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-md border-b border-border p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Patient Identity & MRN */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
            {patient.name ? patient.name.charAt(0).toUpperCase() : "P"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-text">{patient.name}</h2>
              {patient.mrn && <Badge variant="neutral">MRN: {patient.mrn}</Badge>}
              {getRiskBadge(patient.recentNews2Risk, patient.recentNews2Score)}
            </div>
            <div className="text-xs text-text-secondary flex gap-3 mt-0.5">
              <span><b>Gender:</b> {patient.gender || "Unknown"}</span>
              <span><b>DOB:</b> {patient.dob || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Clinical Allergies & Diagnoses Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs flex items-center gap-1.5 bg-surface-hover px-2.5 py-1 rounded-lg border border-border">
            <span className="font-semibold text-text-secondary">Allergies:</span>
            {allergies.map((a, i) => (
              <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${a.includes("NKDA") ? "bg-success-500/10 text-success-700" : "bg-error-500/10 text-error-700"}`}>
                {a}
              </span>
            ))}
          </div>

          <div className="text-xs flex items-center gap-1.5 bg-surface-hover px-2.5 py-1 rounded-lg border border-border">
            <span className="font-semibold text-text-secondary">Diagnoses:</span>
            {conditions.slice(0, 2).map((c, i) => (
              <span key={i} className="bg-primary-500/10 text-primary-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
                {c}
              </span>
            ))}
          </div>

          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="px-3 py-1 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors shadow-sm"
            >
              Search (Cmd+K)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
