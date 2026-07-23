import api from "@/lib/api";

export class AnalyticsService {
  public static async getExecutiveAnalytics() {
    const res = await api.get("/analytics/executive");
    return res.data?.data || res.data;
  }

  public static async getQualityMetrics() {
    const res = await api.get("/analytics/quality-metrics");
    return res.data?.data || res.data;
  }
}
