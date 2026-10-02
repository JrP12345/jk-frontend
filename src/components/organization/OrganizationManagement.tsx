"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { organizationImageUrl, type OrganizationRecord } from "@/services/organization.service";
import { CreateOrganization } from "./CreateOrganization";
import { OrganizationDetails } from "./OrganizationDetails";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrganizationNotifications, OrganizationAISettings } from "./OrganizationConfiguration";
import { OrganizationModules } from "./OrganizationModules";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import LocationManagement from "./LocationManagement";
import BillingSettingsPage from "@/app/(dashboard)/dashboard/settings/billing/page";

function Access({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(false); try { const res = await api.get(`/onboarding/organizations/${organizationId}/members`); setMembers(res.data.data.members); } catch { setError(true); } finally { setLoading(false); } }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <Spinner label="Loading organization access" />;
  if (error) return <Alert variant="error" title="Access could not be loaded" action={<Button onClick={load}>Retry</Button>}>Please retry.</Alert>;
  return <div className="space-y-4"><p className="text-sm text-text-muted">Permission changes apply to this organization. Authentication uses a global identity role; shared identities need platform review before their role changes.</p><RBACPermissionMatrix users={members} onRefresh={load} organizationId={organizationId} /></div>;
}

export default function OrganizationManagement() {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();
  const root = user?.role === "root";
  const canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const queryId = params.get("organizationId") || "";
  const querySection = params.get("section") || "overview";
  const [selectedId, setSelectedId] = useState(queryId);
  const [section, setSection] = useState(querySection);
  const [create, setCreate] = useState(params.get("create") === "1");
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<"login" | "status" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  useEffect(() => { setSelectedId(queryId); setSection(querySection); }, [queryId, querySection]);
  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    setLoading(true); setError("");
    try { const res = await api.get("/organizations"); setOrganizations(res.data.data || []); }
    catch { setError("Organizations could not be loaded. Check your connection and retry."); }
    finally { setLoading(false); }
  }, [canManage, user?.id]);
  useEffect(() => { void load(); }, [load]);
  const organization = organizations.find((org) => org.id === (root ? selectedId : user?.organization_id));
  const sections = [
    { id: "overview", label: "Overview", allowed: true }, { id: "details", label: "Details & branding", allowed: canManage },
    { id: "members", label: "Members", allowed: canManage },
    { id: "access", label: "Roles & permissions", allowed: (root || user?.role === "admin") && hasAnyPermission(user, "ADMINISTRATIVE_GOVERNANCE") },
    { id: "locations", label: "Locations", allowed: hasAnyPermission(user, "VIEW_CLINICS", "MANAGE_CLINICS") },
    { id: "subscription", label: "Subscription", allowed: hasAnyPermission(user, "MANAGE_BILLING") },
    { id: "configuration", label: "Configuration", allowed: canManage },
  ].filter((item) => item.allowed);
  const active = sections.some((s) => s.id === section) ? section : "overview";
  function navigate(id: string, nextSection = "overview") {
    setSelectedId(id); setSection(nextSection);
    router.push(`/dashboard/organizations${id ? `?organizationId=${encodeURIComponent(id)}&section=${nextSection}` : ""}`, { scroll: false });
  }
  async function confirmAction() {
    if (!organization) return;
    setBusy(true);
    try {
      if (action === "login") { await impersonate({ organizationId: organization.id, role: "admin" }); router.push("/dashboard"); }
      if (action === "status") { await api.put(`/organizations/${organization.id}`, { status: organization.status === "inactive" || organization.isActive === false ? "active" : "inactive" }); await load(); toast({ title: "Organization status updated", variant: "success" }); }
      if (action === "delete") { await api.delete(`/organizations/${organization.id}`); navigate(""); await load(); toast({ title: "Organization deleted", variant: "success" }); }
      setAction(null); setConfirmation("");
    } catch (err: unknown) { toast({ title: "Action failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(false); }
  }
  if (!canManage) return <Alert variant="error" title="Organization management is restricted">Your account needs organization management permission.</Alert>;
  const filtered = organizations.filter((org) => `${org.name} ${org.city} ${org.primaryAdmin?.email || ""}`.toLowerCase().includes(search.toLowerCase()) && (status === "all" || (org.status === "inactive" || org.isActive === false ? "inactive" : "active") === status));
  return <div className="space-y-5 w-full min-w-0 pb-8">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0">{root && organization && <Button variant="ghost" size="sm" onClick={() => navigate("")}><ArrowLeft className="w-4 h-4 mr-2" />Organizations</Button>}<h1 className="text-xl font-semibold break-words">{organization?.name || (root ? "Organizations" : "Your organization")}</h1><p className="text-sm text-text-muted mt-1">{organization ? `${organization.city} · ${organization.status === "inactive" || organization.isActive === false ? "Suspended" : "Active"} · ${organization.plan?.toUpperCase() || "Subscription unavailable"}` : "Open an organization to manage its details, members and configuration."}</p></div><div className="flex gap-2 flex-wrap">{root && !organization && <Button onClick={() => setCreate(true)}>Add organization</Button>}{root && organization && <Button variant="outline" onClick={() => setAction("login")} disabled={organization.isActive === false || organization.status === "inactive"}>Login as administrator</Button>}<Button variant="outline" onClick={load} disabled={loading}>Refresh</Button></div></header>
    {error ? <Alert variant="error" title="Unable to load organizations" action={<Button onClick={load}>Retry</Button>}>{error}</Alert> : loading ? <div className="py-8"><Spinner label="Loading organizations" /></div> : root && !selectedId ? <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"><Input aria-label="Search organizations" placeholder="Search organization, city or administrator" value={search} onChange={(e) => setSearch(e.target.value)} /><Select aria-label="Organization status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Suspended" }]} /></div>
      {!filtered.length ? <div className="rounded-xl border border-dashed border-border p-6"><h2 className="font-medium">{organizations.length ? "No matching organizations" : "No organizations yet"}</h2><p className="text-sm text-text-muted mt-1">{organizations.length ? "Change your search or status filter." : "Create the first organization and its administrator to get started."}</p></div> : <ul className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">{filtered.map((org) => <li key={org.id}><button onClick={() => navigate(org.id)} className="w-full text-left p-4 flex items-center gap-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent"><div className="w-10 h-10 rounded-lg shrink-0 bg-surface-alt flex items-center justify-center overflow-hidden">{org.logo_url ? <img src={organizationImageUrl(org.logo_url, org.id)} alt="" className="w-full h-full object-contain" /> : <Building2 className="w-5 h-5 text-text-muted" />}</div><div className="flex-1 min-w-0 sm:grid sm:grid-cols-[minmax(0,1fr)_170px_160px] sm:items-center gap-3"><div className="min-w-0"><p className="font-medium break-words">{org.name}</p><p className="text-sm text-text-muted break-words">{org.city} · {org.primaryAdmin?.name || "No administrator linked"}</p></div><span className="block mt-1 sm:mt-0 text-sm capitalize">{org.subscriptionSummary?.status ? String(org.subscriptionSummary.status).replaceAll("_", " ") : org.plan}</span><span className="block mt-1 sm:mt-0 text-xs text-text-muted">{org.status === "inactive" || org.isActive === false ? "Suspended" : "Active"} · Manage →</span></div></button></li>)}</ul>}
    </> : !organization ? <Alert variant="warning" title="Organization unavailable">{root ? "This organization may have been removed. Return to the list or refresh." : "Your account is not linked to an available organization."}</Alert> : <>
      <nav aria-label="Organization sections" className="border-b border-border flex gap-1 overflow-x-auto max-w-full pb-1">{sections.map((item) => <button key={item.id} type="button" aria-current={active === item.id ? "page" : undefined} onClick={() => navigate(organization.id, item.id)} className={`shrink-0 min-h-[44px] px-3 text-sm border-b-2 ${active === item.id ? "border-accent text-accent font-semibold" : "border-transparent text-text-muted hover:text-text"}`}>{item.label}</button>)}</nav>
      <section aria-label={sections.find((item) => item.id === active)?.label} className="min-w-0">
        {active === "overview" && <div className="space-y-5 max-w-4xl"><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div><dt className="text-text-muted">Primary administrator</dt><dd className="mt-1 font-medium">{organization.primaryAdmin?.name || "No administrator linked"}</dd><dd className="break-all">{organization.primaryAdmin?.email || ""}</dd></div><div><dt className="text-text-muted">Subscription</dt><dd className="mt-1 capitalize font-medium">{String(organization.subscriptionSummary?.status || "Unavailable").replaceAll("_", " ")}</dd><dd>{organization.subscriptionSummary?.expiresAt ? `Ends ${new Date(String(organization.subscriptionSummary.expiresAt)).toLocaleDateString()}` : "Review the Subscription section for commercial terms."}</dd></div><div><dt className="text-text-muted">Legal country / currency</dt><dd className="mt-1">{organization.countryCode || "Not configured"} / {organization.currency || "INR"}</dd></div><div><dt className="text-text-muted">Operating timezone</dt><dd className="mt-1">{organization.timezone || "Not configured"}</dd></div></dl><div className="border-t border-border pt-4"><h2 className="font-semibold text-base">Setup and maintenance</h2><p className="text-sm text-text-muted mt-1">Provisioning creates the administrator, primary location, default access roles and modules. Clinical profiles, appointments and communications need organization-specific configuration.</p><ul className="divide-y divide-border mt-3">{sections.filter((s) => s.id !== "overview").map((s) => <li key={s.id}><button type="button" className="w-full text-left py-3 flex justify-between gap-4 text-sm hover:text-accent" onClick={() => navigate(organization.id, s.id)}>{s.label}<span aria-hidden="true">→</span></button></li>)}</ul>{organization.onboardingStatus !== "COMPLETED" && <p className="text-sm text-text-muted mt-3">Administrator MFA setup is pending. The administrator completes it from their own security settings.</p>}</div>{root && <details className="border-t border-border pt-3"><summary className="text-sm font-medium cursor-pointer py-2">Platform status and deletion</summary><p className="text-sm text-text-muted my-3">Suspension blocks organization access. Deletion permanently removes linked clinical and operational records.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setAction("status")}>{organization.status === "inactive" || organization.isActive === false ? "Reactivate organization" : "Suspend organization"}</Button><Button variant="danger" onClick={() => setAction("delete")}>Delete organization</Button></div></details>}</div>}
        {active === "details" && <OrganizationDetails organization={organization} onSaved={(updated) => setOrganizations((list) => list.map((org) => org.id === updated.id ? updated : org))} />}
        {active === "members" && <OrganizationMembers organizationId={organization.id} />}
        {active === "access" && <Access organizationId={organization.id} />}
        {active === "locations" && <LocationManagement organizationId={organization.id} embedded />}
        {active === "subscription" && <BillingSettingsPage selectedOrgId={organization.id} isRoot={root} />}
        {active === "configuration" && <div className="space-y-6"><OrganizationNotifications selectedOrgId={organization.id} isRoot={root} organizationOnly /><details><summary className="cursor-pointer py-3 font-medium text-sm">Enabled modules</summary><OrganizationModules organizationId={organization.id} /></details>{root && <details><summary className="cursor-pointer py-3 font-medium text-sm">AI configuration</summary><OrganizationAISettings selectedOrgId={organization.id} isRoot /></details>}</div>}
      </section>
    </>}
    {root && create && <CreateOrganization open onClose={() => { setCreate(false); router.replace("/dashboard/organizations", { scroll: false }); }} onCreated={(id) => { setCreate(false); navigate(id); void load(); toast({ title: "Organization created", description: "Continue setup from this organization. Share the administrator password separately.", variant: "success" }); }} />}
    <Modal open={!!action} onClose={() => { if (!busy) { setAction(null); setConfirmation(""); } }} title={action === "login" ? "Login as organization administrator" : action === "delete" ? "Delete organization permanently?" : "Change organization status?"} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button variant={action === "delete" ? "danger" : "primary"} onClick={confirmAction} loading={busy} disabled={action === "delete" && confirmation !== organization?.name}>{action === "login" ? "Start session" : action === "delete" ? "Delete permanently" : "Confirm status change"}</Button></div>}><div className="space-y-4"><p className="text-sm">{action === "login" ? `You will use ${organization?.name}'s administrator identity and permissions. Return to the platform account from the session banner.` : action === "delete" ? "This cannot be undone. Linked locations, memberships, clinical records and subscriptions are deleted. Suspension is available when you need to temporarily block access." : "Suspending an organization blocks access for its users. Reactivation restores organization access; subscription terms still apply."}</p>{action === "delete" && <Input label={`Type ${organization?.name} to confirm`} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />}</div></Modal>
  </div>;
}
