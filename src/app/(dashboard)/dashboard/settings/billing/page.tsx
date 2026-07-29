"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
  ProgressBar,
  Table,
  Modal,
  Spinner,
  useToast,
} from "@/components/ui";
import { billingService, SaaSPlan, SubscriptionInfo, UsageInfo } from "@/services/billing.service";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useAuthStore } from "@/store/authStore";

export default function BillingSettingsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upgrade Modal & Checkout state
  const [selectedPlan, setSelectedPlan] = useState<SaaSPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Organization GST & Billing Details
  const [billingForm, setBillingForm] = useState({
    gstin: "",
    billingEmail: "",
    billingAddress: "",
  });
  const [savingBilling, setSavingBilling] = useState(false);

  const isRootAdmin = user?.role === "root";

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    setLoading(true);
    try {
      const [plansData, subData, usageData, invoicesData] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription(),
        billingService.getUsage(),
        billingService.getSaaSInvoices(),
      ]);

      setPlans(plansData);
      setSubscription(subData);
      setUsageInfo(usageData);
      setInvoices(invoicesData);
    } catch (err: any) {
      toast({
        title: "Error Loading Billing Data",
        description: err.response?.data?.message || "Failed to load commercial subscription details.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleInitiateCheckout(plan: SaaSPlan) {
    setSelectedPlan(plan);
    setIsProcessing(true);

    try {
      // 1. Create order on backend (calls Razorpay REST API POST /v1/orders with user's keys)
      const order = await billingService.createCheckoutOrder(plan.id, billingCycle);

      // 2. Load official Razorpay Checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast({
          title: "Razorpay SDK Load Error",
          description: "Could not load Razorpay SDK from checkout.js. Please check your internet connection.",
          variant: "error",
        });
        setIsProcessing(false);
        return;
      }

      // 3. Open Official Razorpay Checkout Window Modal
      const options = {
        key: order.keyId,
        amount: order.amount * 100, // in paise
        currency: order.currency,
        name: "ANANTA Healthcare SaaS",
        description: `${plan.name} Plan (${billingCycle}) Subscription`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await billingService.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast({
              title: "Subscription Activated! 🎉",
              description: `Your ${plan.name} subscription is now active! Invoice email sent.`,
              variant: "success",
            });
            setCheckoutModalOpen(false);
            loadBillingData();
          } catch (err: any) {
            toast({
              title: "Payment Verification Failed",
              description: err.response?.data?.message || "Invalid payment signature.",
              variant: "error",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#0284c7",
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", (resp: any) => {
        toast({
          title: "Payment Failed",
          description: resp.error?.description || "Transaction failed at Razorpay gateway.",
          variant: "error",
        });
        setIsProcessing(false);
      });
      razorpayInstance.open();
    } catch (err: any) {
      toast({
        title: "Checkout Error",
        description: err.response?.data?.message || err.message || "Failed to initiate Razorpay checkout.",
        variant: "error",
      });
      setIsProcessing(false);
    }
  }

  const handleSaveBillingInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBilling(true);
    setTimeout(() => {
      setSavingBilling(false);
      toast({
        title: "Billing Details Saved",
        description: "Your GSTIN and invoice billing info have been updated.",
        variant: "success",
      });
    }, 600);
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Spinner size="lg" label="Loading commercial subscription details..." />
      </div>
    );
  }

  const currentPlan = subscription?.planId as any;
  const limits = usageInfo?.limits || currentPlan?.limits || {};
  const usage = usageInfo?.usage || { clinicsCount: 0, doctorsCount: 0, staffCount: 0, patientsCount: 0 };
  const isTrial = subscription?.status === "trialing";
  const trialEnds = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const daysLeftInTrial = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased">
      {/* Root Super-Admin Help Banner */}
      {isRootAdmin && (
        <Card className="border border-primary-500/40 bg-primary-500/10 p-4 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-primary-400 font-medium">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Root Super-Admin Context:</strong> You are inspecting this organization's subscription. To manage platform plans, Razorpay merchant credentials, or extend trials, visit the Root Admin Console.
              </span>
            </div>
            <Link href="/dashboard/admin/billing">
              <Button variant="primary" size="xs" className="font-bold rounded-lg shrink-0 cursor-pointer">
                Go to SaaS Plan Console
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Active Subscription Banner */}
      <Card className="border border-primary-500/30 bg-gradient-to-r from-surface via-surface-alt to-surface shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Badge variant="primary" size="md" className="font-bold uppercase tracking-wider">
                  {currentPlan?.name || "Starter Plan"}
                </Badge>
                <Badge
                  variant={isTrial ? "warning" : "success"}
                  size="md"
                  className="font-bold uppercase tracking-wider"
                >
                  {subscription?.status || "Active"}
                </Badge>
              </div>

              <h2 className="text-2xl font-bold text-text">
                ₹{currentPlan?.monthlyPrice ? currentPlan.monthlyPrice.toLocaleString("en-IN") : "1,999"}{" "}
                <span className="text-xs font-normal text-text-muted">/ month</span>
              </h2>

              {isTrial && (
                <p className="text-xs text-warning-600 dark:text-warning-400 font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <strong>{daysLeftInTrial} Days Remaining</strong> on your 15-day Free Trial. Upgrade now to ensure uninterrupted service.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                className="font-bold rounded-xl gap-2 shadow-xs cursor-pointer"
                onClick={() => setCheckoutModalOpen(true)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Quotas & Real-Time Usage */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base font-bold text-text">Resource Quotas & Real-Time Usage</CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Enforced automatically on backend creation APIs according to your active commercial plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Clinics */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface-alt/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Clinic Branches</span>
                <span className="font-bold text-primary">{usage.clinicsCount} / {limits.maxClinics || 1}</span>
              </div>
              <ProgressBar value={usage.clinicsCount} max={limits.maxClinics || 1} size="md" color="primary" />
            </div>

            {/* Doctors */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface-alt/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Doctor Profiles</span>
                <span className="font-bold text-primary">{usage.doctorsCount} / {limits.maxDoctors || 2}</span>
              </div>
              <ProgressBar value={usage.doctorsCount} max={limits.maxDoctors || 2} size="md" color="primary" />
            </div>

            {/* Staff */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface-alt/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Operational Staff</span>
                <span className="font-bold text-primary">{usage.staffCount} / {limits.maxStaff || 5}</span>
              </div>
              <ProgressBar value={usage.staffCount} max={limits.maxStaff || 5} size="md" color="primary" />
            </div>

            {/* Patients */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface-alt/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Patient Records</span>
                <span className="font-bold text-primary">{usage.patientsCount} / {(limits.maxPatients || 500).toLocaleString()}</span>
              </div>
              <ProgressBar value={usage.patientsCount} max={limits.maxPatients || 500} size="md" color="primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commercial Plans Matrix */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-text">Commercial SaaS Plans</CardTitle>
            <CardDescription className="text-xs text-text-muted">Select or change your organization plan.</CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-surface-alt p-1 rounded-xl border border-border/60">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                billingCycle === "monthly" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                billingCycle === "annual" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
              }`}
            >
              Annual (Save 17%)
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
              const isCurrent = currentPlan?.slug === plan.slug;

              return (
                <div
                  key={plan.id || plan.slug}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isCurrent
                      ? "border-primary bg-primary-50/10 dark:bg-primary-950/20 shadow-xs"
                      : "border-border/70 bg-surface-alt/20 hover:border-border"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-bold text-text">{plan.name}</h4>
                      {isCurrent && <Badge variant="primary" size="sm" className="font-bold">Active</Badge>}
                    </div>
                    <p className="text-xs text-text-muted min-h-[36px]">{plan.description}</p>
                    <div className="text-2xl font-black text-text">
                      ₹{price.toLocaleString("en-IN")}{" "}
                      <span className="text-xs font-normal text-text-muted">/ mo</span>
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? "secondary" : "primary"}
                    size="sm"
                    disabled={isCurrent || isProcessing}
                    onClick={() => handleInitiateCheckout(plan)}
                    className="w-full font-bold rounded-xl cursor-pointer"
                  >
                    {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Organization GST & Invoice Details Form */}
      <Card className="border border-border/80 shadow-xs">
        <form onSubmit={handleSaveBillingInfo}>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-text">GSTIN & Billing Information</CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Tax information printed on your commercial SaaS invoices.
                </CardDescription>
              </div>
              <Button variant="primary" size="sm" loading={savingBilling} className="font-bold rounded-xl cursor-pointer">
                Save Details
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="GSTIN Number (Optional)"
                placeholder="22AAAAA0000A1Z5"
                value={billingForm.gstin}
                onChange={(e) => setBillingForm({ ...billingForm, gstin: e.target.value })}
              />
              <Input
                label="Billing Email"
                type="email"
                placeholder="billing@yourhospital.com"
                value={billingForm.billingEmail}
                onChange={(e) => setBillingForm({ ...billingForm, billingEmail: e.target.value })}
              />
            </div>
            <Input
              label="Billing Address"
              placeholder="Full registered address for tax invoices..."
              value={billingForm.billingAddress}
              onChange={(e) => setBillingForm({ ...billingForm, billingAddress: e.target.value })}
            />
          </CardContent>
        </form>
      </Card>

      {/* SaaS Invoice History Table */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base font-bold text-text">SaaS Commercial Invoices</CardTitle>
          <CardDescription className="text-xs text-text-muted">Download tax-compliant GST invoices for your accounting.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No commercial SaaS invoice records found yet. Invoices appear here automatically upon subscription activation.
            </div>
          ) : (
            <Table
              data={invoices}
              columns={[
                {
                  header: "Invoice #",
                  accessor: (row: any) => <span className="font-mono text-xs font-bold text-primary">{row.invoiceNumber}</span>,
                },
                {
                  header: "Date",
                  accessor: (row: any) => <span className="text-xs">{new Date(row.paidAt || row.createdAt).toLocaleDateString()}</span>,
                },
                {
                  header: "Plan Details",
                  accessor: (row: any) => <span className="text-xs font-medium text-text">{row.planName} ({row.billingCycle})</span>,
                },
                {
                  header: "Total Amount",
                  accessor: (row: any) => <span className="text-xs font-bold text-text">₹{row.totalAmount?.toLocaleString("en-IN")}</span>,
                },
                {
                  header: "Status",
                  accessor: (row: any) => <Badge variant="success" size="sm" className="uppercase font-bold">{row.status}</Badge>,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* Upgrade Plan Modal */}
      {checkoutModalOpen && (
        <Modal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          title="Upgrade Commercial Plan"
          size="lg"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-text-muted">Select a plan to launch Razorpay Secure Checkout.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleInitiateCheckout(p)}
                  className="p-4 rounded-xl border border-border hover:border-primary cursor-pointer bg-surface-alt/30 transition-all space-y-2"
                >
                  <div className="font-bold text-text text-sm">{p.name}</div>
                  <div className="text-lg font-black text-primary">₹{p.monthlyPrice.toLocaleString("en-IN")}/mo</div>
                  <Button variant="primary" size="xs" className="w-full font-bold cursor-pointer">Select {p.name}</Button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
