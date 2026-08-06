import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class SOAPService {
  public static async saveDraft(payload: any) {
    const res = await api.post("/clinical-notes", payload);
    const noteData = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.SOAP_NOTE_CREATED, noteData);
    return noteData;
  }

  public static async signNote(noteId: string) {
    const res = await api.put(`/clinical-notes/${noteId}/sign`);
    const signedData = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.SOAP_NOTE_SIGNED, signedData);
    return signedData;
  }

  public static async amendNote(noteId: string, payload: any) {
    const res = await api.post(`/clinical-notes/${noteId}/amend`, payload);
    const amendedData = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.SOAP_NOTE_AMENDED, amendedData);
    return amendedData;
  }

  public static async getNoteHistory(patientId: string) {
    const res = await api.get(`/patients/${patientId}/clinical-notes/history`);
    return res.data?.data || res.data;
  }

  public static async evaluatePrescriptionSafety(payload: { patientId: string; medicationName: string }) {
    const res = await api.post("/prescriptions/evaluate-safety", {
      patientId: payload.patientId,
      proposedPrescriptions: [{ medicineName: payload.medicationName }],
    });
    return res.data?.data || res.data;
  }

  public static async overrideCDSEvaluation(payload: {
    clinicId: string;
    patientId: string;
    encounterId?: string;
    prescriptionIds?: string[];
    findings: unknown[];
    clinicianDecision: "accepted" | "overridden" | "blocked";
    overrideReason?: string;
  }) {
    const res = await api.post("/prescriptions/override-evaluation", payload);
    return res.data?.data || res.data;
  }
}
