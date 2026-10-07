"use client";
import { useCallback, useState } from "react";
import api from "@/lib/api";
import { organizationPath } from "@/services/organization.service";
import { useLocationStore, type LocationInfo } from "@/store/locationStore";

// Management selection must never change the signed session or clinical selector.
export function useOrganizationLocations(organizationId?: string) {
  const store = useLocationStore();
  const [local, setLocal] = useState<LocationInfo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchLocations = useCallback(async (force?: boolean) => {
    if (!organizationId) return useLocationStore.getState().fetchLocations(force);
    setLoading(true); setError(null);
    try {
      const res = await api.get(organizationPath("/onboarding/locations", organizationId));
      const list = (res.data?.data || []).map((c: LocationInfo & { _id?: string }) => ({ ...c, id: String(c.id || c._id) }));
      setLocal(list); return list;
    } catch { setError("Locations could not be loaded. Please retry."); return []; }
    finally { setLoading(false); }
  }, [organizationId]);
  return { locations: organizationId ? local : store.locations, fetchLocations, isLoading: organizationId ? isLoading : store.isLoading, error: organizationId ? error : store.error, activeLocationId: organizationId ? null : store.activeLocationId };
}
