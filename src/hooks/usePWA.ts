"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const pendingInstall = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check online status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "development") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(registration => registration.update())
        .catch(() => {});
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      pendingInstall.current = e as BeforeInstallPromptEvent;
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // Detect if already running in standalone display mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    const handleInstalled = () => {
      setIsInstalled(true);
      pendingInstall.current = null;
      setInstallPrompt(null);
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      pendingInstall.current = null;
    };
  }, []);

  const installApp = useCallback(async () => {
    const prompt = pendingInstall.current;
    if (!prompt) return false;
    // Each browser event can be used once, even when dismissed or rejected.
    pendingInstall.current = null;
    setInstallPrompt(null);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        return true;
      }
    } catch { /* Browser installation remains available through its own menu. */ }
    return false;
  }, []);

  return {
    isInstallable: Boolean(installPrompt && !isInstalled),
    isInstalled,
    isOnline,
    installApp,
  };
}
