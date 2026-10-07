"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { OrganizationNotifications } from "./OrganizationConfiguration";
import WhatsAppConnectionPanel from "@/app/(dashboard)/dashboard/settings/WhatsAppConnectionPanel";

export function PlatformSettings() {
  const { user } = useAuthStore();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") || "messaging";
  const active = tab === "notifications" ? "notifications" : "messaging";
  if (user?.role !== "root") return null;
  return <div className="space-y-6 pb-8 min-w-0">
    <Card padding="lg" className="bg-gradient-to-br from-primary-500/10 via-surface to-surface border-primary-500/20">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-accent-subtle p-3 text-accent"><ShieldCheck className="h-6 w-6" /></span><div><Badge variant="primary">Root administration</Badge><h1 className="mt-2 text-xl sm:text-2xl font-semibold text-text">Platform settings</h1></div></div>
      <p className="mt-3 text-sm text-text-secondary">Manage the platform sender and your own alerts. Organization controls are available in each organization workspace.</p>
    </Card>
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" />Organization controls</CardTitle></CardHeader><CardContent><p className="text-sm text-text-muted">Branding, memberships, access, subscriptions and organization delivery settings.</p><Link href={organizationWorkspaceUrl()} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Choose an organization →</Link></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" />Global identities</CardTitle></CardHeader><CardContent><p className="text-sm text-text-muted">Platform account status and support sessions across organizations.</p><Link href="/dashboard/admin/users" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Manage global users →</Link></CardContent></Card>
    </div>
    <Tabs variant="pills" activeTab={active} onChange={id => router.replace(`/dashboard/settings?tab=${id}`, { scroll: false })} tabs={[
      { id: "messaging", label: "Platform WhatsApp", icon: <MessageSquare className="h-4 w-4" /> },
      { id: "notifications", label: "My notification preferences", icon: <Bell className="h-4 w-4" /> },
    ]} />
    {active === "messaging" ? <Card><CardHeader><CardTitle>Shared WhatsApp sender</CardTitle><p className="text-sm text-text-muted mt-1">These credentials serve all organizations using the shared gateway. Dedicated organization senders are managed in their own workspace.</p></CardHeader><CardContent><WhatsAppConnectionPanel isRoot mode="shared" scope="platform" /></CardContent></Card> : <OrganizationNotifications isRoot personalOnly />}
  </div>;
}
