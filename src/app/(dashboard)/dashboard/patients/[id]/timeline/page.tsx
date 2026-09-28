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
        <h1 className="text-xl sm:text-2xl font-bold text-text">Patient history</h1>
        <p className="text-sm text-text-muted dark:text-text-muted mt-1">
          Consultations, test results, admissions, and bills in date order.
        </p>
      </div>

      <PatientTimeline patientId={id} />
    </div>
  );
}
