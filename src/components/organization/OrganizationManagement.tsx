"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, ChevronDown, CreditCard, LogIn, MapPin, MoreHorizontal, Palette, Plus, RotateCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import api from "@/lib/api";
import { Alert, Avatar, Badge, Button, Card, Dropdown, EmptyState, Input, LoadingState, Modal, Select, SkeletonForm, SkeletonTable, Tabs, useToast, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { organizationImageUrl, organizationWorkspaceUrl, type OrganizationRecord } from "@/services/organization.service";
import { CreateOrganization } from "./CreateOrganization";
import { OrganizationDetails } from "./OrganizationDetails";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrganizationBookingSetup } from "./OrganizationBookingSetup";
import { OrganizationNotifications, OrganizationAISettings } from "./OrganizationConfiguration";
import { OrganizationModules } from "./OrganizationModules";
import { OrganizationWorkflowPreferences } from "./OrganizationWorkflowPreferences";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import LocationManagement from "./LocationManagement";
import BillingSettingsPage from "@/app/(dashboard)/dashboard/settings/billing/page";
import styles from "./OrganizationManagement.module.css";

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
  if (loading) return <LoadingState label="Loading organization access"><SkeletonTable columns={3} /></LoadingState>;
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
  const [clinicalSetup, setClinicalSetup] = useState(false);
  const [create, setCreate] = useState(queryCreate);
  const scope = authScopeKey(user);
  const [organizationRecords, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const hasLoaded = loadedScope === scope;
  const organizations = hasLoaded ? organizationRecords : [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<PlatformAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const sectionNavRef = useRef<HTMLElement>(null);
  const beginRead = useLatestRead();
  useEffect(() => { setSelectedId(queryId); setSection(querySection); }, [queryId, querySection]);
  useEffect(() => { setCreate(queryCreate); }, [queryCreate]);
  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    const request = beginRead(); setLoading(true); setError("");
    try {
      const res = await api.get("/organizations", { signal: request.signal });
      if (request.isCurrent() && authScopeKey(useAuthStore.getState().user) === scope) {
        setOrganizations(res.data.data || []);
        setLoadedScope(scope);
      }
    } catch { if (request.isCurrent()) setError("Organizations could not be loaded. Check your connection and retry."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [canManage, scope, beginRead]);
  useEffect(() => { void load(); }, [load]);
  const organization = organizations.find(org => org.id === (root ? selectedId : user?.organization_id));
  const sections = [
    { id: "overview", label: "Overview", icon: <Building2 className="h-4 w-4" />, allowed: true },
    { id: "details", label: "Details & branding", icon: <Palette className="h-4 w-4" />, allowed: canManage },
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" />, allowed: canManage },
    { id: "access", label: "Roles & permissions", icon: <ShieldCheck className="h-4 w-4" />, allowed: (root || user?.role === "admin") && hasAnyPermission(user, "ADMINISTRATIVE_GOVERNANCE") },
    { id: "locations", label: "Locations", icon: <MapPin className="h-4 w-4" />, allowed: hasAnyPermission(user, "VIEW_LOCATIONS", "MANAGE_LOCATIONS") },
    { id: "subscription", label: "Subscription", icon: <CreditCard className="h-4 w-4" />, allowed: hasAnyPermission(user, "MANAGE_BILLING") },
    { id: "configuration", label: "Configuration", icon: <Settings2 className="h-4 w-4" />, allowed: canManage },
  ].filter(item => item.allowed);
  const active = sections.some(item => item.id === section) ? section : "overview";
  useEffect(() => {
    const rail = sectionNavRef.current?.querySelector<HTMLElement>('[role="tablist"]');
    const tab = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!rail || !tab) return;
    const revealActiveTab = () => {
      const railBounds = rail.getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      if (tabBounds.left < railBounds.left || tabBounds.right > railBounds.right) {
        rail.scrollTo({ left: rail.scrollLeft + tabBounds.left - railBounds.left - 8, behavior: "instant" });
      }
    };
    revealActiveTab();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(revealActiveTab);
    observer?.observe(rail);
    window.addEventListener("resize", revealActiveTab);
    return () => { observer?.disconnect(); window.removeEventListener("resize", revealActiveTab); };
  }, [active, organization?.id]);
  function navigate(id: string, nextSection = "overview", openClinicalSetup = false) {
    setClinicalSetup(openClinicalSetup);
    setSelectedId(id); setSection(nextSection);
    router.push(organizationWorkspaceUrl(id, nextSection), { scroll: false });
  }
  function openAction(kind: PlatformAction["kind"], target = organization) {
    if (root && target && !busy && !(kind === "login" && suspended(target))) {
      setAction({ kind, organization: target }); setConfirmation("");
    }
  }
  async function confirmAction() {
    if (!root || !action || busy || (action.kind === "login" && suspended(action.organization)) || (action.kind === "delete" && confirmation !== action.organization.name)) return;
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
  const activeCount = organizations.filter(org => !suspended(org)).length;
  const hasFilters = !!search || status !== "all";
  return <div className={`${styles.workspace} ${styles.directoryWorkspace} space-y-4 sm:space-y-5 w-full min-w-0 pb-8 text-text`}>
    {directory ? <header className={styles.directoryHeader}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 id="organizations-heading" className="min-w-0 text-xl sm:text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">Organizations</h1>
        {hasLoaded && <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{filtered.length} of {organizations.length} organizations shown</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button className={styles.addOrganization} aria-label="Add organization" onClick={() => setCreate(true)}><Plus className="h-4 w-4" /><span className={styles.compactLabel}>Add</span><span className={styles.wideLabel}>Add organization</span></Button>
        <Dropdown align="right" width="w-56" trigger={<Button variant="ghost" className={styles.iconAction} aria-label="Organization actions" title="Organization actions"><MoreHorizontal className="h-5 w-5" /></Button>} items={[
          { label: "Setup requests", icon: <Building2 />, onClick: () => router.push("/dashboard/admin/setup-requests") },
          { label: "Refresh organizations", icon: <RotateCw className={loading ? "animate-spin" : ""} />, onClick: () => { void load(); }, disabled: loading },
        ]} />
      </div>
    </header> : organization ? <header className={styles.detailsHeader}>
      <div className={styles.detailsHeading}>
        {root && <Button variant="ghost" className={styles.iconAction} aria-label="Back to organizations" title="Back to organizations" onClick={() => navigate("")}><ArrowLeft className="h-4 w-4" /></Button>}
        <div className="min-w-0"><h1 className="text-xl sm:text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{organization.name}</h1><div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant={suspended(organization) ? "warning" : "success"} dot>{suspended(organization) ? "Suspended" : "Active"}</Badge><span className="min-w-0 text-xs text-text-secondary [overflow-wrap:anywhere]">{organization.city}</span></div></div>
      </div>
      <Dropdown align="right" width="w-64" trigger={<Button variant="ghost" className={styles.iconAction} aria-label="Workspace actions" title="Workspace actions"><MoreHorizontal className="h-5 w-5" /></Button>} items={[
        ...(root ? [
          { label: "Login as administrator", icon: <LogIn />, onClick: () => openAction("login"), disabled: suspended(organization) },
          { label: "Setup requests", icon: <Building2 />, onClick: () => router.push("/dashboard/admin/setup-requests") },
          { label: "Review global identities", icon: <Users />, onClick: () => router.push(`/dashboard/admin/users?organizationId=${encodeURIComponent(organization.id)}`) },
        ] : []),
        { label: "Refresh organizations", icon: <RotateCw className={loading ? "animate-spin" : ""} />, onClick: () => { void load(); }, disabled: loading },
      ]} />
    </header> : <h1 className="text-xl font-semibold">Organization workspace</h1>}
    {error && <Alert variant="error" title="Unable to load organizations" action={<Button onClick={load} loading={loading}>Retry</Button>}>{error}</Alert>}
    {!hasLoaded ? error ? null : <LoadingState label="Loading organizations">{directory ? <div className="space-y-3"><div className={styles.directoryToolbar}><Skeleton height="2.75rem" /><Skeleton width="2.75rem" height="2.75rem" /></div>{[0, 1, 2].map(item => <Skeleton key={item} height="8rem" />)}</div> : <SkeletonForm fields={4} />}</LoadingState> : directory ? <>
      <section aria-labelledby="organizations-heading" className={styles.directoryPanel}>
      <div className={styles.directoryToolbar}>
        <Input containerClassName={styles.directorySearch} aria-label="Search organizations" title="Search by organization name, city or administrator email" type="search" icon={<Search />} placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch("")} />
        <Select aria-label="Organization status" icon={<SlidersHorizontal className="h-4 w-4" />} compactOnMobile fullWidth={false} containerClassName={styles.statusFilter} align="right" minMenuWidth={220} value={status === "all" ? "" : status} onChange={event => setStatus(event.target.value || "all")} renderValue={option => option.value ? option.value === "active" ? "Active" : "Suspended" : "All statuses"} options={[{ value: "", label: `All statuses (${organizations.length})` }, { value: "active", label: `Active (${activeCount})` }, { value: "inactive", label: `Suspended (${organizations.length - activeCount})` }]} />
      </div>
      {hasFilters && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4"><span className="text-xs text-text-secondary">{status === "all" ? "Search results" : status === "active" ? "Active organizations" : "Suspended organizations"}</span><Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("all"); }}>Clear filters</Button></div>}
      {!filtered.length ? <EmptyState icon={<Building2 />} title={organizations.length ? "No matching organizations" : "No organizations yet"} description={organizations.length ? "Try another name, city or administrator email, or clear your filters." : "Create the first organization and its administrator to get started."} action={organizations.length ? <Button variant="outline" onClick={() => { setSearch(""); setStatus("all"); }}>Clear filters</Button> : <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Create first organization</Button>} /> : <div className={styles.resourceList}>
        <div aria-hidden="true" className={styles.resourceColumns}><span>Organization</span><span>Administrator</span><span>Subscription</span><span>Access</span></div>
        <ul>
        {filtered.map(org => {
          const administrator = <><p className="text-sm [overflow-wrap:anywhere]">{org.primaryAdmin?.name || "No administrator linked"}</p>{org.primaryAdmin?.email && <p className="mt-0.5 text-xs text-text-secondary [overflow-wrap:anywhere]">{org.primaryAdmin.email}</p>}</>;
          return <li key={org.id} className={styles.resourceRow}>
            <div className={styles.resourceIdentity}>
              <Avatar src={organizationImageUrl(org.logo_url)} name={org.name} size="md" className="shrink-0 [&>img]:object-contain [&>img]:rounded-xl" />
              <div className="min-w-0 flex-1">
                <h2><button type="button" className={styles.organizationLink} aria-label={`Manage ${org.name}`} onClick={() => navigate(org.id)}><span className="[overflow-wrap:anywhere]">{org.name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" /></button></h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Badge variant={suspended(org) ? "warning" : "success"} dot>{suspended(org) ? "Suspended" : "Active"}</Badge><span className="min-w-0 text-xs text-text-secondary [overflow-wrap:anywhere]">{org.city}</span></div>
              </div>
            </div>
            <div className={styles.resourceAdministrator}>
              <div className={styles.desktopAdministrator}><span className="sr-only">Administrator: </span>{administrator}</div>
              <details className={styles.mobileAdministrator}><summary className={styles.administratorSummary}>Administrator<ChevronDown className="h-3.5 w-3.5 shrink-0" /></summary><div className="pb-2">{administrator}</div></details>
            </div>
            <p className={styles.resourceSubscription}><span className={styles.subscriptionLabel}>Subscription</span><span>{subscriptionLabel(org)}</span></p>
            <div className={styles.resourceActions}><Button variant="outline" size="sm" aria-label={`Login as admin for ${org.name}`} title={suspended(org) ? "Reactivate this organization before starting an administrator session" : `Login as administrator for ${org.name}`} disabled={suspended(org) || busy} onClick={() => openAction("login", org)}><LogIn className="h-4 w-4" />Login as admin</Button></div>
          </li>;
        })}
        </ul>
      </div>}
      {organizations.length === 1 && filtered.length === 1 && <div className={styles.workspaceShortcuts} role="group" aria-labelledby="workspace-shortcuts-heading"><h2 id="workspace-shortcuts-heading" className="text-sm font-medium text-text-secondary">Workspace shortcuts</h2><div className={styles.shortcutGrid}>{sections.filter(item => ["details", "members", "locations", "subscription"].includes(item.id)).map(item => <button key={item.id} type="button" className={styles.workspaceShortcut} aria-label={`${item.label} for ${filtered[0].name}`} onClick={() => navigate(filtered[0].id, item.id)}><span className="shrink-0 text-accent">{item.icon}</span><span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" /></button>)}</div></div>}
      {filtered.length > 0 && <footer className={styles.directoryFooter}><span>{hasFilters ? `${filtered.length} of ${organizations.length} shown` : `${organizations.length} ${organizations.length === 1 ? "organization" : "organizations"}`}</span><span>{activeCount} active<span className="mx-1.5" aria-hidden="true">·</span>{organizations.length - activeCount} suspended</span></footer>}
      </section>
    </> : !organization ? <Alert variant="warning" title="Organization unavailable">{root ? "This organization may have been removed. Return to the list or refresh." : "Your account is not linked to an available organization."}</Alert> : <>
      <nav ref={sectionNavRef} aria-label="Organization sections"><Tabs className={styles.workspaceTabs} variant="pills" tabs={sections} activeTab={active} onChange={id => navigate(organization.id, id)} scrollActiveIntoView={false} /></nav>
      <section key={organization.id} aria-label={sections.find(item => item.id === active)?.label} className="min-w-0">
        {active === "overview" && <div className="space-y-5">
          <OrganizationBookingSetup key={`${organization.id}:${scope}`} organizationId={organization.id} onNavigate={nextSection => navigate(organization.id, nextSection, nextSection === "members")} />
          <Card padding="none"><dl className={styles.workspaceSummary} aria-label="Workspace summary"><div><dt>Primary administrator</dt><dd>{organization.primaryAdmin?.name || "No administrator linked"}<span className="block mt-1 text-xs font-normal text-text-secondary">{organization.primaryAdmin?.email || "Contact not provided"}</span></dd></div><div><dt>Subscription</dt><dd className="capitalize">{subscriptionLabel(organization)}</dd></div><div><dt>Country &amp; currency</dt><dd>{organization.countryCode || "Not configured"} / {organization.currency || "Not configured"}</dd></div><div><dt>Operating timezone</dt><dd>{organization.timezone || "Not configured"}</dd></div></dl></Card>
          {organization.onboardingStatus && organization.onboardingStatus !== "COMPLETED" && <Alert title="Administrator setup pending">The administrator completes MFA setup from their own security settings.</Alert>}
          {root && <Card><details><summary className="text-sm font-semibold cursor-pointer py-2">Platform status and deletion</summary><p className="text-sm text-text-muted my-3">Suspension blocks organization access. Deletion permanently removes linked clinical and operational records.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => openAction("status")}>{suspended(organization) ? "Reactivate organization" : "Suspend organization"}</Button><Button variant="danger" onClick={() => openAction("delete")}>Delete organization</Button></div></details></Card>}
        </div>}
        {active === "details" && <OrganizationDetails organization={organization} onSaved={updated => setOrganizations(list => list.map(org => org.id === updated.id ? updated : org))} />}
        {active === "members" && <Card><OrganizationMembers organizationId={organization.id} initialClinicalSetup={clinicalSetup} /></Card>}
        {active === "access" && <Access organizationId={organization.id} />}
        {active === "locations" && <LocationManagement organizationId={organization.id} embedded />}
        {active === "subscription" && <BillingSettingsPage selectedOrgId={organization.id} isRoot={root} />}
        {active === "configuration" && <div className="space-y-4">
          <h2 className="text-base font-semibold">Configuration</h2>
          <div className={styles.configurationGrid}>
          <OrganizationWorkflowPreferences key={organization.id} organizationId={organization.id} />
          <Card><OrganizationModules organizationId={organization.id} /></Card>
          </div>
          <section className="space-y-3" aria-label="Organization delivery settings"><div><h2 className="text-base font-semibold">Organization delivery settings</h2><p className="mt-1 text-sm text-text-secondary">Delivery settings for this workspace.</p>{root && <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/settings?tab=messaging")}>Open platform WhatsApp settings →</Button>}</div><OrganizationNotifications selectedOrgId={organization.id} isRoot={root} organizationOnly /></section>
          {root && <OrganizationAISettings selectedOrgId={organization.id} isRoot />}
        </div>}
      </section>
    </>}
    {root && create && <CreateOrganization open onClose={() => { setCreate(false); router.replace(organizationWorkspaceUrl(), { scroll: false }); }} onCreated={id => { setCreate(false); navigate(id); void load(); toast({ title: "Organization created", description: "Continue setup from this organization. Share the administrator password separately.", variant: "success" }); }} />}
    <Modal open={!!action} onClose={() => { if (!busy) { setAction(null); setConfirmation(""); } }} title={action?.kind === "login" ? "Login as organization administrator" : action?.kind === "delete" ? "Delete organization permanently?" : "Change organization status?"} size="md" busy={busy} footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button variant={action?.kind === "delete" ? "danger" : "primary"} onClick={confirmAction} loading={busy} disabled={action?.kind === "delete" && confirmation !== action.organization.name}>{action?.kind === "login" ? "Start session" : action?.kind === "delete" ? "Delete permanently" : "Confirm status change"}</Button></div>}>
      <div className="space-y-4"><p className="font-semibold break-words">{action?.organization.name}</p><p className="text-sm">{action?.kind === "login" ? "You will use this organization's administrator identity and permissions. Return to the platform account from the session banner." : action?.kind === "delete" ? "This cannot be undone. Linked locations, memberships, clinical records and subscriptions are deleted. Suspension is available to temporarily block access." : "Suspension blocks organization access. Reactivation restores access; subscription terms still apply."}</p>{action?.kind === "delete" && <Input label={`Type ${action.organization.name} to confirm`} value={confirmation} onChange={event => setConfirmation(event.target.value)} />}</div>
    </Modal>
  </div>;
}
