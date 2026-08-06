"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  Button,
  Input,
  Select,
  Badge,
  Table,
  Modal,
  Toggle,
  Spinner,
  useToast,
} from "@/components/ui";
import { billingService, SaaSPlan } from "@/services/billing.service";
import { API_URL } from "@/lib/api";

export default function AdminBillingPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"plans" | "subscriptions" | "razorpay">("plans");

  // Extend Trial Modal state
  const [extendingSubId, setExtendingSubId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState(15);
  const [savingTrial, setSavingTrial] = useState(false);

  // Razorpay Gateway Config Form (Root Admin Only)
  const [razorpayConfig, setRazorpayConfig] = useState({
    keyId: "",
    keySecret: "",
    webhookSecret: "",
    webhookUrl: `${API_URL}/billing/webhook`,
  });
  const [savingRazorpay, setSavingRazorpay] = useState(false);

  // Plan Edit / Create Modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SaaSPlan>>({
    name: "",
    slug: "",
    description: "",
    monthlyPrice: 1999,
    annualPrice: 19990,
    trialDays: 15,
    status: "active",
    isPopular: false,
    limits: {
      maxHospitals: 1,
      maxClinics: 1,
      maxDoctors: 2,
      maxStaff: 5,
      maxPatients: 500,
      maxAppointments: 1000,
      maxStorageMB: 2048,
    },
    features: {
      analytics: true,
      auditLogs: false,
      multiBranch: false,
      dataExport: false,
      apiAccess: false,
      aiFeatures: false,
    },
  });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [plansData, subsData, rzpData] = await Promise.all([
        billingService.adminGetPlans(),
        billingService.adminGetSubscriptions(),
        billingService.adminGetRazorpayConfig(),
      ]);
      setPlans(plansData);
      setSubscriptions(subsData);
      if (rzpData) {
        setRazorpayConfig({
          keyId: rzpData.keyId || "",
          keySecret: rzpData.keySecret || "",
          webhookSecret: rzpData.webhookSecret || "",
          webhookUrl: `${API_URL}/billing/webhook`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Error Loading Admin Data",
        description: err.response?.data?.message || "Failed to load SaaS admin records.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleExtendTrial() {
    if (!extendingSubId) return;
    setSavingTrial(true);
    try {
      await billingService.adminExtendTrial(extendingSubId, extraDays);
      toast({
        title: "Trial Extended",
        description: `Trial extended by ${extraDays} days successfully.`,
        variant: "success",
      });
      setExtendingSubId(null);
      loadAdminData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to extend trial.",
        variant: "error",
      });
    } finally {
      setSavingTrial(false);
    }
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan.name || !editingPlan.slug) {
      toast({ title: "Validation Error", description: "Plan name and slug are required.", variant: "warning" });
      return;
    }

    setSavingPlan(true);
    try {
      await billingService.adminUpsertPlan(editingPlan);
      toast({
        title: "Plan Saved",
        description: `Plan '${editingPlan.name}' has been saved successfully.`,
        variant: "success",
      });
      setPlanModalOpen(false);
      loadAdminData();
    } catch (err: any) {
      toast({
        title: "Failed to Save Plan",
        description: err.response?.data?.message || "Failed to save plan.",
        variant: "error",
      });
    } finally {
      setSavingPlan(false);
    }
  }

  const handleSaveRazorpayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRazorpay(true);
    try {
      await billingService.adminSaveRazorpayConfig({
        keyId: razorpayConfig.keyId,
        keySecret: razorpayConfig.keySecret,
        webhookSecret: razorpayConfig.webhookSecret,
      });
      toast({
        title: "Razorpay Dynamic Keys Saved to MongoDB 💳",
        description: "Platform payment merchant credentials updated dynamically in MongoDB!",
        variant: "success",
      });
      loadAdminData();
    } catch (err: any) {
      toast({
        title: "Error Saving Config",
        description: err.response?.data?.message || "Failed to save dynamic keys to MongoDB.",
        variant: "error",
      });
    } finally {
      setSavingRazorpay(false);
    }
  };

  const filteredSubs = subscriptions.filter((s) => {
    const orgName = s.organizationId?.name || "";
    return orgName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Spinner size="lg" label="Loading platform SaaS administration console..." />
      </div>
    );
  }

  const totalActiveSubs = subscriptions.filter((s) => s.status === "active").length;
  const totalTrialingOrgs = subscriptions.filter((s) => s.status === "trialing").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased pb-8 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            Root Super-Admin Commercial Console
          </h1>
          <p className="text-xs text-text-muted mt-1 max-w-2xl leading-relaxed">
            Platform governance: Configure commercial plans, set limits, manage Razorpay merchant credentials, and override organization subscriptions.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="font-bold rounded-xl gap-2 cursor-pointer shrink-0 shadow-xs"
          onClick={() => {
            setEditingPlan({
              name: "",
              slug: "",
              description: "",
              monthlyPrice: 1999,
              annualPrice: 19990,
              trialDays: 15,
              status: "active",
              isPopular: false,
              limits: { maxHospitals: 1, maxClinics: 1, maxDoctors: 2, maxStaff: 5, maxPatients: 500, maxAppointments: 1000, maxStorageMB: 2048 },
              features: { analytics: true, auditLogs: false, multiBranch: false, dataExport: false, apiAccess: false, aiFeatures: false },
            });
            setPlanModalOpen(true);
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create New SaaS Plan
        </Button>
      </div>

      {/* Global SaaS Platform Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Organizations"
          value={subscriptions.length}
          trend="up"
          change={{ value: "+12%", positive: true }}
          icon={
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          label="Active Paid Subscriptions"
          value={totalActiveSubs}
          trend="up"
          change={{ value: "+8%", positive: true }}
          icon={
            <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Active Free Trials"
          value={totalTrialingOrgs}
          trend="neutral"
          icon={
            <svg className="w-5 h-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Configured SaaS Plans"
          value={plans.length}
          icon={
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Pill Tab Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface p-1.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("plans")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "plans" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Commercial SaaS Plans ({plans.length})
          </button>

          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "subscriptions" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Organization Subscriptions ({subscriptions.length})
          </button>

          <button
            onClick={() => setActiveTab("razorpay")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "razorpay" ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Razorpay Platform Gateway
          </button>
        </div>

        {activeTab === "subscriptions" && (
          <div className="w-full sm:w-64">
            <Input
              placeholder="Filter by organization name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>
        )}
      </div>

      {/* ─── PLANS TAB (COMMERCIAL SaaS PLANS GRID) ─────────────────── */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id || plan.slug}
              className="border border-border/80 shadow-xs hover:border-primary-500/50 transition-all flex flex-col justify-between overflow-hidden"
            >
              <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/20">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-lg font-bold text-text">{plan.name}</h3>
                  <Badge variant={plan.status === "active" ? "success" : "neutral"} size="sm" className="uppercase font-bold">
                    {plan.status}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 min-h-[32px]">{plan.description}</p>
                <div className="text-3xl font-black text-text pt-2">
                  ₹{plan.monthlyPrice?.toLocaleString("en-IN")} <span className="text-xs text-text-muted font-normal">/ month</span>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-3.5">
                <div className="text-xs font-bold text-text uppercase tracking-wider text-[11px] text-text-muted">
                  Resource Quota Limits
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-border/60 bg-surface-alt/40">
                    <span className="text-text-muted text-[11px] block">Max Clinics</span>
                    <strong className="text-text font-bold text-sm">{plan.limits?.maxClinics} Branch(es)</strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/60 bg-surface-alt/40">
                    <span className="text-text-muted text-[11px] block">Max Doctors</span>
                    <strong className="text-text font-bold text-sm">{plan.limits?.maxDoctors} Doctor(s)</strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/60 bg-surface-alt/40">
                    <span className="text-text-muted text-[11px] block">Max Staff</span>
                    <strong className="text-text font-bold text-sm">{plan.limits?.maxStaff} Staff</strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/60 bg-surface-alt/40">
                    <span className="text-text-muted text-[11px] block">Max Patients</span>
                    <strong className="text-text font-bold text-sm">{(plan.limits?.maxPatients || 500).toLocaleString()}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
                  {plan.features?.analytics && <Badge variant="primary" size="sm">Analytics</Badge>}
                  {plan.features?.auditLogs && <Badge variant="primary" size="sm">Audit Logs</Badge>}
                  {plan.features?.aiFeatures && <Badge variant="primary" size="sm">Clinical AI</Badge>}
                  {plan.features?.multiBranch && <Badge variant="primary" size="sm">Multi-Branch</Badge>}
                </div>
              </CardContent>

              <CardFooter className="p-4 border-t border-border/60 bg-surface-alt/20">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full font-bold rounded-xl gap-2 cursor-pointer"
                  onClick={() => {
                    setEditingPlan(plan);
                    setPlanModalOpen(true);
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Plan Configuration
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ─── SUBSCRIPTIONS TAB (ORGANIZATION SUBSCRIPTION TABLE) ─────── */}
      {activeTab === "subscriptions" && (
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-0">
            {filteredSubs.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">No organization subscriptions found.</div>
            ) : (
              <Table
                data={filteredSubs}
                columns={[
                  {
                    header: "Organization",
                    accessor: (row: any) => (
                      <div>
                        <div className="font-bold text-xs text-text">{row.organizationId?.name || "N/A"}</div>
                        <div className="text-[11px] text-text-muted">{row.organizationId?.city || ""}</div>
                      </div>
                    ),
                  },
                  {
                    header: "Active Plan",
                    accessor: (row: any) => (
                      <div>
                        <span className="font-semibold text-xs text-primary">{row.planId?.name || "Starter"}</span>
                        <span className="text-[11px] text-text-muted block capitalize">{row.billingCycle}</span>
                      </div>
                    ),
                  },
                  {
                    header: "Status",
                    accessor: (row: any) => (
                      <Badge
                        variant={row.status === "active" ? "success" : row.status === "trialing" ? "warning" : "danger"}
                        size="sm"
                        className="uppercase font-bold"
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    header: "Trial / Period End",
                    accessor: (row: any) => (
                      <span className="text-xs text-text-muted">
                        {new Date(row.currentPeriodEnd || row.trialEndsAt).toLocaleDateString()}
                      </span>
                    ),
                  },
                  {
                    header: "Actions",
                    accessor: (row: any) => (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => setExtendingSubId(row.id)}
                        className="font-bold rounded-lg cursor-pointer"
                      >
                        Extend Trial
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── RAZORPAY PLATFORM GATEWAY CONFIGURATION TAB ────────────── */}
      {activeTab === "razorpay" && (
        <Card className="border border-border/80 shadow-xs">
          <form onSubmit={handleSaveRazorpayConfig}>
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-text">Razorpay Platform Payment Gateway Credentials</CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Configure your SaaS platform's Razorpay credentials used to process commercial subscription payments and webhooks.
                  </CardDescription>
                </div>
                <Button variant="primary" size="sm" loading={savingRazorpay} className="font-bold rounded-xl cursor-pointer">
                  Save Gateway Credentials
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Razorpay Key ID (RAZORPAY_KEY_ID)"
                  placeholder="rzp_live_xxxxxxxxxxxx"
                  value={razorpayConfig.keyId}
                  onChange={(e) => setRazorpayConfig({ ...razorpayConfig, keyId: e.target.value })}
                />
                <Input
                  label="Razorpay Key Secret (RAZORPAY_KEY_SECRET)"
                  type="password"
                  placeholder="Enter Razorpay Key Secret"
                  value={razorpayConfig.keySecret}
                  onChange={(e) => setRazorpayConfig({ ...razorpayConfig, keySecret: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Razorpay Webhook Secret (RAZORPAY_WEBHOOK_SECRET)"
                  placeholder="Enter Webhook Secret"
                  value={razorpayConfig.webhookSecret}
                  onChange={(e) => setRazorpayConfig({ ...razorpayConfig, webhookSecret: e.target.value })}
                />
                <Input
                  label="Registered Webhook Endpoint URL"
                  readOnly
                  value={razorpayConfig.webhookUrl}
                />
              </div>

              <div className="p-3 bg-surface-alt/40 border border-border/60 rounded-xl text-xs text-text-muted leading-relaxed">
                ℹ️ <strong>Root Super-Admin Note:</strong> These credentials represent your platform payment merchant keys. Customer organizations paying for subscriptions checkout through this platform gateway.
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Extend Trial Modal */}
      {extendingSubId && (
        <Modal isOpen={!!extendingSubId} onClose={() => setExtendingSubId(null)} title="Extend Free Trial Period" size="sm">
          <div className="space-y-4 pt-2">
            <p className="text-xs text-text-muted">Enter additional free trial days to grant to this organization.</p>
            <Input
              label="Additional Days"
              type="number"
              value={extraDays}
              onChange={(e) => setExtraDays(Number(e.target.value))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setExtendingSubId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={savingTrial} onClick={handleExtendTrial}>Confirm Extension</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Plan Edit / Create Modal */}
      {planModalOpen && (
        <Modal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} title={editingPlan.id ? "Edit SaaS Plan" : "Create SaaS Plan"} size="lg">
          <form onSubmit={handleSavePlan} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Plan Name *"
                value={editingPlan.name || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                placeholder="e.g. Starter"
              />
              <Input
                label="Slug *"
                value={editingPlan.slug || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                placeholder="e.g. starter"
              />
            </div>

            <Input
              label="Description"
              value={editingPlan.description || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Monthly Price (INR) *"
                type="number"
                value={editingPlan.monthlyPrice || 0}
                onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
              />
              <Input
                label="Annual Price (INR) *"
                type="number"
                value={editingPlan.annualPrice || 0}
                onChange={(e) => setEditingPlan({ ...editingPlan, annualPrice: Number(e.target.value) })}
              />
              <Input
                label="Trial Days"
                type="number"
                value={editingPlan.trialDays || 15}
                onChange={(e) => setEditingPlan({ ...editingPlan, trialDays: Number(e.target.value) })}
              />
            </div>

            <div className="border-t border-border/60 pt-3">
              <h4 className="text-xs font-bold text-text mb-2">Resource Quota Limits</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Max Clinics"
                  type="number"
                  value={editingPlan.limits?.maxClinics || 1}
                  onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxClinics: Number(e.target.value) } })}
                />
                <Input
                  label="Max Doctors"
                  type="number"
                  value={editingPlan.limits?.maxDoctors || 2}
                  onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxDoctors: Number(e.target.value) } })}
                />
                <Input
                  label="Max Staff"
                  type="number"
                  value={editingPlan.limits?.maxStaff || 5}
                  onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxStaff: Number(e.target.value) } })}
                />
                <Input
                  label="Max Patients"
                  type="number"
                  value={editingPlan.limits?.maxPatients || 500}
                  onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxPatients: Number(e.target.value) } })}
                />
              </div>
            </div>

            <div className="border-t border-border/60 pt-3">
              <h4 className="text-xs font-bold text-text mb-2">Feature Flags</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2 border border-border/60 rounded-xl">
                  <span>Advanced Analytics</span>
                  <Toggle
                    checked={editingPlan.features?.analytics || false}
                    onChange={(v) => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, analytics: v } })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border border-border/60 rounded-xl">
                  <span>Audit Logs</span>
                  <Toggle
                    checked={editingPlan.features?.auditLogs || false}
                    onChange={(v) => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, auditLogs: v } })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border border-border/60 rounded-xl">
                  <span>Multi-Branch Support</span>
                  <Toggle
                    checked={editingPlan.features?.multiBranch || false}
                    onChange={(v) => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, multiBranch: v } })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border border-border/60 rounded-xl">
                  <span>Clinical AI Features</span>
                  <Toggle
                    checked={editingPlan.features?.aiFeatures || false}
                    onChange={(v) => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, aiFeatures: v } })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="secondary" size="sm" onClick={() => setPlanModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={savingPlan} type="submit">Save Plan</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
