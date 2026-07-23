import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class NEWS2Service {
  public static async evaluateScore(encounterId: string, algorithmId = "NEWS2") {
    const res = await api.post(`/encounters/${encounterId}/evaluate-score`, { algorithmId });
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.NEWS2_EVALUATED, data);
    if (data.alert) {
      EncounterEventBus.emit(EncounterEvents.NEWS2_ALERT_TRIGGERED, data.alert);
    }
    return data;
  }

  public static async getScores(encounterId: string) {
    const res = await api.get(`/encounters/${encounterId}/scores`);
    return res.data?.data || res.data;
  }

  public static async acknowledgeAlert(alertId: string) {
    const res = await api.post(`/alerts/${alertId}/acknowledge`);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.NEWS2_ALERT_ACKNOWLEDGED, data);
    return data;
  }

  public static async getPatientVitalTrends(patientId: string) {
    const res = await api.get(`/patients/${patientId}/vital-trends`);
    return res.data?.data || res.data;
  }
}
