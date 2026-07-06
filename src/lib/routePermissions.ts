export const routePermissions: Record<string, string[]> = {
  "/dashboard/staff": ["VIEW_STAFF", "MANAGE_STAFF"],
  "/dashboard/clinics": ["VIEW_CLINICS", "MANAGE_CLINICS"],
  "/dashboard/settings": ["MANAGE_ORGANIZATION"],
  "/dashboard/analytics": ["MANAGE_ORGANIZATION"],
  "/dashboard/appointments": ["VIEW_APPOINTMENTS"],
  "/dashboard/queue": ["VIEW_APPOINTMENTS"],
  "/dashboard/admissions": ["VIEW_APPOINTMENTS"],
  "/dashboard/billing": ["VIEW_APPOINTMENTS"],
  "/dashboard/bills": ["VIEW_APPOINTMENTS"],
  "/dashboard/laboratory": ["VIEW_APPOINTMENTS"],
  "/dashboard/pharmacy": ["VIEW_APPOINTMENTS"]
};

/**
 * Checks if a user has permission to access a specific route.
 * Admins always bypass permission checks.
 */
export function hasRoutePermission(route: string, userRole: string, userPermissions: string[] = []): boolean {
  if (userRole === "admin") return true;

  // Find if there's any mapped requirement for this path
  const matchedRoute = Object.keys(routePermissions).find(p => route.startsWith(p));
  if (!matchedRoute) return true; // Public/unprotected dashboard route by default

  const required = routePermissions[matchedRoute];
  return required.some(p => userPermissions.includes(p));
}
