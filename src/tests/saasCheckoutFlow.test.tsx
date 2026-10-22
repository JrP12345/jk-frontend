import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BillingSettingsPage from "@/app/(dashboard)/dashboard/settings/billing/page";
import { ToastProvider } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

vi.mock("@/lib/razorpay", () => ({ loadRazorpayScript: vi.fn().mockResolvedValue(true) }));

const starter = { id: "starter-id", name: "Starter", slug: "starter", description: "Free", monthlyPrice: 0, annualPrice: 0,
  currency: "INR", status: "active", displayOrder: 0, isPopular: false,
  limits: { maxLocations: 1, maxDoctors: 2, maxStaff: 5, maxPatients: 500, maxAppointments: 1000, maxStorageMB: 1024 },
  features: { analytics: false, auditLogs: false, multiBranch: false, dataExport: false, apiAccess: false, aiFeatures: false } };
const pro = { ...starter, id: "pro-id", name: "Pro", slug: "professional", description: "Paid", monthlyPrice: 499, annualPrice: 4999 };

describe("SaaS Checkout UI", () => {
  let checkoutOptions: any;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    checkoutOptions = null;
    (window as any).Razorpay = class {
      constructor(options: any) { checkoutOptions = options; }
      on() {}
      open() {}
    };
    useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@test.local", role: "admin", organization_id: "org-1" }, isAuthenticated: true, isLoading: false });
    vi.spyOn(billingService, "getPlans").mockResolvedValue([starter, pro]);
    vi.spyOn(billingService, "getProductPlans").mockResolvedValue([]);
    vi.spyOn(billingService, "getSubscription").mockResolvedValue({
      id: "sub-1", organizationId: "org-1", planId: starter, status: "trialing", billingCycle: "monthly",
      trialStartedAt: "2026-09-01T00:00:00Z", trialEndsAt: "2026-10-15T00:00:00Z",
      currentPeriodStart: "2026-09-01T00:00:00Z", currentPeriodEnd: "2026-10-15T00:00:00Z",
      summary: { planName: "Starter", planSlug: "starter", status: "trial", basis: "trial",
        startedAt: "2026-09-01T00:00:00Z", expiresAt: "2026-10-15T00:00:00Z", daysRemaining: 13,
        bookingAvailable: true, paymentStatus: null, nextAction: "none" },
    });
    vi.spyOn(billingService, "getUsage").mockResolvedValue({ usage: { locationsCount: 0, doctorsCount: 0, staffCount: 0, patientsCount: 0, appointmentsCount: 0, storageUsedBytes: 0 },
      limits: starter.limits, features: starter.features, subscriptionStatus: "trialing", planName: "Starter", planSlug: "starter",
      trialEndsAt: "2026-10-15T00:00:00Z", currentPeriodEnd: "2026-10-15T00:00:00Z" });
    vi.spyOn(billingService, "getSaaSInvoices").mockResolvedValue([]);
    vi.spyOn(billingService, "getPaymentAttempts").mockResolvedValue([]);
    vi.spyOn(billingService, "getBillingDetails").mockResolvedValue({ gstin: "", billingEmail: "", billingAddress: "" });
    vi.spyOn(billingService, "getCheckoutStatus").mockResolvedValue({ status: "none", success: false });
    vi.spyOn(billingService, "validatePlanDowngrade").mockResolvedValue({ canDowngrade: true, targetPlan: { id: pro.id, name: pro.name, slug: pro.slug, monthlyPrice: 499, limits: pro.limits },
      currentUsage: { locations: 0, doctors: 0, staff: 0 }, activeLocations: [], violations: [] });
  });

  afterEach(() => { vi.restoreAllMocks(); delete (window as any).Razorpay; });

  it("opens one order for rapid clicks and keeps activation pending until the backend confirms", async () => {
    const create = vi.spyOn(billingService, "createCheckoutOrder").mockResolvedValue({ orderId: "order_1", amount: 589, currency: "INR", keyId: "rzp_test_key", paymentId: "payment-1" });
    vi.spyOn(billingService, "verifyPayment").mockResolvedValue({ success: false, pending: true, message: "Awaiting capture" });
    render(<ToastProvider><BillingSettingsPage /></ToastProvider>);
    const choose = await screen.findByRole("button", { name: "Choose Pro" });
    fireEvent.click(choose);
    fireEvent.click(choose);
    await waitFor(() => expect(checkoutOptions?.order_id).toBe("order_1"));
    expect(create).toHaveBeenCalledTimes(1);
    expect(choose).toBeDisabled();
    await act(async () => {
      await checkoutOptions.handler({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "signature" });
    });
    expect(await screen.findByText(/Checking payment confirmation/)).toBeInTheDocument();
    expect(screen.queryByText("Subscription Activated")).not.toBeInTheDocument();
  });

  it("saves invoice details through the billing API", async () => {
    const details = { gstin: "22AAAAA0000A1Z5", billingEmail: "billing@test.local", billingAddress: "Delhi office" };
    const save = vi.spyOn(billingService, "saveBillingDetails").mockResolvedValue(details);
    render(<ToastProvider><BillingSettingsPage /></ToastProvider>);
    fireEvent.change(await screen.findByLabelText("GSTIN Number (Optional)"), { target: { value: details.gstin } });
    fireEvent.change(screen.getByLabelText("Billing Email"), { target: { value: details.billingEmail } });
    fireEvent.change(screen.getByLabelText("Billing Address"), { target: { value: details.billingAddress } });
    fireEvent.click(screen.getByRole("button", { name: "Save Details" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(details, undefined));
  });
  it("shows zero included doctor seats without replacing zero with a default capacity", async () => {
    vi.mocked(billingService.getUsage).mockResolvedValue({ usage: { locationsCount: 1, doctorsCount: 0, staffCount: 0, patientsCount: 0, appointmentsCount: 0, storageUsedBytes: 0 },
      limits: { ...starter.limits, maxDoctors: 0 }, features: starter.features, subscriptionStatus: "active", planName: "Pharmacy", planSlug: "starter",
      trialEndsAt: "2026-10-15T00:00:00Z", currentPeriodEnd: "2026-10-15T00:00:00Z" });
    render(<ToastProvider><BillingSettingsPage /></ToastProvider>);
    await screen.findByText("Doctor Profiles"); expect(screen.getByText("0 / 0")).toBeInTheDocument();
    expect(document.querySelector('[style*="NaN"]')).toBeNull();
  });

  async function reviewProducts(totalPaise = 49901) {
    const plan = { ...pro, id: "products-id", name: "Location products", monthlyPrice: 0, annualPrice: 0, commercialFamily: "location_products" as const, commercialPricing: { revision: 1 } };
    vi.mocked(billingService.getProductPlans).mockResolvedValue([plan]);
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [{ id: "location-a", name: "Store" }] } });
    const quote = { version: 1 as const, organizationId: "org-1", planId: plan.id, billingCycle: "monthly" as const, fingerprint: "a".repeat(64), currency: "INR" as const,
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(), purchaseAvailable: true as const, quoteToken: "enc:v1:synthetic-reviewed-quote", subtotalPaise: totalPaise, taxPaise: 0, totalPaise,
      lines: [{ id: "pharmacy:location-a", kind: "pharmacy", quantity: 1, amountPaise: totalPaise }], entitlements: { maxLocations: 1, maxDoctors: 0, maxStaff: 5 } };
    vi.spyOn(billingService, "quoteProducts").mockResolvedValue(quote);
    render(<ToastProvider><BillingSettingsPage /></ToastProvider>);
    fireEvent.click(await screen.findByRole("combobox", { name: "Products for Store" }));
    fireEvent.click(await screen.findByRole("option", { name: "Standalone pharmacy", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Preview product quote" }));
    await screen.findByRole("region", { name: "Product quote" });
    return { plan, quote };
  }

  it("charges the reviewed product total through the existing checkout, independent of unused flat prices", async () => {
    const create = vi.spyOn(billingService, "createCheckoutOrder").mockResolvedValue({ orderId: "order_products", amount: 499.01, currency: "INR", keyId: "rzp_test_key", paymentId: "payment-1" });
    const { plan, quote } = await reviewProducts();
    const pay = screen.getByRole("button", { name: /Pay.*499.01/ }); fireEvent.click(pay); fireEvent.click(pay);
    await waitFor(() => expect(checkoutOptions?.order_id).toBe("order_products"));
    expect(create).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(plan.id, "monthly", undefined, expect.any(String), quote.quoteToken);
    expect(checkoutOptions.amount).toBe(49901);
    expect(billingService.validatePlanDowngrade).not.toHaveBeenCalled();
    vi.spyOn(billingService, "verifyPayment").mockResolvedValue({ success: false, requiresReview: true, message: "Captured selection needs review" });
    await act(async () => checkoutOptions.handler({ razorpay_order_id: "order_products", razorpay_payment_id: "pay_products", razorpay_signature: "signature" }));
    expect(await screen.findByText("Captured selection needs review")).toBeInTheDocument();
  });
  it("uses the free-switch workflow only for a reviewed zero-price product selection", async () => {
    const direct = vi.spyOn(billingService, "directSwitchPlan").mockResolvedValue({}), create = vi.spyOn(billingService, "createCheckoutOrder");
    const { plan, quote } = await reviewProducts(0);
    fireEvent.click(screen.getByRole("button", { name: "Activate reviewed free selection" }));
    await waitFor(() => expect(direct).toHaveBeenCalledWith(plan.id, "monthly", undefined, quote.quoteToken));
    expect(create).not.toHaveBeenCalled(); expect(checkoutOptions).toBeNull();
  });
  it("keeps a mismatched order available for recovery and never opens it as the reviewed amount", async () => {
    vi.spyOn(billingService, "createCheckoutOrder").mockResolvedValue({ orderId: "order_mismatch", amount: 1, currency: "INR", keyId: "rzp_test_key" });
    await reviewProducts(); fireEvent.click(screen.getByRole("button", { name: /Pay.*499.01/ }));
    await screen.findByText("The checkout does not match the reviewed total. Check payment status before trying again.");
    expect(checkoutOptions).toBeNull(); expect(screen.getByText(/Order order_mismatch/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeInTheDocument();
  });
  it("resumes a server-held product order after reload without a browser quote or a new order", async () => {
    vi.mocked(billingService.getCheckoutStatus).mockResolvedValue({ status: "created", success: false, orderId: "order_resumed", planId: "products-id", billingCycle: "monthly" });
    const resume = vi.spyOn(billingService, "resumeCheckoutOrder").mockResolvedValue({ orderId: "order_resumed", amount: 499.01, currency: "INR", keyId: "rzp_test_key" });
    const create = vi.spyOn(billingService, "createCheckoutOrder");
    render(<ToastProvider><BillingSettingsPage /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Resume payment" }));
    await waitFor(() => expect(checkoutOptions?.order_id).toBe("order_resumed"));
    expect(resume).toHaveBeenCalledWith("order_resumed", undefined); expect(create).not.toHaveBeenCalled();
    expect(billingService.validatePlanDowngrade).not.toHaveBeenCalled();
  });
  it("ignores a late product order when the authenticated billing scope changes", async () => {
    let resolve!: (value: unknown) => void;
    vi.spyOn(billingService, "createCheckoutOrder").mockReturnValue(new Promise(done => { resolve = done; }));
    await reviewProducts(); fireEvent.click(screen.getByRole("button", { name: /Pay.*499.01/ }));
    await act(async () => { useAuthStore.setState({ user: { id: "another-admin", name: "Other admin", email: "other@test.local", role: "admin", organization_id: "org-2" } }); });
    await act(async () => resolve({ orderId: "order_old_scope", amount: 499.01, currency: "INR", keyId: "rzp_test_key" }));
    expect(checkoutOptions).toBeNull(); expect(screen.queryByText(/order_old_scope/)).not.toBeInTheDocument();
  });
});
