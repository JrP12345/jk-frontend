import type { User } from "@/store/authStore";
export function isPharmacyWorkspace(user: User | null) {
  return Boolean(user?.workspaceProfile === "pharmacy" && !["root", "patient", "family_member", "guest"].includes(user.role));
}
export function pharmacyWorkspaceRoute(href: string) {
  return href === "/dashboard" || ["/dashboard/pharmacy", "/dashboard/staff", "/dashboard/locations", "/dashboard/settings", "/dashboard/security", "/dashboard/organizations", "/dashboard/notifications", "/dashboard/audit"].some(path => href === path || href.startsWith(`${path}/`));
}
