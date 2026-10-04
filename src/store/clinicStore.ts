import { create } from "zustand";
import api from "@/lib/api";

export interface ClinicInfo {
  id: string;
  name: string;
  city: string;
  timezone?: string;
  effectiveTimezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  upiVpa?: string;
  merchantName?: string;
  [key: string]: unknown;
}

interface ClinicState {
  clinics: ClinicInfo[];
  activeClinicId: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  fetchClinics: (force?: boolean) => Promise<ClinicInfo[]>;
  setActiveClinic: (clinicId: string | null) => void;
  reset: () => void;
}

let generation = 0;
let pending: Promise<ClinicInfo[]> | null = null;
let controller: AbortController | null = null;

function storedClinic(): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem("ananta_active_clinic_id") : null; } catch { return null; }
}

function normalizeClinic(raw: Record<string, unknown>): ClinicInfo {
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
    name: String(raw.name || ""),
    city: String(raw.city || ""),
  };
}

export const useClinicStore = create<ClinicState>((set, get) => ({
  clinics: [],
  activeClinicId: storedClinic(),
  isLoaded: false,
  isLoading: false,
  error: null,

  setActiveClinic: (clinicId: string | null) => {
    try { if (typeof window !== "undefined") {
      if (clinicId) localStorage.setItem("ananta_active_clinic_id", clinicId);
      else localStorage.removeItem("ananta_active_clinic_id");
    } } catch { /* Selection still works when storage is unavailable. */ }
    set({ activeClinicId: clinicId });
  },

  reset: () => {
    generation++;
    controller?.abort();
    controller = null;
    pending = null;
    get().setActiveClinic(null);
    set({ clinics: [], isLoaded: false, isLoading: false, error: null });
  },

  fetchClinics: (force = false) => {
    if (pending) return pending;
    if (get().isLoaded && !force) return Promise.resolve(get().clinics);

    const requestGeneration = generation;
    const requestController = new AbortController();
    controller = requestController;
    set({ isLoading: true, error: null });
    pending = (async () => {
      try {
        const res = await api.get("/onboarding/clinics", { signal: requestController.signal });
        if (requestGeneration !== generation) return [];
        const rawList = res.data.data || [];
        const seenIds = new Set<string>();
        const list: ClinicInfo[] = [];
        for (const c of rawList) {
          const normalized = normalizeClinic(c);
          if (normalized.id && !seenIds.has(normalized.id)) {
            seenIds.add(normalized.id);
            list.push(normalized);
          }
        }
        set({ clinics: list, isLoaded: true, isLoading: false });
        return list;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load clinics";
        if (requestGeneration === generation) set({ error: message, isLoading: false });
        return [];
      } finally {
        if (requestGeneration === generation) { pending = null; controller = null; }
      }
    })();
    return pending;
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ananta_active_clinic_id") {
      useClinicStore.setState({ activeClinicId: e.newValue });
    }
  });
}
