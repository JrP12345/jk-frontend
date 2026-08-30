import { isPrivilegedRole } from "./permissions";

export const routePermissions: Record<string, string[]> = {
  // ── Clinic Essentials (P1) ──────────────────────────────────────
  "/dashboard/patients":            ["VIEW_PATIENTS", "MANAGE_PATIENTS"],
  "/dashboard/appointments":        ["MANAGE_APPOINTMENTS", "VIEW_APPOINTMENTS"],
  "/dashboard/queue":               ["MANAGE_QUEUE", "MANAGE_APPOINTMENTS", "VIEW_APPOINTMENTS"],
  "/dashboard/consultations":       ["VIEW_EHR", "MANAGE_CLINICAL_NOTES"],
  "/dashboard/billing":             ["MANAGE_BILLING", "VIEW_BILLING"],
  "/dashboard/billing/services":    ["MANAGE_BILLING", "VIEW_BILLING"],
  "/dashboard/pharmacy":            ["MANAGE_MEDICINES", "VIEW_EHR"],
  "/dashboard/staff":               ["MANAGE_STAFF", "VIEW_STAFF"],
  "/dashboard/clinics":             ["MANAGE_CLINICS", "VIEW_CLINICS"],
  "/dashboard/shifts":              ["MANAGE_STAFF"],

  // ── Administration ─────────────────────────────────────────────
  "/dashboard/settings":            ["MANAGE_ORGANIZATION"],
  "/dashboard/settings/modules":    ["MANAGE_ORGANIZATION"],
  "/dashboard/audit":               ["VIEW_AUDIT_LOGS", "MANAGE_ORGANIZATION"],
  "/dashboard/analytics":           ["VIEW_ANALYTICS", "MANAGE_ORGANIZATION"],

  // ── P2 / Extended Clinical & Quality ───────────────────────────
  "/dashboard/laboratory":          ["MANAGE_LAB_TESTS", "MANAGE_ORDERS", "VIEW_EHR"],
  "/dashboard/radiology":           ["MANAGE_LAB_TESTS", "MANAGE_ORDERS", "VIEW_EHR"],
  "/dashboard/teleconsultation":    ["VIEW_EHR", "MANAGE_APPOINTMENTS"],
  "/dashboard/insurance":           ["MANAGE_BILLING", "VIEW_BILLING"],
  "/dashboard/feedback":            ["VIEW_EHR"],
};

/**
 * Checks if a user has permission to access a specific route.
 *
 * - root and admin always have full access.
 * - Routes NOT listed in routePermissions are open to all authenticated users
 *   (e.g. /dashboard, /dashboard/notifications, /dashboard/profile).
 * - Routes listed require the user to have at least ONE of the listed permissions.
 */
export function hasRoutePermission(
  route: string,
  userRole: string,
  userPermissions: string[] = []
): boolean {
  // Platform Root Super-Admin exclusive routes
  const ROOT_ONLY_ROUTES = ["/dashboard/organizations", "/dashboard/admin/billing"];
  if (ROOT_ONLY_ROUTES.some(r => route === r || route.startsWith(r + "/"))) {
    return userRole === "root";
  }

  if (isPrivilegedRole(userRole)) return true;

  if (userRole === "patient") {
    const patientAllowed = [
      "/dashboard",
      "/dashboard/notifications",
      "/dashboard/appointments",
      "/dashboard/consultations",
      "/dashboard/teleconsultation",
      "/dashboard/patient-portal",
      "/dashboard/laboratory",
      "/dashboard/radiology",
      "/dashboard/bills",
      "/dashboard/invoices"
    ];
    return patientAllowed.some(p => p === "/dashboard" ? route === "/dashboard" : (route === p || route.startsWith(p + "/")));
  }

  if (route === "/dashboard/patient-portal" || route.startsWith("/dashboard/patient-portal/")) {
    return false;
  }

  // Longest-prefix match so /dashboard/settings/modules beats /dashboard/settings
  const matchedRoute = Object.keys(routePermissions)
    .filter(p => route.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  // No explicit restriction → open to all authenticated users
  if (!matchedRoute) return true;

  const required = routePermissions[matchedRoute];
  return required.some(p => userPermissions.includes(p));
}
