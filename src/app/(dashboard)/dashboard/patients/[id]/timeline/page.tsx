import React from "react";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientTimelinePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Longitudinal Patient EHR Timeline</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Comprehensive, chronological medical health record covering outpatient consultations, diagnostics, admissions, and financial transactions.
        </p>
      </div>

      <PatientTimeline patientId={id} />
    </div>
  );
}
