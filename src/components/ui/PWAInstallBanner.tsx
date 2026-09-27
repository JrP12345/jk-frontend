"use client";

import { usePWA } from "@/hooks/usePWA";
import { Button, EkavyuIcon } from "@/components/ui";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function PWAInstallBanner() {
  const { isInstallable, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(true);
  const [top, setTop] = useState(80);
  const pathname = usePathname();

  useEffect(() => {
    if (!isInstallable || dismissed) return;
    const header = document.querySelector("header");
    const update = () => setTop(header ? Math.max(12, header.getBoundingClientRect().bottom + 12) : 16);
    const frame = requestAnimationFrame(update);
    const resize = new ResizeObserver(update);
    const changes = new MutationObserver(update);
    if (header) {
      resize.observe(header);
      if (header.parentElement) changes.observe(header.parentElement, { childList: true });
    }
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isInstallable, dismissed, pathname]);

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
    <div style={{ top }} className="fixed left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-40 animate-slide-in-up">
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
    </div>
  );
}
