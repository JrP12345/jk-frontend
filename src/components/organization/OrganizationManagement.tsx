"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, CheckCircle2, CreditCard, MapPin, Palette, Plus, RotateCw, Settings2, ShieldCheck, Users } from "lucide-react";
import api from "@/lib/api";
import { Alert, Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Modal, Select, Spinner, StatCard, Tabs, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { organizationImageUrl, organizationWorkspaceUrl, type OrganizationRecord } from "@/services/organization.service";
import { CreateOrganization } from "./CreateOrganization";
import { OrganizationDetails } from "./OrganizationDetails";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrganizationNotifications, OrganizationAISettings } from "./OrganizationConfiguration";
import { OrganizationModules } from "./OrganizationModules";
import { OrganizationWorkflowPreferences } from "./OrganizationWorkflowPreferences";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import LocationManagement from "./LocationManagement";
import BillingSettingsPage from "@/app/(dashboard)/dashboard/settings/billing/page";

function Access({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError(false);
    try {
      const res = await api.get(`/onboarding/organizations/${organizationId}/members`, { signal: request.signal });
      if (request.isCurrent()) setMembers(res.data.data.members || []);
    } catch { if (request.isCurrent()) setError(true); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [organizationId, beginRead]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <Spinner label="Loading organization access" />;
  if (error) return <Alert variant="error" title="Access could not be loaded" action={<Button onClick={load}>Retry</Button>}>Please retry.</Alert>;
  return <div className="space-y-4"><p className="text-sm text-text-muted">Permission changes apply to this organization. Shared identities need platform review before their global role changes.</p><RBACPermissionMatrix users={members} onRefresh={load} organizationId={organizationId} /></div>;
}
const suspended = (org: OrganizationRecord) => org.status === "inactive" || org.isActive === false;
function subscriptionLabel(org: OrganizationRecord) {
  const summary = org.subscriptionSummary;
  return String(summary?.label || summary?.commercialState || summary?.status || org.plan || "Unavailable").replaceAll("_", " ");
}
type PlatformAction = { kind: "login" | "status" | "delete"; organization: OrganizationRecord };

export default function OrganizationManagement() {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();
  const root = user?.role === "root";
  const canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const queryId = params.get("organizationId") || "";
  const querySection = params.get("section") || "overview";
  const queryCreate = params.get("create") === "1";
  const [selectedId, setSelectedId] = useState(queryId);
  const [section, setSection] = useState(querySection);
  const [create, setCreate] = useState(queryCreate);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<PlatformAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const beginRead = useLatestRead();
  useEffect(() => { setSelectedId(queryId); setSection(querySection); }, [queryId, querySection]);
  useEffect(() => { setCreate(queryCreate); }, [queryCreate]);
  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    const request = beginRead(); setLoading(true); setError("");
    try {
      const res = await api.get("/organizations", { signal: request.signal });
      if (request.isCurrent()) setOrganizations(res.data.data || []);
    } catch { if (request.isCurrent()) setError("Organizations could not be loaded. Check your connection and retry."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [canManage, user?.id, beginRead]);
  useEffect(() => { void load(); }, [load]);
  const organization = organizations.find(org => org.id === (root ? selectedId : user?.organization_id));
  const sections = [
    { id: "overview", label: "Overview", icon: <Building2 className="h-4 w-4" />, allowed: true },
    { id: "details", label: "Details & branding", icon: <Palette className="h-4 w-4" />, allowed: canManage },
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" />, allowed: canManage },
    { id: "access", label: "Roles & permissions", icon: <ShieldCheck className="h-4 w-4" />, allowed: (root || user?.role === "admin") && hasAnyPermission(user, "ADMINISTRATIVE_GOVERNANCE") },
    { id: "locations", label: "Locations", icon: <MapPin className="h-4 w-4" />, allowed: hasAnyPermission(user, "VIEW_CLINICS", "MANAGE_CLINICS") },
    { id: "subscription", label: "Subscription", icon: <CreditCard className="h-4 w-4" />, allowed: hasAnyPermission(user, "MANAGE_BILLING") },
    { id: "configuration", label: "Configuration", icon: <Settings2 className="h-4 w-4" />, allowed: canManage },
  ].filter(item => item.allowed);
  const active = sections.some(item => item.id === section) ? section : "overview";
  function navigate(id: string, nextSection = "overview") {
    setSelectedId(id); setSection(nextSection);
    router.push(organizationWorkspaceUrl(id, nextSection), { scroll: false });
  }
  function openAction(kind: PlatformAction["kind"]) {
    if (root && organization) { setAction({ kind, organization }); setConfirmation(""); }
  }
  async function confirmAction() {
    if (!root || !action || busy || (action.kind === "delete" && confirmation !== action.organization.name)) return;
    const target = action.organization; setBusy(true);
    try {
      if (action.kind === "login") { await impersonate({ organizationId: target.id, role: "admin" }); router.push("/dashboard"); }
      if (action.kind === "status") { await api.put(`/organizations/${target.id}`, { status: suspended(target) ? "active" : "inactive" }); await load(); toast({ title: "Organization status updated", variant: "success" }); }
      if (action.kind === "delete") { await api.delete(`/organizations/${target.id}`); navigate(""); await load(); toast({ title: "Organization deleted", variant: "success" }); }
      setAction(null); setConfirmation("");
    } catch (err: unknown) { toast({ title: "Action failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(false); }
  }
  if (!canManage) return <Alert variant="error" title="Organization management is restricted">Your account needs organization management permission.</Alert>;
  const filtered = organizations.filter(org => `${org.name} ${org.city} ${org.primaryAdmin?.email || ""}`.toLowerCase().includes(search.toLowerCase()) && (status === "all" || (suspended(org) ? "inactive" : "active") === status));
  const directory = root && !selectedId;
  return <div className="space-y-6 w-full min-w-0 pb-8 text-text">
    {root && selectedId && <Button variant="ghost" size="sm" onClick={() => navigate("")}><ArrowLeft className="h-4 w-4" />Organizations</Button>}
    <Card padding="lg" className="bg-gradient-to-br from-primary-500/10 via-surface to-surface border-primary-500/20">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {organization ? <Avatar key={organization.id + organization.logo_url} src={organizationImageUrl(organization.logo_url, organization.id)} name={organization.name} size="xl" className="[&>img]:object-contain [&>img]:rounded-xl" /> : <div className="shrink-0 rounded-2xl bg-accent-subtle p-3 text-accent"><Building2 className="h-7 w-7" /></div>}
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 mb-2"><Badge variant="primary">{root ? "Root administration" : "Organization workspace"}</Badge>{organization && <Badge variant={suspended(organization) ? "warning" : "success"} dot>{suspended(organization) ? "Suspended" : "Active"}</Badge>}</div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">{organization?.name || (root ? "Organizations" : "Your organization")}</h1>
            <p className="text-sm text-text-secondary mt-2">{organization ? `${organization.city} · ${organization.plan?.toUpperCase() || "Plan unavailable"}` : "Manage workspaces, administrators and organization access."}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {directory && <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Add organization</Button>}
          {root && organization && <Button variant="outline" onClick={() => openAction("login")} disabled={suspended(organization)}>Login as administrator</Button>}
          <Button variant="outline" onClick={load} disabled={loading} aria-label="Refresh organizations"><RotateCw className="h-4 w-4" /><span>Refresh</span></Button>
        </div>
      </div>
    </Card>
    {error ? <Alert variant="error" title="Unable to load organizations" action={<Button onClick={load}>Retry</Button>}>{error}</Alert> : loading ? <div className="py-8"><Spinner label="Loading organizations" /></div> : directory ? <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Organizations" value={organizations.length} icon={<Building2 />} description="Current directory" />
        <StatCard label="Active workspaces" value={organizations.filter(org => !suspended(org)).length} icon={<CheckCircle2 />} />
        <StatCard label="Suspended workspaces" value={organizations.filter(suspended).length} icon={<ShieldCheck />} />
      </div>
      <Card padding="sm"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"><Input aria-label="Search organizations" placeholder="Search organization, city or administrator" value={search} onChange={event => setSearch(event.target.value)} /><Select aria-label="Organization status" value={status} onChange={event => setStatus(event.target.value)} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Suspended" }]} /></div></Card>
      {!filtered.length ? <Card><EmptyState icon={<Building2 />} title={organizations.length ? "No matching organizations" : "No organizations yet"} description={organizations.length ? "Change your search or status filter." : "Create the first organization and its administrator to get started."} /></Card> : <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(org => <li key={org.id} className="min-w-0"><Card hover className="h-full flex flex-col">
          <div className="flex items-start justify-between gap-3"><Avatar src={organizationImageUrl(org.logo_url, org.id)} name={org.name} size="lg" className="[&>img]:object-contain [&>img]:rounded-xl" /><Badge variant={suspended(org) ? "warning" : "success"} dot>{suspended(org) ? "Suspended" : "Active"}</Badge></div>
          <h2 className="font-semibold text-base mt-4 break-words">{org.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" />{org.city}</p>
          <dl className="mt-4 space-y-3 text-sm flex-1"><div><dt className="text-xs text-text-muted">Administrator</dt><dd className="mt-1 break-words">{org.primaryAdmin?.name || "No administrator linked"}</dd>{org.primaryAdmin?.email && <dd className="text-xs text-text-muted break-all mt-0.5">{org.primaryAdmin.email}</dd>}</div><div className="flex items-center justify-between gap-3"><dt className="text-xs text-text-muted">Subscription</dt><dd className="capitalize text-right">{subscriptionLabel(org)}</dd></div></dl>
          <div className="border-t border-border mt-4 pt-3"><Button variant="outline" className="w-full" aria-label={`Manage ${org.name}`} onClick={() => navigate(org.id)}>Manage organization<ArrowUpRight className="h-4 w-4" /></Button></div>
        </Card></li>)}
      </ul>}
    </> : !organization ? <Alert variant="warning" title="Organization unavailable">{root ? "This organization may have been removed. Return to the list or refresh." : "Your account is not linked to an available organization."}</Alert> : <>
      <nav aria-label="Organization sections"><Tabs variant="pills" tabs={sections} activeTab={active} onChange={id => navigate(organization.id, id)} /></nav>
      {root && <Link href={`/dashboard/admin/users?organizationId=${encodeURIComponent(organization.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"><Users className="h-4 w-4" />Review global identities for this organization</Link>}
      <section key={organization.id} aria-label={sections.find(item => item.id === active)?.label} className="min-w-0">
        {active === "overview" && <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardHeader><CardTitle as="h2" className="text-sm">Primary administrator</CardTitle></CardHeader><CardContent><p className="font-medium break-words">{organization.primaryAdmin?.name || "No administrator linked"}</p><p className="text-sm text-text-muted break-all mt-1">{organization.primaryAdmin?.email || "Contact not provided"}</p></CardContent></Card>
            <Card><CardHeader><CardTitle as="h2" className="text-sm">Subscription</CardTitle></CardHeader><CardContent><p className="font-medium capitalize">{subscriptionLabel(organization)}</p><p className="text-sm text-text-muted mt-1">Review commercial terms in Subscription.</p></CardContent></Card>
            <Card><CardHeader><CardTitle as="h2" className="text-sm">Country & currency</CardTitle></CardHeader><CardContent><p className="font-medium">{organization.countryCode || "Not configured"} / {organization.currency || "Not configured"}</p><p className="text-sm text-text-muted mt-1">Legal operating context</p></CardContent></Card>
            <Card><CardHeader><CardTitle as="h2" className="text-sm">Operating timezone</CardTitle></CardHeader><CardContent><p className="font-medium break-words">{organization.timezone || "Not configured"}</p><p className="text-sm text-text-muted mt-1">Clinic scheduling context</p></CardContent></Card>
          </div>
          {organization.onboardingStatus && organization.onboardingStatus !== "COMPLETED" && <Alert title="Administrator setup pending">The administrator completes MFA setup from their own security settings.</Alert>}
          {root && <Card><details><summary className="text-sm font-semibold cursor-pointer py-2">Platform status and deletion</summary><p className="text-sm text-text-muted my-3">Suspension blocks organization access. Deletion permanently removes linked clinical and operational records.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => openAction("status")}>{suspended(organization) ? "Reactivate organization" : "Suspend organization"}</Button><Button variant="danger" onClick={() => openAction("delete")}>Delete organization</Button></div></details></Card>}
        </div>}
        {active === "details" && <Card padding="lg"><OrganizationDetails organization={organization} onSaved={updated => setOrganizations(list => list.map(org => org.id === updated.id ? updated : org))} /></Card>}
        {active === "members" && <Card padding="lg"><OrganizationMembers organizationId={organization.id} /></Card>}
        {active === "access" && <Access organizationId={organization.id} />}
        {active === "locations" && <LocationManagement organizationId={organization.id} embedded />}
        {active === "subscription" && <BillingSettingsPage selectedOrgId={organization.id} isRoot={root} />}
        {active === "configuration" && <div className="space-y-5">
          <OrganizationWorkflowPreferences key={organization.id} organizationId={organization.id} />
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle as="h2">Organization delivery settings</CardTitle><Badge variant="outline">{organization.name}</Badge></div><p className="text-sm text-text-muted">Settings here apply to this organization. The shared platform sender is managed separately by Root.</p>{root && <Link href="/dashboard/settings?tab=messaging" className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">Open platform WhatsApp settings →</Link>}</CardHeader><CardContent><OrganizationNotifications selectedOrgId={organization.id} isRoot={root} organizationOnly /></CardContent></Card>
          <Card><CardHeader><CardTitle as="h2">Enabled modules</CardTitle><p className="text-sm text-text-muted">Root controls optional modules for this organization.</p></CardHeader><CardContent><OrganizationModules organizationId={organization.id} /></CardContent></Card>
          {root && <Card><CardHeader><div className="flex items-center gap-2"><CardTitle as="h2">AI configuration</CardTitle><Badge variant="primary">Root</Badge></div></CardHeader><CardContent><OrganizationAISettings selectedOrgId={organization.id} isRoot /></CardContent></Card>}
        </div>}
      </section>
    </>}
    {root && create && <CreateOrganization open onClose={() => { setCreate(false); router.replace(organizationWorkspaceUrl(), { scroll: false }); }} onCreated={id => { setCreate(false); navigate(id); void load(); toast({ title: "Organization created", description: "Continue setup from this organization. Share the administrator password separately.", variant: "success" }); }} />}
    <Modal open={!!action} onClose={() => { if (!busy) { setAction(null); setConfirmation(""); } }} title={action?.kind === "login" ? "Login as organization administrator" : action?.kind === "delete" ? "Delete organization permanently?" : "Change organization status?"} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button variant={action?.kind === "delete" ? "danger" : "primary"} onClick={confirmAction} loading={busy} disabled={action?.kind === "delete" && confirmation !== action.organization.name}>{action?.kind === "login" ? "Start session" : action?.kind === "delete" ? "Delete permanently" : "Confirm status change"}</Button></div>}>
      <div className="space-y-4"><p className="font-semibold break-words">{action?.organization.name}</p><p className="text-sm">{action?.kind === "login" ? "You will use this organization's administrator identity and permissions. Return to the platform account from the session banner." : action?.kind === "delete" ? "This cannot be undone. Linked locations, memberships, clinical records and subscriptions are deleted. Suspension is available to temporarily block access." : "Suspension blocks organization access. Reactivation restores access; subscription terms still apply."}</p>{action?.kind === "delete" && <Input label={`Type ${action.organization.name} to confirm`} value={confirmation} onChange={event => setConfirmation(event.target.value)} />}</div>
    </Modal>
  </div>;
}
