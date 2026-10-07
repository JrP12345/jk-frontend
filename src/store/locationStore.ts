import { create } from "zustand";
import api from "@/lib/api";
import { resolveLocationSelection, type FacilityType } from "@/lib/facility";

export interface LocationInfo {
  id: string;
  name: string;
  city: string;
  facilityType?: FacilityType | null;
  timezone?: string;
  effectiveTimezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  upiVpa?: string;
  merchantName?: string;
  [key: string]: unknown;
}

interface LocationState {
  locations: LocationInfo[];
  activeLocationId: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  fetchLocations: (force?: boolean) => Promise<LocationInfo[]>;
  setActiveLocation: (locationId: string | null) => void;
  reset: () => void;
}

let generation = 0;
let pending: Promise<LocationInfo[]> | null = null;
let controller: AbortController | null = null;

function storedLocation(): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem("ekavyu_active_location_id") : null; } catch { return null; }
}

function normalizeLocation(raw: Record<string, unknown>): LocationInfo {
  return {
    ...raw,
    id: String(raw.id || ""),
    name: String(raw.name || ""),
    city: String(raw.city || ""),
  };
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  activeLocationId: storedLocation(),
  isLoaded: false,
  isLoading: false,
  error: null,

  setActiveLocation: (locationId: string | null) => {
    try { if (typeof window !== "undefined") {
      if (locationId) localStorage.setItem("ekavyu_active_location_id", locationId);
      else localStorage.removeItem("ekavyu_active_location_id");
    } } catch { /* Selection still works when storage is unavailable. */ }
    set({ activeLocationId: locationId });
  },

  reset: () => {
    generation++;
    controller?.abort();
    controller = null;
    pending = null;
    get().setActiveLocation(null);
    set({ locations: [], isLoaded: false, isLoading: false, error: null });
  },

  fetchLocations: (force = false) => {
    if (pending) return pending;
    if (get().isLoaded && !force) return Promise.resolve(get().locations);

    const requestGeneration = generation;
    const requestController = new AbortController();
    controller = requestController;
    set({ isLoading: true, error: null });
    pending = (async () => {
      try {
        const res = await api.get("/onboarding/locations", { signal: requestController.signal });
        if (requestGeneration !== generation) return [];
        const rawList = res.data.data || [];
        const seenIds = new Set<string>();
        const list: LocationInfo[] = [];
        for (const c of rawList) {
          const normalized = normalizeLocation(c);
          if (normalized.id && !seenIds.has(normalized.id)) {
            seenIds.add(normalized.id);
            list.push(normalized);
          }
        }
        get().setActiveLocation(resolveLocationSelection(list, get().activeLocationId));
        set({ locations: list, isLoaded: true, isLoading: false });
        return list;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load locations";
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
    if (e.key === "ekavyu_active_location_id") {
      useLocationStore.setState({ activeLocationId: e.newValue });
    }
  });
}
