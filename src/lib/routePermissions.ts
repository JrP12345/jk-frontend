export const routePermissions: Record<string, string[]> = {
  "/dashboard/staff": ["MANAGE_STAFF"],
  "/dashboard/clinics": ["MANAGE_CLINICS"],
  "/dashboard/settings": ["MANAGE_ORGANIZATION"],
  "/dashboard/analytics": ["VIEW_ANALYTICS", "MANAGE_ORGANIZATION"],
  "/dashboard/audit": ["VIEW_AUDIT_LOGS", "MANAGE_ORGANIZATION"],
  "/dashboard/appointments": ["MANAGE_APPOINTMENTS", "VIEW_PATIENTS"],
  "/dashboard/queue": ["MANAGE_QUEUE", "MANAGE_APPOINTMENTS"],
  "/dashboard/admissions": ["VIEW_PATIENTS", "MANAGE_PATIENTS", "MANAGE_APPOINTMENTS"],
  "/dashboard/billing": ["MANAGE_BILLING"],
  "/dashboard/bills": ["VIEW_EHR", "MANAGE_BILLING"],
  "/dashboard/laboratory": ["ORDER_LABS", "RECORD_LAB_RESULTS", "VIEW_EHR"],
  "/dashboard/pharmacy": ["ADMINISTER_MEDICATIONS", "VIEW_PATIENTS"],
  "/dashboard/shifts": ["MANAGE_STAFF"],
  "/dashboard/dietary": ["VIEW_PATIENTS"],
  "/dashboard/biomedical": ["MANAGE_ORGANIZATION"],
  "/dashboard/transplant": ["VIEW_EHR"],
  "/dashboard/mortuary": ["VIEW_PATIENTS"],
  "/dashboard/biohazard": ["MANAGE_ORGANIZATION"],
  "/dashboard/genetics": ["VIEW_EHR"],
  "/dashboard/cssd": ["MANAGE_ORGANIZATION"],
  "/dashboard/infection-control": ["MANAGE_ORGANIZATION"],
  "/dashboard/occupational-health": ["MANAGE_ORGANIZATION"],
  "/dashboard/home-rpm": ["VIEW_EHR"],
  "/dashboard/hbot": ["VIEW_EHR"],
  "/dashboard/ambulance-dispatch": ["MANAGE_APPOINTMENTS"],
  "/dashboard/emergency": ["VIEW_PATIENTS", "EVALUATE_NEWS2"],
  "/dashboard/blood-bank": ["VIEW_PATIENTS"],
  "/dashboard/ot": ["VIEW_EHR"],
  "/dashboard/radiology": ["ORDER_LABS", "RECORD_LAB_RESULTS", "VIEW_EHR"],
  "/dashboard/teleconsultation": ["VIEW_EHR", "MANAGE_APPOINTMENTS"],
  "/dashboard/feedback": ["VIEW_PATIENTS"],
  "/dashboard/insurance": ["MANAGE_BILLING"],
  "/dashboard/cds": ["VIEW_EHR"],
  "/dashboard/consultations": ["VIEW_EHR", "MANAGE_CLINICAL_NOTES"],
  "/dashboard/fhir": ["VIEW_EHR", "MANAGE_ORGANIZATION"],
  "/dashboard/settings/modules": ["MANAGE_ORGANIZATION"],
};

/**
 * Checks if a user has permission to access a specific route.
 * Admins always bypass permission checks.
 */
export function hasRoutePermission(route: string, userRole: string, userPermissions: string[] = []): boolean {
  if (userRole === "root" || userRole === "admin") return true;

  // Find if there's any mapped requirement for this path
  const matchedRoute = Object.keys(routePermissions).find(p => route.startsWith(p));
  if (!matchedRoute) return false;

  const required = routePermissions[matchedRoute];
  return required.some(p => userPermissions.includes(p));
}
