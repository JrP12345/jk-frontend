"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ToastProvider, RouteProgress, PWAInstallBanner } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useI18nStore, LanguageCode } from "@/lib/i18n";
import { forceResetScrollLock } from "@/lib/scrollLock";

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: LanguageCode;
}) {
  if (initialLanguage && typeof window === "undefined" && useI18nStore.getState().language !== initialLanguage) {
    useI18nStore.getState().setInitialLanguage(initialLanguage);
  }

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
    useI18nStore.getState().initLanguage();
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
        <ToastProvider>
          {children}
          <PWAInstallBanner />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
