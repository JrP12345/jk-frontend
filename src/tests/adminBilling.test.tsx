import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminBillingPage from "@/app/(dashboard)/dashboard/admin/billing/page";
import { ToastProvider } from "@/components/ui";
import { billingService, type SaaSPlan } from "@/services/billing.service";

const plan: SaaSPlan = { id: "pro", name: "Professional", slug: "professional", description: "For growing practices", monthlyPrice: 999, annualPrice: 9990, currency: "INR", trialDays: 15, status: "active", displayOrder: 1, isPopular: false, limits: { maxLocations: 2, maxDoctors: 5, maxStaff: 10, maxPatients: 1000, maxAppointments: 2000, maxStorageMB: 2048 }, features: { analytics: true, auditLogs: false, multiBranch: true, dataExport: true, apiAccess: false, aiFeatures: false } };
const trial = { id: "sub-trial", organizationId: { id: "org-trial", name: "Willow Clinic", city: "Surat" }, planId: plan, billingCycle: "annual", status: "trialing", trialEndsAt: "2026-11-01T00:00:00Z" };
const active = { ...trial, id: "sub-active", organizationId: { id: "org-active", name: "Aurora Health", city: "Mumbai" }, status: "active", currentPeriodEnd: "2027-10-01T00:00:00Z" };
const mount = () => render(<ToastProvider><AdminBillingPage /></ToastProvider>);
const subscriptions = async () => {
  fireEvent.click(await screen.findByRole("tab", { name: "Subscriptions" }));
  return screen.getByRole("article", { name: "Subscription for Willow Clinic" });
};

beforeEach(() => {
  vi.spyOn(billingService, "adminGetPlans").mockResolvedValue([plan]);
  vi.spyOn(billingService, "adminGetSubscriptions").mockResolvedValue([trial, active]);
  vi.spyOn(billingService, "adminGetPaymentReviews").mockResolvedValue([]);
  vi.spyOn(billingService, "adminGetRazorpayConfig").mockResolvedValue({ keyId: "rzp_test_fixture", keySecret: "", webhookSecret: "" });
  vi.spyOn(billingService, "adminUpsertPlan").mockResolvedValue({});
  vi.spyOn(billingService, "adminExtendTrial").mockResolvedValue({});
  vi.spyOn(billingService, "adminActivateSubscription").mockResolvedValue({});
  vi.spyOn(billingService, "adminSaveRazorpayConfig").mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Platform billing workspace", () => {
  it("supports keyboard navigation across all three billing sections without saving", async () => {
    mount();
    expect(screen.getByRole("status", { name: "Loading platform billing" })).toBeInTheDocument();
    const plans = await screen.findByRole("tab", { name: "Plans" });
    fireEvent.keyDown(plans, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Subscriptions" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Subscriptions" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Gateway" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Save Gateway Keys" })).toHaveAttribute("type", "submit");
    expect(billingService.adminSaveRazorpayConfig).not.toHaveBeenCalled();
    expect(billingService.adminActivateSubscription).not.toHaveBeenCalled();
  });

  it("preserves plan fields while saving an edited price and an accessible feature switch", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Professional plan" }));
    const dialog = screen.getByRole("dialog", { name: "Edit plan" });
    fireEvent.change(within(dialog).getByLabelText(/Monthly Price/), { target: { value: "1499" } });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Clinical AI Features" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Plan Configuration" }));
    await waitFor(() => expect(billingService.adminUpsertPlan).toHaveBeenCalledExactlyOnceWith({ ...plan, monthlyPrice: 1499, features: { ...plan.features, aiFeatures: true } }));
  });

  it("requires plan identity fields before creating a new plan", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Create plan" }));
    const dialog = screen.getByRole("dialog", { name: "Create plan" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Plan Configuration" }));
    expect(billingService.adminUpsertPlan).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Plan Name/), { target: { value: "New practice" } });
    fireEvent.change(within(dialog).getByLabelText(/Slug Identifier/), { target: { value: "New Practice" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Plan Configuration" }));
    await waitFor(() => expect(billingService.adminUpsertPlan).toHaveBeenCalledWith(expect.objectContaining({ name: "New practice", slug: "new-practice", monthlyPrice: 1999, annualPrice: 19990 })));
  });

  it("searches subscriptions locally and extends only the selected trial after confirmation", async () => {
    mount();
    await subscriptions();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search organization subscriptions" }), { target: { value: "Willow" } });
    expect(screen.queryByRole("article", { name: "Subscription for Aurora Health" })).not.toBeInTheDocument();
    const row = screen.getByRole("article", { name: "Subscription for Willow Clinic" });
    fireEvent.click(within(row).getByRole("button", { name: "Extend Trial" }));
    let dialog = screen.getByRole("dialog", { name: "Extend Free Trial Period" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(billingService.adminExtendTrial).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Extend Trial" }));
    dialog = screen.getByRole("dialog", { name: "Extend Free Trial Period" });
    fireEvent.change(within(dialog).getByLabelText("Additional Trial Days"), { target: { value: "21" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Extension" }));
    await waitFor(() => expect(billingService.adminExtendTrial).toHaveBeenCalledExactlyOnceWith("sub-trial", 21));
  });

  it("requires a reason for a manual grant and preserves its target plan and billing cycle", async () => {
    mount();
    const row = await subscriptions();
    expect(within(screen.getByRole("article", { name: "Subscription for Aurora Health" })).queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Grant access" }));
    const dialog = screen.getByRole("dialog", { name: "Grant manual subscription access" });
    const submit = within(dialog).getByRole("button", { name: "Grant access" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason for manual grant"), { target: { value: "  Approved service exception  " } });
    fireEvent.click(submit);
    await waitFor(() => expect(billingService.adminActivateSubscription).toHaveBeenCalledExactlyOnceWith("sub-trial", "professional", "annual", "Approved service exception"));
  });

  it("keeps the manual grant dialog open after failure and blocks a missing plan slug", async () => {
    vi.mocked(billingService.adminActivateSubscription).mockRejectedValue(new Error("unavailable"));
    mount();
    fireEvent.click(within(await subscriptions()).getByRole("button", { name: "Grant access" }));
    const dialog = screen.getByRole("dialog", { name: "Grant manual subscription access" });
    fireEvent.change(within(dialog).getByLabelText("Reason for manual grant"), { target: { value: "Approved service exception" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Grant access" }));
    await screen.findByText("Grant failed");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    vi.mocked(billingService.adminGetSubscriptions).mockResolvedValue([{ ...trial, planId: { ...plan, slug: "" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh platform billing" }));
    await waitFor(() => expect(billingService.adminGetSubscriptions).toHaveBeenCalledTimes(2));
    fireEvent.click(within(screen.getByRole("article", { name: "Subscription for Willow Clinic" })).getByRole("button", { name: "Grant access" }));
    const missing = screen.getByRole("dialog", { name: "Grant manual subscription access" });
    fireEvent.change(within(missing).getByLabelText("Reason for manual grant"), { target: { value: "Approved service exception" } });
    expect(within(missing).getByRole("button", { name: "Grant access" })).toBeDisabled();
    expect(billingService.adminActivateSubscription).toHaveBeenCalledTimes(1);
  });

  it("masks gateway secrets and submits only through the explicit gateway save action", async () => {
    mount();
    fireEvent.click(await screen.findByRole("tab", { name: "Gateway" }));
    const keySecret = screen.getByLabelText("Razorpay Key Secret (RAZORPAY_KEY_SECRET)");
    const webhookSecret = screen.getByLabelText("Razorpay Webhook Secret (RAZORPAY_WEBHOOK_SECRET)");
    expect(keySecret).toHaveAttribute("type", "password");
    expect(webhookSecret).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show Razorpay key secret" }));
    expect(keySecret).toHaveAttribute("type", "text");
    expect(billingService.adminSaveRazorpayConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hide Razorpay key secret" }));
    fireEvent.change(keySecret, { target: { value: "fixture-key-secret" } });
    fireEvent.change(webhookSecret, { target: { value: "fixture-webhook-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Gateway Keys" }));
    await waitFor(() => expect(billingService.adminSaveRazorpayConfig).toHaveBeenCalledExactlyOnceWith({ keyId: "rzp_test_fixture", keySecret: "fixture-key-secret", webhookSecret: "fixture-webhook-secret" }));
    expect(billingService.adminActivateSubscription).not.toHaveBeenCalled();
  });

  it("renders captured-payment review details without granting access or recording a refund", async () => {
    vi.mocked(billingService.adminGetPaymentReviews).mockResolvedValue([{ _id: "review", organizationId: trial.organizationId, planId: plan, amount: 999, razorpayOrderId: "order_fixture", razorpayPaymentId: "pay_fixture" }]);
    const refund = vi.spyOn(billingService, "adminRefundPayment");
    mount();
    await subscriptions();
    expect(screen.getByRole("heading", { name: "Captured payments requiring review (1)" })).toBeInTheDocument();
    expect(screen.getByText(/order_fixture/)).toBeInTheDocument();
    expect(refund).not.toHaveBeenCalled();
    expect(billingService.adminActivateSubscription).not.toHaveBeenCalled();
  });

  it("keeps gateway edits available when the save request fails", async () => {
    vi.mocked(billingService.adminSaveRazorpayConfig).mockRejectedValue(new Error("unavailable"));
    mount();
    fireEvent.click(await screen.findByRole("tab", { name: "Gateway" }));
    const keyId = screen.getByLabelText("Razorpay Key ID (RAZORPAY_KEY_ID)");
    fireEvent.change(keyId, { target: { value: "rzp_test_edited_fixture" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Gateway Keys" }));
    await screen.findByText("Error Saving Config");
    expect(keyId).toHaveValue("rzp_test_edited_fixture");
    expect(billingService.adminGetRazorpayConfig).toHaveBeenCalledTimes(1);
    expect(billingService.adminSaveRazorpayConfig).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable billing data and retries without presenting empty plans", async () => {
    vi.mocked(billingService.adminGetPlans).mockRejectedValueOnce(new Error("offline"));
    mount();
    await screen.findByText("Platform billing unavailable");
    expect(screen.queryByText("No plans configured yet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create plan" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry billing" }));
    expect(await screen.findByRole("button", { name: "Edit Professional plan" })).toBeInTheDocument();
  });
});
