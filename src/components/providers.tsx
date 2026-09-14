"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ToastProvider, RouteProgress } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { forceResetScrollLock } from "@/lib/scrollLock";

export function Providers({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const pathname = usePathname();
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
    checkAuth();
  }, [checkAuth]);

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
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
