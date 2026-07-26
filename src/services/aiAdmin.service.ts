import api from "@/lib/api";

export interface AIConfig {
  organizationId?: string;
  defaultModelAlias: "CLINICAL_FAST" | "CLINICAL_ACCURATE" | "CLINICAL_REASONING";
  monthlyTokenQuota: number;
  featureFlags: {
    enableStreaming: boolean;
    enablePHIAnonymization: boolean;
    enableMultiAgentRouting: boolean;
    enableToolExecution: boolean;
  };
  updatedAt?: string;
}

export const aiAdminService = {
  getConfig: async (): Promise<AIConfig> => {
    const res = await api.get("/ai/admin/config");
    return res.data.data;
  },

  updateConfig: async (data: Partial<AIConfig>): Promise<AIConfig> => {
    const res = await api.put("/ai/admin/config", data);
    return res.data.data;
  },
};
