import axios from "axios";

export const getApiUrl = () => {
  // 1. Explicitly configured API base URL has top priority (e.g. in production)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim();
  }

  // 2. Browser runtime:
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Private LAN / mobile hotspot IPs in development (e.g. 10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
      return "/api";
    }
    // If running in browser on a remote hostname without NEXT_PUBLIC_API_URL configured,
    // fallback to relative "/api" so requests route through the Next.js rewrite proxy.
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "/api";
    }
  }

  // 3. Default local development backend
  return "http://localhost:5000/api";
};

// Direct backend communication using NEXT_PUBLIC_API_URL or same-origin proxy via /api
export const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send httpOnly cookies cross-origin with every request
  timeout: 10000,        // 10s timeout to prevent hanging connections in production
  headers: {
    "Content-Type": "application/json",
  },
});

// Active clinic/organization is a client display preference, never server-side
// authorization context. Tenant scope is derived from the authenticated session.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.baseURL = getApiUrl();
  }
  return config;
});

// Response interceptor for transparent token refresh & 403 handling.
// Keep one promise for the whole browser session rather than a manually managed
// queue. A rejected refresh therefore releases every waiting request immediately;
// it cannot leave a request (and its UI loading state) waiting on a stale queue.
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean });
    const requestPath = originalRequest?.url?.split("?")[0];

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      requestPath !== "/auth/refresh" &&
      requestPath !== "/auth/refresh-token" &&
      requestPath !== "/auth/logout" &&
      requestPath !== "/auth/login" &&
      requestPath !== "/auth/login/verify-2fa"
    ) {
      originalRequest._retry = true;
      const startsRefresh = refreshPromise === null;

      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh")
          .then(() => undefined)
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        return api(originalRequest);
      } catch (err) {
        // Only the request that started the refresh announces expiry. This avoids
        // several simultaneous 401s triggering competing redirects.
        if (startsRefresh && typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth-expired"));
        }
        return Promise.reject(err);
      }
    }

    // If 403 Forbidden, notify client-side listener for permission/organization fallback
    if (error.response?.status === 403 && typeof window !== "undefined") {
      const data = error.response?.data || {};
      const rawMsg = data.message || data.error || "Access forbidden";
      const lower = rawMsg.toLowerCase();

      // Quota limits, plan limits, and subscription upgrade requirements are handled
      // locally by the initiating UI action catch block. Do not broadcast auth-forbidden
      // to avoid double-toasting with generic 'Access Denied'.
      const isQuotaOrLimitError =
        lower.includes("quota") ||
        lower.includes("limit") ||
        lower.includes("subscription") ||
        lower.includes("upgrade");

      if (!isQuotaOrLimitError) {
        window.dispatchEvent(new CustomEvent("auth-forbidden", {
          detail: { message: rawMsg, error: data.error, url: originalRequest?.url },
        }));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
