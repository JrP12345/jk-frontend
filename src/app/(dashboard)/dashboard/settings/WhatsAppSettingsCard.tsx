"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Toggle, Badge, useToast, cn, SkeletonForm } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import WhatsAppConnectionPanel from "./WhatsAppConnectionPanel";
import { whatsappSettingsService } from "@/services/whatsappSettings.service";
import { useAuthStore } from "@/store/authStore";
import { MessageSquare, Zap, CheckCircle2, AlertTriangle, CreditCard, Save, ShieldCheck, Sparkles, Lock } from "lucide-react";

interface WhatsAppSettingsCardProps {
  selectedOrgId?: string;
  isRoot?: boolean;
  orgsLoading?: boolean;
}

export default function WhatsAppSettingsCard({
  selectedOrgId,
  isRoot: propIsRoot,
  orgsLoading = false,
}: WhatsAppSettingsCardProps) {
  const { user } = useAuthStore();
  const isRoot = propIsRoot ?? user?.role === "root";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<"bronze" | "silver" | "gold">("silver");

  // Local form state
  const [mode, setMode] = useState<"disabled" | "shared" | "dedicated">("shared");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  useEffect(() => { setAccessToken(""); setAppSecret(""); }, [selectedOrgId]);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(50);
  const [notifications, setNotifications] = useState({
    sendBookingConfirmation: true,
    sendConsultationComplete: true,
    sendAppointmentCancellation: true,
    sendTurnApproaching: false,
    sendQueueDelayAlert: true,
    sendDisruptionAlert: true,
  });

  const { data: config, isLoading, isError, refetch } = useQuery({
    queryKey: ["whatsapp-settings", selectedOrgId],
    queryFn: () => whatsappSettingsService.getConfig(selectedOrgId),
    enabled: !isRoot || !!selectedOrgId,
  });

  useEffect(() => {
    if (config) {
      setMode(config.mode || "shared");
      setWabaId(config.wabaId || "");
      setPhoneNumberId(config.phoneNumberId || "");
      setLowBalanceThreshold(config.lowBalanceThreshold ?? 50);
      if (config.notifications) {
        setNotifications({
          sendBookingConfirmation: config.notifications.sendBookingConfirmation ?? true,
          sendConsultationComplete: config.notifications.sendConsultationComplete ?? true,
          sendAppointmentCancellation: config.notifications.sendAppointmentCancellation ?? true,
          sendTurnApproaching: config.notifications.sendTurnApproaching ?? false,
          sendQueueDelayAlert: config.notifications.sendQueueDelayAlert ?? true,
          sendDisruptionAlert: config.notifications.sendDisruptionAlert ?? true,
        });
      }
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      whatsappSettingsService.updateConfig(
        {
          mode,
          lowBalanceThreshold,
          wabaId: mode === "dedicated" ? wabaId : undefined,
          phoneNumberId: mode === "dedicated" ? phoneNumberId : undefined,
          accessToken: mode === "dedicated" && accessToken ? accessToken : undefined,
          appSecret: mode === "dedicated" && appSecret ? appSecret : undefined,
          notifications,
        },
        selectedOrgId
      ),
    onSuccess: () => {
      setAccessToken(""); setAppSecret("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-health"] });
      toast({
        title: "WhatsApp Settings Saved",
        description: "Notification preferences and gateway routing updated.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err?.response?.data?.message || "Could not save WhatsApp settings.",
        variant: "error",
      });
    },
  });

  const topUpMutation = useMutation({
    mutationFn: (pack: "bronze" | "silver" | "gold") =>
      whatsappSettingsService.topUpCredits(pack, selectedOrgId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      setIsTopUpModalOpen(false);
      toast({
        title: "Top-Up Successful! 🎉",
        description: data.message || "Credits added immediately to your balance.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Top-Up Failed",
        description: err?.response?.data?.message || "Could not complete credit top-up.",
        variant: "error",
      });
    },
  });

  if (isLoading || (isRoot && (!selectedOrgId || orgsLoading))) {
    return (
      <div className="space-y-4">
        <SkeletonForm rows={4} />
      </div>
    );
  }

  if (isError || !config) return <Alert variant="error" title="Organization WhatsApp settings unavailable" action={<Button variant="outline" onClick={() => refetch()}>Retry WhatsApp settings</Button>}>Load the saved settings before making changes.</Alert>;
  const creditsBalance = config.creditsBalance ?? 0;
  const monthlyQuota = config.monthlyQuota ?? 0;
  const creditsUsedThisMonth = config?.creditsUsedThisMonth ?? 0;
  const isLowBalance = config?.isLowBalance || creditsBalance <= lowBalanceThreshold;
  const usagePercentage = Math.min(100, Math.round((creditsUsedThisMonth / (monthlyQuota || 1)) * 100));

  return (
    <div className="space-y-4">
      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN WHATSAPP GATEWAY CARD
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="border border-border/80 shadow-xs rounded-2xl bg-surface overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-lg bg-success/10 text-success-text dark:text-success-text">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <CardTitle className="text-base font-bold text-text">
                  Meta WhatsApp Business Cloud Gateway
                </CardTitle>
                <Badge
                  variant={mode === "disabled" ? "neutral" : isLowBalance ? "warning" : "success"}
                  size="sm"
                  dot
                  className="font-semibold text-[10px]"
                >
                  {mode === "disabled" ? "Disabled" : isLowBalance ? "Low Credits" : "Active"}
                </Badge>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-success/10 text-success-text dark:text-success-text border-success/20">
                  WhatsApp Cloud API
                </span>
              </div>
              <CardDescription className="text-xs text-text-muted">
                Official Meta Cloud API for patient booking links, live queue tracker, and post-visit digital Rx handoffs.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsTopUpModalOpen(true)}
                className="font-semibold rounded-xl gap-1.5 cursor-pointer shadow-xs text-success-text dark:text-success-text border-success/30 hover:bg-success/10 flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                Top-Up Credits
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
                className="font-semibold rounded-xl gap-1.5 cursor-pointer shadow-xs flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* Low Balance Warning Banner */}
          {isLowBalance && mode !== "disabled" && (
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/25 text-xs text-warning-text dark:text-warning-text flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-warning-text mt-0.5" />
                <div>
                  <p className="font-bold text-xs mb-0.5">WhatsApp Credit Balance Running Low</p>
                  <p className="leading-relaxed text-[11px] text-warning-text/90 dark:text-warning-text/90">
                    You have <span className="font-bold underline">{creditsBalance} credits</span> remaining (below threshold of {lowBalanceThreshold}). If credits reach 0, appointment bookings and queue operations will continue uninterrupted, with live queue tracking automatically falling back to patient web links and email.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsTopUpModalOpen(true)}
                className="shrink-0 text-xs rounded-xl py-1 px-3 bg-warning hover:bg-warning text-background font-semibold cursor-pointer"
              >
                Add Credits
              </Button>
            </div>
          )}

          {/* Credits Balance & Quota Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl border border-border/80 bg-surface-alt/60 space-y-1 relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <span>Available Credits</span>
                <Zap className="w-3.5 h-3.5 text-success-text" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-text tracking-tight">
                  {creditsBalance.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-text-muted">Credits</span>
              </div>
              <p className="text-[11px] text-text-muted">
                1 Credit = 1 Billable WhatsApp Notification
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border/80 bg-surface-alt/60 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <span>Monthly Plan Quota</span>
                <span className="text-xs font-semibold text-text">
                  {creditsUsedThisMonth} / {monthlyQuota}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-border/80 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    usagePercentage >= 90
                      ? "bg-warning"
                      : "bg-primary  "
                  )}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-text-muted">
                Resets on the 1st of every calendar month
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border/80 bg-surface-alt/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <span>Prepaid Credits</span>
                <CreditCard className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-text tracking-tight">
                  {(config?.prepaidCredits ?? 0).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-text-muted">Rollover</span>
              </div>
              <p className="text-[11px] text-text-muted">
                Purchased top-up credits never expire
              </p>
            </div>
          </div>

          {/* Gateway Routing Mode */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-xs font-bold text-text uppercase tracking-wider">
              Gateway Connection Mode
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Shared Mode */}
              <button
                type="button"
                onClick={() => setMode("shared")}
                aria-pressed={mode === "shared"}
                className={cn(
                  "p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1 relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success",
                  mode === "shared"
                    ? "border-success bg-success/5 ring-1 ring-success/30"
                    : "border-border/80 bg-surface hover:bg-surface-alt/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-success-text" />
                    <p className="text-xs font-bold text-text">Shared Gateway</p>
                  </div>
                  {mode === "shared" && (
                    <CheckCircle2 className="w-4 h-4 text-success-text dark:text-success-text shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Managed by Ekavyu Cloud. Uses the shared sender configured by root.
                </p>
                <span className="inline-block text-[10px] font-semibold text-success-text dark:text-success-text mt-1">
                  Default Platform
                </span>
              </button>

              {/* Dedicated WABA Mode */}
              <button
                type="button"
                onClick={() => setMode("dedicated")}
                aria-pressed={mode === "dedicated"}
                className={cn(
                  "p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1 relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  mode === "dedicated"
                    ? "border-primary-500 bg-primary-500/5 ring-1 ring-focus-ring"
                    : "border-border/80 bg-surface hover:bg-surface-alt/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <p className="text-xs font-bold text-text">Dedicated WABA</p>
                  </div>
                  {mode === "dedicated" && (
                    <CheckCircle2 className="w-4 h-4 text-accent dark:text-accent shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Bring your own Meta Business Account and registered clinical phone number.
                </p>
                <span className="inline-block text-[10px] font-semibold text-accent dark:text-accent mt-1">
                  Enterprise Custom
                </span>
              </button>

              {/* Disabled Mode */}
              <button
                type="button"
                onClick={() => setMode("disabled")}
                aria-pressed={mode === "disabled"}
                className={cn(
                  "p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1 relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning",
                  mode === "disabled"
                    ? "border-warning bg-warning/5 ring-1 ring-warning/30"
                    : "border-border/80 bg-surface hover:bg-surface-alt/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-warning-text" />
                    <p className="text-xs font-bold text-text">Disabled</p>
                  </div>
                  {mode === "disabled" && (
                    <CheckCircle2 className="w-4 h-4 text-warning-text dark:text-warning-text shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Turn off WhatsApp notifications. Patient alerts will fall back to Email and SMS.
                </p>
                <span className="inline-block text-[10px] font-semibold text-warning-text dark:text-warning-text mt-1">
                  No Outbound
                </span>
              </button>
            </div>

            {/* Dedicated Credentials Sub-Form */}
            {mode === "dedicated" && (
              <div className="p-4 rounded-2xl border border-primary-500/30 bg-surface-alt space-y-3 mt-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-text flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    Custom Meta Cloud API Credentials
                  </h5>
                  <span className="text-[11px] text-text-muted">
                    Found in Meta App Dashboard → WhatsApp → API Setup
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="WhatsApp Business Account (WABA) ID *"
                    placeholder="e.g. 109283746592019"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                  />
                  <Input
                    label="Phone Number ID *"
                    placeholder="e.g. 104928374650192"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)} type="tel" inputMode="tel"
                  />
                </div>
                <Input
                  label="Permanent System User Access Token"
                  type="password"
                  placeholder={config?.hasDedicatedCredentials ? "•••••••••••••••• (Active. Leave blank to keep)" : "EAAG..."}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <Input label="Meta App Secret" type="password" autoComplete="new-password" value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder="Leave blank to keep the saved secret" />
              </div>
            )}
          </div>

          <WhatsAppConnectionPanel key={`${selectedOrgId}:${config?.mode || mode}`} organizationId={selectedOrgId} isRoot={isRoot} mode={config?.mode || mode} />
          {/* Lean 2-Message Notification Rules & Toggles */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                  Lean Automated Notification Triggers
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Controlled messaging policy to safeguard patient privacy and eliminate notification spam.
                </p>
              </div>
              <span className="text-[10px] font-medium text-text-muted bg-surface-alt px-2.5 py-1 rounded-full border border-border/70 w-fit">
                Tracking Link Included
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Trigger 1 */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text">Booking Confirmation & Tracker</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-success/10 text-success-text dark:text-success-text border border-success/20">
                      Essential
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Token #, doctor, time, and patient live queue tracker URL.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendBookingConfirmation}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendBookingConfirmation: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>

              {/* Trigger 2 */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text">Post-Consultation Digital Handoff</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-success/10 text-success-text dark:text-success-text border border-success/20">
                      Essential
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Secure prescription link, doctor advice, and digital invoice summary.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendConsultationComplete}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendConsultationComplete: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>

              {/* Trigger 3 */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-text">Appointment Cancellation Notice</p>
                  <p className="text-[11px] text-text-muted">
                    Instant cancellation confirmation if doctor schedule changes.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendAppointmentCancellation}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendAppointmentCancellation: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>

              {/* Trigger 4 */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text">Turn Approaching Alert (2 Ahead)</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Notifies patient when 2 tokens remain ahead. Use web tracker to save credits.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendTurnApproaching}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendTurnApproaching: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>

              {/* Trigger 5: Queue Delay Domino Alerts */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text">Queue Delay Domino Alerts</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-accent dark:text-accent border border-accent/20">
                      Smart Flow
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Notifies un-arrived patients with revised arrival times when consultations run &ge; 20m late.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendQueueDelayAlert}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendQueueDelayAlert: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>

              {/* Trigger 6: Doctor Schedule Disruption Notices */}
              <div className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text">Doctor Disruption & Triage</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20">
                      High Priority
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Sends emergency disruption notice with 1-click self-service reschedule & refund links.
                  </p>
                </div>
                <Toggle
                  checked={notifications.sendDisruptionAlert}
                  onChange={(v) =>
                    setNotifications({ ...notifications, sendDisruptionAlert: v })
                  }
                  disabled={mode === "disabled"}
                />
              </div>
            </div>
          </div>

          {/* Safety Threshold & Webhook Information */}
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-text">
                Low Balance Warning Threshold:
              </label>
              <div className="w-24">
                <Input
                  type="number"
                  min={10}
                  value={lowBalanceThreshold}
                  onChange={(e) => setLowBalanceThreshold(Number(e.target.value))}
                />
              </div>
              <span className="text-text-muted text-[11px]">credits</span>
            </div>

            <div className="text-[11px] text-text-muted flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-success-text shrink-0" />
              <span>Inbound STOP opt-out and webhook delivery tracking active.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          TOP-UP MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        title="Purchase WhatsApp Notification Credits"
        description="Prepaid credits are consumed after your monthly plan allowance and never expire. Invoices are generated instantly with full GST breakdown."
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            <div className="text-xs text-text-muted text-center sm:text-left">
              Instant activation • No hidden setup fees
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsTopUpModalOpen(false)}
                className="rounded-xl font-semibold cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={topUpMutation.isPending}
                onClick={() => topUpMutation.mutate(selectedPack)}
                className="rounded-xl font-semibold gap-1.5 cursor-pointer shadow-xs bg-success hover:bg-success text-background w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                Confirm & Top-Up
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: "bronze" as const,
                name: "Bronze Pack",
                credits: 1000,
                price: "₹200",
                rate: "₹0.20 / msg",
                volume: "~400 visits",
                description: "Ideal for small locations & solo practices.",
              },
              {
                id: "silver" as const,
                name: "Silver Pack",
                credits: 3000,
                price: "₹550",
                rate: "₹0.18 / msg",
                volume: "~1,200 visits",
                popular: true,
                description: "Best for growing medical centers & multi-doc locations.",
              },
              {
                id: "gold" as const,
                name: "Gold Pack",
                credits: 10000,
                price: "₹1,700",
                rate: "₹0.17 / msg",
                volume: "~4,000 visits",
                description: "High volume tier for hospitals & multi-chain centers.",
              },
            ].map((pack) => {
              const isSelected = selectedPack === pack.id;
              return (
                <button
                  type="button"
                  key={pack.id}
                  onClick={() => setSelectedPack(pack.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "p-4 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between space-y-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success",
                    isSelected
                      ? "border-success bg-success/10 ring-2 ring-success/40 shadow-sm"
                      : "border-border/80 bg-surface-alt/40 hover:bg-surface-alt"
                  )}
                >
                  {pack.popular && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide bg-primary   text-brand-mist rounded-full shadow-xs">
                      Popular
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold text-text">{pack.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-text tracking-tight">
                        {pack.credits.toLocaleString()}
                      </span>
                      <span className="text-[11px] font-semibold text-text-muted">credits</span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-snug">
                      {pack.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-text">{pack.price}</span>
                      <span className="text-[10px] font-semibold text-success-text dark:text-success-text bg-success/10 px-1.5 py-0.5 rounded-md">
                        {pack.rate}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted mt-0.5 block">
                      {pack.volume}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-alt border border-border/80 text-xs text-text-muted space-y-1">
            <p className="font-bold text-text flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-success-text" />
              Platform Zero-Disruption Guarantee
            </p>
            <p className="text-[11px] leading-relaxed">
              WhatsApp credits are exclusively for outbound messaging. Clinical operations, doctor queues, and patient records are never locked or throttled if credits are exhausted.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
