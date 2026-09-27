import React from "react";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientTimelinePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text">Longitudinal Patient EHR Timeline</h1>
        <p className="text-sm text-text-muted dark:text-text-muted mt-1">
          Comprehensive, chronological medical health record covering outpatient consultations, diagnostics, admissions, and financial transactions.
        </p>
      </div>

      <PatientTimeline patientId={id} />
    </div>
  );
}
