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
  cn,
} from "@/components/ui";
import { billingService, SaaSPlan } from "@/services/billing.service";
import { API_URL } from "@/lib/api";
import {
  RotateCw,
  Plus,
  Building2,
  CreditCard,
  Clock,
  Layers,
  ShieldCheck,
  Zap,
  Crown,
  Search,
  Edit3,
  CheckCircle2,
  CalendarPlus,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Stethoscope,
  Users,
  UserCheck,
  Sparkles,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function AdminBillingPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
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
    try {
      setIsRefreshing(true);
      const [plansData, subsData, rzpData] = await Promise.all([
        billingService.adminGetPlans(),
        billingService.adminGetSubscriptions(),
        billingService.adminGetRazorpayConfig(),
      ]);
      setPlans(plansData || []);
      setSubscriptions(subsData || []);
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
      setIsRefreshing(false);
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
      toast({
        title: "Validation Error",
        description: "Plan name and slug are required.",
        variant: "warning",
      });
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
        title: "Razorpay Dynamic Keys Saved",
        description: "Platform payment gateway credentials updated dynamically in MongoDB.",
        variant: "success",
      });
      loadAdminData();
    } catch (err: any) {
      toast({
        title: "Error Saving Config",
        description: err.response?.data?.message || "Failed to save dynamic keys.",
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
      <div className="py-20 text-center">
        <Spinner size="lg" label="Loading platform SaaS administration console..." />
      </div>
    );
  }

  const totalActiveSubs = subscriptions.filter((s) => s.status === "active").length;
  const totalTrialingOrgs = subscriptions.filter((s) => s.status === "trialing").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased pb-8 animate-fade-up">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Commercial Plans & Platform Subscriptions
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Root Super Admin
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Commercial plan tiers, resource limits, Razorpay platform gateway, and organization subscription overrides.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdminData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="font-semibold rounded-xl shadow-xs"
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
                  limits: {
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
                setPlanModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create SaaS Plan
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. PLATFORM KPI METRICS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Organizations"
          value={subscriptions.length.toString()}
          description="Registered tenant accounts"
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Active Subscriptions"
          value={totalActiveSubs.toString()}
          description="Paid active commercial plans"
          icon={<CreditCard className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Active Free Trials"
          value={totalTrialingOrgs.toString()}
          description="Organizations in trial period"
          icon={<Clock className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Configured Plans"
          value={plans.length.toString()}
          description="Live commercial tier plans"
          icon={<Layers className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. SEGMENTED TAB NAVIGATION & SEARCH
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("plans")}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
              activeTab === "plans"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Layers className={cn("w-3.5 h-3.5", activeTab === "plans" ? "text-primary-500" : "text-text-muted")} />
            <span>Commercial SaaS Plans</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
              {plans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subscriptions")}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
              activeTab === "subscriptions"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Building2 className={cn("w-3.5 h-3.5", activeTab === "subscriptions" ? "text-primary-500" : "text-text-muted")} />
            <span>Organization Subscriptions</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
              {subscriptions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("razorpay")}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
              activeTab === "razorpay"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <CreditCard className={cn("w-3.5 h-3.5", activeTab === "razorpay" ? "text-primary-500" : "text-text-muted")} />
            <span>Razorpay Platform Gateway</span>
          </button>
        </div>

        {activeTab === "subscriptions" && (
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-surface-alt border border-border/80 rounded-xl text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. TAB 1: COMMERCIAL SaaS PLANS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <Card
              key={plan.id || plan.slug}
              className="border border-border/80 shadow-xs hover:border-primary-500/40 transition-all flex flex-col justify-between overflow-hidden rounded-2xl bg-surface"
            >
              <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/30">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-base sm:text-lg font-bold text-text">{plan.name}</h3>
                  <Badge
                    variant={plan.status === "active" ? "success" : "neutral"}
                    size="sm"
                    dot
                    className="uppercase font-bold text-[10px]"
                  >
                    {plan.status}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 min-h-[32px]">{plan.description}</p>
                <div className="text-2xl sm:text-3xl font-bold text-text pt-2 tabular-nums">
                  ₹{plan.monthlyPrice?.toLocaleString("en-IN")}{" "}
                  <span className="text-xs text-text-muted font-normal">/ month</span>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Resource Quotas
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-border/80 bg-surface-alt">
                    <span className="text-text-muted text-[10px] block">Clinics</span>
                    <strong className="text-text font-bold text-xs sm:text-sm">
                      {plan.limits?.maxClinics} Branch{plan.limits?.maxClinics !== 1 ? "es" : ""}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/80 bg-surface-alt">
                    <span className="text-text-muted text-[10px] block">Doctors</span>
                    <strong className="text-text font-bold text-xs sm:text-sm">
                      {plan.limits?.maxDoctors} Doctor{plan.limits?.maxDoctors !== 1 ? "s" : ""}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/80 bg-surface-alt">
                    <span className="text-text-muted text-[10px] block">Staff</span>
                    <strong className="text-text font-bold text-xs sm:text-sm">
                      {plan.limits?.maxStaff} Staff
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border/80 bg-surface-alt">
                    <span className="text-text-muted text-[10px] block">Patients</span>
                    <strong className="text-text font-bold text-xs sm:text-sm">
                      {(plan.limits?.maxPatients || 500).toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
                  {plan.features?.analytics && (
                    <Badge variant="primary" size="sm" className="text-[10px]">
                      Analytics
                    </Badge>
                  )}
                  {plan.features?.auditLogs && (
                    <Badge variant="primary" size="sm" className="text-[10px]">
                      Audit Logs
                    </Badge>
                  )}
                  {plan.features?.aiFeatures && (
                    <Badge variant="primary" size="sm" className="text-[10px]">
                      Clinical AI
                    </Badge>
                  )}
                  {plan.features?.multiBranch && (
                    <Badge variant="primary" size="sm" className="text-[10px]">
                      Multi-Branch
                    </Badge>
                  )}
                </div>
              </CardContent>

              <CardFooter className="p-4 border-t border-border/60 bg-surface-alt/30">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full font-semibold rounded-xl"
                  onClick={() => {
                    setEditingPlan(plan);
                    setPlanModalOpen(true);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Edit Plan Configuration
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          5. TAB 2: ORGANIZATION SUBSCRIPTIONS TABLE
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <Table
            data={filteredSubs}
            loading={loading}
            emptyMessage="No organization subscriptions match the current search filter."
            columns={[
                  {
                    header: "Organization",
                    accessor: (row: any) => (
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs sm:text-sm text-text">
                          {row.organizationId?.name || "Unassigned"}
                        </div>
                        <div className="text-xs text-text-muted">{row.organizationId?.city || "General"}</div>
                      </div>
                    ),
                  },
                  {
                    header: "Active Plan",
                    accessor: (row: any) => (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-primary-600 dark:text-primary-400">
                          {row.planId?.name || "Starter Tier"}
                        </span>
                        <span className="text-[10px] text-text-muted block capitalize">
                          {row.billingCycle || "monthly"} cycle
                        </span>
                      </div>
                    ),
                  },
                  {
                    header: "Status",
                    accessor: (row: any) => (
                      <Badge
                        variant={row.status === "active" ? "success" : row.status === "trialing" ? "warning" : "danger"}
                        size="sm"
                        dot
                        className="uppercase font-bold text-[10px]"
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    header: "Trial / Period End",
                    accessor: (row: any) => (
                      <div className="flex items-center gap-1 text-xs text-text-muted">
                        <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span>
                          {new Date(row.currentPeriodEnd || row.trialEndsAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    ),
                  },
                  {
                    header: "Actions",
                    align: "right",
                    accessor: (row: any) => (
                      <div className="flex items-center justify-end gap-2">
                        {row.status !== "active" && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={async () => {
                              try {
                                await billingService.adminActivateSubscription(row.id);
                                toast({
                                  title: "Subscription Activated",
                                  description: `Organization '${row.organizationId?.name}' upgraded to Active Paid status.`,
                                  variant: "success",
                                });
                                loadAdminData();
                              } catch (err: any) {
                                toast({
                                  title: "Error",
                                  description: err.response?.data?.message || "Failed to activate subscription.",
                                  variant: "error",
                                });
                              }
                            }}
                            className="font-semibold rounded-lg shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Activate Paid
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setExtendingSubId(row.id)}
                          className="font-semibold rounded-lg"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 mr-1 text-text-muted" />
                          Extend Trial
                        </Button>
                      </div>
                    ),
                  },
              ]}
            />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          6. TAB 3: RAZORPAY PLATFORM GATEWAY CONFIGURATION
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "razorpay" && (
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <form onSubmit={handleSaveRazorpayConfig}>
            <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-text">
                  Razorpay Platform Payment Gateway
                </CardTitle>
                <CardDescription className="text-xs text-text-muted mt-0.5">
                  Configure your SaaS platform's merchant credentials for automated subscription checkouts and webhook events.
                </CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                loading={savingRazorpay}
                className="font-semibold rounded-xl shadow-xs shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Save Gateway Keys
              </Button>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Razorpay Key ID (RAZORPAY_KEY_ID)"
                  placeholder="rzp_live_xxxxxxxxxxxx"
                  value={razorpayConfig.keyId}
                  onChange={(e) => setRazorpayConfig({ ...razorpayConfig, keyId: e.target.value })}
                />
                <div>
                  <Input
                    label="Razorpay Key Secret (RAZORPAY_KEY_SECRET)"
                    type={showKeySecret ? "text" : "password"}
                    placeholder="Enter Razorpay Key Secret"
                    value={razorpayConfig.keySecret}
                    onChange={(e) => setRazorpayConfig({ ...razorpayConfig, keySecret: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer mt-1 inline-flex items-center gap-1"
                  >
                    {showKeySecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showKeySecret ? "Hide secret" : "Show secret"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Razorpay Webhook Secret (RAZORPAY_WEBHOOK_SECRET)"
                    type={showWebhookSecret ? "text" : "password"}
                    placeholder="Enter Webhook Secret"
                    value={razorpayConfig.webhookSecret}
                    onChange={(e) => setRazorpayConfig({ ...razorpayConfig, webhookSecret: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="text-[11px] font-semibold text-text-muted hover:text-text cursor-pointer mt-1 inline-flex items-center gap-1"
                  >
                    {showWebhookSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showWebhookSecret ? "Hide secret" : "Show secret"}
                  </button>
                </div>
                <Input
                  label="Registered Webhook Endpoint URL"
                  readOnly
                  value={razorpayConfig.webhookUrl}
                />
              </div>

              <div className="p-3.5 bg-primary-500/[0.04] border border-primary-500/20 rounded-2xl text-xs text-text-muted leading-relaxed flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-text font-semibold">Root Governance Notice:</strong> These credentials represent your SaaS platform payment merchant keys. All tenant customer subscriptions checkout through this primary platform gateway.
                </div>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          7. EXTEND TRIAL MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      {extendingSubId && (
        <Modal
          open={!!extendingSubId}
          onClose={() => setExtendingSubId(null)}
          title="Extend Free Trial Period"
          size="sm"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-text-muted">
              Grant additional free trial days to this organization before requiring paid checkout.
            </p>
            <Input
              label="Additional Trial Days"
              type="number"
              min={1}
              max={365}
              value={extraDays}
              onChange={(e) => setExtraDays(Number(e.target.value))}
            />
            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setExtendingSubId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingTrial}
                onClick={handleExtendTrial}
                className="font-semibold rounded-xl shadow-xs"
              >
                Confirm Extension
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          8. PLAN EDIT / CREATE MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      {planModalOpen && (
        <Modal
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          title={editingPlan.id ? "Edit SaaS Commercial Plan" : "Create New SaaS Plan"}
          size="lg"
        >
          <form onSubmit={handleSavePlan} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Plan Name *"
                value={editingPlan.name || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                placeholder="e.g. Professional Tier"
                required
              />
              <Input
                label="Slug Identifier *"
                value={editingPlan.slug || ""}
                onChange={(e) =>
                  setEditingPlan({ ...editingPlan, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
                placeholder="e.g. professional"
                required
              />
            </div>

            <Input
              label="Plan Summary & Value Proposition"
              value={editingPlan.description || ""}
              onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
              placeholder="e.g. Designed for growing multi-doctor practices and multi-branch clinics."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Input
                label="Monthly Price (INR) *"
                type="number"
                value={editingPlan.monthlyPrice || 0}
                onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                required
              />
              <Input
                label="Annual Price (INR) *"
                type="number"
                value={editingPlan.annualPrice || 0}
                onChange={(e) => setEditingPlan({ ...editingPlan, annualPrice: Number(e.target.value) })}
                required
              />
              <Input
                label="Default Trial Days"
                type="number"
                value={editingPlan.trialDays || 15}
                onChange={(e) => setEditingPlan({ ...editingPlan, trialDays: Number(e.target.value) })}
              />
            </div>

            <div className="border-t border-border/60 pt-3.5 space-y-2">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider">Resource Quota Limits</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Max Clinics"
                  type="number"
                  value={editingPlan.limits?.maxClinics || 1}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      limits: { ...editingPlan.limits!, maxClinics: Number(e.target.value) },
                    })
                  }
                />
                <Input
                  label="Max Doctors"
                  type="number"
                  value={editingPlan.limits?.maxDoctors || 2}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      limits: { ...editingPlan.limits!, maxDoctors: Number(e.target.value) },
                    })
                  }
                />
                <Input
                  label="Max Staff"
                  type="number"
                  value={editingPlan.limits?.maxStaff || 5}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      limits: { ...editingPlan.limits!, maxStaff: Number(e.target.value) },
                    })
                  }
                />
                <Input
                  label="Max Patients"
                  type="number"
                  value={editingPlan.limits?.maxPatients || 500}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      limits: { ...editingPlan.limits!, maxPatients: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>

            <div className="border-t border-border/60 pt-3.5 space-y-2">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider">Feature Flags</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-3 border border-border/80 rounded-xl bg-surface-alt">
                  <span className="font-semibold text-text">Advanced Analytics</span>
                  <Toggle
                    checked={editingPlan.features?.analytics || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, analytics: v } })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-border/80 rounded-xl bg-surface-alt">
                  <span className="font-semibold text-text">Audit Logging Trail</span>
                  <Toggle
                    checked={editingPlan.features?.auditLogs || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, auditLogs: v } })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-border/80 rounded-xl bg-surface-alt">
                  <span className="font-semibold text-text">Multi-Branch Support</span>
                  <Toggle
                    checked={editingPlan.features?.multiBranch || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, multiBranch: v } })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-border/80 rounded-xl bg-surface-alt">
                  <span className="font-semibold text-text">Clinical AI Features</span>
                  <Toggle
                    checked={editingPlan.features?.aiFeatures || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, aiFeatures: v } })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button type="button" variant="outline" size="sm" onClick={() => setPlanModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={savingPlan} className="font-semibold rounded-xl shadow-xs">
                Save Plan Configuration
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
