"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ConsultationDraftPayload {
  chiefComplaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  examinationNotes?: string;
  prescriptions?: Array<any>;
  labOrders?: Array<any>;
  vitals?: Record<string, any>;
  followUpDays?: number;
  followUpDate?: string;
  cdsOverrideReason?: string;
}

interface UseConsultationDraftOptions {
  appointmentId: string;
  initialData?: ConsultationDraftPayload;
  debounceMs?: number;
}

/**
 * Consultation drafts are deliberately memory-only. Persisting clinical text,
 * prescriptions, or vitals in browser storage creates a PHI exposure on a
 * shared or compromised device. The server is the only durable draft store.
 */
export function useConsultationDraft({ appointmentId, debounceMs = 1500 }: UseConsultationDraftOptions) {
  const legacyStorageKey = `ananta_draft_${appointmentId}`;
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedDraftData, setSavedDraftData] = useState<ConsultationDraftPayload | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Clear data written by the retired local-storage draft implementation.
    try { localStorage.removeItem(legacyStorageKey); } catch {}

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [legacyStorageKey]);

  const autoSaveDraft = useCallback((_currentData: ConsultationDraftPayload) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // Preserve the debounced API shape without retaining any PHI in the
    // browser. Components can show their normal unsaved state instead.
    saveTimeoutRef.current = setTimeout(() => {
      setHasSavedDraft(false);
      setLastSavedAt(null);
      setSavedDraftData(null);
    }, debounceMs);
  }, [debounceMs]);

  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try { localStorage.removeItem(legacyStorageKey); } catch {}
    setHasSavedDraft(false);
    setSavedDraftData(null);
    setLastSavedAt(null);
  }, [legacyStorageKey]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

  return { isOnline, hasSavedDraft, lastSavedAt, savedDraftData, autoSaveDraft, clearDraft };
}
