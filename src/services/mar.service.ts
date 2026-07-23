import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class MARService {
  public static async scheduleDose(encounterId: string, payload: any) {
    const res = await api.post(`/encounters/${encounterId}/mar`, payload);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.MAR_SCHEDULED, data);
    return data;
  }

  public static async getMAR(encounterId: string) {
    const res = await api.get(`/encounters/${encounterId}/mar`);
    const data = res.data?.data || res.data;
    return Array.isArray(data) ? data : (data?.entries || []);
  }

  public static async administer(marId: string, notes?: string) {
    const res = await api.put(`/mar/${marId}/administer`, { notes });
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.MAR_ADMINISTERED, data);
    return data;
  }

  public static async refuse(marId: string, refusalReason: string) {
    const res = await api.put(`/mar/${marId}/refuse`, { refusalReason });
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.MAR_REFUSED, data);
    return data;
  }

  public static async hold(marId: string, holdReason: string) {
    const res = await api.put(`/mar/${marId}/hold`, { holdReason });
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.MAR_HELD, data);
    return data;
  }

  public static async getPrescriptionMAR(prescriptionId: string) {
    const res = await api.get(`/prescriptions/${prescriptionId}/mar`);
    return res.data?.data || res.data;
  }
}
