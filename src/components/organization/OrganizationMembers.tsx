"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { organizationPath, type OrganizationMember } from "@/services/organization.service";
import TeamManagement from "./TeamManagement";

export function OrganizationMembers({ organizationId, onMembersLoaded }: { organizationId: string; onMembersLoaded?: (members: OrganizationMember[]) => void }) {
  const { user, impersonate } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("nurse");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<{ member: OrganizationMember; action: "remove" | "login" } | null>(null);
  const [profiles, setProfiles] = useState(false);
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
    {error ? <Alert variant="error" title="Unable to load members" action={<Button variant="outline" onClick={load}>Retry</Button>}>{error}</Alert> : loading ? <Spinner label="Loading members" /> : <>
      {!filtered.length ? <p className="border border-dashed border-border p-6 text-sm text-text-muted">{search ? "No members match your search." : "No members found."}</p> : <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">{filtered.map((member) => <li key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium break-words">{member.name}</p><p className="text-sm text-text-muted break-all">{member.email}</p><p className="text-xs mt-1 capitalize">{member.role.replaceAll("_", " ")} · {member.isActive ? "Active identity" : "Inactive identity"}</p></div><div className="flex flex-wrap gap-2 shrink-0">{user?.role === "root" && member.isActive && member.role !== "root" && <Button variant="outline" size="sm" onClick={() => setTarget({ member, action: "login" })}>Login as</Button>}{canManage && member.id !== user?.id && member.role !== "root" && <Button variant="ghost" size="sm" onClick={() => setTarget({ member, action: "remove" })}>Remove membership</Button>}</div></li>)}</ul>}
    </>}
    {hasAnyPermission(user, "VIEW_STAFF", "MANAGE_STAFF") && <div className="border-t border-border pt-4"><Button variant="outline" onClick={() => setProfiles(!profiles)} aria-expanded={profiles}>{profiles ? "Close clinical team setup" : "Clinical profiles & assignments"}</Button>{profiles && <div className="pt-4"><TeamManagement organizationId={organizationId} embedded /></div>}</div>}
    <Modal open={invite} onClose={() => { if (!busy) setInvite(false); }} title="Invite organization member" size="md" busy={busy} footer={<Button type="submit" form="invite-member" loading={busy}>Send invitation</Button>}><form id="invite-member" className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await api.post(organizationPath("/onboarding/invitations", organizationId), { email: email.trim().toLowerCase(), role }); setInvite(false); setEmail(""); toast({ title: "Invitation queued", description: "The email link expires in 48 hours. Membership appears after acceptance.", variant: "success" }); }
      catch (err: unknown) { toast({ title: "Invitation failed", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
      finally { setBusy(false); }
    }}><Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /><Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} disabled={busy} options={["admin", "doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} /><p className="text-sm text-text-muted">For a doctor or receptionist, complete their clinical profile and location assignments after acceptance.</p></form></Modal>
    <Modal open={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.action === "login" ? `Login as ${target.member.name}` : `Remove ${target?.member.name}'s membership?`} size="md" busy={busy} footer={<div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button><Button onClick={confirm} loading={busy}>{target?.action === "login" ? "Start session" : "Remove membership"}</Button></div>}><p className="text-sm">{target?.action === "login" ? "You will use this member's permissions in the selected organization. Return to your platform account using the session banner." : "Organization access and clinical assignments will be removed. The global identity and other organization memberships will be kept. The last active administrator cannot be removed."}</p></Modal>
  </div>;
}
