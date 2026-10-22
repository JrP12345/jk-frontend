import api from "@/lib/api";

export interface SaaSPlan {
  id: string;
  name: string;
  slug: string;
  legacyTier?: "starter" | "professional" | "enterprise";
  commercialFamily?: "location_products";
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  selfServicePharmacy?: boolean;
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
  commercialQuote?: { totalPaise: number; billingCycle: "monthly" | "annual"; commercialFamily: string };
  summary: SubscriptionSummary;
  productEntitlements?: { mode: "legacy_included" | "configured" | "review_required"; enforcement: boolean; active: boolean;
    limits: { maxLocations: number; maxDoctors: number; maxStaff: number }; clinicLocationIds: string[]; pharmacyLocationIds: string[] };
}

export interface ProductPlan extends SaaSPlan {
  commercialFamily: "location_products";
  commercialPricing: { revision: number; annual?: unknown };
}
export interface ProductQuoteInput {
  planId: string; priceRevision: number; billingCycle: "monthly" | "annual"; doctorSeats: number;
  locations: Array<{ locationId: string; clinic: boolean; pharmacy: boolean }>;
}
export interface ProductQuote {
  version: 1; organizationId: string; planId: string; billingCycle: "monthly" | "annual"; fingerprint: string; currency: "INR"; expiresAt: string; purchaseAvailable: true; quoteToken: string;
  subtotalPaise: number; taxPaise: number; totalPaise: number;
  lines: Array<{ id: string; kind: string; quantity: number; amountPaise: number }>;
  entitlements: { maxLocations: number; maxDoctors: number; maxStaff: number };
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
  async getProductPlans(signal?: AbortSignal): Promise<ProductPlan[]> {
    const response = await api.get("/billing/plans?kind=location_products", { signal });
    if (!Array.isArray(response.data?.data)) throw new Error("Product catalogue response is incomplete");
    return response.data.data;
  },
  async quoteProducts(input: ProductQuoteInput, organizationId: string): Promise<ProductQuote> {
    const response = await api.post(`/billing/quote?organizationId=${encodeURIComponent(organizationId)}`, input);
    const quote = response.data?.data as ProductQuote;
    if (!quote || quote.version !== 1 || quote.organizationId !== organizationId || quote.planId !== input.planId || quote.billingCycle !== input.billingCycle || quote.currency !== "INR" || quote.purchaseAvailable !== true ||
        typeof quote.quoteToken !== "string" || !quote.quoteToken.startsWith("enc:v1:") || quote.quoteToken.length > 150000 ||
        !/^[a-f\d]{64}$/.test(quote.fingerprint) || !(Date.parse(quote.expiresAt) > Date.now()) ||
        ![quote.subtotalPaise, quote.taxPaise, quote.totalPaise].every(value => Number.isSafeInteger(value) && value >= 0) || quote.subtotalPaise + quote.taxPaise !== quote.totalPaise ||
        !Array.isArray(quote.lines) || !quote.lines.length || quote.lines.some(line => !Number.isSafeInteger(line.amountPaise) || line.amountPaise < 0 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) ||
        !quote.entitlements || ![quote.entitlements.maxLocations, quote.entitlements.maxDoctors, quote.entitlements.maxStaff].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("Product quote response is incomplete");
    return quote;
  },
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
  async directSwitchPlan(planId: string, billingCycle: "monthly" | "annual" = "monthly", organizationId?: string, quoteToken?: string) {
    const res = await api.post("/billing/switch-plan", { planId, billingCycle, ...(quoteToken ? { quoteToken } : {}), ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  // Checkout
  async createCheckoutOrder(planId: string, billingCycle: "monthly" | "annual" = "monthly", organizationId?: string, checkoutIntentId?: string, quoteToken?: string) {
    const res = await api.post("/billing/checkout", { planId, billingCycle, checkoutIntentId, ...(quoteToken ? { quoteToken } : {}), ...(organizationId ? { organizationId } : {}) });
    return res.data.data;
  },

  async resumeCheckoutOrder(orderId: string, organizationId?: string) {
    const res = await api.post("/billing/checkout", { orderId, ...(organizationId ? { organizationId } : {}) });
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
