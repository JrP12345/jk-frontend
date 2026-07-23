import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class FHIRService {
  public static async getPatientResource(id: string) {
    const res = await api.get(`/fhir/R4/Patient/${id}`);
    return res.data;
  }

  public static async getEncounterResource(id: string) {
    const res = await api.get(`/fhir/R4/Encounter/${id}`);
    return res.data;
  }

  public static async exportEncounterBundle(id: string) {
    const res = await api.get(`/fhir/R4/Encounter/${id}/$export`);
    EncounterEventBus.emit("FHIR_BUNDLE_EXPORTED", { encounterId: id });
    return res.data;
  }

  public static async getObservationResource(id: string) {
    const res = await api.get(`/fhir/R4/Observation/${id}`);
    return res.data;
  }

  public static async getDiagnosticReportResource(id: string) {
    const res = await api.get(`/fhir/R4/DiagnosticReport/${id}`);
    return res.data;
  }

  public static async getMedicationAdministrationResource(id: string) {
    const res = await api.get(`/fhir/R4/MedicationAdministration/${id}`);
    return res.data;
  }

  public static async getCompositionResource(id: string) {
    const res = await api.get(`/fhir/R4/Composition/${id}`);
    return res.data;
  }
}
