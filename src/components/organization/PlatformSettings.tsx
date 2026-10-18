"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Bell, Building2, MessageSquare, Users } from "lucide-react";
import { Tabs } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import { OrganizationNotifications } from "./OrganizationConfiguration";
import WhatsAppConnectionPanel from "@/app/(dashboard)/dashboard/settings/WhatsAppConnectionPanel";
import styles from "./SettingsWorkspace.module.css";

export function PlatformSettings() {
  const { user } = useAuthStore();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") || "messaging";
  const active = tab === "notifications" ? "notifications" : "messaging";
  if (user?.role !== "root") return null;
  return (
    <div className={styles.workspace}>
      <header className={styles.header}><h1>Platform settings</h1><p>Manage the shared WhatsApp sender and your personal alerts.</p></header>
      <div className={styles.layout}>
        <Tabs className={styles.tabs} variant="pills" scrollActiveIntoView={false} activeTab={active} onChange={id => router.replace(`/dashboard/settings?tab=${id}`, { scroll: false })} tabs={[
          { id: "messaging", label: "WhatsApp", icon: <MessageSquare className="h-4 w-4" />, content: <section className={styles.panel} aria-labelledby="platform-sender-title"><div className={styles.panelHeader}><h2 id="platform-sender-title">Shared WhatsApp sender</h2><p>Used by organizations connected to the platform gateway.</p></div><div className={styles.panelBody}><WhatsAppConnectionPanel isRoot mode="shared" scope="platform" /></div></section> },
          { id: "notifications", label: "My alerts", icon: <Bell className="h-4 w-4" />, content: <OrganizationNotifications isRoot personalOnly /> },
        ]} />
        <aside className={styles.shortcuts} aria-label="Related settings">
          <h2>Administration</h2>
          <Link href={organizationWorkspaceUrl()} className={styles.shortcut}><Building2 className="h-5 w-5" aria-hidden="true" /><span><strong>Choose an organization</strong><small>Branding, members, locations and delivery settings.</small></span><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link href="/dashboard/admin/users" className={styles.shortcut}><Users className="h-5 w-5" aria-hidden="true" /><span><strong>Manage global users</strong><small>Account status and support sessions.</small></span><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
          <p>Dedicated senders and subscriptions are managed in each organization workspace.</p>
        </aside>
      </div>
    </div>
  );
}
