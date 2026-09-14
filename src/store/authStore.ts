import { create } from "zustand";
import api from "@/lib/api";
import { useClinicStore } from "./clinicStore";

export type Role = "root" | "admin" | "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier" | "patient" | "family_member";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization_id?: string;
  permissions?: string[];
  impersonatedBy?: {
    id: string;
    email: string;
    name: string;
    originalRole: string;
  } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  checkAuth: () => Promise<void>;
  login: (user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (organizationId?: string) => Promise<void>;
  impersonate: (params: { userId?: string; organizationId?: string; role?: string }) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Initially true so we don't flash login page on load

  checkAuth: async () => {
    try {
      const res = await api.get("/auth/me");
      const user = res.data.data.user;
      if (user && (!user.impersonatedBy || !user.impersonatedBy.id)) {
        user.impersonatedBy = null;
      }
      if (typeof window !== "undefined") {
        document.cookie = "ananta_session=1; path=/; max-age=604800; SameSite=Lax";
        if (user && (user.role === "patient" || user.role === "family_member")) {
          localStorage.removeItem("ananta_active_org_id");
          localStorage.removeItem("ananta_active_clinic_id");
        }
      }
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      if (typeof window !== "undefined") {
        document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: (user: User) => {
    if (user && (!user.impersonatedBy || !user.impersonatedBy.id)) {
      user.impersonatedBy = null;
    }
    if (typeof window !== "undefined") {
      document.cookie = "ananta_session=1; path=/; max-age=604800; SameSite=Lax";
      if (user && (user.role === "patient" || user.role === "family_member")) {
        localStorage.removeItem("ananta_active_org_id");
        localStorage.removeItem("ananta_active_clinic_id");
      }
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      set({ user: null, isAuthenticated: false });
    }
  },

  switchOrg: async (organizationId?: string) => {
    try {
      await api.post("/auth/switch-org", { organizationId });
      const res = await api.get("/auth/me");
      const user = res.data.data.user;
      if (user && (!user.impersonatedBy || !user.impersonatedBy.id)) {
        user.impersonatedBy = null;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("ananta_active_clinic_id");
        if (organizationId) localStorage.setItem("ananta_active_org_id", organizationId);
        else localStorage.removeItem("ananta_active_org_id");
      }
      useClinicStore.getState().setActiveClinic(null);
      set({ user, isAuthenticated: true });
    } catch (err) {
      console.error("Failed to switch organization context:", err);
      throw err;
    }
  },

  impersonate: async (params: { userId?: string; organizationId?: string; role?: string }) => {
    try {
      const res = await api.post("/auth/impersonate", params);
      const targetUser = res.data.data.user;
      if (targetUser && (!targetUser.impersonatedBy || !targetUser.impersonatedBy.id)) {
        targetUser.impersonatedBy = null;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("ananta_active_clinic_id");
        if (targetUser.organization_id) {
          localStorage.setItem("ananta_active_org_id", targetUser.organization_id);
        }
      }
      useClinicStore.getState().setActiveClinic(null);
      set({ user: targetUser, isAuthenticated: true });
    } catch (err) {
      console.error("Failed to impersonate user:", err);
      throw err;
    }
  },

  stopImpersonation: async () => {
    try {
      const res = await api.post("/auth/stop-impersonation");
      const rootUser = res.data.data.user;
      if (rootUser && (!rootUser.impersonatedBy || !rootUser.impersonatedBy.id)) {
        rootUser.impersonatedBy = null;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("ananta_active_clinic_id");
        localStorage.removeItem("ananta_active_org_id");
      }
      useClinicStore.getState().setActiveClinic(null);
      set({ user: rootUser, isAuthenticated: true });
    } catch (err: any) {
      // If 400 (session not active or out of sync), gracefully resync user via /auth/me
      if (err.response?.status === 400) {
        try {
          const checkRes = await api.get("/auth/me");
          const refreshedUser = checkRes.data.data.user;
          if (refreshedUser && (!refreshedUser.impersonatedBy || !refreshedUser.impersonatedBy.id)) {
            refreshedUser.impersonatedBy = null;
          }
          if (typeof window !== "undefined") {
            localStorage.removeItem("ananta_active_clinic_id");
            localStorage.removeItem("ananta_active_org_id");
          }
          useClinicStore.getState().setActiveClinic(null);
          set({ user: refreshedUser, isAuthenticated: true });
          return;
        } catch {
          // ignore
        }
      }
      console.error("Failed to stop impersonation:", err);
      throw err;
    }
  },
}));

// Listen for cross-tab context changes (active org or logout)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ananta_active_org_id") {
      // Re-verify auth when organization changes across tabs
      useAuthStore.getState().checkAuth();
    }
  });

  // Listen for the custom "auth-expired" event from the axios interceptor
  window.addEventListener("auth-expired", async () => {
    if (typeof window !== "undefined") {
      document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    // Clear state
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    
    // We MUST tell the backend to clear the HttpOnly cookies, otherwise middleware.ts 
    // will see the stale refresh_token and redirect back to /dashboard, causing an infinite loop.
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors if already logged out on backend
    }
    
    // Only force redirect if we are inside the dashboard
    if (window.location.pathname.startsWith("/dashboard")) {
      window.location.href = "/login?expired=1";
    }
  });
}
