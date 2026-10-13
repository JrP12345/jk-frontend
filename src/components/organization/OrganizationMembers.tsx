"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, useToast, LoadingState, SkeletonCardGrid } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { type OrganizationMember } from "@/services/organization.service";
import { InviteOrganizationMember } from "./InviteOrganizationMember";
import TeamManagement from "./TeamManagement";
import MemberLocationAccess from "./MemberLocationAccess";

export function OrganizationMembers({ organizationId, onMembersLoaded, initialClinicalSetup = false }: { organizationId: string; onMembersLoaded?: (members: OrganizationMember[]) => void; initialClinicalSetup?: boolean }) {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [invite, setInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<{ member: OrganizationMember; action: "remove" | "login" } | null>(null);
  const [profiles, setProfiles] = useState(initialClinicalSetup);
  const [accessMember, setAccessMember] = useState<OrganizationMember | null>(null);
  const canManageAccess = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const canManage = hasAnyPermission(user, "MANAGE_STAFF");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await api.get(`/onboarding/organizations/${organizationId}/members`); setMembers(res.data?.data?.members || []); }
    catch { setError("Members could not be loaded. Please retry."); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!loading && !error) onMembersLoaded?.(members); }, [members, loading, error, onMembersLoaded]);
  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.action === "login") { await impersonate({ userId: target.member.id, organizationId }); router.push("/dashboard"); }
      else { await api.delete(`/organizations/${organizationId}/members/${target.member.id}`); await load(); toast({ title: "Membership removed", description: "The user identity and other organization memberships are retained.", variant: "success" }); }
      setTarget(null);
    } catch (err: unknown) { toast({ title: "Action failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(false); }
  }
  const filtered = members.filter((m) => `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4 min-w-0">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Organization members</h2><p className="text-sm text-text-muted">Membership and access for this organization. User identities are shared across the platform.</p></div>{canManage && <Button onClick={() => setInvite(true)}>Invite member</Button>}</div>
    <div className="flex gap-3"><Input aria-label="Search members" placeholder="Search name, email or role" value={search} onChange={(e) => setSearch(e.target.value)} /><Button variant="outline" onClick={load} disabled={loading}>Refresh</Button></div>
    {error ? <Alert variant="error" title="Unable to load members" action={<Button variant="outline" onClick={load}>Retry</Button>}>{error}</Alert> : loading ? <LoadingState label="Loading members"><SkeletonCardGrid count={3} columns={1} /></LoadingState> : <>
      {!filtered.length ? <p className="border border-dashed border-border p-6 text-sm text-text-muted">{search ? "No members match your search." : "No members found."}</p> : <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">{filtered.map((member) => <li key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium break-words">{member.name}</p><p className="text-sm text-text-muted break-all">{member.email}</p><p className="text-xs mt-1 capitalize">{member.role.replaceAll("_", " ")} Â· {member.isActive ? "Active identity" : "Inactive identity"}</p></div><div className="flex flex-wrap gap-2 shrink-0">{canManageAccess && member.source === "org_member" && member.id !== user?.id && !["patient", "family_member", "root"].includes(member.role) && <Button variant="outline" size="sm" onClick={() => setAccessMember(member)}>Location access</Button>}{user?.role === "root" && member.isActive && member.role !== "root" && <Button variant="outline" size="sm" onClick={() => setTarget({ member, action: "login" })}>Login as</Button>}{canManage && member.id !== user?.id && member.role !== "root" && <Button variant="ghost" size="sm" onClick={() => setTarget({ member, action: "remove" })}>Remove membership</Button>}</div></li>)}</ul>}
    </>}
    {hasAnyPermission(user, "VIEW_STAFF", "MANAGE_STAFF") && <div className="border-t border-border pt-4"><Button variant="outline" onClick={() => setProfiles(!profiles)} aria-expanded={profiles}>{profiles ? "Close clinical team setup" : "Clinical profiles & assignments"}</Button>{profiles && <div className="pt-4"><TeamManagement organizationId={organizationId} embedded /></div>}</div>}
    {accessMember && <MemberLocationAccess organizationId={organizationId} member={accessMember} onClose={() => setAccessMember(null)} onSaved={() => { setAccessMember(null); void load(); }} />}
    {invite && <InviteOrganizationMember key={organizationId} organizationId={organizationId} onClose={() => setInvite(false)} />}
    <Modal open={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.action === "login" ? `Login as ${target.member.name}` : `Remove ${target?.member.name}'s membership?`} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button><Button onClick={confirm} loading={busy}>{target?.action === "login" ? "Start session" : "Remove membership"}</Button></div>}><p className="text-sm">{target?.action === "login" ? "You will use this member's permissions in the selected organization. Return to your platform account using the session banner." : "Organization access and clinical assignments will be removed. The global identity and other organization memberships will be kept. The last active administrator cannot be removed."}</p></Modal>
  </div>;
}
