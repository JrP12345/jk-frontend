import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class EncounterService {
  public static async getSummaryReport(encounterId: string) {
    const res = await api.get(`/encounters/${encounterId}/summary-report`);
    return res.data?.data || res.data;
  }

  public static async startEncounter(payload: { clinicId: string; patientId: string; appointmentId?: string; encounterType?: string }) {
    const res = await api.post("/encounters", payload);
    const encounterData = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ENCOUNTER_CLOSED, { encounterId: encounterData.id, status: "in_progress" });
    return encounterData;
  }
}
