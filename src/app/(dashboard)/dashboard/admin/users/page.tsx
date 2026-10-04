"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, RotateCw, ShieldCheck, Users } from "lucide-react";
import api from "@/lib/api";
import { Alert, Avatar, Badge, Button, Card, Input, Modal, Pagination, Select, Spinner, StatCard, Table, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { organizationWorkspaceUrl, type OrganizationRecord } from "@/services/organization.service";

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
  return <div className="space-y-6 min-w-0 pb-8 text-text">
    <Card padding="lg" className="bg-gradient-to-br from-primary-500/10 via-surface to-surface border-primary-500/20">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0"><span className="shrink-0 rounded-2xl bg-accent-subtle p-3 text-accent"><Users className="h-7 w-7" /></span><div><Badge variant="primary">Root administration</Badge><h1 className="text-xl sm:text-2xl font-semibold mt-2">Global users</h1><p className="text-sm text-text-secondary mt-2">Platform identities and account status. Membership and organization access are managed in the organization workspace.</p></div></div>
        <Button variant="outline" onClick={load} disabled={loading || scopeUnavailable}><RotateCw className="h-4 w-4" />Refresh</Button>
      </header>
    </Card>
    {selectedOrgId && <Card padding="sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-text-muted">Viewing organization identities</p><p className="font-semibold break-words mt-1">{selectedOrganization?.name || "Selected organization"}</p></div>{selectedOrganization && <Link href={organizationWorkspaceUrl(selectedOrgId, "members")} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Manage organization membership →</Link>}</div></Card>}
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Matching identities" value={total} loading={loading || scopeUnavailable} icon={<Users />} description={selectedOrgId ? "Selected organization" : "Current filters"} />
      <StatCard label="Active on this page" value={users.filter(row => row.isActive).length} loading={loading || scopeUnavailable} icon={<CheckCircle2 />} />
      <StatCard label="Inactive on this page" value={users.filter(row => !row.isActive).length} loading={loading || scopeUnavailable} icon={<ShieldCheck />} />
    </div>
    <Card padding="sm"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_210px_230px]">
      <Input aria-label="Search global users" maxLength={100} placeholder="Search name, email or phone" value={search} onChange={event => setSearch(event.target.value)} />
      <Select aria-label="Global role" value={role} onChange={event => setRole(event.target.value)} options={["all", "root", "admin", "doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier", "patient", "family_member", ...users.map(row => row.role)].filter((value, index, all) => all.indexOf(value) === index).map(value => ({ value, label: value === "all" ? "All identity roles" : value.replaceAll("_", " ") }))} />
      <Select aria-label="Filter by organization" value={selectedOrgId} disabled={orgLoading || orgError} onChange={event => chooseOrganization(event.target.value)} options={[{ value: "", label: "All organizations" }, ...organizations.map(org => ({ value: org.id, label: org.name })), ...(selectedOrgId && !selectedOrganization ? [{ value: selectedOrgId, label: "Organization unavailable" }] : [])]} />
    </div></Card>
    {orgError && <Alert variant="warning" title="Organization filter unavailable" action={<Button variant="outline" onClick={loadOrganizations}>Retry organizations</Button>}>Organization choices could not be loaded.</Alert>}
    {scopeUnavailable ? <Alert variant="warning" title="Selected organization unavailable" action={<Button variant="outline" onClick={() => chooseOrganization("")}>Show all organizations</Button>}>Choose an available organization before reviewing its identities.</Alert> : <Card padding="none" className="overflow-hidden"><Table<GlobalUser>
      data={users} loading={loading || (!!selectedOrgId && orgLoading)} error={error || null} onRetry={load} searchable={false} pagination={false} showColumnVisibility={false}
      emptyMessage="No identities match these filters."
      columns={[
        { key: "name", header: "Identity", render: row => <div className="flex items-start gap-3 min-w-0"><Avatar name={row.name} size="md" /><div className="min-w-0"><p className="font-semibold break-words">{row.name}</p><p className="text-xs text-text-muted break-all mt-1">{row.email}</p><p className="text-xs text-text-muted capitalize mt-1">{row.role.replaceAll("_", " ")}</p></div></div> },
        { key: "memberships", header: "Organization access", render: row => {
          const memberships = membershipsFor(row);
          return memberships.length ? <ul className="space-y-2">{memberships.map(member => <li key={member.organizationId}><Link href={organizationWorkspaceUrl(member.organizationId, "members")} className="text-accent font-medium hover:underline break-words">{member.organizationName}</Link><p className="text-xs text-text-muted capitalize mt-1">{member.role.replaceAll("_", " ")}</p></li>)}</ul> : <span className="text-sm text-text-muted">{row.role === "root" ? "Platform account" : "No organization membership"}</span>;
        } },
        { key: "isActive", header: "Global status", render: row => <Badge variant={row.isActive ? "success" : "neutral"} dot>{row.isActive ? "Active identity" : "Inactive identity"}</Badge> },
        { key: "actions", header: "Platform actions", align: "right", render: row => <div className="flex flex-wrap gap-2 justify-end">
          {row.id !== user.id && row.role !== "root" && row.isActive && <Button variant="outline" size="sm" onClick={() => open(row, "login")}>Login as</Button>}
          {row.id !== user.id && <Button variant="ghost" size="sm" onClick={() => open(row, "status")}>{row.isActive ? "Deactivate identity" : "Reactivate identity"}</Button>}
          {row.id === user.id && <Badge variant="outline">Your account</Badge>}
        </div> },
      ]}
    /></Card>}
    {!scopeUnavailable && <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-text-muted">{total} identities · Page {page} of {pages}</span><Pagination currentPage={page} totalPages={pages} onPageChange={next => { if (!loading) setPagination({ key: filterKey, page: next }); }} /></div>}
    <Card variant="flat" padding="sm"><p className="text-xs text-text-muted flex items-start gap-2"><Building2 className="h-4 w-4 shrink-0 text-accent" />Account status changes affect every organization. To remove access from one organization, manage its membership.</p></Card>
    <Modal open={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.action === "login" ? "Start login-as session" : target?.user.isActive ? "Deactivate global identity?" : "Reactivate global identity?"} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button onClick={confirm} loading={busy}>Confirm</Button></div>}>
      <div className="space-y-4"><div className="rounded-xl bg-surface-alt p-3"><p className="font-semibold break-words">{target?.user.name}</p><p className="text-sm text-text-muted break-all">{target?.user.email}</p></div><p className="text-sm">{target?.action === "login" ? "This session uses the selected identity's permissions. Choose the organization context for accounts with multiple memberships." : "Account status applies across all organizations. Deactivation revokes sessions. To remove only one organization's access, use its Members section."}</p>{target?.action === "login" && !!membershipsFor(target.user).length && <Select label="Organization context" value={organizationId} onChange={event => setOrganizationId(event.target.value)} options={membershipsFor(target.user).map(member => ({ value: member.organizationId, label: member.organizationName }))} />}</div>
    </Modal>
  </div>;
}
export default function PlatformUsersPage() {
  return <Suspense fallback={<Spinner label="Loading global users" />}><PlatformUsers /></Suspense>;
}
