import { create } from "zustand";
import api from "@/lib/api";

export interface ClinicInfo {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

interface ClinicState {
  clinics: ClinicInfo[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  fetchClinics: (force?: boolean) => Promise<ClinicInfo[]>;
}

function normalizeClinic(raw: Record<string, unknown>): ClinicInfo {
  return {
    ...raw,
    id: String(raw.id || raw._id),
    name: String(raw.name || ""),
    city: String(raw.city || ""),
  };
}

export const useClinicStore = create<ClinicState>((set, get) => ({
  clinics: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  fetchClinics: async (force = false) => {
    if (get().isLoading) return get().clinics;
    if (get().isLoaded && !force) return get().clinics;

    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/onboarding/clinics");
      const list = (res.data.data || []).map((c: Record<string, unknown>) => normalizeClinic(c));
      set({ clinics: list, isLoaded: true, isLoading: false });
      return list;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load clinics";
      set({ error: message, isLoaded: true, isLoading: false });
      return [];
    }
  },
}));
