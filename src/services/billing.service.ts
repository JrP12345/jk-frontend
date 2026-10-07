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
    maxLocations: number;
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
  summary: SubscriptionSummary;
}

export interface BillingDetails {
  gstin: string;
  billingEmail: string;
  billingAddress: string;
}

export interface SubscriptionSummary {
  planName: string;
  planSlug: string | null;
  status: "trial" | "active" | "expiring_soon" | "expired" | "cancelled" | "payment_pending" | "payment_failed" | "disabled" | "unavailable";
  basis: "trial" | "free" | "paid" | "manual" | "unknown";
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  bookingAvailable: boolean;
  paymentStatus: "created" | "captured" | "failed" | "abandoned" | "captured_review" | "refunded" | null;
  nextAction: "review" | "resolve_payment" | "upgrade" | "renew" | "none";
}

export interface UsageInfo {
  usage: {
    locationsCount: number;
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

export interface DowngradeViolation {
  resource: "locations" | "doctors" | "staff";
  current: number;
  allowed: number;
  excess: number;
  message: string;
}

export interface DowngradeValidationResult {
  canDowngrade: boolean;
  targetPlan: {
    id: string;
    name: string;
    slug: string;
    monthlyPrice: number;
    limits: any;
  };
  currentUsage: {
    locations: number;
    doctors: number;
    staff: number;
  };
  activeLocations: Array<{
    id: string;
    name: string;
    city: string;
    address?: string;
  }>;
  violations: DowngradeViolation[];
}

export const billingService = {
  // Public Plans
  async getPlans(): Promise<SaaSPlan[]> {
    const res = await api.get("/billing/plans");
    return res.data.data;
  },

  // Authenticated Subscription Details
  async getSubscription(organizationId?: string): Promise<SubscriptionInfo> {
    const url = organizationId ? `/billing/subscription?organizationId=${organizationId}` : "/billing/subscription";
    const res = await api.get(url);
    return res.data.data;
  },

  // Usage & Limits
  async getUsage(organizationId?: string): Promise<UsageInfo> {
    const url = organizationId ? `/billing/usage?organizationId=${organizationId}` : "/billing/usage";
    const res = await api.get(url);
    return res.data.data;
  },

  // SaaS Commercial Invoices
  async getSaaSInvoices(organizationId?: string) {
    const url = organizationId ? `/billing/saas-invoices?organizationId=${organizationId}` : "/billing/saas-invoices";
    const res = await api.get(url);
    return res.data.data;
  },

  async getPaymentAttempts(organizationId?: string) {
    const params = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    const res = await api.get(`/billing/payment-attempts${params}`);
    return res.data.data;
  },

  async getBillingDetails(organizationId?: string): Promise<BillingDetails> {
    const params = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    const res = await api.get(`/billing/details${params}`);
    return res.data.data;
  },

  async saveBillingDetails(details: BillingDetails, organizationId?: string): Promise<BillingDetails> {
    const res = await api.put("/billing/details", { ...details, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Downgrade Feasibility Validation
  async validatePlanDowngrade(planId: string, organizationId?: string): Promise<DowngradeValidationResult> {
    const res = await api.post("/billing/validate-downgrade", { planId, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Direct Switch Plan (zero-cost / free plan transition)
  async directSwitchPlan(planId: string, billingCycle: "monthly" | "annual" = "monthly", organizationId?: string) {
    const res = await api.post("/billing/switch-plan", { planId, billingCycle, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Checkout
  async createCheckoutOrder(planId: string, billingCycle: "monthly" | "annual" = "monthly", organizationId?: string, checkoutIntentId?: string) {
    const res = await api.post("/billing/checkout", { planId, billingCycle, checkoutIntentId, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  async getCheckoutStatus(organizationId?: string, orderId?: string): Promise<{
    status: "none" | "created" | "captured" | "failed" | "abandoned" | "captured_review" | "refunded";
    success: boolean; orderId?: string; planId?: string; billingCycle?: "monthly" | "annual";
    failureReason?: string | null; requiresReview?: boolean;
  }> {
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    if (orderId) params.set("orderId", orderId);
    const res = await api.get(`/billing/checkout-status?${params}`);
    return res.data.data;
  },

  async abandonCheckout(orderId: string, organizationId?: string) {
    const res = await api.post("/billing/checkout/abandon", { orderId, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Verify Payment
  async verifyPayment(data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }, organizationId?: string): Promise<{ success: boolean; pending?: boolean; requiresReview?: boolean; message: string }> {
    const res = await api.post("/billing/verify-payment", { ...data, ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Cancel
  async cancelSubscription(organizationId?: string) {
    const url = organizationId ? `/billing/cancel?organizationId=${organizationId}` : "/billing/cancel";
    const res = await api.post(url, organizationId ? { organizationId } : {});
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

  async adminGetPaymentReviews() {
    const res = await api.get("/admin/billing/payment-reviews");
    return res.data.data;
  },

  async adminExtendTrial(subscriptionId: string, extraDays: number = 15) {
    const res = await api.post(`/admin/billing/subscriptions/${subscriptionId}/extend-trial`, { extraDays });
    return res.data.data;
  },

  async adminActivateSubscription(subscriptionId: string, planSlug: string, billingCycle: "monthly" | "annual", reason: string) {
    const res = await api.post(`/admin/billing/subscriptions/${subscriptionId}/activate`, { planSlug, billingCycle, reason });
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
