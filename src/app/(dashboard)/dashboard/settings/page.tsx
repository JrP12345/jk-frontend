"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { OrganizationDetails } from "@/components/organization/OrganizationDetails";
import { OrganizationNotifications as NotificationsTab, OrganizationAISettings as AISettingsTab } from "@/components/organization/OrganizationConfiguration";
import { organizationPath } from "@/services/organization.service";
import { Alert, Button, Select, Badge, SkeletonForm, cn } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

import BillingSettingsPage from "./billing/page";
import { OrganizationModules } from "@/components/organization/OrganizationModules";
import { Building2, Bell, Sparkles, LayoutGrid, CreditCard } from "lucide-react";

type Tab = "organization" | "notifications" | "ai" | "modules" | "billing";

const TABS: { id: Tab; label: string; rootOnly?: boolean; icon: React.ReactNode }[] = [
  {
    id: "organization",
    label: "Organization Details",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "notifications",
    label: "Notifications & Messaging Gateway",
    icon: <Bell className="w-4 h-4" />,
  },
  {
    id: "ai",
    label: "AI Configuration",
    rootOnly: true,
    icon: <Sparkles className="w-4 h-4 text-accent" />,
  },
  {
    id: "modules",
    label: "Module Manager",
    rootOnly: true,
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
function OrganizationTab({ selectedOrgId, isRoot }: { selectedOrgId?: string; isRoot?: boolean; orgsLoading?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["organization-details", selectedOrgId],
    queryFn: async () => (await api.get(organizationPath("/onboarding/organization/me", selectedOrgId))).data.data,
    enabled: !isRoot || !!selectedOrgId,
  });
  if (isRoot && !selectedOrgId) return <p className="text-sm text-text-muted">Select an organization to manage its details.</p>;
  if (isLoading) return <SkeletonForm fields={5} />;
  if (error) return <Alert variant="error" title="Organization could not be loaded" action={<Button onClick={() => refetch()}>Retry</Button>}>Please try again.</Alert>;
  if (!data) return null;
  return <OrganizationDetails organization={{ ...data, id: data.id || data._id }} onSaved={() => { void refetch(); }} />;
}
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("organization");
  const { user } = useAuthStore();
  const isRoot = user?.role === "root";
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgsLoading, setOrgsLoading] = useState<boolean>(isRoot);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "billing") setActiveTab("billing");
  }, []);

  useEffect(() => {
    if (isRoot) {
      setOrgsLoading(true);
      api
        .get("/organizations")
        .then((res) => {
          const orgList = res.data.data?.organizations || res.data.data || [];
          setOrganizations(orgList);
          if (orgList.length > 0) {
            const requestedOrgId = new URLSearchParams(window.location.search).get("organizationId");
            const matchingOrg = orgList.find((org: any) => (org.id || org._id) === requestedOrgId);
            setSelectedOrgId((prev) => matchingOrg?.id || matchingOrg?._id || prev || orgList[0].id || orgList[0]._id);
          }
        })
        .catch(() => {})
        .finally(() => setOrgsLoading(false));
    }
  }, [isRoot]);

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                {isRoot ? "Platform Settings" : "Organization Settings"}
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                {isRoot ? "System Governance" : "Organization Management"}
              </Badge>
              {isRoot && (
                <Badge variant="secondary" size="sm" className="font-semibold text-[10px] bg-primary/10 text-accent dark:text-accent border border-accent/20">
                  Platform administration
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              {isRoot
                ? "Manage organization details, notification preferences, email gateway, commercial billing, and AI configuration."
                : "Manage your clinic organization profile, notification channels, clinical modules, and subscriptions."}
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
      <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto touch-manipulation scrollbar-none w-full md:w-fit max-w-full">
        {TABS.filter((tab) => !tab.rootOnly || isRoot).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 min-h-[38px] sm:min-h-[32px]",
                isActive
                  ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                  : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
              )}
            >
              <span className={cn(isActive ? "text-accent" : "text-text-muted")}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.rootOnly && (
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                    isActive
                      ? "bg-primary-500/10 text-accent dark:text-accent"
                      : "bg-warning/15 text-warning-text dark:text-warning-text"
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
      {activeTab === "organization" && (
        <OrganizationTab
          selectedOrgId={selectedOrgId}
          isRoot={isRoot}
          orgsLoading={orgsLoading}
        />
      )}
      {activeTab === "notifications" && (
        <NotificationsTab
          selectedOrgId={selectedOrgId}
          isRoot={isRoot}
          orgsLoading={orgsLoading}
        />
      )}
      {activeTab === "ai" && (
        <AISettingsTab
          selectedOrgId={selectedOrgId}
          isRoot={isRoot}
          orgsLoading={orgsLoading}
        />
      )}
      {activeTab === "modules" && <OrganizationModules organizationId={selectedOrgId} />}
      {activeTab === "billing" && (
        <BillingSettingsPage
          selectedOrgId={selectedOrgId}
          isRoot={isRoot}
          orgsLoading={orgsLoading}
        />
      )}
    </div>
  );
}
