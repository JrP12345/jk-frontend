import { create } from "zustand";
import api from "@/lib/api";
import { useClinicStore } from "./clinicStore";
import { useModuleStore } from "./moduleStore";
import { authScopeKey } from "@/lib/authScope";
import { aiSDK } from "@/lib/aiSDK";
import { clearRecentTracker } from "./trackerStore";

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
  isLoggingOut: boolean;
  
  // Actions
  checkAuth: () => Promise<void>;
  login: (user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (organizationId?: string) => Promise<void>;
  impersonate: (params: { userId?: string; organizationId?: string; role?: string }) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

let authRevision = 0;
let authRead = 0;
let changingWorkspace = false;

function normalizeUser(user: User): User {
  return { ...user, impersonatedBy: user.impersonatedBy?.id ? user.impersonatedBy : null };
}

function resetScopedData() {
  useClinicStore.getState().reset();
  useModuleStore.getState().reset();
  aiSDK.cancelAllStreams();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-context-change"));
}

/** Suspend private screens while the server changes the effective session. */
async function changeWorkspace(loadUser: () => Promise<User>) {
  if (changingWorkspace || useAuthStore.getState().isLoggingOut) throw new Error("A session change is already in progress");
  changingWorkspace = true;
  authRevision++;
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  const revision = authRevision;
  try {
    const user = normalizeUser(await loadUser());
    if (revision !== authRevision || useAuthStore.getState().isLoggingOut) throw new Error("The session changed while switching workspace");
    if (!user.id) throw new Error("The server did not return a valid session");
    try {
      if (typeof window !== "undefined") {
        if (user.organization_id) localStorage.setItem("ananta_active_org_id", user.organization_id);
        else localStorage.removeItem("ananta_active_org_id");
      }
    } catch { /* Server session remains authoritative when storage is unavailable. */ }
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
  } catch (error) {
    // A failed request may have changed the HttpOnly cookie; never retain the old workspace.
    if (revision === authRevision) useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    throw error;
  } finally {
    changingWorkspace = false;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Initially true so we don't flash login page on load
  isLoggingOut: false,

  checkAuth: async () => {
    if (get().isLoggingOut || changingWorkspace) return;
    const revision = authRevision;
    const read = ++authRead;
    try {
      const res = await api.get("/auth/me");
      if (get().isLoggingOut || revision !== authRevision || read !== authRead) return;
      const user = res.data.data.user;
      if (user && (user.role as string) === "guest") {
        if (typeof window !== "undefined") {
          document.cookie = "ananta_session=guest; path=/; max-age=604800; SameSite=Lax";
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      if (typeof window !== "undefined") {
        document.cookie = "ananta_session=1; path=/; max-age=604800; SameSite=Lax";
        if (user && (user.role === "patient" || user.role === "family_member")) {
          localStorage.removeItem("ananta_active_org_id");
          localStorage.removeItem("ananta_active_clinic_id");
        }
      }
      set({ user: user ? normalizeUser(user) : null, isAuthenticated: Boolean(user), isLoading: false });
    } catch {
      if (get().isLoggingOut || revision !== authRevision || read !== authRead) return;
      if (typeof window !== "undefined" && !document.cookie.split("; ").includes("ananta_session=guest")) {
        document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: (user: User) => {
    authRevision++;
    user = normalizeUser(user);
    if ((user?.role as string) === "guest") {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    if (typeof window !== "undefined") {
      document.cookie = "ananta_session=1; path=/; max-age=604800; SameSite=Lax";
      if (user && (user.role === "patient" || user.role === "family_member")) {
        localStorage.removeItem("ananta_active_org_id");
        localStorage.removeItem("ananta_active_clinic_id");
      }
    }
    set({ user, isAuthenticated: true, isLoading: false, isLoggingOut: false });
  },

  logout: async () => {
    if (get().isLoggingOut) return;
    authRevision++;
    set({ user: null, isAuthenticated: false, isLoading: false, isLoggingOut: true });
    const revision = authRevision;
    clearRecentTracker();
    aiSDK.cancelAllStreams();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-logout"));
      try { localStorage.setItem("ananta_logout_at", String(Date.now())); } catch { /* Storage may be unavailable; this tab still signs out. */ }
    }
    try {
      await api.post("/auth/logout", {}, { timeout: 3000 });
    } catch {
      // ignore
    } finally {
      if (revision !== authRevision || !get().isLoggingOut) return;
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
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  switchOrg: (organizationId?: string) => changeWorkspace(async () => {
    await api.post("/auth/switch-org", { organizationId });
    const res = await api.get("/auth/me");
    return res.data.data.user;
  }),

  impersonate: (params: { userId?: string; organizationId?: string; role?: string }) => changeWorkspace(async () => {
    const res = await api.post("/auth/impersonate", params);
    return res.data.data.user;
  }),

  stopImpersonation: () => changeWorkspace(async () => {
    try {
      const res = await api.post("/auth/stop-impersonation");
      return res.data.data.user;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 400) throw error;
      const res = await api.get("/auth/me");
      return res.data.data.user;
    }
  }),
}));

useAuthStore.subscribe((state, previous) => {
  if (authScopeKey(state.user) === authScopeKey(previous.user)) return;
  authRevision++;
  resetScopedData();
});

// Listen for cross-tab context changes (active org or logout)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ananta_active_org_id") {
      // Re-verify auth when organization changes across tabs
      authRevision++;
      useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
      useAuthStore.getState().checkAuth();
    }
    if (e.key === "ananta_logout_at") {
      authRevision++;
      useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, isLoggingOut: true });
      clearRecentTracker();
      window.dispatchEvent(new Event("auth-logout"));
      window.location.replace("/login?logout=1");
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
    authRevision++;
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
