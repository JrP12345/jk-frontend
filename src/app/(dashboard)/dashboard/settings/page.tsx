"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, Building2, CreditCard, Settings2 } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Spinner, Tabs } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { OrganizationNotifications } from "@/components/organization/OrganizationConfiguration";
import { PlatformSettings } from "@/components/organization/PlatformSettings";
import BillingSettingsPage from "./billing/page";

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
  return <div className="space-y-6 pb-8 min-w-0">
    <Card padding="lg" className="bg-gradient-to-br from-primary-500/10 via-surface to-surface border-primary-500/20">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-accent-subtle p-3 text-accent"><Settings2 className="h-6 w-6" /></span><div><Badge variant="primary">Your workspace</Badge><h1 className="text-xl sm:text-2xl font-semibold mt-2">Settings</h1><p className="text-sm text-text-secondary mt-2">Manage your alerts and organization subscription. Organization administration is available in the organization workspace.</p></div></div>
    </Card>
    <Tabs variant="pills" tabs={tabs} activeTab={active} onChange={setSelected} />
    {active === "organization" && (organizationId ? <Card><CardHeader><CardTitle as="h2">Organization workspace</CardTitle><p className="text-sm text-text-muted">Manage your branding, members, access, locations and organization delivery settings in one place.</p></CardHeader><CardContent><Link href={organizationWorkspaceUrl(organizationId)} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Open your organization →</Link></CardContent></Card> : <Alert title="Organization unavailable">Your account is not linked to an organization.</Alert>)}
    {active === "notifications" && <OrganizationNotifications personalOnly />}
    {active === "billing" && <BillingSettingsPage selectedOrgId={organizationId} isRoot={false} />}
  </div>;
}
export default function SettingsPage() {
  const { user } = useAuthStore();
  return <Suspense fallback={<Spinner label="Loading settings" />}>{user?.role === "root" ? <PlatformSettings /> : <OrganizationSettings />}</Suspense>;
}
