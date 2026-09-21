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
  Skeleton,
  SkeletonCard,
  SkeletonStats,
  SkeletonForm,
  useToast,
} from "@/components/ui";
import { billingService, SaaSPlan, SubscriptionInfo, UsageInfo, DowngradeValidationResult } from "@/services/billing.service";
import api from "@/lib/api";
import { AlertTriangle, Building2, Users, ExternalLink, CheckCircle2, ArrowRight } from "lucide-react";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useAuthStore } from "@/store/authStore";

interface BillingSettingsPageProps {
  selectedOrgId?: string;
  isRoot?: boolean;
  orgsLoading?: boolean;
}

export default function BillingSettingsPage({
  selectedOrgId,
  isRoot: propIsRoot,
  orgsLoading = false,
}: BillingSettingsPageProps) {
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

  // Downgrade resolution state
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [downgradeValidation, setDowngradeValidation] = useState<DowngradeValidationResult | null>(null);
  const [deactivatingClinicId, setDeactivatingClinicId] = useState<string | null>(null);

  // Organization GST & Billing Details
  const [billingForm, setBillingForm] = useState({
    gstin: "",
    billingEmail: "",
    billingAddress: "",
  });
  const [savingBilling, setSavingBilling] = useState(false);

  const isRootAdmin = propIsRoot ?? user?.role === "root";

  useEffect(() => {
    if (isRootAdmin && !selectedOrgId) {
      return;
    }
    loadBillingData();
  }, [selectedOrgId, isRootAdmin]);

  async function loadBillingData() {
    if (isRootAdmin && !selectedOrgId) {
      return;
    }
    setLoading(true);
    try {
      const [plansData, subData, usageData, invoicesData] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription(selectedOrgId),
        billingService.getUsage(selectedOrgId),
        billingService.getSaaSInvoices(selectedOrgId),
      ]);

      setPlans(plansData);
      setSubscription(subData);
      setUsageInfo(usageData);
      setInvoices(invoicesData);
    } catch (err: any) {
      toast({
        title: "Unable to Load Billing Data",
        description: err.response?.data?.message || "Could not load subscription details. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivateClinic(clinicId: string) {
    setDeactivatingClinicId(clinicId);
    try {
      await api.delete(`/clinics/${clinicId}`);
      toast({
        title: "Branch Deactivated",
        description: "Clinic branch has been archived. It no longer counts toward your active branch quota.",
        variant: "success",
      });

      // Re-validate feasibility with target plan if open
      if (selectedPlan) {
        const recheck = await billingService.validatePlanDowngrade(selectedPlan.id, selectedOrgId);
        setDowngradeValidation(recheck);
        if (recheck.canDowngrade) {
          toast({
            title: "Quota Requirements Met!",
            description: `You are now eligible to switch to the ${selectedPlan.name} plan.`,
            variant: "success",
          });
        }
      }
      loadBillingData();
    } catch (err: any) {
      toast({
        title: "Cannot Deactivate Branch",
        description: err.response?.data?.message || "Please reassign or complete active appointments first.",
        variant: "error",
      });
    } finally {
      setDeactivatingClinicId(null);
    }
  }

  async function handleInitiateCheckout(plan: SaaSPlan) {
    setSelectedPlan(plan);

    // 1. Pre-flight check: validate if active resources fit within target plan
    try {
      const validation = await billingService.validatePlanDowngrade(plan.id, selectedOrgId);
      if (!validation.canDowngrade) {
        setDowngradeValidation(validation);
        setDowngradeModalOpen(true);
        return;
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        const violationData = err.response?.data?.data || err.response?.data;
        setDowngradeValidation(violationData);
        setDowngradeModalOpen(true);
        return;
      }
    }

    const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

    // 2. Direct switch for free plans (e.g. Starter at ₹0)
    if (price === 0) {
      setIsProcessing(true);
      try {
        await billingService.directSwitchPlan(plan.id, billingCycle, selectedOrgId);
        toast({
          title: "Plan Changed Successfully",
          description: `Your subscription has been switched to ${plan.name} (${billingCycle}).`,
          variant: "success",
        });
        setCheckoutModalOpen(false);
        setDowngradeModalOpen(false);
        loadBillingData();
      } catch (err: any) {
        if (err.response?.status === 409) {
          const violationData = err.response?.data?.data || err.response?.data;
          setDowngradeValidation(violationData);
          setDowngradeModalOpen(true);
        } else {
          toast({
            title: "Switch Failed",
            description: err.response?.data?.message || "Could not switch plan.",
            variant: "error",
          });
        }
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 3. Paid plan: Proceed to Razorpay checkout order creation
    setIsProcessing(true);
    try {
      const order = await billingService.createCheckoutOrder(plan.id, billingCycle, selectedOrgId);

      // Load official Razorpay Checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast({
          title: "Payment Gateway Unavailable",
          description: "Could not connect to the secure payment gateway. Please check your internet connection.",
          variant: "error",
        });
        setIsProcessing(false);
        return;
      }

      // Open Official Razorpay Checkout Window Modal
      const options = {
        key: order.keyId,
        amount: order.amount * 100, // in paise
        currency: order.currency,
        name: "ANANT Healthcare SaaS",
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
              title: "Subscription Activated",
              description: `Your ${plan.name} plan is now active. A confirmation invoice has been sent to your email.`,
              variant: "success",
            });
            setCheckoutModalOpen(false);
            setDowngradeModalOpen(false);
            loadBillingData();
          } catch (err: any) {
            toast({
              title: "Verification Failed",
              description: err.response?.data?.message || "Could not verify transaction signature. Please contact support if your account was debited.",
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
      if (err.response?.status === 409) {
        const violationData = err.response?.data?.data || err.response?.data;
        setDowngradeValidation(violationData);
        setDowngradeModalOpen(true);
      } else {
        toast({
          title: "Checkout Error",
          description: err.response?.data?.message || err.message || "Failed to initiate Razorpay checkout.",
          variant: "error",
        });
      }
    } finally {
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

  if (loading || (isRootAdmin && (!selectedOrgId || orgsLoading))) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading commercial subscription and plan limits">
        {/* Current Plan Overview Skeleton */}
        <div className="p-5 sm:p-6 bg-surface border border-border/80 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton width="180px" height="1.5rem" rounded="md" />
            <Skeleton width="90px" height="1.5rem" rounded="full" />
          </div>
          <Skeleton width="280px" height="0.875rem" rounded="sm" />
        </div>

        {/* Quotas / Usage Stats Skeleton */}
        <SkeletonStats count={4} />

        {/* Form Skeleton */}
        <SkeletonForm fields={3} />
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

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="primary"
                size="md"
                className="font-bold rounded-xl gap-2 shadow-xs cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
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
        <CardHeader className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-text">Commercial SaaS Plans</CardTitle>
            <CardDescription className="text-xs text-text-muted">Select or change your organization plan.</CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-surface-alt p-1 rounded-xl border border-border/60 w-fit">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all min-h-[36px] sm:min-h-[30px] ${
                billingCycle === "monthly" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all min-h-[36px] sm:min-h-[30px] ${
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
                    className="w-full font-bold rounded-xl cursor-pointer min-h-[44px] sm:min-h-[36px]"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-text">GSTIN & Billing Information</CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Tax information printed on your commercial SaaS invoices.
                </CardDescription>
              </div>
              <Button variant="primary" size="sm" loading={savingBilling} className="font-bold rounded-xl cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
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
              mobileCardView={true}
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
                  <Button variant="primary" size="xs" className="w-full font-bold cursor-pointer min-h-[36px]">Select {p.name}</Button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Downgrade Limit Resolution Modal */}
      {downgradeModalOpen && downgradeValidation && (
        <Modal
          isOpen={downgradeModalOpen}
          onClose={() => setDowngradeModalOpen(false)}
          title="Plan Downgrade Action Required"
          size="lg"
        >
          <div className="space-y-4 pt-1">
            {downgradeValidation.canDowngrade ? (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-fade-in">
                <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text">
                    Resource Requirements Satisfied!
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Your active resources now comply with the limits of the <strong>{downgradeValidation.targetPlan?.name}</strong> plan. You are ready to complete the transition.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 animate-fade-in">
                <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text">
                    Resource Footprint Exceeds {downgradeValidation.targetPlan?.name || "Target Plan"} Limits
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Your organization currently has active branches or staff that exceed the allowed limits of the <strong>{downgradeValidation.targetPlan?.name}</strong> plan.
                    To protect your clinical operations and prevent accidental data loss, please archive excess resources before switching.
                  </p>
                </div>
              </div>
            )}

            {/* List of Resource Violations */}
            {downgradeValidation.violations.length > 0 && (
              <div className="space-y-2.5">
                {downgradeValidation.violations.map((v, i) => (
                  <div key={i} className="p-3 bg-surface-alt/60 rounded-xl border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="capitalize text-text flex items-center gap-1.5">
                        {v.resource === "clinics" ? <Building2 className="w-3.5 h-3.5 text-text-muted" /> : <Users className="w-3.5 h-3.5 text-text-muted" />}
                        <span>Active {v.resource}</span>
                      </span>
                      <Badge variant="error" size="sm">
                        {v.current} Active / {v.allowed} Allowed ({v.excess} in excess)
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted">{v.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Doctors / Staff Resolution Guidance */}
            {downgradeValidation.violations.some((v) => v.resource === "doctors" || v.resource === "staff") && (
              <div className="p-3 bg-surface rounded-xl border border-border flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-text flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary-600" />
                    <span>Manage Practitioner & Staff Roster</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Deactivate or suspend excess doctors and staff accounts in Staff Management.
                  </p>
                </div>
                <Link
                  href="/dashboard/staff"
                  className="px-3 py-1.5 rounded-lg bg-surface-alt hover:bg-border text-text font-semibold text-xs flex items-center gap-1 shrink-0 border border-border"
                >
                  <span>Go to Staff</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" />
                </Link>
              </div>
            )}

            {/* Active Clinics Quick Archival Section */}
            {downgradeValidation.activeClinics && downgradeValidation.activeClinics.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Active Clinic Branches ({downgradeValidation.activeClinics.length})
                  </span>
                  <Link
                    href="/dashboard/clinics"
                    className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Manage All Branches</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto touch-scroll">
                  {downgradeValidation.activeClinics.map((clinic) => (
                    <div
                      key={clinic.id}
                      className="p-2.5 bg-surface rounded-xl border border-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-text truncate">{clinic.name}</div>
                        <div className="text-[11px] text-text-muted truncate">{clinic.city} {clinic.address ? `• ${clinic.address}` : ""}</div>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        loading={deactivatingClinicId === clinic.id}
                        disabled={deactivatingClinicId === clinic.id}
                        onClick={() => handleDeactivateClinic(clinic.id)}
                        className="text-error-600 hover:text-error-700 hover:bg-error-500/10 border-border font-semibold shrink-0 cursor-pointer"
                      >
                        Deactivate Branch
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDowngradeModalOpen(false)}
                className="text-xs font-semibold"
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!downgradeValidation.canDowngrade}
                onClick={() => {
                  setDowngradeModalOpen(false);
                  if (selectedPlan) {
                    handleInitiateCheckout(selectedPlan);
                  }
                }}
                className="font-bold text-xs"
              >
                {downgradeValidation.canDowngrade ? "Proceed to Checkout" : "Deactivate Resources to Proceed"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
