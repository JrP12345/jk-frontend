"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Alert, Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge, Table, Tabs, Modal, Toggle, EmptyState, useToast, Skeleton } from "@/components/ui";
import { billingService, SaaSPlan } from "@/services/billing.service";
import { API_URL } from "@/lib/api";
import { RotateCw, Plus, Building2, CreditCard, Layers, Search, Edit3, CheckCircle2, CalendarPlus, KeyRound, Eye, EyeOff, Shield } from "lucide-react";

import styles from "./AdminBilling.module.css";

export default function AdminBillingPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [paymentReviews, setPaymentReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"plans" | "subscriptions" | "razorpay">("plans");

  // Extend Trial Modal state
  const [extendingSubId, setExtendingSubId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState(15);
  const [savingTrial, setSavingTrial] = useState(false);
  const [manualGrantSub, setManualGrantSub] = useState<any | null>(null);
  const [manualGrantReason, setManualGrantReason] = useState("");
  const [savingManualGrant, setSavingManualGrant] = useState(false);

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
      maxLocations: 1,
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

  const loadAdminData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setLoadError("");
      const [plansData, subsData, rzpData, reviewsData] = await Promise.all([
        billingService.adminGetPlans(),
        billingService.adminGetSubscriptions(),
        billingService.adminGetRazorpayConfig(),
        billingService.adminGetPaymentReviews(),
      ]);
      setPlans(plansData || []);
      setSubscriptions(subsData || []);
      setPaymentReviews(reviewsData || []);
      if (rzpData) {
        setRazorpayConfig({
          keyId: rzpData.keyId || "",
          keySecret: rzpData.keySecret || "",
          webhookSecret: rzpData.webhookSecret || "",
          webhookUrl: `${API_URL}/billing/webhook`,
        });
      }
    } catch (err: any) {
      setLoadError(err.response?.data?.message || "Plans and subscriptions could not be loaded. Retry.");
      toast({
        title: "Error Loading Admin Data",
        description: err.response?.data?.message || "Plans and subscriptions could not be loaded.",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAdminData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

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

  if (loading) return <div className={styles.workspace} role="status" aria-label="Loading platform billing" aria-busy="true"><Skeleton height="4rem" /><Skeleton height="7rem" /><Skeleton height="3.5rem" /><div className={styles.planGrid}>{[0, 1, 2].map(item => <Skeleton key={item} height="20rem" />)}</div></div>;

  const totalActiveSubs = subscriptions.filter((s) => s.status === "active").length;
  const totalTrialingOrgs = subscriptions.filter((s) => s.status === "trialing").length;

  return (
    <div className={styles.workspace}>
      <header className={styles.header}><h1>Plans &amp; subscriptions</h1><div className={styles.headerActions}><Button variant="outline" className={styles.iconAction} aria-label="Refresh platform billing" title="Refresh platform billing" onClick={loadAdminData} loading={isRefreshing}><RotateCw className="h-4 w-4" /></Button><Button className={styles.createAction} aria-label="Create plan" title="Create plan" disabled={!!loadError} onClick={() => {
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
                    maxLocations: 1,
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
              }}><Plus className="h-4 w-4" /><span className={styles.createLabel}>Create plan</span></Button></div><p>Manage plan prices, usage limits and organization subscriptions.</p></header>
      <dl className={styles.summary} aria-label="Platform billing summary">
        {[{ label: "Organizations", value: subscriptions.length }, { label: "Active subscriptions", value: totalActiveSubs }, { label: "Free trials", value: totalTrialingOrgs }, { label: "Configured plans", value: plans.length }].map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{loadError ? <span aria-label="Unavailable">—</span> : metric.value}</dd></div>)}
      </dl>
      <nav aria-label="Billing sections"><Tabs className={styles.tabs} variant="pills" activeTab={activeTab} scrollActiveIntoView={false} onChange={id => { if (id === "plans" || id === "subscriptions" || id === "razorpay") setActiveTab(id); }} tabs={[{ id: "plans", label: "Plans", icon: <Layers /> }, { id: "subscriptions", label: "Subscriptions", icon: <Building2 /> }, { id: "razorpay", label: "Gateway", icon: <CreditCard /> }]} /></nav>
      {loadError && <Alert variant="error" title="Platform billing unavailable" action={<Button variant="outline" onClick={loadAdminData} loading={isRefreshing}>Retry billing</Button>}>{loadError}</Alert>}
      {!loadError && activeTab === "plans" && <section aria-label="Configured plans" className={styles.planGrid}>
        {!plans.length && <EmptyState icon={<Layers />} title="No plans configured yet" description="Create a subscription plan to set its price, limits and features." />}
        {plans.map(plan => <Card key={plan.id || plan.slug} contentClassName="gap-4">
          <div><div className={styles.planTitle}><h2>{plan.name}</h2><Badge variant={plan.status === "active" ? "success" : "neutral"} size="sm" dot>{plan.status}</Badge></div><p className={`${styles.meta} ${styles.planDescription}`}>{plan.description}</p><p className="mt-3 text-2xl font-semibold tabular-nums">₹{plan.monthlyPrice?.toLocaleString("en-IN")} <span className="text-xs font-normal text-text-secondary">/ month</span></p></div>
          <div className="border-t border-border pt-4"><h3 className="mb-3 text-xs font-medium text-text-secondary">Resource limits</h3><dl className={styles.quotaGrid}><div><dt>Locations</dt><dd>{plan.limits?.maxLocations} {plan.limits?.maxLocations === 1 ? "branch" : "branches"}</dd></div><div><dt>Doctors</dt><dd>{plan.limits?.maxDoctors}</dd></div><div><dt>Staff</dt><dd>{plan.limits?.maxStaff}</dd></div><div><dt>Patients</dt><dd>{(plan.limits?.maxPatients || 500).toLocaleString("en-IN")}</dd></div></dl></div>
          <div className="flex flex-wrap gap-1.5">{plan.features?.analytics && <Badge variant="primary" size="sm">Analytics</Badge>}{plan.features?.auditLogs && <Badge variant="primary" size="sm">Audit logs</Badge>}{plan.features?.aiFeatures && <Badge variant="primary" size="sm">Clinical AI</Badge>}{plan.features?.multiBranch && <Badge variant="primary" size="sm">Multi-branch</Badge>}</div>
          <div className={styles.planFooter}><Button variant="outline" size="sm" aria-label={`Edit plan: ${plan.name}`} onClick={() => { setEditingPlan(plan); setPlanModalOpen(true); }}><Edit3 className="h-4 w-4" />Edit plan</Button></div>
        </Card>)}
      </section>}

      {!loadError && activeTab === "subscriptions" && <div className={styles.content}>
        {paymentReviews.length > 0 && <Card className="border-warning/40 bg-warning/10"><h2 className="text-sm font-semibold">Captured payments requiring review ({paymentReviews.length})</h2><div className="mt-3 space-y-3">{paymentReviews.map(payment => <div key={payment._id} className={styles.review}><strong>{payment.organizationId?.name || "Organization unavailable"}</strong><p>{payment.planId?.name || "Plan unavailable"} / ₹{payment.amount?.toLocaleString("en-IN")}</p><p className="font-mono text-xs">Order {payment.razorpayOrderId}<br />Payment {payment.razorpayPaymentId}</p><p className="text-xs text-text-secondary">Review the existing entitlement and invoice before a manual grant or refund.</p></div>)}</div></Card>}
        <section aria-label="Organization subscriptions" className={styles.panel}><div className={styles.toolbar}><Input icon={<Search />} type="search" placeholder="Search organization subscriptions" aria-label="Search organization subscriptions" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /></div>
          <Table className={styles.responsiveTable} data={filteredSubs} searchable={false} showColumnVisibility={false} fitContent caption="Organization subscriptions" emptyMessage="No organization subscriptions match the current search filter." columns={[
            { header: "Organization", accessor: (row: any) => <div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-sm font-semibold">{row.organizationId?.name || "Unassigned"}</p><p className={styles.meta}>{row.organizationId?.city || "General"}</p></div> },
            { header: "Plan", accessor: (row: any) => <div><p className="text-sm font-medium text-accent">{row.planId?.name || "Starter Tier"}</p><p className={styles.meta}><span className="capitalize">{row.billingCycle || "monthly"}</span> cycle</p></div> },
            { header: "Status & period end", accessor: (row: any) => <div><Badge variant={row.status === "active" ? "success" : row.status === "trialing" ? "warning" : "error"} size="sm" dot>{row.status}</Badge><p className={styles.meta}>{new Date(row.currentPeriodEnd || row.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p></div> },
            { header: "Actions", align: "right", accessor: (row: any) => <div className={styles.actions}>{row.status !== "active" && <Button variant="primary" size="sm" onClick={() => { setManualGrantSub(row); setManualGrantReason(""); }}><CheckCircle2 className="h-4 w-4 shrink-0" />Grant access</Button>}<Button variant="outline" size="sm" onClick={() => setExtendingSubId(row.id)}><CalendarPlus className="h-4 w-4 shrink-0" />Extend Trial</Button></div> },
          ]} renderMobileCard={(row: any) => <article className={styles.subscriptionCard} aria-label={`Subscription for ${row.organizationId?.name || "Unassigned"}`}><div><h3>{row.organizationId?.name || "Unassigned"}</h3><p className={styles.meta}>{row.organizationId?.city || "General"}</p></div><dl className={styles.subscriptionFacts}><div><dt>Plan</dt><dd>{row.planId?.name || "Starter Tier"}<span className="block mt-1 text-xs capitalize text-text-secondary">{row.billingCycle || "monthly"} cycle</span></dd></div><div><dt>Status</dt><dd><Badge variant={row.status === "active" ? "success" : row.status === "trialing" ? "warning" : "error"} size="sm" dot>{row.status}</Badge></dd></div><div className="col-span-2"><dt>Trial / period end</dt><dd>{new Date(row.currentPeriodEnd || row.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd></div></dl><div className={styles.actions}>{row.status !== "active" && <Button variant="primary" size="sm" onClick={() => { setManualGrantSub(row); setManualGrantReason(""); }}><CheckCircle2 className="h-4 w-4 shrink-0" />Grant access</Button>}<Button variant="outline" size="sm" onClick={() => setExtendingSubId(row.id)}><CalendarPlus className="h-4 w-4 shrink-0" />Extend Trial</Button></div></article>} />
        </section>
      </div>}

      {!loadError && activeTab === "razorpay" && (
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <form onSubmit={handleSaveRazorpayConfig}>
            <CardHeader className={styles.gatewayHeading}>
              <div>
                <CardTitle as="h2" className="text-base font-semibold text-text">
                  Razorpay Platform Payment Gateway
                </CardTitle>
                <CardDescription className="text-xs text-text-muted mt-0.5">
                  Configure payment credentials for subscription checkout and payment updates.
                </CardDescription>
              </div>

            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className={styles.formGrid}>
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
                    aria-label={showKeySecret ? "Hide Razorpay key secret" : "Show Razorpay key secret"}
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className={styles.secretAction}
                  >
                    {showKeySecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showKeySecret ? "Hide secret" : "Show secret"}
                  </button>
                </div>
              </div>

              <div className={styles.formGrid}>
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
                    aria-label={showWebhookSecret ? "Hide webhook secret" : "Show webhook secret"}
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className={styles.secretAction}
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
                <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <strong className="text-text font-semibold">Platform payment account:</strong> Subscription payments for all organizations use these credentials. Update them only when changing the payment account.
                </div>
              </div>
            <div className={styles.formActions}><Button type="submit" variant="primary" loading={savingRazorpay}><KeyRound className="h-4 w-4" />Save Gateway Keys</Button></div>
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
            <div className={`${styles.formActions} pt-3 border-t border-border/60`}>
              <Button variant="outline" size="sm" onClick={() => setExtendingSubId(null)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingTrial}
                onClick={handleExtendTrial}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold"
              >
                Confirm Extension
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={!!manualGrantSub} onClose={() => setManualGrantSub(null)} title="Grant manual subscription access" size="sm">
        <div className="space-y-4 pt-1">
          <p className="text-sm text-text-secondary">Grant {manualGrantSub?.organizationId?.name} access to {manualGrantSub?.planId?.name}. This is a Root override and does not record a payment.</p>
          <Input label="Reason for manual grant" value={manualGrantReason} onChange={(event) => setManualGrantReason(event.target.value)} placeholder="Describe the approved exception" minLength={10} />
          <div className={styles.formActions}>
            <Button variant="outline" onClick={() => setManualGrantSub(null)}>Cancel</Button>
            <Button disabled={manualGrantReason.trim().length < 10 || !manualGrantSub?.planId?.slug} loading={savingManualGrant} onClick={async () => {
              if (!manualGrantSub?.planId?.slug) return;
              setSavingManualGrant(true);
              try {
                await billingService.adminActivateSubscription(manualGrantSub.id, manualGrantSub.planId.slug, manualGrantSub.billingCycle || "monthly", manualGrantReason.trim());
                toast({ title: "Access granted", description: "The manual entitlement is active and attributed to this Root account.", variant: "success" });
                setManualGrantSub(null);
                loadAdminData();
              } catch (err: any) {
                toast({ title: "Grant failed", description: err.response?.data?.message || "Could not grant subscription access.", variant: "error" });
              } finally { setSavingManualGrant(false); }
            }}>Grant access</Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. PLAN EDIT / CREATE MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      {planModalOpen && (
        <Modal
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          title={editingPlan.id ? "Edit plan" : "Create plan"}
          size="xl"
        >
          <form onSubmit={handleSavePlan} className="space-y-4 pt-1">
            <div className={styles.formGrid}>
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
              placeholder="e.g. Designed for growing multi-doctor practices and multi-branch locations."
            />

            <div className={styles.formGrid}>
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
              <Toggle
                label="Publish independent pharmacy signup"
                description="Offers this configured product plan as a one-branch pharmacy trial. Review INR pricing, limits and trial duration before publishing."
                checked={editingPlan.selfServicePharmacy === true}
                disabled={editingPlan.commercialFamily !== "location_products"}
                onChange={(checked) => setEditingPlan({ ...editingPlan, selfServicePharmacy: checked })}
              />
            </div>

            <div className="border-t border-border/60 pt-3.5 space-y-2">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider">Resource Quota Limits</h4>
              <div className={styles.limitFields}>
                <Input
                  label="Max Locations"
                  type="number"
                  value={editingPlan.limits?.maxLocations || 1}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      limits: { ...editingPlan.limits!, maxLocations: Number(e.target.value) },
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
              <div className={styles.formGrid}>
                <div className={styles.featureRow}>
                  <label htmlFor="plan-feature-analytics" className="font-semibold text-sm text-text">Advanced Analytics</label>
                  <Toggle
                    id="plan-feature-analytics"
                    checked={editingPlan.features?.analytics || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, analytics: v } })
                    }
                  />
                </div>
                <div className={styles.featureRow}>
                  <label htmlFor="plan-feature-auditLogs" className="font-semibold text-sm text-text">Audit Logging Trail</label>
                  <Toggle
                    id="plan-feature-auditLogs"
                    checked={editingPlan.features?.auditLogs || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, auditLogs: v } })
                    }
                  />
                </div>
                <div className={styles.featureRow}>
                  <label htmlFor="plan-feature-multiBranch" className="font-semibold text-sm text-text">Multi-Branch Support</label>
                  <Toggle
                    id="plan-feature-multiBranch"
                    checked={editingPlan.features?.multiBranch || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, multiBranch: v } })
                    }
                  />
                </div>
                <div className={styles.featureRow}>
                  <label htmlFor="plan-feature-aiFeatures" className="font-semibold text-sm text-text">Clinical AI Features</label>
                  <Toggle
                    id="plan-feature-aiFeatures"
                    checked={editingPlan.features?.aiFeatures || false}
                    onChange={(v) =>
                      setEditingPlan({ ...editingPlan, features: { ...editingPlan.features!, aiFeatures: v } })
                    }
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.formActions} pt-3 border-t border-border/60`}>
              <Button type="button" variant="outline" size="sm" onClick={() => setPlanModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={savingPlan} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold">
                Save Plan Configuration
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
