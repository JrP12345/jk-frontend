"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService, type SmtpConfig } from "@/services/notificationService";
import { Card, Button, Toggle, Spinner, useToast, Input } from "@/components/ui";

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Notification Preferences ────────────────────────────────────────
  const { data: pref, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationService.getPreferences(),
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

  useEffect(() => {
    if (pref) {
      if (pref.channels) setChannels(pref.channels);
      if (pref.categories) setCategories(pref.categories);
    }
  }, [pref]);

  const updatePrefMutation = useMutation({
    mutationFn: () => notificationService.updatePreferences({ channels, categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({ title: "Preferences Saved", description: "Notification settings updated.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not update notification preferences.", variant: "error" });
    },
  });

  // ─── SMTP Config ─────────────────────────────────────────────────────
  const { data: smtpData, isLoading: smtpLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: () => notificationService.getSmtpConfig(),
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
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (smtpData) {
      setSmtp({
        host: smtpData.host || "",
        port: smtpData.port || 587,
        secure: smtpData.secure || false,
        user: smtpData.user || "",
        pass: smtpData.pass || "",       // will be "••••••••" if set
        fromEmail: smtpData.fromEmail || "",
        fromName: smtpData.fromName || "",
      });
    }
  }, [smtpData]);

  const updateSmtpMutation = useMutation({
    mutationFn: () => notificationService.updateSmtpConfig(smtp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smtp-config"] });
      toast({ title: "Email Gateway Saved", description: "SMTP configuration updated successfully.", variant: "success" });
    },
    onError: (err: any) => {
      toast({
        title: "SMTP Save Failed",
        description: err?.response?.data?.message || "Could not save SMTP configuration.",
        variant: "error",
      });
    },
  });

  const handleSendTestEmail = async () => {
    try {
      setTestingEmail(true);
      const res = await notificationService.sendTestEmail(testEmail.trim() || undefined);
      toast({ title: "Test Email Sent 📧", description: res.message || "Check your inbox!", variant: "success" });
    } catch (err: any) {
      toast({
        title: "Test Email Failed",
        description: err.response?.data?.message || "Could not send test email. Check your SMTP configuration.",
        variant: "error",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  if (isLoading || smtpLoading) {
    return (
      <div className="p-12 text-center">
        <Spinner size="lg" label="Loading settings..." />
      </div>
    );
  }

  const smtpConfigured = !!(smtpData?.host && smtpData?.user && smtpData?.passIsSet);

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Settings</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure notification delivery, event alerts, and email gateway.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => updatePrefMutation.mutate()}
            loading={updatePrefMutation.isPending}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Save Preferences</span>
          </Button>
        </div>
      </div>

      {/* Delivery Channels */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text">Delivery Channels</h2>
          <p className="text-xs text-text-muted mt-0.5">Select the communication channels you want enabled.</p>
        </div>

        <div className="space-y-4 divide-y divide-border/60">
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-text">In-App Notifications</p>
              <p className="text-xs text-text-muted">Live notification toasts and bell popups while active in Ananta.</p>
            </div>
            <Toggle checked={channels.inApp} onChange={(checked) => setChannels({ ...channels, inApp: checked })} />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-text">Email Notifications</p>
              <p className="text-xs text-text-muted">Email summaries and real-time alerts for important updates.</p>
            </div>
            <Toggle checked={channels.email} onChange={(checked) => setChannels({ ...channels, email: checked })} />
          </div>
        </div>
      </Card>

      {/* Event Categories */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text">Event Categories</h2>
          <p className="text-xs text-text-muted mt-0.5">Choose which event types trigger notifications.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { key: "auth", label: "Authentication", desc: "Logins, device alerts, password changes" },
            { key: "organization", label: "Organization", desc: "Member invites, role changes, tenancy" },
            { key: "team", label: "Team Activity", desc: "Team additions, role assignments" },
            { key: "task", label: "Tasks & Workflow", desc: "Task assignments, due dates, mentions" },
            { key: "patient", label: "Healthcare / Patient", desc: "Appointments, lab reports, critical alerts" },
            { key: "billing", label: "Billing & Subscription", desc: "Invoices, payment failures, trial ending" },
            { key: "security", label: "Security Alerts", desc: "Suspicious activity, API key changes" },
            { key: "system", label: "System Alerts", desc: "Maintenance windows, feature updates" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium text-text">{label}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
              <Toggle
                checked={categories[key]}
                onChange={(checked) => setCategories({ ...categories, [key]: checked })}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Email Gateway (SMTP) Config */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text">Email Gateway</h2>
              {smtpConfigured ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Not Configured
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Configure SMTP credentials for outbound emails (appointment confirmations, password resets, alerts).
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => updateSmtpMutation.mutate()}
            loading={updateSmtpMutation.isPending}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Save Gateway</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* SMTP Host */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">SMTP Host</label>
            <Input
              placeholder="e.g. smtp.gmail.com"
              value={smtp.host}
              onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
            />
          </div>

          {/* SMTP Port */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">SMTP Port</label>
            <Input
              type="number"
              placeholder="587"
              value={smtp.port}
              onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
            />
          </div>

          {/* SMTP User */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">SMTP Username / Email</label>
            <Input
              placeholder="your@email.com"
              value={smtp.user}
              onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
            />
          </div>

          {/* SMTP Password */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              SMTP Password / App Password
              {smtpData?.passIsSet && (
                <span className="ml-2 text-[10px] text-green-600 font-normal">(password is set)</span>
              )}
            </label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder={smtpData?.passIsSet ? "Leave blank to keep current password" : "Enter SMTP password"}
                value={smtp.pass}
                onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
              >
                {showPass ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* From Email */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Sender Email Address</label>
            <Input
              placeholder="noreply@yourhospital.com"
              value={smtp.fromEmail}
              onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
            />
          </div>

          {/* From Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Sender Display Name</label>
            <Input
              placeholder="Ananta Health"
              value={smtp.fromName}
              onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
            />
          </div>
        </div>

        {/* TLS/Secure toggle */}
        <div className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border/60">
          <div>
            <p className="text-sm font-medium text-text">Use TLS / SSL (Port 465)</p>
            <p className="text-xs text-text-muted">Enable for port 465. Leave off for STARTTLS on port 587.</p>
          </div>
          <Toggle checked={smtp.secure} onChange={(checked) => setSmtp({ ...smtp, secure: checked })} />
        </div>

        {/* Test Email Dispatch */}
        <div className="border-t border-border/60 pt-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-text">Test Email Dispatch</p>
            <p className="text-xs text-text-muted mt-0.5">
              Send a test email to verify your gateway is working. Uses saved SMTP config.
            </p>
          </div>
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
              className="rounded-xl cursor-pointer shrink-0 gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Dispatch Test
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
