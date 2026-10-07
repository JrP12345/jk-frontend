/** Maps dashboard routes to module keys for route-level module guard checks. */
export function requiresTenantModules(user: { role: string; impersonatedBy?: { id: string } | null } | null): boolean {
  if (!user || user.role === "patient" || user.role === "family_member") return false;
  // Use the effective session role; a root impersonating staff has tenant limits.
  return user.role !== "root" || Boolean(user.impersonatedBy?.id);
}

export function getDisabledRouteModule(
  pathname: string,
  user: Parameters<typeof requiresTenantModules>[0],
  isModuleEnabled: (moduleKey: string) => boolean,
): string | undefined {
  if (!requiresTenantModules(user)) return undefined;
  const key = getModuleKeyForRoute(pathname);
  return key && !isModuleEnabled(key) ? key : undefined;
}

export const ROUTE_MODULE_MAP: Array<{ prefix: string; moduleKey: string }> = [
  // P1 — Location Essentials (always-on modules included for direct-URL guard parity)
  { prefix: "/dashboard", moduleKey: "dashboard" },
  { prefix: "/dashboard/notifications", moduleKey: "notifications" },
  { prefix: "/dashboard/appointments", moduleKey: "appointments" },
  { prefix: "/dashboard/queue", moduleKey: "queue" },
  { prefix: "/dashboard/patients", moduleKey: "patients" },
  { prefix: "/dashboard/patient-portal", moduleKey: "patients" },
  { prefix: "/dashboard/consultations", moduleKey: "consultations" },
  { prefix: "/dashboard/billing/services", moduleKey: "service-catalog" },
  { prefix: "/dashboard/billing", moduleKey: "billing" },
  { prefix: "/dashboard/pharmacy", moduleKey: "pharmacy" },
  { prefix: "/dashboard/staff", moduleKey: "staff" },
  { prefix: "/dashboard/locations", moduleKey: "locations" },
  { prefix: "/dashboard/shifts", moduleKey: "shifts" },
  { prefix: "/dashboard/settings", moduleKey: "settings" },

  // P2 — Important / Extended
  { prefix: "/dashboard/laboratory", moduleKey: "laboratory" },
  { prefix: "/dashboard/radiology", moduleKey: "radiology" },
  { prefix: "/dashboard/teleconsultation", moduleKey: "teleconsultation" },
  { prefix: "/dashboard/insurance", moduleKey: "insurance" },
  { prefix: "/dashboard/analytics", moduleKey: "analytics" },
  { prefix: "/dashboard/audit", moduleKey: "audit" },
  { prefix: "/dashboard/feedback", moduleKey: "feedback" },
];

export function getModuleKeyForRoute(pathname: string): string | undefined {
  const match = ROUTE_MODULE_MAP
    .filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.moduleKey;
}
