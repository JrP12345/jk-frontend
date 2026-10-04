"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { organizationPath } from "@/services/organization.service";

export interface WorkflowPreferences {
  registration: "full" | "essential";
  consultation: "full" | "focused";
  currency: string;
}
const defaults: WorkflowPreferences = { registration: "full", consultation: "full", currency: "INR" };

export function useWorkflowPreferences(organizationId?: string) {
  const user = useAuthStore((state) => state.user);
  const scope = organizationId || user?.organization_id;
  const enabled = Boolean(scope && user && !["patient", "family_member", "guest"].includes(user.role));
  const query = useQuery({
    queryKey: ["workflow-preferences", authScopeKey(user), scope],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<WorkflowPreferences> => {
      const response = await api.get(organizationPath("/onboarding/organization/preferences", organizationId), { signal });
      return { ...defaults, ...response.data.data };
    },
  });
  const refetch = query.refetch;
  const reload = useCallback(async () => {
    if (enabled) await refetch({ cancelRefetch: false });
  }, [enabled, refetch]);
  return {
    preferences: enabled ? query.data || defaults : defaults,
    loading: enabled && query.isPending,
    error: enabled && query.isError,
    reload,
  };
}
