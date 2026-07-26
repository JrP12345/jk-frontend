"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiAdminService, type AIConfig } from "@/services/aiAdmin.service";
import { Card, Button, Toggle, Spinner, useToast } from "@/components/ui";

const MODEL_OPTIONS = [
  {
    value: "CLINICAL_FAST",
    label: "Clinical Fast",
    desc: "Fastest responses. Best for routine queries, triage summaries, and quick lookups.",
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: "border-emerald-500/40 bg-emerald-500/5",
    activeColor: "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30",
  },
  {
    value: "CLINICAL_ACCURATE",
    label: "Clinical Accurate",
    desc: "Balanced speed and accuracy. Ideal for clinical notes, prescriptions, and differential diagnosis.",
    icon: (
      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "border-blue-500/40 bg-blue-500/5",
    activeColor: "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30",
  },
  {
    value: "CLINICAL_REASONING",
    label: "Clinical Reasoning",
    desc: "Deep reasoning model. Best for complex case analysis, rare conditions, and multi-step clinical logic.",
    icon: (
      <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.5.5 0 01-.707 0l-3.182-3.182M7.5 9l4 4 4-4" />
      </svg>
    ),
    color: "border-violet-500/40 bg-violet-500/5",
    activeColor: "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30",
  },
] as const;

const QUOTA_PRESETS = [
  { label: "1M tokens", value: 1_000_000 },
  { label: "5M tokens", value: 5_000_000 },
  { label: "10M tokens", value: 10_000_000 },
  { label: "25M tokens", value: 25_000_000 },
  { label: "Unlimited", value: 999_999_999 },
];

export default function AISettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-admin-config"],
    queryFn: () => aiAdminService.getConfig(),
  });

  const [form, setForm] = useState<AIConfig>({
    defaultModelAlias: "CLINICAL_FAST",
    monthlyTokenQuota: 10_000_000,
    featureFlags: {
      enableStreaming: true,
      enablePHIAnonymization: true,
      enableMultiAgentRouting: true,
      enableToolExecution: true,
    },
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: () => aiAdminService.updateConfig(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-admin-config"] });
      toast({ title: "AI Config Saved", description: "AI settings updated successfully.", variant: "success" });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err?.response?.data?.message || "Could not save AI configuration.",
        variant: "error",
      });
    },
  });

  const setFlag = (key: keyof typeof form.featureFlags, value: boolean) => {
    setForm((prev) => ({ ...prev, featureFlags: { ...prev.featureFlags, [key]: value } }));
  };

  const quotaLabel = (v: number) => {
    if (v >= 999_999_999) return "Unlimited";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M tokens`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K tokens`;
    return `${v} tokens`;
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Spinner size="lg" label="Loading AI configuration..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">AI Configuration</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Control AI model selection, token quota, and clinical feature flags for your organization.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => updateMutation.mutate()}
          loading={updateMutation.isPending}
          className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Save Config</span>
        </Button>
      </div>

      {/* Default Model Selection */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text">Default AI Model</h2>
          <p className="text-xs text-text-muted mt-0.5">
            The AI model used by default across the platform for all clinical queries and generation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODEL_OPTIONS.map((model) => {
            const isActive = form.defaultModelAlias === model.value;
            return (
              <button
                key={model.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, defaultModelAlias: model.value }))}
                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isActive ? model.activeColor : `${model.color} hover:border-opacity-70`
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {model.icon}
                  <span className="text-sm font-semibold text-text">{model.label}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-text/10 text-text">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{model.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Monthly Token Quota */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text">Monthly Token Quota</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Maximum AI tokens allowed per calendar month for this organization. Resets monthly.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUOTA_PRESETS.map((preset) => {
            const isActive = form.monthlyTokenQuota === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, monthlyTokenQuota: preset.value }))}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "border-border bg-surface text-text hover:border-primary/50"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-bg/60 border border-border/60">
          <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-text-muted">
            Current quota: <span className="font-semibold text-text">{quotaLabel(form.monthlyTokenQuota)}</span> / month.
            Tokens count across all AI features — copilot, SOAP notes, clinical reasoning, and chat.
          </p>
        </div>
      </Card>

      {/* Feature Flags */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text">Clinical AI Feature Flags</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Enable or disable specific AI capabilities platform-wide for your organization.
          </p>
        </div>

        <div className="space-y-1 divide-y divide-border/50">
          {([
            {
              key: "enableStreaming" as const,
              label: "Real-time Streaming Response",
              desc: "Stream AI responses word-by-word as they generate for a faster perceived experience.",
              badge: null,
              badgeColor: null,
            },
            {
              key: "enablePHIAnonymization" as const,
              label: "PHI Anonymization",
              desc: "Automatically redact Protected Health Information before sending data to the AI model.",
              badge: "Recommended",
              badgeColor: "bg-green-500/10 text-green-600 border-green-500/20",
            },
            {
              key: "enableMultiAgentRouting" as const,
              label: "Multi-Agent Routing",
              desc: "Route complex queries to specialized clinical sub-agents for better accuracy.",
              badge: null,
              badgeColor: null,
            },
            {
              key: "enableToolExecution" as const,
              label: "AI Tool Execution",
              desc: "Allow AI to trigger clinical tools (lab orders, medication checks) with clinician co-signature.",
              badge: "Advanced",
              badgeColor: "bg-violet-500/10 text-violet-600 border-violet-500/20",
            },
          ]).map(({ key, label, desc, badge, badgeColor }) => (
            <div key={key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text">{label}</p>
                  {badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">{desc}</p>
              </div>
              <Toggle
                checked={form.featureFlags[key]}
                onChange={(checked) => setFlag(key, checked)}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
