"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { EncounterProvider } from "@/providers/EncounterProvider";
import { EncounterWorkspace } from "@/components/clinical/EncounterWorkspace";
import { PatientHeaderData } from "@/components/clinical/PatientHeader";
import { Spinner, Alert } from "@/components/ui";

interface ConsultationClientWorkspaceProps {
  appointmentId: string;
  initialPatientId?: string;
  initialClinicId?: string;
}

export function ConsultationClientWorkspace({
  appointmentId,
  initialPatientId,
  initialClinicId,
}: ConsultationClientWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>(initialPatientId || "");
  const [clinicId, setClinicId] = useState<string>(initialClinicId || "");
  const [doctorId, setDoctorId] = useState<string>("");

  const [patientData, setPatientData] = useState<PatientHeaderData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const initWorkspace = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch appointment details to resolve real patientId, clinicId, doctorId
        const apptsRes = await api.get("/appointments");
        const list = apptsRes.data?.data || [];
        const appt = list.find((a: any) => a.id === appointmentId || a._id === appointmentId);

        let resolvedPatientId = patientId;
        let resolvedClinicId = clinicId;
        let resolvedDoctorId = doctorId;
        let patientName = "Patient Profile";
        let patientGender = "Unknown";
        let patientDob = "N/A";
        let patientMrn = "MRN-PENDING";
        let patientAllergies: string[] = [];
        let patientConditions: string[] = [];

        if (appt) {
          const pObj = appt.patientId;
          const cObj = appt.clinicId;
          const dObj = appt.doctorId;

          if (pObj) {
            resolvedPatientId = typeof pObj === "object" ? (pObj.id || pObj._id) : pObj;
            patientName = typeof pObj === "object" ? (pObj.userId?.name || pObj.name || "Patient") : "Patient";
            patientGender = typeof pObj === "object" ? (pObj.gender || "Unknown") : "Unknown";
            patientDob = typeof pObj === "object" ? (pObj.dob || "N/A") : "N/A";
            patientMrn = typeof pObj === "object" ? (pObj.mrn || `MRN-${resolvedPatientId.substring(0, 6)}`) : "MRN-PENDING";
            patientAllergies = typeof pObj === "object" ? (pObj.allergies || []) : [];
            patientConditions = typeof pObj === "object" ? (pObj.conditions || []) : [];
          }

          if (cObj) {
            resolvedClinicId = typeof cObj === "object" ? (cObj.id || cObj._id) : cObj;
          }

          if (dObj) {
            resolvedDoctorId = typeof dObj === "object" ? (dObj.id || dObj._id) : dObj;
          }
        }

        setPatientId(resolvedPatientId);
        setClinicId(resolvedClinicId);
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
          clinicId: resolvedClinicId,
          patientId: resolvedPatientId,
          appointmentId,
          encounterType: "opd",
        });

        const activeEncounterId = encRes.data?.data?.id || encRes.data?.data?._id || encRes.data?.id || encRes.data?._id;
        if (!activeEncounterId) throw new Error("Failed to initialize encounter session");

        if (isMounted) {
          setEncounterId(activeEncounterId);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.message || err.message || "Failed to initialize consultation workspace");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initWorkspace();

    return () => {
      isMounted = false;
    };
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" label="Loading clinical consultation workspace & patient EHR..." />
      </div>
    );
  }

  if (error || !encounterId || !patientData) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="error" title="Workspace Initialization Error">
          {error || "Unable to start active encounter session. Please try again or return to queue."}
        </Alert>
      </div>
    );
  }

  return (
    <EncounterProvider
      encounterId={encounterId}
      patientId={patientId}
      clinicId={clinicId}
      doctorId={doctorId}
    >
      <EncounterWorkspace patient={patientData} />
    </EncounterProvider>
  );
}
