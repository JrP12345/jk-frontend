"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, CheckCheck, Inbox, MessageSquare, Settings2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import styles from "./CrmWorkspace.module.css";

type Workflow = "inquiries" | "tasks" | "communications" | "overview" | "settings";

export function CrmWorkspaceLayout({ active, title, description, action, children }: {
  active: Workflow; title: string; description: string; action?: ReactNode; children: ReactNode;
}) {
  const user = useAuthStore(state => state.user);
  const navigation = useRef<HTMLElement>(null);
  const links = [
    { id: "inquiries", label: "Inquiries", href: "/dashboard/crm", icon: Inbox, allowed: true },
    { id: "tasks", label: "Daily tasks", href: "/dashboard/crm/tasks", icon: CheckCheck, allowed: !!user?.organization_id },
    { id: "communications", label: "Replies", href: "/dashboard/crm/communications", icon: MessageSquare, allowed: hasAnyPermission(user, "COMMUNICATE_PATIENTS") },
    { id: "overview", label: "Overview", href: "/dashboard/crm/overview", icon: ChartNoAxesCombined, allowed: !!user?.organization_id && hasAnyPermission(user, "VIEW_CRM_ANALYTICS") },
    { id: "settings", label: "Workflow settings", href: "/dashboard/crm/settings", icon: Settings2, allowed: !!user?.organization_id && hasAnyPermission(user, "MANAGE_CRM_SETTINGS") },
  ].filter(link => link.allowed);

  useEffect(() => {
    const rail = navigation.current;
    const selected = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !selected) return;
    const reveal = () => {
      const bounds = rail.getBoundingClientRect(), item = selected.getBoundingClientRect();
      if (item.left < bounds.left || item.right > bounds.right) {
        rail.scrollTo({ left: rail.scrollLeft + item.left - bounds.left - 6, behavior: "instant" });
      }
    };
    reveal();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reveal);
    observer?.observe(rail);
    return () => observer?.disconnect();
  }, [active]);

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>{title}</h1><p>{description}</p></div>
      {action && <div className={styles.headerAction}>{action}</div>}
    </header>
    <nav ref={navigation} aria-label="Patient relationship workflows" className={styles.navigation}>
      {links.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} aria-current={active === id ? "page" : undefined}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{label}</span></Link>)}
    </nav>
    {children}
  </div>;
}

export function CrmFilterPanel({ children, search, actions, activeCount = 0 }: {
  children: ReactNode; search?: ReactNode; actions?: ReactNode; activeCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const fieldsId = useId();
  return <div className={styles.filters}>
    <div className={styles.filterToolbar}>
      {search && <div className={styles.search}>{search}</div>}
      <Button variant="outline" className={styles.filterToggle} aria-label="Filters" title="Filters" aria-expanded={expanded} aria-controls={fieldsId} onClick={() => setExpanded(value => !value)}><SlidersHorizontal className="h-4 w-4 shrink-0" /><span className={styles.filterText}>Filters</span>{activeCount > 0 && <span className={styles.filterCount}>{activeCount}</span>}</Button>
      {actions && <div className={styles.toolbarActions}>{actions}</div>}
    </div>
    <div id={fieldsId} className={styles.filterFields} data-expanded={expanded}>{children}</div>
  </div>;
}
