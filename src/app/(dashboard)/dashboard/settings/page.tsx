"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  useToast,
  Spinner,
  ImageUpload,
  ScheduleEditor,
  Toggle,
  Select,
  Badge,
  cn,
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
import { notificationService, type SmtpConfig } from "@/services/notificationService";
import { aiAdminService } from "@/services/aiAdmin.service";
import { useAuthStore } from "@/store/authStore";
import { isRootUser } from "@/lib/permissions";
import BillingSettingsPage from "./billing/page";
import ModulesSettingsPage from "./modules/page";
import {
  Building2,
  Bell,
  Sparkles,
  LayoutGrid,
  CreditCard,
  Save,
  Check,
  Mail,
  Send,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/;

type Tab = "organization" | "notifications" | "ai" | "modules" | "billing";

const TABS: { id: Tab; label: string; rootOnly?: boolean; icon: React.ReactNode }[] = [
  {
    id: "organization",
    label: "Organization Details",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "notifications",
    label: "Notifications & Email Gateway",
    icon: <Bell className="w-4 h-4" />,
  },
  {
    id: "ai",
    label: "AI Configuration",
    rootOnly: true,
    icon: <Sparkles className="w-4 h-4 text-primary-500" />,
  },
  {
    id: "modules",
    label: "Module Manager",
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    id: "billing",
    label: "Commercial Billing & Subscription",
    icon: <CreditCard className="w-4 h-4" />,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Organization Details
// ─────────────────────────────────────────────────────────────────────────────
function OrganizationTab({ selectedOrgId }: { selectedOrgId?: string }) {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();

  const validateField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) error = "Organization Name is required";
    else if (field === "city" && !value.trim()) error = "City is required";
    else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) error = "Valid email required";
    else if (field === "phone" && value.trim() && !PHONE_REGEX.test(value)) error = "Valid phone required";
    setErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "Organization Name is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (formData.email?.trim() && !EMAIL_REGEX.test(formData.email)) newErrors.email = "Valid email required";
    if (formData.phone?.trim() && !PHONE_REGEX.test(formData.phone)) newErrors.phone = "Valid phone required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const url = selectedOrgId
        ? `/onboarding/organization/me?organizationId=${selectedOrgId}`
        : "/onboarding/organization/me";
      const res = await api.get(url);
      setFormData(res.data.data);
      setErrors({});
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load settings", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [selectedOrgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix form validation errors.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      let finalData = { ...formData };
      if (selectedOrgId) {
        finalData.organizationId = selectedOrgId;
      }
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading logo to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }
      const url = selectedOrgId
        ? `/onboarding/organization/me?organizationId=${selectedOrgId}`
        : "/onboarding/organization/me";
      await api.put(url, finalData);
      toast({ title: "Saved", description: "Organization settings updated successfully!", variant: "success" });
      fetchSettings();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update settings", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Card className="p-12 border border-border/80 shadow-xs flex justify-center rounded-2xl">
        <Spinner size="md" label="Loading facility profile & schedule..." />
      </Card>
    );
  if (!formData) return null;

  return (
    <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden bg-surface">
      <form onSubmit={handleSave}>
        <CardHeader className="border-b border-border/60 pb-4 bg-surface-alt/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">Facility Profile & Operating Schedule</CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Facility information displayed on public booking cards and diagnostic certificates.
              </CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Save Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="bg-surface-alt p-4 border border-border/80 rounded-2xl">
            <ImageUpload
              label="Organization Logo / Display Image"
              value={formData.image_url || null}
              onChange={(val) => setFormData({ ...formData, image_url: val })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Organization Name *"
              required
              value={formData.name || ""}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                validateField("name", e.target.value);
              }}
              onBlur={(e) => validateField("name", e.target.value)}
              error={errors.name}
            />
            <Input
              label="City *"
              required
              value={formData.city || ""}
              onChange={(e) => {
                setFormData({ ...formData, city: e.target.value });
                validateField("city", e.target.value);
              }}
              onBlur={(e) => validateField("city", e.target.value)}
              error={errors.city}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Primary Contact Email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                validateField("email", e.target.value);
              }}
              onBlur={(e) => validateField("email", e.target.value)}
              error={errors.email}
            />
            <Input
              label="Phone Number"
              value={formData.phone || ""}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                validateField("phone", e.target.value);
              }}
              onBlur={(e) => validateField("phone", e.target.value)}
              error={errors.phone}
            />
          </div>

          <Input
            label="Full Physical Address"
            value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. 100 Medical Center Drive, Suite 500"
          />

          <Input
            label="Organization Description / Mission"
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief overview of your clinical ecosystem..."
          />

          <div className="pt-3 border-t border-border/60">
            <ScheduleEditor
              label="Default Operating Schedule & Working Hours"
              value={formData.timings || ""}
              onChange={(val) => setFormData({ ...formData, timings: val })}
            />
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Notifications & Email Gateway
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab({ selectedOrgId }: { selectedOrgId?: string }) {
  const { user } = useAuthStore();
  const isRoot = user?.role === "root";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pref, isLoading: prefLoading } = useQuery({
    queryKey: ["notification-preferences", selectedOrgId],
    queryFn: () => notificationService.getPreferences(),
  });

  const { data: smtpData, isLoading: smtpLoading } = useQuery({
    queryKey: ["smtp-config", selectedOrgId],
    queryFn: () => notificationService.getSmtpConfig(selectedOrgId),
    enabled: isRoot,
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
      const res = await notificationService.sendTestEmail(testEmail.trim() || undefined);
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

  if (prefLoading || (isRoot && smtpLoading))
    return (
      <Card className="p-12 border border-border/80 shadow-xs flex justify-center rounded-2xl">
        <Spinner size="md" label="Loading notification preferences & SMTP configuration..." />
      </Card>
    );

  const smtpConfigured = !!(smtpData?.host && smtpData?.user && smtpData?.passIsSet);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Delivery Channels */}
      <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-bold text-text">Delivery Channels</h3>
            <p className="text-xs text-text-muted mt-0.5">Communication channels enabled for user alerts.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => updatePrefMutation.mutate()}
            loading={updatePrefMutation.isPending}
            className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs"
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
      </Card>

      {/* Event Categories */}
      <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
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
      </Card>

      {/* Email Gateway (SMTP) */}
      <Card className="p-5 border border-border/80 shadow-xs rounded-2xl space-y-4 bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
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
              className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs"
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
                    <span className="ml-2 text-[10px] text-emerald-600 font-normal">(password active)</span>
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
                placeholder="Anant Health"
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
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="recipient@email.com (blank = your account email)"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendTestEmail}
                  loading={testingEmail}
                  className="rounded-xl cursor-pointer shrink-0 font-semibold gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-bold text-xs mb-0.5">System Outbound Gateway Restricted</p>
              <p className="leading-relaxed">
                SMTP Email Gateway configuration contains system-wide secret credentials and is managed exclusively by the Platform Super-Admin (Root). Notification preferences for your facility above remain fully active.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: AI Configuration
// ─────────────────────────────────────────────────────────────────────────────
function AISettingsTab({ selectedOrgId }: { selectedOrgId?: string }) {
  const { user } = useAuthStore();
  const isRoot = user?.role === "root";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-admin-config", selectedOrgId],
    queryFn: () => aiAdminService.getConfig(selectedOrgId),
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

  if (isLoading)
    return (
      <Card className="p-12 border border-border/80 shadow-xs flex justify-center rounded-2xl">
        <Spinner size="md" label="Loading AI governance & copilot configuration..." />
      </Card>
    );

  const FLAG_CONFIG = [
    {
      key: "enablePHIAnonymization" as const,
      label: "PHI Anonymization",
      desc: "Auto-redact Protected Health Information (names, MRNs, emails) before sending data to the AI model. Strongly recommended for HIPAA compliance.",
      badge: "Recommended",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      impact: "Affects every AI request — prompts are scrubbed before leaving your server.",
    },
    {
      key: "enableStreaming" as const,
      label: "Token Streaming (SSE)",
      desc: "Stream AI model tokens in real-time to clinician interfaces for immediate feedback.",
      badge: "Performance",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      impact: "Reduces perceived latency during note drafting and chat assistance.",
    },
    {
      key: "enableMultiAgentRouting" as const,
      label: "Multi-Agent Specialist Routing",
      desc: "Route clinical questions to sub-specialized agent pipelines (e.g. pharmacology, coding, diagnosis).",
      badge: "Accuracy",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      impact: "Improves diagnostic nuance; slightly increases latency per consultation turn.",
    },
    {
      key: "enableToolExecution" as const,
      label: "Autonomous Clinical Tools",
      desc: "Allow AI agents to autonomously query live EHR vitals, active lab orders, and drug databases.",
      badge: "Clinical Power",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      impact: "Enables interactive tools (drug interaction checker, allergy guard) directly in chat.",
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
                className="font-semibold rounded-xl gap-1.5 cursor-pointer shrink-0 shadow-xs"
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
                {isRoot ? (
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
            <p className="text-[11px] text-text-muted">Real-time chat, autocomplete, voice transcribe. Latency: &lt;500ms.</p>
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
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("organization");
  const { user } = useAuthStore();
  const isRoot = user?.role === "root";
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  useEffect(() => {
    if (isRoot) {
      api
        .get("/onboarding/organizations")
        .then((res) => {
          const orgList = res.data.data?.organizations || res.data.data || [];
          setOrganizations(orgList);
          if (orgList.length > 0) {
            setSelectedOrgId((prev) => prev || orgList[0].id || orgList[0]._id);
          }
        })
        .catch(() => {
          api
            .get("/organizations")
            .then((res) => {
              const orgList = res.data.data || [];
              setOrganizations(orgList);
              if (orgList.length > 0) {
                setSelectedOrgId((prev) => prev || orgList[0].id || orgList[0]._id);
              }
            })
            .catch(() => {});
        });
    }
  }, [isRoot]);

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Platform Settings</h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                System Governance
              </Badge>
              {isRoot && (
                <Badge variant="secondary" size="sm" className="font-semibold text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Root Super-Admin Workspace
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage organization details, notification preferences, email gateway, commercial billing, and AI configuration.
            </p>
          </div>

          {isRoot && organizations.length > 0 && (
            <div className="w-full sm:w-72 shrink-0">
              <Select
                size="sm"
                label="Target Healthcare Organization"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                options={organizations.map((org) => ({
                  value: org.id || org._id,
                  label: `${org.name} (${org.city})`,
                }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. SEGMENTED TAB NAVIGATION BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
                isActive
                  ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                  : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
              )}
            >
              <span className={cn(isActive ? "text-primary-500" : "text-text-muted")}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.rootOnly && (
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                    isActive
                      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  )}
                >
                  Root
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. TAB CONTENT VIEWS
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "organization" && <OrganizationTab selectedOrgId={selectedOrgId} />}
      {activeTab === "notifications" && <NotificationsTab selectedOrgId={selectedOrgId} />}
      {activeTab === "ai" && <AISettingsTab selectedOrgId={selectedOrgId} />}
      {activeTab === "modules" && <ModulesSettingsPage />}
      {activeTab === "billing" && <BillingSettingsPage selectedOrgId={selectedOrgId} />}
    </div>
  );
}
