"use client";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { pharmacyEntryPermissions } from "@/lib/pharmacyCapabilities";
export function PharmacyHome() {
  const user = useAuthStore(state => state.user);
  const owner = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  return <section aria-label="Pharmacy workspace" className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-semibold">Pharmacy workspace</h1><p className="mt-2 text-text-secondary">Manage counter sales, stock, purchases, collections and branch records.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {hasAnyPermission(user, ...pharmacyEntryPermissions) && <Link className="rounded-xl border border-border bg-surface p-4 font-medium" href="/dashboard/pharmacy">Open pharmacy workspace</Link>}
      {hasAnyPermission(user, "MANAGE_LOCATIONS", "VIEW_LOCATIONS") && <Link className="rounded-xl border border-border bg-surface p-4 font-medium" href="/dashboard/locations">Review branch issuer, licences and pharmacy access</Link>}
      {hasAnyPermission(user, "MANAGE_STAFF", "VIEW_STAFF") && <Link className="rounded-xl border border-border bg-surface p-4 font-medium" href="/dashboard/staff">Manage staff and branch permissions</Link>}
      {hasAnyPermission(user, "MANAGE_BILLING", "MANAGE_ORGANIZATION") && <Link className="rounded-xl border border-border bg-surface p-4 font-medium" href="/dashboard/settings/billing">Review subscription and trial</Link>}
    </div>
    {owner && <p className="text-sm text-text-secondary">Before the first sale, review the branch issuer and operating licences, enable pharmacy, configure product units and classification, receive actual dated stock, and open a drawer for cash collection.</p>}
  </section>;
}
