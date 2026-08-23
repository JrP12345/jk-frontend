/** Maps dashboard routes to module keys for route-level module guard checks. */
export const ROUTE_MODULE_MAP: Array<{ prefix: string; moduleKey: string }> = [
  // P1 — Clinic Essentials (always-on modules included for direct-URL guard parity)
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
  { prefix: "/dashboard/clinics", moduleKey: "clinics" },
  { prefix: "/dashboard/shifts", moduleKey: "shifts" },
  { prefix: "/dashboard/settings", moduleKey: "settings" },

  // P2 — extended
  { prefix: "/dashboard/teleconsultation", moduleKey: "teleconsultation" },
  { prefix: "/dashboard/cds", moduleKey: "cds" },
  { prefix: "/dashboard/ambulance-dispatch", moduleKey: "ambulance-dispatch" },
  { prefix: "/dashboard/home-rpm", moduleKey: "home-rpm" },
  { prefix: "/dashboard/emergency", moduleKey: "emergency" },
  { prefix: "/dashboard/admissions", moduleKey: "admissions" },
  { prefix: "/dashboard/laboratory", moduleKey: "laboratory" },
  { prefix: "/dashboard/radiology", moduleKey: "radiology" },
  { prefix: "/dashboard/insurance", moduleKey: "insurance" },
  { prefix: "/dashboard/fhir", moduleKey: "fhir" },
  { prefix: "/dashboard/analytics", moduleKey: "analytics" },
  { prefix: "/dashboard/audit", moduleKey: "audit" },
  { prefix: "/dashboard/feedback", moduleKey: "feedback" },

  // P3 — specialty (dormant by default)
  { prefix: "/dashboard/ot", moduleKey: "ot" },
  { prefix: "/dashboard/dietary", moduleKey: "dietary" },
  { prefix: "/dashboard/transplant", moduleKey: "transplant" },
  { prefix: "/dashboard/blood-bank", moduleKey: "blood-bank" },
  { prefix: "/dashboard/genetics", moduleKey: "genetics" },
  { prefix: "/dashboard/hbot", moduleKey: "hbot" },
  { prefix: "/dashboard/biomedical", moduleKey: "biomedical" },
  { prefix: "/dashboard/cssd", moduleKey: "cssd" },
  { prefix: "/dashboard/biohazard", moduleKey: "biohazard" },
  { prefix: "/dashboard/infection-control", moduleKey: "infection-control" },
  { prefix: "/dashboard/occupational-health", moduleKey: "occupational-health" },
  { prefix: "/dashboard/mortuary", moduleKey: "mortuary" },
];

export function getModuleKeyForRoute(pathname: string): string | undefined {
  const match = ROUTE_MODULE_MAP
    .filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.moduleKey;
}
