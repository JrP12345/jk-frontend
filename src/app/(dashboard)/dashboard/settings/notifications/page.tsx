"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notificationService";
import { Card, Button, Toggle, Spinner, useToast, Input } from "@/components/ui";

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  const { data: pref, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationService.getPreferences(),
  });

  const handleSendTestEmail = async () => {
    try {
      setIsSendingTestEmail(true);
      const res = await notificationService.sendTestEmail(testEmailAddress.trim() || undefined);
      toast({
        title: "Test Email Dispatched 📧",
        description: res.message || "Test email sent successfully!",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Email Dispatch Failed",
        description: err.response?.data?.message || "Could not send test email. Verify SMTP credentials in backend/.env",
        variant: "error",
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };


  const [channels, setChannels] = useState({
    email: true,
    inApp: true,
  });

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

  const updateMutation = useMutation({
    mutationFn: () => notificationService.updatePreferences({ channels, categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({
        title: "Preferences Saved",
        description: "Your notification settings have been updated successfully.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not update notification preferences. Please try again.",
        variant: "error",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Spinner size="lg" label="Loading preferences..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text">Notification Preferences</h1>
        <p className="text-sm text-text-muted mt-1">
          Customize how and when you receive notifications in Ananta across delivery channels and event categories.
        </p>
      </div>

      {/* Delivery Channels */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text">Delivery Channels</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Select the communication channels you wish to enable.
          </p>
        </div>

        <div className="space-y-4 divide-y divide-border/60">
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-text">In-App Notifications</p>
              <p className="text-xs text-text-muted">Receive live notification toasts and bell popups while active in Ananta.</p>
            </div>
            <Toggle
              checked={channels.inApp}
              onChange={(checked) => setChannels({ ...channels, inApp: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-text">Email Notifications</p>
              <p className="text-xs text-text-muted">Receive email summaries and real-time alerts for important updates.</p>
            </div>
            <Toggle
              checked={channels.email}
              onChange={(checked) => setChannels({ ...channels, email: checked })}
            />
          </div>
        </div>
      </Card>

      {/* Event Categories */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text">Event Categories</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Turn specific event categories on or off.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Authentication</p>
              <p className="text-xs text-text-muted">New logins, device alerts, password updates</p>
            </div>
            <Toggle
              checked={categories.auth}
              onChange={(checked) => setCategories({ ...categories, auth: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Organization</p>
              <p className="text-xs text-text-muted">Member invitations, role changes, tenancy</p>
            </div>
            <Toggle
              checked={categories.organization}
              onChange={(checked) => setCategories({ ...categories, organization: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Team Activity</p>
              <p className="text-xs text-text-muted">Team additions, role assignments</p>
            </div>
            <Toggle
              checked={categories.team}
              onChange={(checked) => setCategories({ ...categories, team: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Tasks & Workflow</p>
              <p className="text-xs text-text-muted">Task assignments, due dates, mentions</p>
            </div>
            <Toggle
              checked={categories.task}
              onChange={(checked) => setCategories({ ...categories, task: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Healthcare / Patient</p>
              <p className="text-xs text-text-muted">Appointments, lab reports, critical alerts</p>
            </div>
            <Toggle
              checked={categories.patient}
              onChange={(checked) => setCategories({ ...categories, patient: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Billing & Subscription</p>
              <p className="text-xs text-text-muted">Invoices, payment failures, trial ending</p>
            </div>
            <Toggle
              checked={categories.billing}
              onChange={(checked) => setCategories({ ...categories, billing: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">Security Alerts</p>
              <p className="text-xs text-text-muted">Suspicious activities, API key changes</p>
            </div>
            <Toggle
              checked={categories.security}
              onChange={(checked) => setCategories({ ...categories, security: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text">System Alerts</p>
              <p className="text-xs text-text-muted">Maintenance windows, feature updates</p>
            </div>
            <Toggle
              checked={categories.system}
              onChange={(checked) => setCategories({ ...categories, system: checked })}
            />
          </div>
        </div>
      </Card>

      {/* Outbound Email SMTP Gateway Config & Test */}
      <Card className="p-6 space-y-4 border-blue-500/30 dark:border-blue-500/20">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <span>✉️ Outbound Email Gateway & Sender Settings</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Real emails (appointment confirmations, notifications, password resets) are sent via Nodemailer SMTP.
          </p>
        </div>

        <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-2 font-mono border border-border">
          <p className="font-semibold text-text text-sm font-sans mb-1">How to set your Sender Email & SMTP Server Credentials:</p>
          <p className="text-text-muted font-sans">
            Open <code className="bg-background px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono">backend/.env</code> and configure your SMTP provider:
          </p>
          <div className="bg-background p-3 rounded border border-border/80 space-y-1">
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_HOST=smtp.gmail.com</div>
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_PORT=587</div>
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_USER=your-email@gmail.com</div>
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_PASS=your-app-password</div>
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_FROM_EMAIL=your-email@gmail.com</div>
            <div className="text-emerald-600 dark:text-emerald-400">SMTP_FROM_NAME="Ananta Health"</div>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <label className="text-xs font-medium text-text">Test Live Email Delivery</label>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="Enter recipient email (e.g. user@gmail.com)"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="max-w-md text-sm"
            />
            <Button
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail}
            >
              {isSendingTestEmail ? <Spinner size="sm" /> : "Send Test Email 🚀"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="primary"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? <Spinner size="sm" /> : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

