"use client";

import React, { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from "lucide-react";
import { getPendingOutboxCount, flushOutbox } from "@/lib/offlineStore";
import api from "@/lib/api";

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const updatePending = async () => {
      const count = await getPendingOutboxCount();
      setPendingCount(count);
    };

    updatePending();

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      const res = await flushOutbox(api);
      setIsSyncing(false);
      await updatePending();
      if (res.synced > 0) {
        setSyncMessage(`Synced ${res.synced} offline record(s) to server.`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePending();
    };

    const handleSyncComplete = (e: any) => {
      updatePending();
      if (e.detail?.synced > 0) {
        setSyncMessage(`Synced ${e.detail.synced} offline record(s) to server.`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-sync-complete", handleSyncComplete);

    const interval = setInterval(updatePending, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-sync-complete", handleSyncComplete);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && !syncMessage && !isSyncing && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-sm transition-all animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>
            <strong>Offline Cabin Mode Active:</strong> Internet connection lost. Consultations and prescriptions are being saved securely in local storage.
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="bg-amber-700/80 px-2 py-0.5 rounded text-[11px] font-mono">
            {pendingCount} pending sync
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2 text-xs font-medium flex items-center gap-2 shadow-sm transition-all">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Reconnected to clinic network. Synchronizing offline consultation buffer with server...</span>
      </div>
    );
  }

  if (syncMessage) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center gap-2 shadow-sm transition-all animate-in fade-in duration-300">
        <CheckCircle2 className="w-4 h-4" />
        <span>{syncMessage}</span>
      </div>
    );
  }

  return null;
}
