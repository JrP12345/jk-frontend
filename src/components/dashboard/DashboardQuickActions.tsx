"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { hasRoutePermission } from "@/lib/routePermissions";
import { getDisabledRouteModule } from "@/lib/routeModules";
import { useModuleStore } from "@/store/moduleStore";
import { formatCurrency } from "@/lib/currency";
import type { User } from "@/store/authStore";
import styles from "./DashboardOverview.module.css";

interface DashboardQuickActionsProps {
  user: User | null;
  invoices: Array<{ id: string; invoiceNumber?: string; totalAmount: number; amountPaid?: number; currency?: string }>;
  canViewOpsDashboard: boolean;
}

export function DashboardQuickActions({ user, invoices }: DashboardQuickActionsProps) {
  const { isModuleEnabled } = useModuleStore();
  if (!user) return null;
  const consumer = ["patient", "family_member"].includes(user.role);
  const entries = consumer ? [
    { href: "/browse", label: "Book doctor consultation" },
    { href: "/dashboard/patient-portal", label: "Care records and prescriptions" },
    { href: "/dashboard/bills", label: "Bills and receipts" },
    { href: "/dashboard/laboratory", label: "Lab and diagnostic reports" },
  ] : [
    { href: "/dashboard/queue", label: "Queue desk" },
    { href: "/dashboard/appointments", label: "Appointments" },
    { href: "/dashboard/patients", label: "Patient records" },
    { href: "/dashboard/billing", label: "Patient billing" },
    { href: "/dashboard/staff", label: "Staff and clinicians" },
    { href: "/dashboard/locations", label: "Locations" },
    { href: "/dashboard/organizations", label: "Organizations" },
    { href: "/dashboard/admin/billing", label: "Plans and subscriptions" },
    { href: "/dashboard/audit", label: "Audit log" },
  ];
  const accessible = entries.filter(entry => hasRoutePermission(entry.href, user.role, user.permissions) && !getDisabledRouteModule(entry.href, user, isModuleEnabled));
  return <Card padding="none" className={styles.panel}>
    <CardHeader className={styles.panelHeader}><CardTitle>{consumer ? "Care and billing" : "Quick operations"}</CardTitle></CardHeader>
    <CardContent className={`${styles.panelBody} space-y-3`}>
      {consumer && invoices.length > 0 && <div className="space-y-2">
        <p className="text-xs text-text-muted">Recent unpaid invoices</p>
        {invoices.slice(0, 5).map(invoice => <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0"><p className="truncate text-xs text-text-muted">Invoice {invoice.invoiceNumber || invoice.id.slice(0, 8)}</p><p className="font-semibold tabular-nums">{formatCurrency(Math.max(0, invoice.totalAmount - (invoice.amountPaid || 0)), invoice.currency)}</p></div>
          <Link href="/dashboard/bills" className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm text-accent focus-visible:ring-2 focus-visible:ring-focus-ring">View bill</Link>
        </div>)}
      </div>}
      <div className={styles.quickLinks}>{accessible.map(entry => <Link key={entry.href} href={entry.href} className="flex min-h-11 items-center rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">{entry.label}</Link>)}</div>
    </CardContent>
  </Card>;
}
