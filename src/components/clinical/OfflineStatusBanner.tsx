"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { purgeLegacyClinicalBrowserData } from "@/lib/offlineStore";

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    void purgeLegacyClinicalBrowserData();
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  if (isOnline) return null;
  return (
    <div role="status" className="bg-surface-alt text-text border-b border-border px-4 py-2 text-xs flex items-center gap-2">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Connection lost. Clinical records cannot be saved while offline. Reconnect before continuing.</span>
    </div>
  );
}
