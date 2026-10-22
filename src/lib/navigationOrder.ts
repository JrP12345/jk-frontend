type NavigationEntry = { href: string; section?: string };
const care = "Outpatient (OPD)";
const diagnostics = "Diagnostics & Pharmacy";
const finance = "Billing & Finance";
const administration = "Administration & Facilities";
const reporting = "Reporting";
const utilities = "Account & Settings";
const sections: Record<string, string[]> = {
  admin: [care, finance, administration, reporting, diagnostics, utilities],
  doctor: [care, diagnostics, finance, reporting, administration, utilities],
  nurse: [care, diagnostics, finance, reporting, administration, utilities],
  receptionist: [care, finance, diagnostics, reporting, administration, utilities],
  lab_tech: [diagnostics, care, finance, reporting, administration, utilities],
  pharmacist: [diagnostics, finance, care, reporting, administration, utilities],
  cashier: [finance, care, diagnostics, reporting, administration, utilities],
};

/** Order existing, permission-filtered entries without creating role-specific sidebars. */
export function orderNavigation<T extends NavigationEntry>(items: readonly T[], role: string | undefined, pharmacyFirst = false): T[] {
  if (pharmacyFirst) {
    const routes = ["/dashboard", "/dashboard/pharmacy", "/dashboard/locations", "/dashboard/staff", "/dashboard/settings", "/dashboard/organizations", "/dashboard/audit", "/dashboard/notifications"];
    return [...items].sort((a, b) => (routes.indexOf(a.href) < 0 ? routes.length : routes.indexOf(a.href)) - (routes.indexOf(b.href) < 0 ? routes.length : routes.indexOf(b.href)));
  }
  const groups = sections[role || ""];
  if (!groups) return [...items]; // Patient and platform groups already follow their own workflows.
  const visits = role === "doctor" || role === "nurse"
    ? ["queue", "consultations", "appointments", "patients", "teleconsultation"]
    : ["queue", "appointments", "patients", "consultations", "teleconsultation"];
  const diagnosticRoutes = role === "pharmacist" ? ["pharmacy", "laboratory", "radiology"] : ["laboratory", "radiology", "pharmacy"];
  const rank = (item: T, index: number) => {
    if (item.href === "/dashboard") return -1;
    const group = groups.indexOf(item.section || "");
    const routes = item.section === care ? visits : item.section === diagnostics ? diagnosticRoutes : [];
    const route = routes.indexOf(item.href.replace("/dashboard/", ""));
    return (group < 0 ? groups.length : group) * 1000 + (route < 0 ? index : route);
  };
  return items.map((item, index) => ({ item, rank: rank(item, index) })).sort((a, b) => a.rank - b.rank).map(({ item }) => item);
}
