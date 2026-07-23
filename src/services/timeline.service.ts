import api from "@/lib/api";

export class TimelineService {
  public static async getPatientTimeline(patientId: string, params?: { category?: string; includeFinancial?: boolean; q?: string; cursor?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.category && params.category !== "all") queryParams.set("category", params.category);
    if (params?.includeFinancial) queryParams.set("includeFinancial", "true");
    if (params?.q?.trim()) queryParams.set("q", params.q.trim());
    if (params?.cursor) queryParams.set("cursor", params.cursor);

    const res = await api.get(`/patients/${patientId}/timeline?${queryParams.toString()}`);
    return res.data?.data || res.data;
  }
}
