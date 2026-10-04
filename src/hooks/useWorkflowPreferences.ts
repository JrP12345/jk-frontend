"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { organizationPath } from "@/services/organization.service";
import { useLatestRead } from "./useLatestRead";

export interface WorkflowPreferences {
  registration: "full" | "essential";
  consultation: "full" | "focused";
  currency: string;
}
const defaults: WorkflowPreferences = { registration: "full", consultation: "full", currency: "INR" };

export function useWorkflowPreferences(organizationId?: string) {
  const user = useAuthStore((state) => state.user);
  const scope = organizationId || user?.organization_id;
  const key = `${user?.id || ""}:${scope || ""}`;
  const [result, setResult] = useState<{ key: string; preferences: WorkflowPreferences; error: boolean } | null>(null);
  const beginRead = useLatestRead();
  const reload = useCallback(async () => {
    const request = beginRead();
    if (!user || !scope || ["patient", "family_member", "guest"].includes(user.role)) return;
    try {
      const response = await api.get(organizationPath("/onboarding/organization/preferences", organizationId), { signal: request.signal });
      if (request.isCurrent()) setResult({ key, preferences: { ...defaults, ...response.data.data }, error: false });
    } catch {
      if (request.isCurrent()) setResult({ key, preferences: defaults, error: true });
    }
  }, [beginRead, key, organizationId, scope, user]);
  useEffect(() => { void reload(); }, [reload]);
  return { preferences: result?.key === key ? result.preferences : defaults,
    loading: Boolean(scope && user && !["patient", "family_member", "guest"].includes(user.role) && result?.key !== key),
    error: result?.key === key && result.error, reload };
}
