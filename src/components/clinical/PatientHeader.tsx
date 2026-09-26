"use client";

import { Badge, Button } from "@/components/ui";
import { Search } from "lucide-react";

export interface PatientHeaderData {
  id: string;
  mrn?: string;
  name: string;
  gender?: string;
  dob?: string;
  age?: number;
  allergies?: string[];
  conditions?: string[];
  clinicalProfileRestricted?: boolean;
  recentNews2Score?: number;
  recentNews2Risk?: string;
}

interface PatientHeaderProps {
  patient: PatientHeaderData;
  onOpenSearch?: () => void;
}

export function PatientHeader({ patient, onOpenSearch }: PatientHeaderProps) {
  const allergies = patient.allergies && patient.allergies.length > 0 ? patient.allergies : [patient.clinicalProfileRestricted ? "Patient approval needed" : "Not recorded"];
  const conditions = patient.conditions && patient.conditions.length > 0 ? patient.conditions : [patient.clinicalProfileRestricted ? "Patient approval needed" : "Not recorded"];

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
    <div className="relative sm:sticky sm:top-0 z-20 bg-surface/95 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Patient Identity & MRN */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
            {patient.name ? patient.name.charAt(0).toUpperCase() : "P"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-sm sm:text-base text-text truncate">{patient.name}</h2>
              {patient.mrn && <Badge variant="neutral" size="sm">MRN: {patient.mrn}</Badge>}
              {getRiskBadge(patient.recentNews2Risk, patient.recentNews2Score)}
            </div>
            <div className="text-xs text-text-secondary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              <span><b>Gender:</b> {patient.gender || "Unknown"}</span>
              <span><b>DOB:</b> {patient.dob || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Clinical Allergies & Diagnoses Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs flex items-center gap-1.5 bg-surface-alt px-2.5 py-1 rounded-xl border border-border/80 flex-wrap">
            <span className="font-semibold text-text-secondary">Allergies:</span>
            {allergies.map((a, i) => (
              <Badge key={i} variant={a.includes("NKDA") ? "success" : a === "Not recorded" || patient.clinicalProfileRestricted ? "neutral" : "danger"} size="sm">
                {a}
              </Badge>
            ))}
          </div>

          <div className="text-xs flex items-center gap-1.5 bg-surface-alt px-2.5 py-1 rounded-xl border border-border/80 flex-wrap">
            <span className="font-semibold text-text-secondary">Diagnoses:</span>
            {conditions.slice(0, 2).map((c, i) => (
              <Badge key={i} variant="primary" size="sm">
                {c}
              </Badge>
            ))}
          </div>

          {onOpenSearch && (
            <Button
              size="xs"
              variant="primary"
              onClick={onOpenSearch}
              className="rounded-xl font-bold text-xs shadow-xs min-h-[36px] w-full sm:w-auto justify-center"
            >
              <Search className="w-3.5 h-3.5 mr-1" />
              <span>Search (Cmd+K)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
