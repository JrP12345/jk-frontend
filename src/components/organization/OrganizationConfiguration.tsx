"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Input, useToast, Toggle, Badge, SkeletonForm } from "@/components/ui";
import { notificationService, type SmtpConfig } from "@/services/notificationService";
import { aiAdminService } from "@/services/aiAdmin.service";
import { useAuthStore } from "@/store/authStore";
import WhatsAppSettingsCard from "@/app/(dashboard)/dashboard/settings/WhatsAppSettingsCard";
import { Save, Send, Eye, EyeOff, Lock } from "lucide-react";
export function OrganizationNotifications({
  selectedOrgId,
  isRoot: propIsRoot,
  orgsLoading = false,
  organizationOnly = false,
  personalOnly = false,
}: {
  selectedOrgId?: string;
  isRoot?: boolean;
  orgsLoading?: boolean;
  organizationOnly?: boolean;
  personalOnly?: boolean;
}) {
  const { user } = useAuthStore();
  const isRoot = propIsRoot ?? user?.role === "root";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pref, isLoading: prefLoading, isError: prefError, refetch: retryPreferences } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: () => notificationService.getPreferences(),
    enabled: !organizationOnly && !!user && (!isRoot || personalOnly || !!selectedOrgId),
  });

  const { data: smtpData, isLoading: smtpLoading, isError: smtpError, refetch: retrySmtp } = useQuery({
    queryKey: ["smtp-config", selectedOrgId],
    queryFn: () => notificationService.getSmtpConfig(selectedOrgId),
    enabled: !personalOnly && !!isRoot && !!selectedOrgId,
  });

  const [channels, setChannels] = useState({ email: true, inApp: true });
  const [categories, setCategories] = useState({
    auth: true,
    organization: true,
    team: true,
    task: true,
    patient: true,
    billing: true,
    security: true,
    system: true,
  });
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    if (pref) {
      if (pref.channels) setChannels(pref.channels);
      if (pref.categories) setCategories(pref.categories);
    }
  }, [pref]);

  useEffect(() => {
    if (smtpData) {
      setSmtp({
        host: smtpData.host || "",
        port: smtpData.port || 587,
        secure: smtpData.secure || false,
        user: smtpData.user || "",
        pass: smtpData.pass || "",
        fromEmail: smtpData.fromEmail || "",
        fromName: smtpData.fromName || "",
      });
    }
  }, [smtpData]);

  const updatePrefMutation = useMutation({
    mutationFn: () => notificationService.updatePreferences({ channels, categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({ title: "Preferences Saved", variant: "success" });
    },
    onError: () => toast({ title: "Save Failed", variant: "error" }),
  });

  const updateSmtpMutation = useMutation({
    mutationFn: () => notificationService.updateSmtpConfig(smtp, selectedOrgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smtp-config"] });
      toast({
        title: "Email Gateway Saved",
        description: "SMTP configuration updated successfully.",
        variant: "success",
      });
    },
    onError: (err: any) =>
      toast({
        title: "SMTP Save Failed",
        description: err?.response?.data?.message || "Could not save SMTP.",
        variant: "error",
      }),
  });

  const handleSendTestEmail = async () => {
    try {
      setTestingEmail(true);
      const res = await notificationService.sendTestEmail(testEmail.trim() || undefined, selectedOrgId);
      toast({ title: "Test Email Sent", description: res.message, variant: "success" });
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.response?.data?.message || "Check your SMTP configuration.",
        variant: "error",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  if ((!organizationOnly && prefLoading) || (!personalOnly && isRoot && (smtpLoading || !selectedOrgId || orgsLoading))) return <SkeletonForm fields={4} />;
  if (!organizationOnly && prefError) return <Alert variant="error" title="Notification preferences unavailable" action={<Button onClick={() => retryPreferences()}>Retry preferences</Button>}>Load your saved preferences before making changes.</Alert>;
  if (smtpError) return <Alert variant="error" title="Email gateway could not be loaded" action={<Button onClick={() => retrySmtp()}>Retry</Button>}>Retry before making changes.</Alert>;

  const smtpConfigured = !!(smtpData?.host && smtpData?.user && smtpData?.passIsSet);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Delivery Channels */}
      {!organizationOnly && <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-bold text-text">Delivery Channels</h3>
            <p className="text-xs text-text-muted mt-0.5">Communication channels enabled for user alerts.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => updatePrefMutation.mutate()}
            loading={updatePrefMutation.isPending}
            className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
          >
            <Save className="w-3.5 h-3.5" />
            Save Preferences
          </Button>
        </div>
        <div className="space-y-3 divide-y divide-border/40">
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-semibold text-text">In-App Notifications</p>
              <p className="text-xs text-text-muted">Live notification bell badge & toasts while active in app.</p>
            </div>
            <Toggle checked={channels.inApp} onChange={(v) => setChannels({ ...channels, inApp: v })} />
          </div>
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-semibold text-text">Email Notifications</p>
              <p className="text-xs text-text-muted">Email summaries and real-time alert emails.</p>
            </div>
            <Toggle checked={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} />
          </div>
        </div>
      </Card>}

      {/* Meta WhatsApp Business Gateway & Notification Credits */}
      {!personalOnly && <WhatsAppSettingsCard key={selectedOrgId || user?.organization_id} selectedOrgId={selectedOrgId} isRoot={isRoot} orgsLoading={orgsLoading} />}

      {/* Event Categories */}
      {!organizationOnly && <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
        <div className="pb-2 border-b border-border/60">
          <h3 className="text-sm font-bold text-text">Event Categories</h3>
          <p className="text-xs text-text-muted mt-0.5">Toggle specific event categories on or off.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: "auth", label: "Authentication", desc: "Logins, device alerts, password changes" },
            { key: "organization", label: "Organization", desc: "Member invites, role changes" },
            { key: "team", label: "Team Activity", desc: "Team additions, assignments" },
            { key: "task", label: "Tasks & Workflow", desc: "Due dates, assignments, mentions" },
            { key: "patient", label: "Patient / Clinical", desc: "Appointments, labs, critical alerts" },
            { key: "billing", label: "Billing", desc: "Invoices, payments, subscription" },
            { key: "security", label: "Security", desc: "Suspicious activity, API changes" },
            { key: "system", label: "System", desc: "Maintenance, feature updates" },
          ].map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between p-3.5 border border-border/70 rounded-2xl bg-surface-alt/40 hover:bg-surface-alt transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-text">{label}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>
              </div>
              <Toggle
                checked={(categories as any)[key]}
                onChange={(v) => setCategories({ ...categories, [key]: v })}
              />
            </div>
          ))}
        </div>
      </Card>}

      {/* Email Gateway (SMTP) */}
      {!personalOnly && <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-text">Outbound Email Gateway (SMTP)</h3>
              {isRoot ? (
                <Badge
                  variant={smtpConfigured ? "success" : "warning"}
                  size="sm"
                  dot
                  className="font-semibold text-[10px]"
                >
                  {smtpConfigured ? "Configured" : "Not Configured"}
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" className="font-semibold text-[10px] inline-flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Root Super-Admin Only
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              SMTP credentials for outbound system emails — appointment confirmations, password resets, alerts.
            </p>
          </div>
          {isRoot && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => updateSmtpMutation.mutate()}
              loading={updateSmtpMutation.isPending}
              className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
            >
              <Save className="w-3.5 h-3.5" />
              Save Gateway
            </Button>
          )}
        </div>

        {isRoot ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="SMTP Host"
                placeholder="smtp.gmail.com"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              />
              <Input
                label="SMTP Port"
                type="number"
                placeholder="587"
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
              />
              <Input
                label="SMTP Username"
                placeholder="you@email.com"
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
              />
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Password / App Password
                  {smtpData?.passIsSet && (
                    <span className="ml-2 text-[10px] text-success-text font-normal">(password active)</span>
                  )}
                </label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder={smtpData?.passIsSet ? "Leave blank to keep current" : "SMTP password"}
                    value={smtp.pass}
                    onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors p-1"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Input
                label="Sender Email"
                placeholder="noreply@yourhospital.com"
                value={smtp.fromEmail}
                onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
              />
              <Input
                label="Sender Name"
                placeholder="Ekavyu Health"
                value={smtp.fromName}
                onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-surface-alt rounded-2xl border border-border/80">
              <div>
                <p className="text-xs font-bold text-text">Use SSL/TLS (Port 465)</p>
                <p className="text-[11px] text-text-muted">Off = STARTTLS on port 587. On = direct TLS on port 465.</p>
              </div>
              <Toggle checked={smtp.secure} onChange={(v) => setSmtp({ ...smtp, secure: v })} />
            </div>

            <div className="border-t border-border/60 pt-4 space-y-2">
              <p className="text-xs font-bold text-text">Dispatch Test Email</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={selectedOrgId ? "Active organization member's email" : "recipient@email.com (blank = your account email)"}
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendTestEmail}
                  loading={testingEmail}
                  disabled={!!selectedOrgId && !testEmail.trim()}
                  className="rounded-xl cursor-pointer shrink-0 font-semibold gap-1.5 shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-xs text-warning-text dark:text-warning-text flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-warning-text" />
            <div>
              <p className="font-bold text-xs mb-0.5">System Outbound Gateway Restricted</p>
              <p className="leading-relaxed">
                SMTP Email Gateway credentials are managed by Root. Authorized organization communication settings remain available above.
              </p>
            </div>
          </div>
        )}
      </Card>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: AI Configuration
// ─────────────────────────────────────────────────────────────────────────────
export function OrganizationAISettings({
  selectedOrgId,
  isRoot: propIsRoot,
  orgsLoading = false,
}: {
  selectedOrgId?: string;
  isRoot?: boolean;
  orgsLoading?: boolean;
}) {
  const { user } = useAuthStore();
  const isRoot = propIsRoot ?? user?.role === "root";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading, isError, refetch } = useQuery({
    queryKey: ["ai-admin-config", selectedOrgId],
    queryFn: () => aiAdminService.getConfig(selectedOrgId),
    enabled: !isRoot || !!selectedOrgId,
  });

  const [flags, setFlags] = useState({
    enableStreaming: true,
    enablePHIAnonymization: true,
    enableMultiAgentRouting: true,
    enableToolExecution: true,
  });

  useEffect(() => {
    if (config?.featureFlags) setFlags(config.featureFlags);
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: () => aiAdminService.updateConfig({ featureFlags: flags }, selectedOrgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-admin-config"] });
      toast({
        title: "AI Config Saved",
        description: "Changes take effect on the next AI request.",
        variant: "success",
      });
    },
    onError: (err: any) =>
      toast({
        title: "Save Failed",
        description: err?.response?.data?.message || "Could not save AI config.",
        variant: "error",
      }),
  });

  if (isLoading || (isRoot && (!selectedOrgId || orgsLoading))) return <SkeletonForm fields={4} />;
  if (isError) return <Alert variant="error" title="AI configuration could not be loaded" action={<Button onClick={() => refetch()}>Retry</Button>}>Retry before making changes.</Alert>;

  const FLAG_CONFIG = [
    {
      key: "enablePHIAnonymization" as const,
      label: "PHI Anonymization",
      desc: "Patient identifiers are redacted before deidentified clinical requests leave the server. This protection is always enabled.",
      badge: "Required",
      badgeColor: "bg-success/10 text-success-text dark:text-success-text border-success/20",
      impact: "Affects every AI request — prompts are scrubbed before leaving your server.",
    },
    {
      key: "enableStreaming" as const,
      label: "Token Streaming (SSE)",
      desc: "Stream AI model tokens in real-time to clinician interfaces for immediate feedback.",
      badge: "Performance",
      badgeColor: "bg-primary/10 text-accent dark:text-accent border-accent/20",
      impact: "Reduces perceived latency during note drafting and chat assistance.",
    },
    {
      key: "enableMultiAgentRouting" as const,
      label: "Multi-Agent Specialist Routing",
      desc: "Route clinical questions to sub-specialized agent pipelines (e.g. pharmacology, coding, diagnosis).",
      badge: "Accuracy",
      badgeColor: "bg-primary/10 text-accent dark:text-accent border-accent/20",
      impact: "Improves diagnostic nuance; slightly increases latency per consultation turn.",
    },
    {
      key: "enableToolExecution" as const,
      label: "Clinical Tools",
      desc: "Allow clinical tool requests. Actions still require clinician approval and existing permissions.",
      badge: "Clinical Power",
      badgeColor: "bg-warning/10 text-warning-text dark:text-warning-text border-warning/20",
      impact: "Controls new tool requests and approval of pending actions.",
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Feature Flags */}
      <Card className="border border-border/80 shadow-xs rounded-2xl bg-surface overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">AI Architecture & Safety Governance</CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Configure pipeline behaviors, security filters, and safety rails for clinical AI models.
              </CardDescription>
            </div>
            {isRoot && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => updateMutation.mutate()}
                loading={updateMutation.isPending}
                className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <Save className="w-3.5 h-3.5" />
                Save AI Config
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-3 divide-y divide-border/40">
            {FLAG_CONFIG.map(({ key, label, desc, badge, badgeColor, impact }) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{label}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {badge}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{desc}</p>
                  <p className="text-[11px] text-text-muted/80 italic">{impact}</p>
                </div>
                {key === "enablePHIAnonymization" ? (
                  <span className="text-xs font-medium text-text-muted">Always enabled</span>
                ) : isRoot ? (
                  <Toggle checked={flags[key]} onChange={(val) => setFlags({ ...flags, [key]: val })} />
                ) : (
                  <span className="text-xs font-medium text-text-muted">{flags[key] ? "Enabled" : "Disabled"}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Alias Overview */}
      <Card className="border border-border/80 shadow-xs rounded-2xl p-5 bg-surface">
        <h3 className="text-sm font-bold text-text mb-1">Active Model Pipeline Routing</h3>
        <p className="text-xs text-text-muted mb-4">Current routing tiers configured in backend environment variables.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-alt space-y-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fast Lane</p>
            <p className="text-xs font-bold text-text">CLINICAL_FAST</p>
            <p className="text-[11px] text-text-muted">Clinical chat. Latency depends on the configured provider.</p>
          </div>
          <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-alt space-y-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Default Tier</p>
            <p className="text-xs font-bold text-text">CLINICAL_ACCURATE</p>
            <p className="text-[11px] text-text-muted">SOAP notes, visit summaries, patient timeline synthesis.</p>
          </div>
          <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-alt space-y-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Deep Reasoning</p>
            <p className="text-xs font-bold text-text">CLINICAL_REASONING</p>
            <p className="text-[11px] text-text-muted">Differential diagnosis, complex drug interaction adjudications.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Page Component
// ─────────────────────────────────────────────────────────────────────────────
