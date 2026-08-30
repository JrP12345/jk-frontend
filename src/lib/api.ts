import axios from "axios";

// Direct backend communication using NEXT_PUBLIC_API_URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send httpOnly cookies cross-origin with every request
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to automatically attach active clinic and organization context
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const activeClinicId = localStorage.getItem("ananta_active_clinic_id");
    if (activeClinicId && !config.headers["x-clinic-id"]) {
      config.headers["x-clinic-id"] = activeClinicId;
    }
    const activeOrgId = localStorage.getItem("ananta_active_org_id");
    if (activeOrgId && !config.headers["x-organization-id"]) {
      config.headers["x-organization-id"] = activeOrgId;
    }
  }
  return config;
});

// Response interceptor for transparent token refresh & 403 handling
let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized, try to refresh token
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh" &&
      originalRequest.url !== "/auth/login" &&
      originalRequest.url !== "/auth/login/verify-2fa"
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          const timeoutId = setTimeout(() => {
            reject(new Error("Token refresh request timed out"));
          }, 10000);
          failedQueue.push({
            resolve: (val) => {
              clearTimeout(timeoutId);
              resolve(val);
            },
            reject: (err) => {
              clearTimeout(timeoutId);
              reject(err);
            },
          });
        }).then(() => {
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh");
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth-expired"));
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // If 403 Forbidden, notify client-side listener for permission/organization fallback
    if (error.response?.status === 403 && typeof window !== "undefined") {
      const data = error.response?.data || {};
      const msg = data.message || data.error || "Access forbidden";
      window.dispatchEvent(new CustomEvent("auth-forbidden", {
        detail: { message: msg, error: data.error, url: originalRequest?.url },
      }));
    }

    return Promise.reject(error);
  }
);

export default api;
