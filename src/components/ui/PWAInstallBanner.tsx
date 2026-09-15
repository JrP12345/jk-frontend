"use client";

import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui";
import { Download, X } from "lucide-react";
import { useState, useEffect } from "react";

export function PWAInstallBanner() {
  const { isInstallable, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("pwa_install_dismissed") === "1";
      setDismissed(isDismissed);
    }
  }, []);

  if (!isInstallable || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa_install_dismissed", "1");
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 animate-slide-in-up">
      <div className="bg-surface/95 backdrop-blur-xl border border-primary-500/30 rounded-2xl p-3.5 shadow-2xl ring-1 ring-primary-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-500/30 flex items-center justify-center text-primary-600 shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text truncate">Install ANANTA App</p>
            <p className="text-[11px] text-text-muted truncate">Faster access & offline support</p>
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
            className="w-7 h-7 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
