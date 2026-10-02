"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

interface GlobalUser {
  id: string; name: string; email: string; role: string; isActive: boolean;
  organizationId?: string; organizationName?: string;
  memberships?: { organizationId: string; organizationName: string; role: string }[];
}
export default function PlatformUsersPage() {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<{ user: GlobalUser; action: "status" | "login" } | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    if (user?.role !== "root") { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ q: query, role, page: String(page), limit: "25" });
      const res = await api.get("/admin/users?" + params);
      setUsers(res.data.data.users || []); setPages(Math.max(1, res.data.data.totalPages || 1)); setTotal(res.data.data.total || 0);
    } catch { setError("Global identities could not be loaded. Please retry."); }
    finally { setLoading(false); }
  }, [query, role, page, user?.role]);
  useEffect(() => { void load(); }, [load]);
  function open(row: GlobalUser, action: "status" | "login") { setTarget({ user: row, action }); setOrganizationId(row.memberships?.[0]?.organizationId || row.organizationId || ""); }
  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.action === "login") { await impersonate({ userId: target.user.id, organizationId: organizationId || undefined }); router.push("/dashboard"); }
      else { await api.put("/admin/users/" + target.user.id + "/status", { isActive: !target.user.isActive }); await load(); toast({ title: "Global identity updated", variant: "success" }); }
      setTarget(null);
    } catch (err: unknown) { toast({ title: "Action failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(false); }
  }
  if (user?.role !== "root") return <Alert variant="error" title="Restricted">Global identity management is available to Root.</Alert>;
  return <div className="space-y-5 min-w-0 pb-8">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Global users</h1><p className="text-sm text-text-muted mt-1">Platform identities and account status. Manage membership and organization access inside the organization.</p></div><Button variant="outline" onClick={load} disabled={loading}>Refresh</Button></header>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"><Input aria-label="Search global users" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /><Select aria-label="Global role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={["all", "root", "admin", "doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier", "patient", ...users.map((u) => u.role)].filter((v, i, all) => all.indexOf(v) === i).map((value) => ({ value, label: value === "all" ? "All identity roles" : value.replaceAll("_", " ") }))} /></div>
    {error ? <Alert variant="error" title="Unable to load global users" action={<Button onClick={load}>Retry</Button>}>{error}</Alert> : loading ? <Spinner label="Loading global users" /> : !users.length ? <p className="p-6 border border-dashed border-border text-sm text-text-muted">No identities match these filters.</p> : <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">{users.map((row) => {
      const memberships = row.memberships || (row.organizationId ? [{ organizationId: row.organizationId, organizationName: row.organizationName || "Organization", role: row.role }] : []);
      return <li key={row.id} className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-medium break-words">{row.name}</p><p className="text-sm text-text-muted break-all">{row.email}</p><p className="text-xs mt-1 capitalize">{row.role.replaceAll("_", " ")} · {row.isActive ? "Active identity" : "Inactive identity"}</p></div><div className="min-w-0 flex-1 text-sm">{memberships.length ? <ul className="space-y-1">{memberships.map((m) => <li key={m.organizationId}><Link href={"/dashboard/organizations?organizationId=" + m.organizationId + "&section=members"} className="text-accent hover:underline break-words">{m.organizationName}</Link><span className="text-xs text-text-muted ml-2 capitalize">{m.role.replaceAll("_", " ")}</span></li>)}</ul> : <span className="text-text-muted">{row.role === "root" ? "Platform account" : "No organization membership"}</span>}</div><div className="flex gap-2 shrink-0">{row.id !== user.id && row.role !== "root" && row.isActive && <Button variant="outline" size="sm" onClick={() => open(row, "login")}>Login as</Button>}{row.id !== user.id && <Button variant="ghost" size="sm" onClick={() => open(row, "status")}>{row.isActive ? "Deactivate identity" : "Reactivate identity"}</Button>}</div></li>;
    })}</ul>}
    <div className="flex items-center justify-between gap-3 text-sm"><span className="text-text-muted">{total} identities · Page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>
    <Modal open={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.action === "login" ? "Start login-as session" : (target?.user.isActive ? "Deactivate global identity?" : "Reactivate global identity?")} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button onClick={confirm} loading={busy}>Confirm</Button></div>}><div className="space-y-4"><p className="text-sm">{target?.action === "login" ? "This session uses the selected identity's permissions. Choose the organization context for accounts with multiple memberships." : "Account status applies across all organizations. Deactivation revokes sessions. To remove only one organization's access, use its Members section."}</p>{target?.action === "login" && !!target.user.memberships?.length && <Select label="Organization context" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} options={target.user.memberships.map((m) => ({ value: m.organizationId, label: m.organizationName }))} />}</div></Modal>
  </div>;
}
