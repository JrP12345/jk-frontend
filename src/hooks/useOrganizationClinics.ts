"use client";
import { useCallback, useState } from "react";
import api from "@/lib/api";
import { organizationPath } from "@/services/organization.service";
import { useClinicStore, type ClinicInfo } from "@/store/clinicStore";

// Management selection must never change the signed session or clinical selector.
export function useOrganizationClinics(organizationId?: string) {
  const store = useClinicStore();
  const [local, setLocal] = useState<ClinicInfo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchClinics = useCallback(async (force?: boolean) => {
    if (!organizationId) return useClinicStore.getState().fetchClinics(force);
    setLoading(true); setError(null);
    try {
      const res = await api.get(organizationPath("/onboarding/clinics", organizationId));
      const list = (res.data?.data || []).map((c: ClinicInfo & { _id?: string }) => ({ ...c, id: String(c.id || c._id) }));
      setLocal(list); return list;
    } catch { setError("Locations could not be loaded. Please retry."); return []; }
    finally { setLoading(false); }
  }, [organizationId]);
  return { clinics: organizationId ? local : store.clinics, fetchClinics, isLoading: organizationId ? isLoading : store.isLoading, error: organizationId ? error : store.error, activeClinicId: organizationId ? null : store.activeClinicId };
}
