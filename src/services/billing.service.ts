import api from "@/lib/api";

export interface SaaSPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  status: string;
  displayOrder: number;
  isPopular: boolean;
  limits: {
    maxHospitals: number;
    maxClinics: number;
    maxDoctors: number;
    maxStaff: number;
    maxPatients: number;
    maxAppointments: number;
    maxStorageMB: number;
  };
  features: {
    analytics: boolean;
    auditLogs: boolean;
    multiBranch: boolean;
    dataExport: boolean;
    apiAccess: boolean;
    aiFeatures: boolean;
  };
}

export interface SubscriptionInfo {
  id: string;
  organizationId: string;
  status: "trialing" | "active" | "payment_pending" | "payment_failed" | "cancelled" | "expired";
  billingCycle: "monthly" | "annual";
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  planId: SaaSPlan;
}

export interface UsageInfo {
  usage: {
    hospitalsCount: number;
    clinicsCount: number;
    doctorsCount: number;
    staffCount: number;
    patientsCount: number;
    appointmentsCount: number;
    storageUsedBytes: number;
  };
  limits: SaaSPlan["limits"];
  features: SaaSPlan["features"];
  subscriptionStatus: string;
  planName: string;
  planSlug: string;
  trialEndsAt: string;
  currentPeriodEnd: string;
}

export const billingService = {
  // Public Plans
  async getPlans(): Promise<SaaSPlan[]> {
    const res = await api.get("/billing/plans");
    return res.data.data;
  },

  // Authenticated Subscription Details
  async getSubscription(): Promise<SubscriptionInfo> {
    const res = await api.get("/billing/subscription");
    return res.data.data;
  },

  // Usage & Limits
  async getUsage(): Promise<UsageInfo> {
    const res = await api.get("/billing/usage");
    return res.data.data;
  },

  // SaaS Commercial Invoices
  async getSaaSInvoices() {
    const res = await api.get("/billing/saas-invoices");
    return res.data.data;
  },

  // Checkout
  async createCheckoutOrder(planId: string, billingCycle: "monthly" | "annual" = "monthly") {
    const res = await api.post("/billing/checkout", { planId, billingCycle });
    return res.data.data;
  },

  // Verify Payment
  async verifyPayment(data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const res = await api.post("/billing/verify-payment", data);
    return res.data.data;
  },

  // Cancel
  async cancelSubscription() {
    const res = await api.post("/billing/cancel");
    return res.data.data;
  },

  // Admin APIs
  async adminGetPlans(): Promise<SaaSPlan[]> {
    const res = await api.get("/admin/billing/plans");
    return res.data.data;
  },

  async adminUpsertPlan(planData: Partial<SaaSPlan>) {
    const res = await api.post("/admin/billing/plans", planData);
    return res.data.data;
  },

  async adminGetSubscriptions() {
    const res = await api.get("/admin/billing/subscriptions");
    return res.data.data;
  },

  async adminExtendTrial(subscriptionId: string, extraDays: number = 15) {
    const res = await api.post(`/admin/billing/subscriptions/${subscriptionId}/extend-trial`, { extraDays });
    return res.data.data;
  },

  async adminActivateSubscription(subscriptionId: string, planSlug: string = "starter", billingCycle: "monthly" | "annual" = "monthly") {
    const res = await api.post(`/admin/billing/subscriptions/${subscriptionId}/activate`, { planSlug, billingCycle });
    return res.data.data;
  },

  async adminRefundPayment(paymentId: string) {
    const res = await api.post(`/admin/billing/payments/${paymentId}/refund`);
    return res.data.data;
  },

  async adminGetRazorpayConfig() {
    const res = await api.get("/admin/billing/razorpay-config");
    return res.data.data;
  },

  async adminSaveRazorpayConfig(config: { keyId: string; keySecret: string; webhookSecret?: string; isLiveMode?: boolean }) {
    const res = await api.post("/admin/billing/razorpay-config", config);
    return res.data.data;
  },
};
