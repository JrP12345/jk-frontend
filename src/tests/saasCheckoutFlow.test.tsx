import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BillingSettingsPage from "@/app/(dashboard)/dashboard/settings/billing/page";
import { ToastProvider } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/lib/razorpay", () => ({ loadRazorpayScript: vi.fn().mockResolvedValue(true) }));

const starter = { id: "starter-id", name: "Starter", slug: "starter", description: "Free", monthlyPrice: 0, annualPrice: 0,
  currency: "INR", status: "active", displayOrder: 0, isPopular: false,
  limits: { maxClinics: 1, maxDoctors: 2, maxStaff: 5, maxPatients: 500, maxAppointments: 1000, maxStorageMB: 1024 },
  features: { analytics: false, auditLogs: false, multiBranch: false, dataExport: false, apiAccess: false, aiFeatures: false } };
const pro = { ...starter, id: "pro-id", name: "Pro", slug: "pro", description: "Paid", monthlyPrice: 499, annualPrice: 4999 };

describe("SaaS Checkout UI", () => {
  let checkoutOptions: any;

  beforeEach(() => {
    checkoutOptions = null;
    (window as any).Razorpay = class {
      constructor(options: any) { checkoutOptions = options; }
      on() {}
      open() {}
    };
    useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@test.local", role: "admin", organization_id: "org-1" }, isAuthenticated: true, isLoading: false });
    vi.spyOn(billingService, "getPlans").mockResolvedValue([starter, pro]);
    vi.spyOn(billingService, "getSubscription").mockResolvedValue({
      id: "sub-1", organizationId: "org-1", planId: starter, status: "trialing", billingCycle: "monthly",
      trialStartedAt: "2026-09-01T00:00:00Z", trialEndsAt: "2026-10-15T00:00:00Z",
      currentPeriodStart: "2026-09-01T00:00:00Z", currentPeriodEnd: "2026-10-15T00:00:00Z",
      summary: { planName: "Starter", planSlug: "starter", status: "trial", basis: "trial",
        startedAt: "2026-09-01T00:00:00Z", expiresAt: "2026-10-15T00:00:00Z", daysRemaining: 13,
        bookingAvailable: true, paymentStatus: null, nextAction: "none" },
    });
    vi.spyOn(billingService, "getUsage").mockResolvedValue({ usage: { clinicsCount: 0, doctorsCount: 0, staffCount: 0, patientsCount: 0, appointmentsCount: 0, storageUsedBytes: 0 },
      limits: starter.limits, features: starter.features, subscriptionStatus: "trialing", planName: "Starter", planSlug: "starter",
      trialEndsAt: "2026-10-15T00:00:00Z", currentPeriodEnd: "2026-10-15T00:00:00Z" });
    vi.spyOn(billingService, "getSaaSInvoices").mockResolvedValue([]);
    vi.spyOn(billingService, "getPaymentAttempts").mockResolvedValue([]);
    vi.spyOn(billingService, "getBillingDetails").mockResolvedValue({ gstin: "", billingEmail: "", billingAddress: "" });
    vi.spyOn(billingService, "getCheckoutStatus").mockResolvedValue({ status: "none", success: false });
    vi.spyOn(billingService, "validatePlanDowngrade").mockResolvedValue({ canDowngrade: true, targetPlan: { id: pro.id, name: pro.name, slug: pro.slug, monthlyPrice: 499, limits: pro.limits },
      currentUsage: { clinics: 0, doctors: 0, staff: 0 }, activeClinics: [], violations: [] });
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
});
