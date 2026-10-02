"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Input, Spinner, Toggle, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useModuleStore, type ModuleInfo } from "@/store/moduleStore";
import { organizationPath } from "@/services/organization.service";

export function OrganizationModules({ organizationId }: { organizationId?: string }) {
  const { user } = useAuthStore();
  const id = organizationId || user?.organization_id;
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true); setError("");
    try { const res = await api.get(organizationPath("/modules", id)); setModules(res.data.data || []); }
    catch { setError("Module configuration could not be loaded."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function update(updates: { moduleKey: string; enabled: boolean }[], key: string) {
    setBusy(key);
    try {
      await api.put(organizationPath("/modules/bulk", id), { modules: updates });
      const next = modules.map((m) => ({ ...m, enabled: updates.find((u) => u.moduleKey === m.moduleKey)?.enabled ?? m.enabled }));
      setModules(next);
      if (id === user?.organization_id) useModuleStore.setState({ modules: next, isLoaded: true });
      toast({ title: "Modules updated", variant: "success" });
    } catch (err: unknown) { toast({ title: "Could not update modules", description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || "Please retry.", variant: "error" }); }
    finally { setBusy(""); }
  }
  if (!id) return <p className="text-sm text-text-muted">Select an organization to configure its modules.</p>;
  if (loading) return <Spinner label="Loading module configuration" />;
  if (error) return <Alert variant="error" title="Unable to load modules" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>;
  return <div className="space-y-4"><h2 className="text-base font-semibold">Organization modules</h2><p className="text-sm text-text-muted">Core modules are enabled during provisioning. Required modules stay enabled. Root controls optional modules.</p><Input aria-label="Find module" placeholder="Find a module" value={search} onChange={(e) => setSearch(e.target.value)} />{["P1", "P2"].map((priority) => {
    const group = modules.filter((m) => m.priority === priority);
    const filtered = group.filter((m) => `${m.label} ${m.description}`.toLowerCase().includes(search.toLowerCase()));
    return <section key={priority} className="border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h3 className="font-medium">{priority === "P1" ? "Clinic essentials" : "Extended modules"}</h3>{user?.role === "root" && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={() => update(group.filter((m) => !m.alwaysOn).map((m) => ({ moduleKey: m.moduleKey, enabled: true })), priority)}>Enable all</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => update(group.filter((m) => !m.alwaysOn).map((m) => ({ moduleKey: m.moduleKey, enabled: false })), priority)}>Disable optional</Button></div>}</div>{!filtered.length ? <p className="text-sm text-text-muted">No matching modules.</p> : <ul className="divide-y divide-border">{filtered.map((m) => <li key={m.moduleKey} className="py-3 flex justify-between items-center gap-4"><div className="min-w-0"><p className="font-medium text-sm">{m.label}{m.alwaysOn && " · Required"}</p><p className="text-xs text-text-muted">{m.description}</p></div><Toggle label={m.label} checked={m.enabled} disabled={user?.role !== "root" || m.alwaysOn || !!busy} onChange={(enabled) => update([{ moduleKey: m.moduleKey, enabled }], m.moduleKey)} /></li>)}</ul>}</section>;
  })}</div>;
}
