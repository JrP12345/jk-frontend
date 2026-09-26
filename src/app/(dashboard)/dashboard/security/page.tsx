"use client";

import { useState, useEffect } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Button, Card, Input, Toggle, Skeleton, useToast, Badge } from "@/components/ui";
import { KeyRound, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Passkey = { id: string; name: string; createdAt: string; lastUsedAt?: string };
type Owner = { id: string; name: string; email: string; limit: number | null; activeSessions: number; organizations: string[] };

export default function AccountSecurityPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const load = async () => {
    try {
      const result = await api.get("/auth/passkeys");
      setKeys(result.data.data || []);
      if (user?.role === "root" && !user.impersonatedBy) {
        const policies = await api.get("/auth/admin/owner-session-policies");
        setOwners(policies.data.data || []);
        setLimits(Object.fromEntries((policies.data.data || []).map((owner: Owner) => [owner.id, owner.limit === null ? "" : String(owner.limit)])));
      }
    } catch (error: any) { toast({ title: "Could not load account security", description: error.response?.data?.message || "Please try again.", variant: "error" }); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    setSupported(window.isSecureContext && browserSupportsWebAuthn());
    setHaptics(localStorage.getItem("ananta_haptics") !== "off");
    if (user && !user.impersonatedBy) void load();
    else setLoading(false);
  }, [user?.id]);
  const addKey = async () => {
    setBusy("add");
    try {
      const options = await api.post("/auth/passkeys/register/options");
      const response = await startRegistration({ optionsJSON: options.data.data });
      await api.post("/auth/passkeys/register/verify", { response, name: "My passkey" });
      await load();
      toast({ title: "Passkey added", description: "You can now sign in using your device's screen lock.", variant: "success" });
    } catch (error: any) {
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") toast({ title: "Could not add passkey", description: error.response?.data?.message || "Please try again on a supported device.", variant: "error" });
    } finally { setBusy(null); }
  };
  const removeKey = async (id: string) => {
    setBusy(id);
    try { await api.delete(`/auth/passkeys/${id}`); await load(); toast({ title: "Passkey removed", variant: "success" }); }
    catch { toast({ title: "Could not remove passkey", variant: "error" }); }
    finally { setBusy(null); }
  };
  const updateLimit = async (owner: Owner) => {
    const value = limits[owner.id]?.trim() || "";
    const limit = value === "" ? null : Number(value);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
      toast({ title: "Enter a limit from 1 to 1000, or leave it blank for unlimited", variant: "error" }); return;
    }
    setBusy(owner.id);
    try { await api.patch(`/auth/admin/owner-session-policies/${owner.id}`, { limit }); await load(); toast({ title: "Owner session limit updated", variant: "success" }); }
    catch { toast({ title: "Could not update session limit", variant: "error" }); }
    finally { setBusy(null); }
  };
  if (user?.impersonatedBy) return <Card className="p-5">Return to your own account to manage account security.</Card>;
  return <div className="space-y-5 max-w-4xl mx-auto pb-24">
    <div><h1 className="text-2xl font-bold text-text">Account security</h1><p className="text-sm text-text-secondary mt-1">Manage your passkeys and device preferences.</p></div>
    <Card className="p-4 sm:p-6 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary-500" />Passkeys</h2>
      <p className="text-sm text-text-secondary">Sign in with your fingerprint, face, or device PIN. Your existing sign-in methods remain available.</p>
      {loading ? <Skeleton className="h-16 w-full" /> : keys.length === 0 ? <p className="text-sm text-text-muted">No passkeys added yet.</p> : keys.map((key) => <div key={key.id} className="flex flex-wrap gap-3 justify-between items-center border border-border rounded-xl p-3">
        <div><p className="font-semibold text-sm">{key.name}</p><p className="text-xs text-text-muted">{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : `Added ${new Date(key.createdAt).toLocaleDateString()}`}</p></div>
        <Button variant="outline" size="sm" disabled={busy !== null} loading={busy === key.id} onClick={() => removeKey(key.id)}>Remove</Button>
      </div>)}
      <Button onClick={addKey} disabled={!supported || busy !== null || loading} loading={busy === "add"}>Add passkey</Button>
      {!supported && <p className="text-xs text-text-muted">Open this page in a browser that supports passkeys over HTTPS.</p>}
    </Card>
    <Card className="p-4 sm:p-6"><Toggle label="Vibration feedback" checked={haptics} onChange={(value) => { setHaptics(value); localStorage.setItem("ananta_haptics", value ? "on" : "off"); }} /><p className="text-xs text-text-muted mt-2">Brief feedback for confirmations and errors on supported devices.</p></Card>
    {user?.role === "root" && <Card className="p-4 sm:p-6 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-500" />Organization owner sessions</h2>
      <p className="text-sm text-text-secondary">Owners have unlimited sessions by default. Lowering a limit signs out the oldest sessions above that limit.</p>
      {loading ? <Skeleton className="h-20 w-full" /> : owners.map((owner) => <div key={owner.id} className="border border-border p-3 sm:p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap gap-2 justify-between"><div><p className="font-semibold">{owner.name}</p><p className="text-xs text-text-muted break-all">{owner.email} · {owner.organizations.join(", ")}</p></div><Badge>{owner.activeSessions} active sessions</Badge></div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end"><Input label="Maximum sessions (blank means unlimited)" type="number" min={1} max={1000} value={limits[owner.id] || ""} onChange={(event) => setLimits((current) => ({ ...current, [owner.id]: event.target.value }))} /><Button disabled={busy !== null} loading={busy === owner.id} onClick={() => updateLimit(owner)}>Save limit</Button></div>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={async () => { setBusy(owner.id); try { await api.post(`/auth/admin/sessions/revoke-user/${owner.id}`); await load(); toast({ title: "Owner sessions signed out", variant: "success" }); } catch { toast({ title: "Could not sign out sessions", variant: "error" }); } finally { setBusy(null); } }}>Sign out all sessions</Button>
      </div>)}
    </Card>}
  </div>;
}
