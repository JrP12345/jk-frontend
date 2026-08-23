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
  getConfig: async (organizationId?: string): Promise<AIConfig> => {
    const url = organizationId ? `/ai/admin/config?organizationId=${organizationId}` : "/ai/admin/config";
    const res = await api.get(url);
    return res.data.data;
  },

  updateConfig: async (data: Partial<AIConfig>, organizationId?: string): Promise<AIConfig> => {
    const url = organizationId ? `/ai/admin/config?organizationId=${organizationId}` : "/ai/admin/config";
    const res = await api.put(url, { ...data, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },
};

