import api from "@/lib/api";

export interface WhatsAppPack {
  id: "bronze" | "silver" | "gold";
  name: string;
  credits: number;
  price: number;
  currency: string;
  popular?: boolean;
  description: string;
}

export interface WhatsAppSettingsData {
  mode: "disabled" | "shared" | "dedicated";
  monthlyQuota: number;
  creditsBalance: number;
  creditsUsedThisMonth: number;
  prepaidCredits: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  autoRechargeEnabled: boolean;
  autoRechargePack: string;
  hasDedicatedCredentials: boolean;
  wabaId: string | null;
  phoneNumberId: string | null;
  notifications: {
    sendBookingConfirmation: boolean;
    sendConsultationComplete: boolean;
    sendAppointmentCancellation: boolean;
    sendTurnApproaching: boolean;
    sendQueueDelayAlert?: boolean;
    sendDisruptionAlert?: boolean;
  };
  availablePacks: WhatsAppPack[];
}

export const whatsappSettingsService = {
  async getConfig(organizationId?: string): Promise<WhatsAppSettingsData> {
    const res = await api.get("/organization/whatsapp", {
      params: organizationId ? { organizationId } : undefined,
    });
    return res.data.data;
  },

  async updateConfig(payload: Partial<WhatsAppSettingsData> & { accessToken?: string }, organizationId?: string): Promise<any> {
    const res = await api.patch("/organization/whatsapp", {
      ...payload,
      ...(organizationId ? { organizationId } : {}),
    });
    return res.data;
  },

  async topUpCredits(pack: "bronze" | "silver" | "gold", organizationId?: string): Promise<any> {
    const res = await api.post("/organization/whatsapp/top-up", {
      pack,
      ...(organizationId ? { organizationId } : {}),
    });
    return res.data;
  },
};
