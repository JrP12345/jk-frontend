import { ConsultationClientWorkspace } from "./ConsultationClientWorkspace";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ patientId?: string; locationId?: string }>;
}

export default async function ConsultationWorkspacePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { patientId, locationId } = await searchParams;

  return (
    <ConsultationClientWorkspace
      appointmentId={id}
      initialPatientId={patientId}
      initialLocationId={locationId}
    />
  );
}
