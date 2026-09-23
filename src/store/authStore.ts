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
  image_url?: string;
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
      if (user && (user.role as string) === "guest") {
        if (typeof window !== "undefined") {
          document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
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
    if ((user?.role as string) === "guest") {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
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
        // Clear sensitive client caches during logout (Finding: Step 2.8)
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ action: "CLEAR_USER_CACHE" });
        }
        if ("caches" in window) {
          caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
        }
        sessionStorage.clear();
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

  // Listen for the custom "auth-expired" event from the axios interceptor.
  // This handler must redirect with `expired=1` immediately. Waiting for an
  // API logout first leaves the stale HttpOnly cookies in place long enough for
  // proxy middleware to bounce `/login` back to `/dashboard`.
  let handlingExpiredSession = false;
  window.addEventListener("auth-expired", () => {
    if (handlingExpiredSession) return;
    handlingExpiredSession = true;

    if (typeof window !== "undefined") {
      document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    // Clear state so no component remains in its authentication loading state.
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });

    // Best-effort server-side cleanup. `/auth/logout` is excluded from refresh
    // handling, so it cannot join a failed refresh cycle.
    void api.post("/auth/logout").catch(() => {
      // The login proxy below also clears same-site auth cookies.
    });

    // The proxy recognizes `expired=1`, clears stale cookies, and deliberately
    // allows this navigation through instead of redirecting back to the dashboard.
    if (window.location.pathname.startsWith("/dashboard")) {
      window.location.replace("/login?expired=1");
    }
  });
}
