"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Bell, Building2, CreditCard } from "lucide-react";
import { Alert, Tabs, LoadingState, SkeletonForm } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { OrganizationNotifications } from "@/components/organization/OrganizationConfiguration";
import { PlatformSettings } from "@/components/organization/PlatformSettings";
import BillingSettingsPage from "./billing/page";
import styles from "@/components/organization/SettingsWorkspace.module.css";

function OrganizationSettings() {
  const { user } = useAuthStore();
  const params = useSearchParams();
  const canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const canBill = hasAnyPermission(user, "MANAGE_BILLING");
  const tabs = [
    { id: "organization", label: "Organization", icon: <Building2 className="h-4 w-4" />, allowed: canManage },
    { id: "notifications", label: "My alerts", icon: <Bell className="h-4 w-4" />, allowed: true },
    { id: "billing", label: "Subscription", icon: <CreditCard className="h-4 w-4" />, allowed: canBill },
  ].filter(tab => tab.allowed);
  const [selected, setSelected] = useState(params.get("tab") || (canManage ? "organization" : "notifications"));
  const active = tabs.some(tab => tab.id === selected) ? selected : "notifications";
  // Organization settings always use the signed-in membership, never a URL override.
  const organizationId = user?.organization_id;
  const content = {
    organization: organizationId ? <section className={styles.panel} aria-labelledby="organization-settings-title"><div className={styles.panelHeader}><h2 id="organization-settings-title">Organization workspace</h2><p>Manage branding, members, access, locations and delivery settings in one place.</p></div><div className={styles.panelBody}><Link href={organizationWorkspaceUrl(organizationId)} className={styles.primaryLink}>Open your organization <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div></section> : <Alert title="Organization unavailable">Your account is not linked to an organization.</Alert>,
    notifications: <OrganizationNotifications personalOnly />,
    billing: <BillingSettingsPage selectedOrgId={organizationId} isRoot={false} />,
  };
  return <div className={styles.workspace}>
    <header className={styles.header}><h1>Settings</h1><p>Manage your organization, personal alerts and subscription.</p></header>
    <Tabs className={styles.tabs} variant="pills" scrollActiveIntoView={false} tabs={tabs.map(tab => ({ ...tab, content: content[tab.id as keyof typeof content] }))} activeTab={active} onChange={setSelected} />
  </div>;
}
export default function SettingsPage() {
  const { user } = useAuthStore();
  return <Suspense fallback={<LoadingState label="Loading settings"><SkeletonForm fields={4} /></LoadingState>}>{user?.role === "root" ? <PlatformSettings /> : <OrganizationSettings />}</Suspense>;
}
