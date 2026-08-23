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

  // Actions
  fetchModules: () => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
  toggleModule: (moduleKey: string, enabled: boolean) => Promise<void>;
  bulkToggleModules: (updates: Array<{ moduleKey: string; enabled: boolean }>) => Promise<void>;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  fetchModules: async () => {
    // Avoid duplicate fetches
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/modules");
      const data = res.data.data || [];
      set({ modules: data, isLoaded: true, isLoading: false });
    } catch (err: any) {
      console.error("Failed to fetch modules:", err);
      set({ error: err.message || "Failed to load modules", isLoaded: true, isLoading: false });
    }
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
    try {
      await api.put(`/modules/${moduleKey}`, { enabled });
      // Optimistic update
      set((state) => ({
        modules: state.modules.map((m) =>
          m.moduleKey === moduleKey ? { ...m, enabled } : m
        ),
      }));
    } catch (err: any) {
      console.error("Failed to toggle module:", err);
      throw err;
    }
  },

  bulkToggleModules: async (updates: Array<{ moduleKey: string; enabled: boolean }>) => {
    try {
      await api.put("/modules/bulk", { modules: updates });
      // Optimistic update
      const updateMap = new Map(updates.map((u) => [u.moduleKey, u.enabled]));
      set((state) => ({
        modules: state.modules.map((m) =>
          updateMap.has(m.moduleKey)
            ? { ...m, enabled: updateMap.get(m.moduleKey)! }
            : m
        ),
      }));
    } catch (err: any) {
      console.error("Failed to bulk toggle modules:", err);
      throw err;
    }
  },
}));
