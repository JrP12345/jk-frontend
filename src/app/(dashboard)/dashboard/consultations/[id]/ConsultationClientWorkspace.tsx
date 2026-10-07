"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { EncounterProvider } from "@/providers/EncounterProvider";
import { EncounterWorkspace } from "@/components/clinical/EncounterWorkspace";
import type { PatientHeaderData } from "@/components/clinical/PatientHeader";
import { Alert, Button, Skeleton, SkeletonCard } from "@/components/ui";
import { RotateCw, ArrowLeft } from "lucide-react";
import { userFacingError } from "@/lib/userFacingError";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";

interface ConsultationClientWorkspaceProps {
  appointmentId: string;
  initialPatientId?: string;
  initialLocationId?: string;
}

export function ConsultationClientWorkspace({
  appointmentId,
  initialPatientId,
  initialLocationId,
}: ConsultationClientWorkspaceProps) {
  const router = useRouter();
  const { preferences, loading: preferencesLoading } = useWorkflowPreferences();
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [initialNoteData, setInitialNoteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>(initialPatientId || "");
  const [locationId, setLocationId] = useState<string>(initialLocationId || "");
  const [doctorId, setDoctorId] = useState<string>("");

  const [patientData, setPatientData] = useState<PatientHeaderData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const initWorkspace = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch appointment details directly by ID to resolve real patientId, locationId, doctorId
        const apptRes = await api.get(`/appointments/${appointmentId}`);
        const appt = apptRes.data?.data || apptRes.data;
        if (!appt?.patientId || !appt.locationId || !appt.doctorId) throw new Error("The visit is missing its patient, location or doctor reference.");
        if (!isMounted) return;
        setAppointmentStatus(appt.status || "");
        setVisitNotes(appt.notes || "");

        let resolvedPatientId = patientId;
        let resolvedLocationId = locationId;
        let resolvedDoctorId = doctorId;
        let patientName = "Patient Profile";
        let patientGender = "Unknown";
        let patientDob = "N/A";
        let patientMrn = "";
        let patientAllergies: string[] = [];
        let patientConditions: string[] = [];

        if (appt) {
          const pObj = appt.patientId;
          const cObj = appt.locationId;
          const dObj = appt.doctorId;

          if (pObj) {
            resolvedPatientId = typeof pObj === "object" ? (pObj.id || pObj._id) : pObj;
            patientName = typeof pObj === "object" ? (pObj.userId?.name || pObj.name || "Patient") : "Patient";
            patientGender = typeof pObj === "object" ? (pObj.gender || "Unknown") : "Unknown";
            patientDob = typeof pObj === "object" ? (pObj.dob || "N/A") : "N/A";
            patientMrn = typeof pObj === "object" ? (pObj.mrn || "") : "";
            patientAllergies = typeof pObj === "object" ? (pObj.allergies || []) : [];
            patientConditions = typeof pObj === "object" ? (pObj.conditions || []) : [];
          }

          if (cObj) {
            resolvedLocationId = typeof cObj === "object" ? (cObj.id || cObj._id) : cObj;
          }

          if (dObj) {
            resolvedDoctorId = typeof dObj === "object" ? (dObj.id || dObj._id) : dObj;
          }
        }

        if (!isMounted) return;
        setPatientId(resolvedPatientId);
        setLocationId(resolvedLocationId);
        setDoctorId(resolvedDoctorId);

        setPatientData({
          id: resolvedPatientId,
          name: patientName,
          gender: patientGender,
          dob: patientDob,
          mrn: patientMrn,
          allergies: patientAllergies,
          conditions: patientConditions,
        });

        // 2. Start or lookup active encounter for this appointment
        const encRes = await api.post("/encounters", {
          locationId: resolvedLocationId,
          patientId: resolvedPatientId,
          appointmentId,
          encounterType: "opd",
        });

        const activeEncounterId = encRes.data?.data?.id || encRes.data?.data?._id || encRes.data?.id || encRes.data?._id;
        if (!activeEncounterId) throw new Error("Failed to initialize encounter session");
        const notesRes = await api.get(`/patients/${resolvedPatientId}/clinical-notes/history`, { params: { encounterId: activeEncounterId } });
        const noteList = notesRes.data?.data || [];

        if (isMounted) {
          setInitialNoteData(Array.isArray(noteList) ? noteList[0] || null : null);
          setEncounterId(activeEncounterId);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(userFacingError(err.response?.data?.message || err.message, "This consultation could not be opened. Please try again."));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initWorkspace();

    return () => {
      isMounted = false;
    };
  }, [appointmentId, retryCount]);

  if (loading || preferencesLoading) {
    return (
      <div role="status" aria-live="polite" className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading consultation">
        {/* Patient Header Banner Skeleton */}
        <div className="p-4 sm:p-5 bg-surface border border-border/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Skeleton width="3rem" height="3rem" rounded="xl" />
            <div className="space-y-1.5">
              <Skeleton width="160px" height="1.25rem" rounded="md" />
              <Skeleton width="220px" height="0.75rem" rounded="sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton width="100px" height="2rem" rounded="xl" />
            <Skeleton width="100px" height="2rem" rounded="xl" />
          </div>
        </div>

        {/* Workspace Split Panels Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <Skeleton width="140px" height="1.25rem" rounded="md" />
                <Skeleton width="80px" height="1.75rem" rounded="xl" />
              </div>
              <div className="space-y-3">
                <Skeleton width="100%" height="3.5rem" rounded="xl" />
                <Skeleton width="100%" height="4.5rem" rounded="xl" />
                <Skeleton width="100%" height="6rem" rounded="xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !encounterId || !patientData) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <h1 className="sr-only">Consultation could not be opened</h1>
        <Alert variant="error" title="Consultation could not be opened">
          {error || "Please try again or return to the queue."}
        </Alert>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/queue")}
            className="w-full sm:w-auto min-h-[44px] rounded-xl font-semibold text-xs gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Outpatient Queue</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setRetryCount((c) => c + 1)}
            className="w-full sm:w-auto min-h-[44px] rounded-xl font-bold text-xs gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EncounterProvider
      encounterId={encounterId}
      patientId={patientId}
      locationId={locationId}
      doctorId={doctorId}
    >
      <h1 className="sr-only">Consultation: {patientData.name}</h1>
      <EncounterWorkspace key={appointmentId} patient={patientData} appointmentId={appointmentId} appointmentStatus={appointmentStatus} visitNotes={visitNotes} initialNoteId={initialNoteData?.id || initialNoteData?._id} initialNoteData={initialNoteData} focused={preferences.consultation === "focused"} />
    </EncounterProvider>
  );
}
