import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class DischargeService {
  public static async compileSummary(encounterId: string) {
    const res = await api.post(`/encounters/${encounterId}/discharge/compile`);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.DISCHARGE_COMPILED, data);
    return data;
  }

  public static async getSummaryByEncounter(encounterId: string) {
    const res = await api.get(`/encounters/${encounterId}/discharge`);
    return res.data?.data || res.data;
  }

  public static async finalizeSummary(documentId: string, payload: { summaryNarrative: string; dischargeInstructions?: string; followupDate?: string }) {
    const res = await api.put(`/discharge/${documentId}/finalize`, payload);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.DISCHARGE_FINALIZED, data);
    return data;
  }

  public static async countersignSummary(documentId: string) {
    const res = await api.put(`/discharge/${documentId}/countersign`);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.DISCHARGE_COUNTERSIGNED, data);
    return data;
  }

  public static async getSummaryById(documentId: string) {
    const res = await api.get(`/discharge/${documentId}`);
    return res.data?.data || res.data;
  }
}
