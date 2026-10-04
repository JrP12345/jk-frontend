import { create } from "zustand";
import api from "@/lib/api";

export interface ModuleInfo {
  moduleKey: string;
  enabled: boolean;
  priority: "P1" | "P2" | "P3";
  label: string;
  route: string | null;
  description: string | null;
  section: string | null;
  alwaysOn: boolean;
}

interface ModuleState {
  modules: ModuleInfo[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  reset: () => void;

  // Actions
  fetchModules: () => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
  toggleModule: (moduleKey: string, enabled: boolean) => Promise<void>;
  bulkToggleModules: (updates: Array<{ moduleKey: string; enabled: boolean }>) => Promise<void>;
}

let generation = 0;
let pending: Promise<void> | null = null;
let controller: AbortController | null = null;

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  reset: () => {
    generation++;
    controller?.abort();
    controller = null;
    pending = null;
    set({ modules: [], isLoaded: false, isLoading: false, error: null });
  },

  fetchModules: () => {
    if (pending) return pending;

    const requestGeneration = generation;
    const requestController = new AbortController();
    controller = requestController;
    set({ isLoading: true, error: null });
    pending = (async () => {
      try {
        const res = await api.get("/modules", { signal: requestController.signal });
        if (requestGeneration !== generation) return;
        const data = res.data.data || [];
        set({ modules: data, isLoaded: true, isLoading: false });
      } catch (err: unknown) {
        if (requestGeneration === generation) set({ error: err instanceof Error ? err.message : "Failed to load modules", isLoading: false });
      } finally {
        if (requestGeneration === generation) { pending = null; controller = null; }
      }
    })();
    return pending;
  },

  isModuleEnabled: (moduleKey: string) => {
    const { modules, isLoaded } = get();

    // Before modules are loaded, default to showing everything
    // so we don't flash-hide navigation items on initial load
    if (!isLoaded) return true;

    const mod = modules.find((m) => m.moduleKey === moduleKey);
    if (!mod) return false;
    if (mod.alwaysOn) return true;

    return mod.enabled;
  },

  toggleModule: async (moduleKey: string, enabled: boolean) => {
    const requestGeneration = generation;
    try {
      await api.put(`/modules/${moduleKey}`, { enabled });
      if (requestGeneration !== generation) return;
      set((state) => ({
        modules: state.modules.map((m) =>
          m.moduleKey === moduleKey ? { ...m, enabled } : m
        ),
      }));
    } catch (err: unknown) {
      console.error("Failed to toggle module:", err);
      throw err;
    }
  },

  bulkToggleModules: async (updates: Array<{ moduleKey: string; enabled: boolean }>) => {
    const requestGeneration = generation;
    try {
      await api.put("/modules/bulk", { modules: updates });
      if (requestGeneration !== generation) return;
      const updateMap = new Map(updates.map((u) => [u.moduleKey, u.enabled]));
      set((state) => ({
        modules: state.modules.map((m) =>
          updateMap.has(m.moduleKey)
            ? { ...m, enabled: updateMap.get(m.moduleKey)! }
            : m
        ),
      }));
    } catch (err: unknown) {
      console.error("Failed to bulk toggle modules:", err);
      throw err;
    }
  },
}));
