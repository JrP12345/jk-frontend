"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Select, useToast } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import type { StaffWorkspace } from "@/types/workspace";
import api from "@/lib/api";

export default function StaffWorkspaceSwitcher() {
  const user = useAuthStore(state => state.user);
  const switchOrg = useAuthStore(state => state.switchOrg);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const enabled = Boolean(user && !["root", "patient", "family_member"].includes(user.role) && !user.impersonatedBy);
  const query = useQuery({ queryKey: ["staff-workspaces", user?.id, user?.organization_id], enabled,
    queryFn: async ({ signal }): Promise<StaffWorkspace[]> => (await api.get("/auth/workspaces", { signal })).data.data,
  });
  if (!enabled) return null;
  if (query.isError) return <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Reload workspaces</Button>;
  if (!query.data || query.data.length < 2) return null;
  return <div className="w-36 sm:w-48 min-w-0">
    <Select aria-label="Organization workspace" value={user?.organization_id || ""} disabled={busy}
      options={query.data.map(workspace => ({ value: workspace.organizationId, label: workspace.name }))}
      onChange={async event => {
        if (busy || event.target.value === user?.organization_id) return;
        setBusy(true);
        try { await switchOrg(event.target.value); router.replace("/dashboard"); }
        catch { toast({ title: "Workspace could not be opened", description: "Sign in again to verify your current workspace.", variant: "error" }); }
        finally { setBusy(false); }
      }} />
  </div>;
}
