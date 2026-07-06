import { create } from "zustand";
import api from "@/lib/api";

export type Role = "admin" | "doctor" | "receptionist" | "patient";

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
  
  // Actions
  checkAuth: () => Promise<void>;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Initially true so we don't flash login page on load

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
}));

// Listen for the custom "auth-expired" event from the axios interceptor
if (typeof window !== "undefined") {
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
