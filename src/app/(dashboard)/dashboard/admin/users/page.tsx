"use client";

import { Suspense, useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Building2, LogIn, RotateCw, Search, SlidersHorizontal, UserRoundCheck, UserRoundX, Users, X } from "lucide-react";
import api from "@/lib/api";
import { Alert, Avatar, Badge, Button, EmptyState, Input, Modal, Pagination, Select, useToast, LoadingState, Skeleton, SkeletonTable } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { organizationWorkspaceUrl, type OrganizationRecord } from "@/services/organization.service";

import styles from "./PlatformUsers.module.css";

interface GlobalUser {
  id: string; name: string; email: string; role: string; isActive: boolean;
  organizationId?: string; organizationName?: string;
  memberships?: { organizationId: string; organizationName: string; role: string }[];
}
function membershipsFor(row: GlobalUser) {
  return row.memberships?.length ? row.memberships : row.organizationId ? [{ organizationId: row.organizationId, organizationName: row.organizationName || "Organization", role: row.role }] : [];
}
function PlatformUsers() {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const selectedOrgId = params.get("organizationId") || "";
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState(false);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const filterKey = `${selectedOrgId}|${role}|${query}`;
  const [pagination, setPagination] = useState({ key: filterKey, page: 1 });
  const page = pagination.key === filterKey ? pagination.page : 1;
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<{ user: GlobalUser; action: "status" | "login" } | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersId = useId();
  const beginRead = useLatestRead();
  const beginScopeRead = useLatestRead();
  const selectedOrganization = organizations.find(org => org.id === selectedOrgId);
  const scopeUnavailable = !!selectedOrgId && !orgLoading && (orgError || !selectedOrganization);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const loadOrganizations = useCallback(async () => {
    if (user?.role !== "root") { setOrgLoading(false); return; }
    const request = beginScopeRead(); setOrgLoading(true); setOrgError(false);
    try { const response = await api.get("/organizations", { signal: request.signal }); if (request.isCurrent()) setOrganizations(response.data.data || []); }
    catch { if (request.isCurrent()) setOrgError(true); }
    finally { if (request.isCurrent()) setOrgLoading(false); }
  }, [user?.role, user?.id, beginScopeRead]);
  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);
  const load = useCallback(async () => {
    const request = beginRead();
    if (user?.role !== "root") { setLoading(false); return; }
    if (selectedOrgId && (orgLoading || scopeUnavailable)) { setLoading(true); return; }
    setLoading(true); setError("");
    try {
      const requestParams = new URLSearchParams({ q: query, role, page: String(page), limit: "25" });
      if (selectedOrgId) requestParams.set("organizationId", selectedOrgId);
      const res = await api.get("/admin/users?" + requestParams, { signal: request.signal });
      if (!request.isCurrent()) return;
      setUsers(res.data.data.users || []); setPages(Math.max(1, res.data.data.totalPages || 1)); setTotal(res.data.data.total || 0);
    } catch { if (request.isCurrent()) setError("Global identities could not be loaded. Please retry."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [query, role, page, user?.role, user?.id, selectedOrgId, orgLoading, scopeUnavailable, beginRead]);
  useEffect(() => { void load(); }, [load]);
  function chooseOrganization(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("organizationId", id); else next.delete("organizationId");
    router.replace("/dashboard/admin/users" + (next.size ? "?" + next : ""), { scroll: false });
  }
  function open(row: GlobalUser, action: "status" | "login") {
    const memberships = membershipsFor(row);
    setTarget({ user: row, action });
    setOrganizationId(memberships.find(member => member.organizationId === selectedOrgId)?.organizationId || memberships[0]?.organizationId || "");
  }
  async function confirm() {
    if (!target || busy || user?.role !== "root") return;
    setBusy(true);
    try {
      if (target.action === "login") { await impersonate({ userId: target.user.id, organizationId: organizationId || undefined }); router.push("/dashboard"); }
      else { await api.put("/admin/users/" + target.user.id + "/status", { isActive: !target.user.isActive }); await load(); toast({ title: "Global identity updated", variant: "success" }); }
      setTarget(null);
    } catch (err: unknown) { toast({ title: "Action failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(false); }
  }
  if (user?.role !== "root") return <Alert variant="error" title="Restricted">Global identity management is available to Root.</Alert>;
  const listLoading = loading || (!!selectedOrgId && orgLoading);
  const activeFilterCount = Number(role !== "all") + Number(!!selectedOrgId);
  return <div className={styles.workspace}>
    <header className={styles.header}><div><h1>Global users</h1><p>Manage platform identities and account status.</p></div><Button variant="outline" className={styles.iconAction} aria-label="Refresh global users" title="Refresh global users" onClick={load} disabled={loading || scopeUnavailable}><RotateCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></header>
    {selectedOrgId && <section className={styles.scope} aria-label="Selected organization"><div><p className="text-xs text-text-secondary">Viewing organization identities</p><p className="mt-1 text-sm font-semibold">{selectedOrganization?.name || "Selected organization"}</p></div><Button variant="ghost" className={styles.iconAction} aria-label="Clear organization filter" title="Clear organization filter" onClick={() => chooseOrganization("")}><X className="h-4 w-4" /></Button>{selectedOrganization && <Link href={organizationWorkspaceUrl(selectedOrgId, "members")} className={styles.scopeLink}>Manage organization membership<ArrowUpRight className="h-4 w-4 shrink-0" /></Link>}</section>}
    <dl className={styles.summary} aria-label="Identity summary" aria-busy={listLoading || scopeUnavailable}>
      {[{ label: "Matching identities", value: total }, { label: "Active on this page", value: users.filter(row => row.isActive).length }, { label: "Inactive on this page", value: users.filter(row => !row.isActive).length }].map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{listLoading || scopeUnavailable ? <Skeleton width="2rem" height="1.5rem" /> : error ? <span aria-label="Unavailable">—</span> : metric.value}</dd></div>)}
    </dl>
    {orgError && <Alert variant="warning" title="Organization filter unavailable" action={<Button variant="outline" onClick={loadOrganizations}>Retry organizations</Button>}>Organization choices could not be loaded.</Alert>}
    <section aria-label="Global identity directory" className={styles.directory}>
      <div className={styles.filterBar}>
      <div className={styles.toolbar}>
        <Input containerClassName={styles.search} aria-label="Search global users" type="search" icon={<Search />} maxLength={100} placeholder="Search name, email or phone" value={search} onChange={event => setSearch(event.target.value)} />
        <Button variant="outline" className={styles.filterToggle} aria-label="User filters" aria-expanded={filtersExpanded} aria-controls={filtersId} onClick={() => setFiltersExpanded(value => !value)}><SlidersHorizontal className="h-4 w-4" />Filters{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}</Button>
      </div>
      <div id={filtersId} className={styles.filters} data-expanded={filtersExpanded}>
        <Select label="Global role" value={role} onChange={event => setRole(event.target.value)} options={["all", "root", "admin", "doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier", "patient", "family_member", ...users.map(row => row.role)].filter((value, index, all) => all.indexOf(value) === index).map(value => ({ value, label: value === "all" ? "All identity roles" : value.replaceAll("_", " ") }))} />
        <Select label="Filter by organization" value={selectedOrgId} disabled={orgLoading || orgError} onChange={event => chooseOrganization(event.target.value)} options={[{ value: "", label: "All organizations" }, ...organizations.map(org => ({ value: org.id, label: org.name })), ...(selectedOrgId && !selectedOrganization ? [{ value: selectedOrgId, label: "Organization unavailable" }] : [])]} />
      </div>
      </div>
      {scopeUnavailable ? <div className="p-4"><Alert variant="warning" title="Selected organization unavailable" action={<Button variant="outline" onClick={() => chooseOrganization("")}>Show all organizations</Button>}>Choose an available organization before reviewing its identities.</Alert></div> : <>
        <div aria-hidden="true" className={styles.columns}><span>Identity</span><span>Organization access</span><span>Global status</span><span className="text-right">Platform actions</span></div>
        {error ? <div className="p-4"><Alert variant="error" title="Unable to load identities" action={<Button variant="outline" onClick={load}>Try again</Button>}>{error}</Alert></div> : listLoading ? <LoadingState label="Loading global users"><div className="space-y-3 p-4">{[0, 1, 2].map(item => <Skeleton key={item} height="8rem" />)}</div></LoadingState> : !users.length ? <EmptyState icon={<Users />} title="No identities match these filters." description="Try another name, role or organization." /> : <ul aria-label="Global identities" className={styles.list}>
          {users.map(row => <li key={row.id} className={styles.row}>
            <div className={styles.identity}><Avatar name={row.name} size="md" /><div><h2>{row.name || "Unnamed user"}</h2><p className={styles.identityEmail}>{row.email}</p><p className={styles.identityRole}>{row.role.replaceAll("_", " ")}</p></div></div>
            <div className={styles.status}><span className={styles.fieldLabel}>Global status</span><Badge variant={row.isActive ? "success" : "neutral"} dot>{row.isActive ? "Active identity" : "Inactive identity"}</Badge></div>
            <div className={styles.memberships}><p className={styles.fieldLabel}>Organization access</p>{membershipsFor(row).length ? <ul>{membershipsFor(row).map(member => <li key={member.organizationId}><Link href={organizationWorkspaceUrl(member.organizationId, "members")} className={styles.membershipLink}><span>{member.organizationName}</span><span>{member.role.replaceAll("_", " ")}</span></Link></li>)}</ul> : <p className="mt-1 text-sm text-text-secondary">{row.role === "root" ? "Platform account" : "No organization membership"}</p>}</div>
            <div className={styles.actions}>
              {row.id !== user.id && row.role !== "root" && row.isActive && <Button variant="outline" size="sm" onClick={() => open(row, "login")}><LogIn className="h-4 w-4 shrink-0" />Login as</Button>}
              {row.id !== user.id && <Button variant="ghost" size="sm" onClick={() => open(row, "status")}>{row.isActive ? <UserRoundX className="h-4 w-4 shrink-0" /> : <UserRoundCheck className="h-4 w-4 shrink-0" />}{row.isActive ? "Deactivate identity" : "Reactivate identity"}</Button>}
              {row.id === user.id && <Badge variant="outline">Your account</Badge>}
            </div>
          </li>)}
        </ul>}
        <footer className={styles.footer}><span>{error ? "Results unavailable" : listLoading ? "Loading identities..." : `${total} identities`}</span><span>Page {page} of {pages}</span><Pagination currentPage={page} totalPages={pages} onPageChange={next => { if (!loading) setPagination({ key: filterKey, page: next }); }} /></footer>
      </>}
    </section>
    <p className={styles.notice}><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>Account status changes affect every organization. To remove access from one organization, manage its membership.</span></p>
    <Modal open={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.action === "login" ? "Start login-as session" : target?.user.isActive ? "Deactivate global identity?" : "Reactivate global identity?"} size="md" busy={busy} footer={<div className={styles.modalActions}><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button onClick={confirm} loading={busy}>Confirm</Button></div>}>
      <div className="space-y-4"><div className="rounded-xl bg-surface-alt p-3"><p className="font-semibold break-words">{target?.user.name}</p><p className="text-sm text-text-muted break-all">{target?.user.email}</p></div><p className="text-sm">{target?.action === "login" ? "This session uses the selected identity's permissions. Choose the organization context for accounts with multiple memberships." : "Account status applies across all organizations. Deactivation revokes sessions. To remove only one organization's access, use its Members section."}</p>{target?.action === "login" && !!membershipsFor(target.user).length && <Select label="Organization context" value={organizationId} onChange={event => setOrganizationId(event.target.value)} options={membershipsFor(target.user).map(member => ({ value: member.organizationId, label: member.organizationName }))} />}</div>
    </Modal>
  </div>;
}
export default function PlatformUsersPage() {
  return <Suspense fallback={<LoadingState label="Loading global users"><SkeletonTable columns={5} /></LoadingState>}><PlatformUsers /></Suspense>;
}
