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

  public static async evaluatePrescriptionSafety(payload: { patientId: string; clinicId: string; medicationName: string }) {
    const res = await api.post("/prescriptions/evaluate-safety", payload);
    return res.data?.data || res.data;
  }

  public static async overrideCDSEvaluation(payload: { evaluationId: string; overrideReason: string }) {
    const res = await api.post("/prescriptions/override-evaluation", payload);
    return res.data?.data || res.data;
  }
}
