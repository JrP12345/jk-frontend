"use client";

import { usePWA } from "@/hooks/usePWA";
import { Button, EkavyuIcon } from "@/components/ui";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { usePathname } from "next/navigation";

export function PWAInstallBanner({ suppressed = false }: { suppressed?: boolean }) {
  const { isInstallable, installApp } = usePWA();
  const { hasActiveToasts } = useToast();
  const pathname = usePathname();
  const inDashboard = pathname?.startsWith("/dashboard");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("pwa_install_dismissed") === "1";
      setDismissed(isDismissed);
    }
  }, []);

  if (!isInstallable || dismissed || hasActiveToasts || suppressed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa_install_dismissed", "1");
    }
  };

  return (
    <div role="region" aria-label="Install Ekavyu" className={`fixed left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none ${inDashboard ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))] md:bottom-[calc(1rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"}`}>
      <div className="pointer-events-auto bg-surface border border-primary-500/30 rounded-2xl p-3.5 shadow-lg ring-1 ring-focus-ring flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-500/30 flex items-center justify-center text-accent shrink-0">
            <EkavyuIcon className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text">Install Ekavyu App</p>
            <p className="text-[11px] text-text-muted">Open from your device&apos;s home screen</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="xs"
            variant="primary"
            onClick={installApp}
            className="min-h-11 rounded-xl font-bold shadow-xs px-3 py-1 text-xs"
          >
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="touch-target rounded-lg text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
