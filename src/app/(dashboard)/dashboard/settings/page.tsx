"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Input, useToast, Spinner, ImageUpload, ScheduleEditor, Toggle
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
import { notificationService, type SmtpConfig } from "@/services/notificationService";
import { aiAdminService } from "@/services/aiAdmin.service";
import BillingSettingsPage from "./billing/page";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/;

type Tab = "organization" | "notifications" | "ai" | "billing";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "organization",
    label: "Organization Details",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications & Email Gateway",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: "ai",
    label: "AI Configuration",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
  },
  {
    id: "billing",
    label: "Commercial Billing & Subscription",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Organization Details
// ─────────────────────────────────────────────────────────────────────────────
function OrganizationTab() {
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

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/onboarding/organization/me");
      setFormData(res.data.data);
      setErrors({});
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load settings", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix form validation errors.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      let finalData = { ...formData };
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading logo to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }
      await api.put("/onboarding/organization/me", finalData);
      toast({ title: "Saved", description: "Organization settings updated successfully!", variant: "success" });
      fetchSettings();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update settings", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><Spinner size="lg" label="Loading details..." /></div>;
  if (!formData) return null;

  return (
    <Card className="border border-border/80 shadow-xs">
      <form onSubmit={handleSave}>
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">Facility Profile & Operating Schedule</CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Facility information displayed on public booking cards and diagnostic certificates.
              </CardDescription>
            </div>
            <Button variant="primary" size="sm" loading={saving} className="font-bold rounded-xl gap-1.5 cursor-pointer shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Save Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="bg-surface-alt/40 p-4 border border-border/70 rounded-2xl">
            <ImageUpload
              label="Organization Logo / Display Image"
              value={formData.image_url || null}
              onChange={(val) => setFormData({ ...formData, image_url: val })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Organization Name *" required value={formData.name || ""}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); validateField("name", e.target.value); }}
              onBlur={(e) => validateField("name", e.target.value)} error={errors.name} />
            <Input label="City *" required value={formData.city || ""}
              onChange={(e) => { setFormData({ ...formData, city: e.target.value }); validateField("city", e.target.value); }}
              onBlur={(e) => validateField("city", e.target.value)} error={errors.city} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Primary Contact Email" type="email" value={formData.email || ""}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); validateField("email", e.target.value); }}
              onBlur={(e) => validateField("email", e.target.value)} error={errors.email} />
            <Input label="Phone Number" value={formData.phone || ""}
              onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); validateField("phone", e.target.value); }}
              onBlur={(e) => validateField("phone", e.target.value)} error={errors.phone} />
          </div>

          <Input label="Full Physical Address" value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. 100 Medical Center Drive, Suite 500" />

          <Input label="Organization Description / Mission" value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief overview of your clinical ecosystem..." />

          <div className="pt-3 border-t border-border/60">
            <ScheduleEditor
              label="Default Operating Schedule & Hours"
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
function NotificationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pref, isLoading: prefLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationService.getPreferences(),
  });

  const { data: smtpData, isLoading: smtpLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: () => notificationService.getSmtpConfig(),
  });

  const [channels, setChannels] = useState({ email: true, inApp: true });
  const [categories, setCategories] = useState({
    auth: true, organization: true, team: true, task: true,
    patient: true, billing: true, security: true, system: true,
  });
  const [smtp, setSmtp] = useState<SmtpConfig>({ host: "", port: 587, secure: false, user: "", pass: "", fromEmail: "", fromName: "" });
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
      setSmtp({ host: smtpData.host || "", port: smtpData.port || 587, secure: smtpData.secure || false, user: smtpData.user || "", pass: smtpData.pass || "", fromEmail: smtpData.fromEmail || "", fromName: smtpData.fromName || "" });
    }
  }, [smtpData]);

  const updatePrefMutation = useMutation({
    mutationFn: () => notificationService.updatePreferences({ channels, categories }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }); toast({ title: "Preferences Saved", variant: "success" }); },
    onError: () => toast({ title: "Save Failed", variant: "error" }),
  });

  const updateSmtpMutation = useMutation({
    mutationFn: () => notificationService.updateSmtpConfig(smtp),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["smtp-config"] }); toast({ title: "Email Gateway Saved", description: "SMTP configuration updated successfully.", variant: "success" }); },
    onError: (err: any) => toast({ title: "SMTP Save Failed", description: err?.response?.data?.message || "Could not save SMTP.", variant: "error" }),
  });

  const handleSendTestEmail = async () => {
    try {
      setTestingEmail(true);
      const res = await notificationService.sendTestEmail(testEmail.trim() || undefined);
      toast({ title: "Test Email Sent 📧", description: res.message, variant: "success" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.response?.data?.message || "Check your SMTP configuration.", variant: "error" });
    } finally { setTestingEmail(false); }
  };

  if (prefLoading || smtpLoading) return <div className="p-12 text-center"><Spinner size="lg" label="Loading..." /></div>;

  const smtpConfigured = !!(smtpData?.host && smtpData?.user && smtpData?.passIsSet);

  return (
    <div className="space-y-5">
      {/* Delivery Channels */}
      <Card className="p-5 border border-border/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-bold text-text">Delivery Channels</h3>
            <p className="text-xs text-text-muted mt-0.5">Communication channels enabled for user alerts.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => updatePrefMutation.mutate()} loading={updatePrefMutation.isPending} className="font-bold rounded-xl gap-1.5 cursor-pointer shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Save Preferences
          </Button>
        </div>
        <div className="space-y-3 divide-y divide-border/40">
          <div className="flex items-center justify-between pt-1">
            <div><p className="text-sm font-medium text-text">In-App Notifications</p><p className="text-xs text-text-muted">Live notification bell badge & toasts while active in app.</p></div>
            <Toggle checked={channels.inApp} onChange={(v) => setChannels({ ...channels, inApp: v })} />
          </div>
          <div className="flex items-center justify-between pt-3">
            <div><p className="text-sm font-medium text-text">Email Notifications</p><p className="text-xs text-text-muted">Email summaries and real-time alert emails.</p></div>
            <Toggle checked={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} />
          </div>
        </div>
      </Card>

      {/* Event Categories */}
      <Card className="p-5 border border-border/80 shadow-xs space-y-4">
        <div className="pb-2 border-b border-border/60">
          <h3 className="text-sm font-bold text-text">Event Categories</h3>
          <p className="text-xs text-text-muted mt-0.5">Toggle specific event categories on or off.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { key: "auth", label: "Authentication", desc: "Logins, device alerts, password changes" },
            { key: "organization", label: "Organization", desc: "Member invites, role changes" },
            { key: "team", label: "Team Activity", desc: "Team additions, assignments" },
            { key: "task", label: "Tasks & Workflow", desc: "Due dates, assignments, mentions" },
            { key: "patient", label: "Patient / Clinical", desc: "Appointments, labs, critical alerts" },
            { key: "billing", label: "Billing", desc: "Invoices, payments, subscription" },
            { key: "security", label: "Security", desc: "Suspicious activity, API changes" },
            { key: "system", label: "System", desc: "Maintenance, feature updates" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3.5 border border-border/70 rounded-xl bg-surface-alt/20 hover:bg-surface-alt/50 transition-colors">
              <div><p className="text-xs font-semibold text-text">{label}</p><p className="text-[11px] text-text-muted mt-0.5">{desc}</p></div>
              <Toggle checked={categories[key]} onChange={(v) => setCategories({ ...categories, [key]: v })} />
            </div>
          ))}
        </div>
      </Card>

      {/* Email Gateway (SMTP) */}
      <Card className="p-5 border border-border/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text">Outbound Email Gateway (SMTP)</h3>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${smtpConfigured ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${smtpConfigured ? "bg-green-500" : "bg-amber-500"}`} />
                {smtpConfigured ? "Configured" : "Not Configured"}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">SMTP credentials for real emails — appointment confirmations, password resets, alerts. Stored encrypted (AES-256-GCM).</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => updateSmtpMutation.mutate()} loading={updateSmtpMutation.isPending} className="font-bold rounded-xl gap-1.5 cursor-pointer shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Save Gateway
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div><label className="block text-xs font-medium text-text-muted mb-1">SMTP Host</label><Input placeholder="smtp.gmail.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-text-muted mb-1">SMTP Port</label><Input type="number" placeholder="587" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></div>
          <div><label className="block text-xs font-medium text-text-muted mb-1">SMTP Username</label><Input placeholder="you@email.com" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} /></div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Password / App Password
              {smtpData?.passIsSet && <span className="ml-2 text-[10px] text-green-600 font-normal">(password set)</span>}
            </label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} placeholder={smtpData?.passIsSet ? "Leave blank to keep current" : "SMTP password"} value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {showPass ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                </svg>
              </button>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-text-muted mb-1">Sender Email</label><Input placeholder="noreply@yourhospital.com" value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-text-muted mb-1">Sender Name</label><Input placeholder="Ananta Health" value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} /></div>
        </div>

        <div className="flex items-center justify-between p-3 bg-surface-alt/40 rounded-xl border border-border/60">
          <div><p className="text-xs font-medium text-text">Use SSL/TLS (Port 465)</p><p className="text-[11px] text-text-muted">Off = STARTTLS on port 587. On = direct TLS on port 465.</p></div>
          <Toggle checked={smtp.secure} onChange={(v) => setSmtp({ ...smtp, secure: v })} />
        </div>

        <div className="border-t border-border/60 pt-4 space-y-2">
          <p className="text-xs font-semibold text-text">Dispatch Test Email</p>
          <div className="flex items-center gap-2">
            <div className="flex-1"><Input placeholder="recipient@email.com (blank = your account email)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /></div>
            <Button variant="secondary" size="sm" onClick={handleSendTestEmail} loading={testingEmail} className="rounded-xl cursor-pointer shrink-0 gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: AI Configuration
// ─────────────────────────────────────────────────────────────────────────────
function AISettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-admin-config"],
    queryFn: () => aiAdminService.getConfig(),
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
    mutationFn: () => aiAdminService.updateConfig({ featureFlags: flags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-admin-config"] });
      toast({ title: "AI Config Saved", description: "Changes take effect on the next AI request.", variant: "success" });
    },
    onError: (err: any) => toast({ title: "Save Failed", description: err?.response?.data?.message || "Could not save AI config.", variant: "error" }),
  });

  if (isLoading) return <div className="p-12 text-center"><Spinner size="lg" label="Loading AI config..." /></div>;

  const FLAG_CONFIG = [
    {
      key: "enablePHIAnonymization" as const,
      label: "PHI Anonymization",
      desc: "Auto-redact Protected Health Information (names, MRNs, emails) before sending data to the AI model. Strongly recommended for HIPAA compliance.",
      badge: "Recommended",
      badgeColor: "bg-green-500/10 text-green-500 border-green-500/20",
      impact: "Affects every AI request — prompts are scrubbed before leaving your server.",
    },
    {
      key: "enableMultiAgentRouting" as const,
      label: "Multi-Agent Routing",
      desc: "Routes queries to specialized clinical sub-agents (Cardiologist, Radiologist, etc.) based on query context for higher accuracy.",
      badge: null,
      badgeColor: "",
      impact: "Disabling routes all queries to the General Clinical Assistant directly.",
    },
    {
      key: "enableToolExecution" as const,
      label: "AI Tool Execution",
      desc: "Allows the AI copilot to trigger structured clinical actions (lab order suggestions, drug interaction checks) that require clinician co-signature before execution.",
      badge: "Advanced",
      badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
      impact: "Disabling turns off AI action suggestions. Chat and generation still work.",
    },
    {
      key: "enableStreaming" as const,
      label: "Streaming Responses",
      desc: "Stream AI tokens in real-time as they are generated. Provides a faster perceived response for long outputs.",
      badge: null,
      badgeColor: "",
      impact: "Disabling returns full responses as one block after generation completes.",
    },
  ] as const;

  return (
    <Card className="p-5 border border-border/80 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-text">Clinical AI Feature Flags</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Enforced in real-time on every AI request across your organization.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => updateMutation.mutate()} loading={updateMutation.isPending} className="font-bold rounded-xl gap-1.5 cursor-pointer shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Save Flags
        </Button>
      </div>

      <div className="space-y-3">
        {FLAG_CONFIG.map(({ key, label, desc, badge, badgeColor, impact }) => (
          <div key={key} className={`p-4 rounded-xl border transition-all ${flags[key] ? "border-border/80 bg-surface-alt/40" : "border-border/50 bg-surface-alt/10 opacity-75"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-text">{label}</p>
                  {badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
                <p className="text-[11px] text-text-muted/70 mt-1.5 italic">↳ {impact}</p>
              </div>
              <Toggle checked={flags[key]} onChange={(v) => setFlags((prev) => ({ ...prev, [key]: v }))} />
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 rounded-xl bg-surface-alt/30 border border-border/60 flex items-start gap-2.5">
        <svg className="w-4.5 h-4.5 text-text-muted mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-text-muted leading-relaxed">
          The active AI provider is determined by which API key is set in <code className="text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border/60 font-mono text-text">backend/.env</code> —
          currently using <strong className="text-text">{config ? "Google Gemini (GEMINI_API_KEY)" : "..."}</strong>.
        </p>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("organization");

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Banner */}
      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Settings</h1>
        <p className="text-xs text-text-muted mt-0.5">Manage organization details, notification preferences, email gateway, commercial billing, and AI configuration.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 bg-surface p-1.5 rounded-2xl border border-border/80 shadow-xs w-full overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "organization" && <OrganizationTab />}
      {activeTab === "notifications" && <NotificationsTab />}
      {activeTab === "ai" && <AISettingsTab />}
      {activeTab === "billing" && <BillingSettingsPage />}
    </div>
  );
}
