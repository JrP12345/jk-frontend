export const routePermissions: Record<string, string[]> = {
  // Administration (admin-only routes)
  "/dashboard/staff":               ["MANAGE_STAFF"],
  "/dashboard/clinics":             ["MANAGE_CLINICS"],
  "/dashboard/settings":            ["MANAGE_ORGANIZATION"],
  "/dashboard/audit":               ["VIEW_AUDIT_LOGS", "MANAGE_ORGANIZATION"],
  "/dashboard/fhir":                ["VIEW_EHR", "MANAGE_ORGANIZATION"],
  "/dashboard/settings/modules":    ["MANAGE_ORGANIZATION"],
  "/dashboard/biomedical":          ["MANAGE_ORGANIZATION"],
  "/dashboard/biohazard":           ["MANAGE_ORGANIZATION"],
  "/dashboard/cssd":                ["MANAGE_ORGANIZATION"],
  "/dashboard/infection-control":   ["MANAGE_ORGANIZATION"],
  "/dashboard/occupational-health": ["MANAGE_ORGANIZATION"],

  // Receptionist / clinical-desk accessible
  "/dashboard/appointments":        ["MANAGE_APPOINTMENTS", "VIEW_APPOINTMENTS"],
  "/dashboard/queue":               ["MANAGE_QUEUE", "MANAGE_APPOINTMENTS"],
  "/dashboard/admissions":          ["VIEW_ADMISSIONS", "MANAGE_ADMISSIONS"],
  "/dashboard/billing":             ["MANAGE_BILLING", "VIEW_BILLING"],
  "/dashboard/bills":               ["VIEW_EHR", "MANAGE_BILLING", "VIEW_BILLING"],
  "/dashboard/ambulance-dispatch":  ["MANAGE_APPOINTMENTS", "MANAGE_ADMISSIONS"],
  "/dashboard/emergency":           ["MANAGE_EHR", "VIEW_EHR", "MANAGE_ADMISSIONS"],

  // Doctor / nurse / clinical staff
  "/dashboard/laboratory":          ["MANAGE_LAB_TESTS", "MANAGE_ORDERS", "VIEW_EHR"],
  "/dashboard/pharmacy":            ["MANAGE_MEDICINES", "ADMINISTER_MEDICATION", "VIEW_EHR"],
  "/dashboard/radiology":           ["MANAGE_LAB_TESTS", "MANAGE_ORDERS", "VIEW_EHR"],
  "/dashboard/teleconsultation":    ["VIEW_EHR", "MANAGE_APPOINTMENTS"],
  "/dashboard/cds":                 ["VIEW_EHR"],
  "/dashboard/consultations":       ["VIEW_EHR", "MANAGE_CLINICAL_NOTES"],
  "/dashboard/transplant":          ["VIEW_EHR"],
  "/dashboard/genetics":            ["VIEW_EHR"],
  "/dashboard/home-rpm":            ["VIEW_EHR"],
  "/dashboard/hbot":                ["VIEW_EHR"],
  "/dashboard/ot":                  ["VIEW_EHR"],
  "/dashboard/blood-bank":          ["VIEW_EHR"],
  "/dashboard/mortuary":            ["VIEW_EHR"],
  "/dashboard/dietary":             ["VIEW_EHR"],
  "/dashboard/feedback":            ["VIEW_EHR"],

  // Analytics
  "/dashboard/analytics":           ["VIEW_ANALYTICS", "MANAGE_ORGANIZATION"],

  // Staff scheduling
  "/dashboard/shifts":              ["MANAGE_STAFF"],

  // Insurance / tariffs
  "/dashboard/insurance":           ["MANAGE_BILLING", "VIEW_BILLING"],
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
  if (userRole === "root" || userRole === "admin") return true;

  // Longest-prefix match so /dashboard/settings/modules beats /dashboard/settings
  const matchedRoute = Object.keys(routePermissions)
    .filter(p => route.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  // No explicit restriction → open to all authenticated users
  if (!matchedRoute) return true;

  const required = routePermissions[matchedRoute];
  return required.some(p => userPermissions.includes(p));
}
