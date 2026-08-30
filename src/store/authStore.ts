import { create } from "zustand";
import api from "@/lib/api";

export type Role = "root" | "admin" | "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier" | "patient" | "family_member";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization_id?: string;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeClinicId: string | null;
  
  // Actions
  checkAuth: () => Promise<void>;
  login: (user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (organizationId?: string) => Promise<void>;
  setActiveClinic: (clinicId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Initially true so we don't flash login page on load
  activeClinicId: typeof window !== "undefined" ? localStorage.getItem("ananta_active_clinic_id") : null,

  checkAuth: async () => {
    try {
      const res = await api.get("/auth/me");
      set({ user: res.data.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: (user: User) => {
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // ignore
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  switchOrg: async (organizationId?: string) => {
    try {
      await api.post("/auth/switch-org", { organizationId });
      const res = await api.get("/auth/me");
      if (typeof window !== "undefined") {
        localStorage.removeItem("ananta_active_clinic_id");
        if (organizationId) localStorage.setItem("ananta_active_org_id", organizationId);
        else localStorage.removeItem("ananta_active_org_id");
      }
      set({ user: res.data.data.user, isAuthenticated: true, activeClinicId: null });
    } catch (err) {
      console.error("Failed to switch organization context:", err);
      throw err;
    }
  },

  setActiveClinic: (clinicId: string | null) => {
    if (typeof window !== "undefined") {
      if (clinicId) localStorage.setItem("ananta_active_clinic_id", clinicId);
      else localStorage.removeItem("ananta_active_clinic_id");
    }
    set({ activeClinicId: clinicId });
  },
}));

// Listen for cross-tab context changes (active clinic, active org, or logout)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ananta_active_clinic_id") {
      useAuthStore.setState({ activeClinicId: e.newValue });
    } else if (e.key === "ananta_active_org_id") {
      // Re-verify auth when organization changes across tabs
      useAuthStore.getState().checkAuth();
    }
  });

  // Listen for the custom "auth-expired" event from the axios interceptor
  window.addEventListener("auth-expired", async () => {
    // Clear state
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    
    // We MUST tell the backend to clear the HttpOnly cookies, otherwise proxy.ts 
    // will see the stale refresh_token and redirect back to /dashboard, causing an infinite loop.
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors if already logged out on backend
    }
    
    // Only force redirect if we are inside the dashboard
    if (window.location.pathname.startsWith("/dashboard")) {
      window.location.href = "/login";
    }
  });
}
