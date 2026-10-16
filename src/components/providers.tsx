"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ToastProvider, RouteProgress, PWAInstallBanner } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { forceResetScrollLock } from "@/lib/scrollLock";

import { NotificationRealtime } from "@/components/NotificationRealtime";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const mfaEnrollmentRequired = useAuthStore(state => state.user?.mfaEnrollmentRequired);
  const pathname = usePathname();
  const initialPathname = useRef(pathname);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    void checkAuth({ allowAnonymous: !initialPathname.current.startsWith("/dashboard") });
  }, [checkAuth]);

  useEffect(() => {
    const refreshAuthority = () => { void checkAuth(); };
    window.addEventListener("auth-mfa-required", refreshAuthority);
    return () => window.removeEventListener("auth-mfa-required", refreshAuthority);
  }, [checkAuth]);

  useEffect(() => {
    const clearUserQueries = () => queryClient.clear();
    window.addEventListener("auth-logout", clearUserQueries);
    window.addEventListener("auth-context-change", clearUserQueries);
    return () => {
      window.removeEventListener("auth-logout", clearUserQueries);
      window.removeEventListener("auth-context-change", clearUserQueries);
    };
  }, [queryClient]);

  // Route transition recovery: ensure scroll is never stuck across SPA navigations
  useEffect(() => {
    // If no active dialog element exists on the new page, ensure scroll lock is cleared
    if (typeof document !== "undefined") {
      const hasOpenDialog = document.querySelector('[role="dialog"]');
      if (!hasOpenDialog) {
        forceResetScrollLock();
      }
    }
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <ToastProvider>
          <NotificationRealtime />
          {children}
          <PWAInstallBanner suppressed={Boolean(mfaEnrollmentRequired) || pathname === "/" || pathname === "/dashboard/organizations" || pathname.startsWith("/dashboard/admin/") || ["/dashboard/consultations", "/dashboard/appointments", "/dashboard/queue", "/dashboard/billing"].some(route => pathname === route || pathname.startsWith(route + "/"))} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
