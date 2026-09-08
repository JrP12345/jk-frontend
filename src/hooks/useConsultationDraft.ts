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

export function useConsultationDraft({
  appointmentId,
  initialData,
  debounceMs = 1500,
}: UseConsultationDraftOptions) {
  const storageKey = `ananta_draft_${appointmentId}`;
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedDraftData, setSavedDraftData] = useState<ConsultationDraftPayload | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor network connectivity
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check for existing saved draft on load
  useEffect(() => {
    if (!appointmentId || typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
          setSavedDraftData(parsed.data);
          setHasSavedDraft(true);
          if (parsed.timestamp) {
            setLastSavedAt(new Date(parsed.timestamp));
          }
        }
      }
    } catch (err) {
      console.warn("[ConsultationDraft] Failed to inspect local draft:", err);
    }
  }, [appointmentId, storageKey]);

  // Debounced auto-save function
  const autoSaveDraft = useCallback(
    (currentData: ConsultationDraftPayload) => {
      if (!appointmentId || typeof window === "undefined") return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const envelope = {
            appointmentId,
            timestamp: new Date().toISOString(),
            data: currentData,
          };
          localStorage.setItem(storageKey, JSON.stringify(envelope));
          setLastSavedAt(new Date());
          setHasSavedDraft(true);
        } catch (err) {
          console.error("[ConsultationDraft] Failed to auto-save draft:", err);
        }
      }, debounceMs);
    },
    [appointmentId, storageKey, debounceMs]
  );

  // Clear draft on successful checkout/submission
  const clearDraft = useCallback(() => {
    if (!appointmentId || typeof window === "undefined") return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
      setHasSavedDraft(false);
      setSavedDraftData(null);
      setLastSavedAt(null);
    } catch (err) {
      console.warn("[ConsultationDraft] Failed to clear draft:", err);
    }
  }, [appointmentId, storageKey]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    hasSavedDraft,
    lastSavedAt,
    savedDraftData,
    autoSaveDraft,
    clearDraft,
  };
}
