import React from "react";
import { ConsultationClientWorkspace } from "./ConsultationClientWorkspace";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ patientId?: string; clinicId?: string }>;
}

export default async function ConsultationWorkspacePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { patientId, clinicId } = await searchParams;

  return (
    <ConsultationClientWorkspace
      appointmentId={id}
      initialPatientId={patientId}
      initialClinicId={clinicId}
    />
  );
}
