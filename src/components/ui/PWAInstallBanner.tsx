"use client";

import { usePWA } from "@/hooks/usePWA";
import { Button, EkavyuIcon } from "@/components/ui";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useToastPosition } from "@/hooks/useToastPosition";
import { useToast } from "./Toast";

export function PWAInstallBanner({ suppressed = false }: { suppressed?: boolean }) {
  const { isInstallable, installApp } = usePWA();
  const { hasActiveToasts } = useToast();
  const [dismissed, setDismissed] = useState(true);
  const position = useToastPosition(isInstallable && !dismissed && !hasActiveToasts && !suppressed);

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

  return createPortal(
    <div style={position} role="region" aria-label="Install Ekavyu" className="install-banner-region fixed left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40 overflow-y-auto overscroll-contain animate-slide-down">
      <div className="bg-surface  border border-primary-500/30 rounded-2xl p-3.5 shadow-lg ring-1 ring-focus-ring flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-500/30 flex items-center justify-center text-accent shrink-0">
            <EkavyuIcon className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text">Install Ekavyu App</p>
            <p className="text-[11px] text-text-muted">Faster access & offline support</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="xs"
            variant="primary"
            onClick={installApp}
            className="rounded-xl font-bold shadow-xs px-2.5 py-1 text-xs"
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
    </div>, document.body
  );
}
