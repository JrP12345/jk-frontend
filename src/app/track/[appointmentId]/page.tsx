"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import PrintButton from "@/components/ui/PrintButton";
import { printHtml } from "@/lib/printBrand";
import { formatCurrency } from "@/lib/currency";
import { addCalendarDays, locationDateKey } from "@/lib/locationTime";

import { useLatestRead } from "@/hooks/useLatestRead";
import { rememberTracker, getStoredTrackerToken, clearRecentTracker } from "@/store/trackerStore";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { getApiUrl } from "@/lib/api";
import { createReconnectingSocket, type ReconnectingSocket } from "@/utils/websocket";
import { userFacingError } from "@/lib/userFacingError";
import { Card, Button, Badge, Skeleton, Modal, useToast, cn, EkavyuIcon, ModeSwitcher } from "@/components/ui";
import { Clock, Users, CheckCircle2, AlertCircle, Stethoscope, MapPin, RotateCw, Calendar, Sparkles, ShieldCheck, BellRing, Phone, Receipt, CreditCard, Pill, Volume2, VolumeX, Smartphone, Copy } from "lucide-react";
import QRCode from "qrcode";

interface PrescribedMedicine {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  status: string;
}

interface ConsultationSummary {
  completedAt: string;
  chiefComplaint: string | null;
  diagnoses: Array<{ code: string; description: string }>;
  doctorAdvice: string | null;
  followUp: {
    date: string;
    instructions: string;
  } | null;
  prescriptions: PrescribedMedicine[];
  signedBy: string | null;
  signedAt: string | null;
}

interface BillingItem {
  description: string;
  quantity: number;
  amount: number;
  total: number;
}

interface BillingSummary {
  invoiceId: string;
  invoiceNumber: string;
  currency?: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: "unpaid" | "partially_paid" | "paid";
  paymentMethod: string | null;
  paymentDate: string | null;
  items: BillingItem[];
}

interface TrackerData {
  appointmentId: string;
  tokenNumber: number;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show" | "disruption_triage" | "standby";
  reviewState?: "overdue" | "unresolved" | null;
  parkedAt?: string | null;
  parkedReason?: string | null;
  patientReturned?: boolean;
  patientReturnedAt?: string | null;
  consultationPhase?: "single" | "initial_pending_investigation" | "report_review";
  delayNotifiedAt?: string | null;
  lastNotifiedDelayMinutes?: number | null;
  disruptionResponseDeadline?: string | null;
  triageAction?: string;
  paymentStatus?: "unpaid" | "paid" | "partially_paid";
  appointmentTime: string;
  appointmentType: string;
  patientName: string;
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  location: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    upiVpa?: string;
    merchantName?: string;
    timezone?: string;
  };
  currentlyServingToken: number | null;
  peopleAhead: number;
  estimatedWaitMinutes: number;
  estimatedCallTime: string | null;
  averageDuration: number;
  isAdaptiveDuration: boolean;
  adaptiveSampleCount: number;
  doctorAvailability: {
    status: string;
    isAvailable: boolean;
    reason: string | null;
    delayMinutes: number;
  };
  isToday: boolean;
  isEmergency?: boolean;
  vitals?: {
    bpSystolic?: number;
    bpDiastolic?: number;
    pulse?: number;
    temperature?: number;
    temperatureUnit?: "F" | "C";
    spO2?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    bloodSugar?: number;
    bloodSugarType?: string;
    allergies?: string[];
    triageNotes?: string;
    recordedAt?: string;
    recordedByName?: string;
  } | null;
  consultationSummary?: ConsultationSummary | null;
  pharmacyStatus?: "none" | "sent_to_pharmacy" | "dispensed";
  followUpAppointment?: {
    id: string;
    tokenNumber: number;
    appointmentTime: string;
    status: string;
  } | null;
  billing?: BillingSummary | null;
  investigationResults?: Array<{
    testId?: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    resultNotes?: string;
    resultedAt?: string;
  }>;
}

export default function PublicLiveQueueTracker() {
  const params = useParams();
  const appointmentId = params?.appointmentId as string;
  const getTrackerHeaders = useCallback(() => {
    if (typeof window === "undefined") return {};
    const token =
      new URLSearchParams(window.location.hash.slice(1)).get("t") ||
      getStoredTrackerToken(appointmentId);
    return token ? { "x-tracker-token": token } : {};
  }, [appointmentId]);
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const beginTrackerRead = useLatestRead();
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Audio / Vibration Sensory Feedback Controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevStatusRef = useRef<string | null>(null);
  const lastEtagRef = useRef<string | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [trackerQrDataUrl, setTrackerQrDataUrl] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  const trackerVpa = data?.location?.upiVpa?.trim() || "";
  const trackerMerchant = data?.location?.merchantName?.trim() || data?.location?.name || "";
  const trackerDueAmt = data?.billing?.balanceDue || 0;
  const trackerInvoiceNum = data?.billing?.invoiceNumber || "INV-OPD";
  const canUseTrackerUpi = data?.billing?.currency === "INR" && Boolean(trackerVpa);
  const trackerUpiPayload = canUseTrackerUpi ? `upi://pay?pa=${encodeURIComponent(trackerVpa)}&pn=${encodeURIComponent(
    trackerMerchant
  )}&am=${trackerDueAmt.toFixed(2)}&tr=${encodeURIComponent(trackerInvoiceNum)}&tn=${encodeURIComponent(
    `Token #${data?.tokenNumber || "OPD"} ${data?.patientName || "Patient"} Visit Settlement`
  )}&cu=INR` : "";

  useEffect(() => {
    if (typeof window === "undefined" || !appointmentId) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("t");
    if (!token) return;

    try { window.sessionStorage.setItem(`tracker-capability:${appointmentId}`, token); } catch { /* The URL still carries the capability. */ }
    rememberTracker(appointmentId, token, useAuthStore.getState().user?.id || null);
    params.delete("t");
    const hash = params.toString();
    const cleanUrl = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ""}`;
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [appointmentId]);

  useEffect(() => {
    if (isPayModalOpen && canUseTrackerUpi && trackerDueAmt > 0) {
      QRCode.toDataURL(trackerUpiPayload, {
        width: 220,
        margin: 2,
        color: { dark: "#0E2A28", light: "#ffffff" },
      })
        .then((url) => setTrackerQrDataUrl(url))
        .catch((err) => console.error("Tracker QR generation error:", err));
    }
  }, [isPayModalOpen, canUseTrackerUpi, trackerUpiPayload, trackerDueAmt]);

  // Disruption Self-Service Action State
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState(false);
  const [disruptionActionType, setDisruptionActionType] = useState<"reschedule" | "cancel" | null>(null);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const locationTomorrow = addCalendarDays(locationDateKey(new Date(), data?.location?.timezone || "Asia/Kolkata"), 1);
  const effectiveRescheduleDate = rescheduleTargetDate >= locationTomorrow ? rescheduleTargetDate : locationTomorrow;
  const [isSubmittingDisruption, setIsSubmittingDisruption] = useState(false);

  // Standby "I'm Back" Notification State
  const [notifyingReturn, setNotifyingReturn] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);

  const handleNotifyReturn = async () => {
    if (!appointmentId) return;
    setNotifyingReturn(true);
    try {
      const res = await api.post(`/public/track/${appointmentId}/return`, {}, { headers: getTrackerHeaders() });
      if (res.data?.success) {
        setReturnSuccess(true);
        toast({
          title: "Reception Notified!",
          description: "You are marked present in the waiting room and will be called Next Up.",
          variant: "success",
        });
        fetchTrackerData(true);
      }
    } catch (err: any) {
      toast({
        title: "Could not notify reception",
        description: err.response?.data?.message || "Please inform reception directly.",
        variant: "error",
      });
    } finally {
      setNotifyingReturn(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const action = search.get("action");
      if (action === "reschedule") {
        setDisruptionActionType("reschedule");
        setIsDisruptionModalOpen(true);
      } else if (action === "cancel") {
        setDisruptionActionType("cancel");
        setIsDisruptionModalOpen(true);
      }
    }
  }, []);

  const handleExecuteDisruptionAction = async () => {
    if (!disruptionActionType) return;
    setIsSubmittingDisruption(true);
    try {
      const response = await api.post("/doctor-overrides/patient-action", {
        appointmentId,
        action: disruptionActionType,
        targetDate: disruptionActionType === "reschedule" ? effectiveRescheduleDate : undefined,
        reason: "Patient selected choice via live tracker",
      }, { headers: getTrackerHeaders() });
      toast({
        title: disruptionActionType === "reschedule" ? "Rescheduled with Priority" : "Appointment Cancelled",
        description: disruptionActionType === "reschedule"
          ? "Your appointment has been booked for the selected date with high priority."
          : response.data.data?.paymentStatus === "refunded"
            ? "Your appointment is cancelled and the refund has been processed."
            : response.data.data?.paymentStatus === "refund_pending"
              ? "Your appointment is cancelled. Contact reception to confirm the pending refund."
              : "Your appointment has been cancelled.",
        variant: "success",
      });
      setIsDisruptionModalOpen(false);
      fetchTrackerData(false);
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.message || "Failed to process action. Please contact reception.",
        variant: "error",
      });
    } finally {
      setIsSubmittingDisruption(false);
    }
  };

  const fetchTrackerData = useCallback(async (isBackground = false) => {
    if (!appointmentId) return;
    const request = beginTrackerRead();
    try {
      if (!isBackground) setRefreshing(true);
      const headers: Record<string, string> = {
        ...(getTrackerHeaders() as Record<string, string>),
      };
      if (lastEtagRef.current) {
        headers["If-None-Match"] = lastEtagRef.current;
      }

      const res = await api.get(`/public/track/${appointmentId}`, {
        headers,
        signal: request.signal,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      });

      if (!request.isCurrent()) return;
      setStale(false);
      if (res.status === 304) {
        // Step 5.2: State unchanged; preserve local view and reset failure count
        consecutiveFailuresRef.current = 0;
        setLastUpdated(new Date());
        setError(null);
        return;
      }

      if (res.data?.data) {
        const etag = (res.headers?.etag || res.headers?.["etag"]) as string | undefined;
        if (etag) lastEtagRef.current = etag;
        setData(res.data.data);
        if (["completed", "cancelled", "canceled", "no-show"].includes(res.data.data.status)) clearRecentTracker(appointmentId);
        else rememberTracker(appointmentId, getTrackerHeaders()["x-tracker-token"], useAuthStore.getState().user?.id || null, res.data.data.appointmentTime);
        setError(null);
        setLastUpdated(new Date());
        consecutiveFailuresRef.current = 0;
      }
    } catch (err: any) {
      if (!request.isCurrent()) return;
      setStale(true);
      if ([401, 403, 404, 410].includes(err.response?.status)) clearRecentTracker(appointmentId);
      consecutiveFailuresRef.current = Math.min(5, consecutiveFailuresRef.current + 1);
      if (!isBackground) {
        const status = err.response?.status;
        const fallback = status === 404 || status === 410
          ? "This tracking link is no longer active. Contact reception if you still need help."
          : status === 401 || status === 403
            ? "This tracking link cannot be opened. Use the link sent by your care team."
            : "We could not connect to live tracking. Check your connection and try again.";
        setError(userFacingError(err.response?.data?.message, fallback));
      }
    } finally {
      if (request.isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [appointmentId, getTrackerHeaders, beginTrackerRead]);

  // Step 5.2: WebSocket as primary delivery; slow jittered reconciliation poll; pause in hidden tabs; back off on errors
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let cancelled = false;

    const scheduleNextPoll = () => {
      if (cancelled) return;
      // Base reconciliation interval: 15s (WebSocket is primary)
      const baseInterval = 15000;
      // 0 - 5s random jitter to avoid thundering herd across mobile clients
      const jitter = Math.floor(Math.random() * 5000);
      // Exponential backoff multiplier based on consecutive failures (capped at 4x)
      const backoffMultiplier = Math.min(4, Math.pow(1.5, consecutiveFailuresRef.current));
      const delay = Math.round((baseInterval + jitter) * backoffMultiplier);

      timeoutId = setTimeout(async () => {
        if (!cancelled && typeof document !== "undefined" && document.visibilityState === "visible") {
          await fetchTrackerData(true);
        }
        scheduleNextPoll();
      }, delay);
    };

    // Initial load
    fetchTrackerData(false);
    scheduleNextPoll();

    // Pause polling when tab is hidden, resume immediately when returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchTrackerData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchTrackerData]);

  // Real-time WebSocket connection to location updates
  useEffect(() => {
    let ws: ReconnectingSocket | null = null;
    const locationId = data?.location?.id;
    if (typeof window !== "undefined" && locationId) {
      try {
        ws = createReconnectingSocket(`/api/queue/ws?locationId=${locationId}`, () => { void fetchTrackerData(true); });

        ws.onopen = () => {
          consecutiveFailuresRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (
              payload.type === "PRESCRIPTION_ISSUED" ||
              payload.type === "PRESCRIPTION_DISPENSED" ||
              payload.type === "PAYMENT_RECEIVED" ||
              payload.type === "QUEUE_UPDATED"
            ) {
              const targetApptId = payload.data?.appointmentId;
              if (!targetApptId || targetApptId === appointmentId) {
                fetchTrackerData(true);
              }
            }
          } catch {
            // ignore JSON parse error
          }
        };

        ws.onclose = () => {
          // Back off on disconnects
          consecutiveFailuresRef.current = Math.min(4, consecutiveFailuresRef.current + 1);
        };

        ws.onerror = (err) => {
          console.warn("Tracker WS warning:", err);
          consecutiveFailuresRef.current = Math.min(4, consecutiveFailuresRef.current + 1);
        };
      } catch (wsErr) {
        console.warn("Could not initiate Tracker WS:", wsErr);
      }
    }

    return () => {
      if (ws) ws.close();
    };
  }, [data?.location?.id, appointmentId, fetchTrackerData]);

  // Two-tone cheerful medical chime using standard Web Audio API
  const playChimeSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Note 1 (C5 - 523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2 (G5 - 783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(783.99, now + 0.15);
      gain2.gain.setValueAtTime(0.22, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch {
      // Audio autoplay policy handled gracefully
    }
  }, [soundEnabled]);

  const triggerVibration = useCallback(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch {
        // Ignored if browser restricts
      }
    }
  }, []);

  // Monitor transitions to "in-consultation" for sensory notification (once per session)
  useEffect(() => {
    if (!data) return;
    const currentStatus = data.status;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = currentStatus;

    if (currentStatus === "in-consultation" && prevStatus && prevStatus !== "in-consultation") {
      const storageKey = `ekavyu_call_alert_${appointmentId}`;
      const alreadyNotified = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
      if (!alreadyNotified) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(storageKey, "true");
        }
        playChimeSound();
        triggerVibration();
        toast({
          title: "Doctor Calling You! 🔔",
          description: `Token #${data.tokenNumber} — Please proceed directly to Dr. ${data.doctor.name}'s room.`,
          variant: "success",
        });
      }
    }
  }, [data?.status, appointmentId, playChimeSound, triggerVibration, data?.tokenNumber, data?.doctor.name, toast]);

  const handleSelfCheckIn = async () => {
    if (!appointmentId || checkingIn) return;
    setCheckingIn(true);
    try {
      const capabilityRes = await api.post(
        `/public/track/${appointmentId}/check-in-capability`,
        {},
        { headers: getTrackerHeaders() },
      );
      const checkInToken = capabilityRes.data?.data?.checkInToken;
      if (!checkInToken) {
        throw new Error("Unable to issue a self check-in capability");
      }
      const res = await api.post(
        `/public/track/${appointmentId}/check-in`,
        { checkInToken },
        { headers: getTrackerHeaders() },
      );
      toast({
        title: "Check-In Confirmed ✓",
        description: res.data?.message || `You are now checked in! Token #${res.data?.data?.tokenNumber}`,
        variant: "success",
      });
      await fetchTrackerData(false);
    } catch (err: any) {
      toast({
        title: "Check-In Notice",
        description: err.response?.data?.message || "Unable to check in. Please speak with the front desk.",
        variant: "error",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const getPrintPrescriptionUrl = () => {
    const base = getApiUrl().replace(/\/+$/, "");
    const token = typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.hash.slice(1)).get("t") || getStoredTrackerToken(appointmentId);
    return `${base}/public/track/${appointmentId}/prescription/print${token ? `?trackerToken=${encodeURIComponent(token)}` : ""}`;
  };

  const handleDownloadPrescription = async () => {
    const url = getPrintPrescriptionUrl();
    const response = await api.get<string>(url, { responseType: "text" });
    await printHtml(response.data);
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-surface-alt font-sans text-text antialiased p-4 sm:p-6" aria-busy="true" aria-label="Connecting to Live Queue Tracker">
        <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
          {/* Location Brand Header Skeleton */}
          <div className="p-4 sm:p-5 bg-surface border border-border/80 rounded-3xl shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton width="3rem" height="3rem" rounded="2xl" />
              <div className="space-y-1.5">
                <Skeleton width="160px" height="1.25rem" rounded="md" />
                <Skeleton width="120px" height="0.75rem" rounded="sm" />
              </div>
            </div>
            <Skeleton width="90px" height="2rem" rounded="xl" />
          </div>

          {/* Live Queue Token Card Skeleton */}
          <div className="p-6 bg-surface border border-border/80 rounded-3xl shadow-xs text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-3xl bg-surface-alt border border-border flex items-center justify-center">
              <Skeleton width="4rem" height="3rem" rounded="xl" />
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              <Skeleton height="1.5rem" width="70%" rounded="md" className="mx-auto" />
              <Skeleton height="0.875rem" width="90%" rounded="sm" className="mx-auto" />
            </div>
            <div className="pt-4 border-t border-border/60 flex justify-around">
              <div className="space-y-1.5 flex flex-col items-center">
                <Skeleton width="60px" height="0.75rem" rounded="sm" />
                <Skeleton width="40px" height="1.25rem" rounded="md" />
              </div>
              <div className="space-y-1.5 flex flex-col items-center">
                <Skeleton width="60px" height="0.75rem" rounded="sm" />
                <Skeleton width="50px" height="1.25rem" rounded="md" />
              </div>
            </div>
          </div>

          {/* Doctor & Location Info Card Skeleton */}
          <div className="p-5 bg-surface border border-border/80 rounded-3xl shadow-xs space-y-3">
            <Skeleton height="1.25rem" width="40%" rounded="md" />
            <Skeleton height="0.875rem" width="75%" rounded="sm" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh bg-surface-alt text-text flex flex-col">
        <header data-app-header className="bg-surface border-b border-border/70 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <Link href="/browse" aria-label="Browse locations" className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
              <EkavyuIcon className="h-8 w-8" />
              <span className="text-sm font-bold text-text">Ekavyu</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-medium text-text-secondary">Live tracker</span>
              <ModeSwitcher variant="icon" />
            </div>
          </div>
        </header>
        <main className="w-full max-w-lg mx-auto flex-1 px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-16">
          <Card className="w-full p-5 sm:p-7 border border-border/80 shadow-sm rounded-2xl" contentClassName="items-start text-left">
            <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning-text flex items-center justify-center mb-4">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-text mb-2">Tracking unavailable</h1>
            <p className="text-sm text-text-secondary mb-5 leading-relaxed">
              {error || "We could not find an appointment for this tracking link."}
            </p>
            <div className="w-full flex flex-col sm:flex-row gap-2.5">
              <Button variant="primary" size="sm" loading={refreshing} icon={<RotateCw className="w-4 h-4" />} onClick={() => fetchTrackerData(false)} className="w-full sm:w-auto min-h-11 justify-center">Try again</Button>
              <Link href="/browse" className="inline-flex items-center justify-center w-full sm:w-auto min-h-11 px-4 rounded-xl border border-border bg-surface text-sm font-medium text-text hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Browse locations</Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Step Journey Mapping
  const steps = [
    { key: "booked", label: "Booked", done: true },
    { key: "checked-in", label: "Checked In", done: ["checked-in", "standby", "in-consultation", "completed"].includes(data.status) },
    { key: "in-consultation", label: "In Doctor Room", done: ["in-consultation", "completed"].includes(data.status) },
    { key: "completed", label: "Completed", done: data.status === "completed" },
  ];

  const isCheckedIn = ["checked-in", "standby", "in-consultation", "completed"].includes(data.status);
  const isInConsultation = data.status === "in-consultation";
  const isCompleted = data.status === "completed";
  const isCancelled = data.status === "cancelled" || data.status === "no-show";
  const isStandby = data.status === "standby";
  const doctorUnavailable = !data.doctorAvailability.isAvailable;

  const apptDateFormatted = new Date(data.appointmentTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const apptTimeFormatted = new Date(data.appointmentTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const callTimeFormatted = data.estimatedCallTime
    ? new Date(data.estimatedCallTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-surface-alt text-text font-sans antialiased pb-16">
      {/* Top Floating App Bar */}
      <header data-app-header className="sticky top-0 z-40 bg-surface/90  border-b border-border/70 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/browse" aria-label="Return to locations" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            <EkavyuIcon className="h-8 w-8 shadow-xs" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text">Ekavyu</span>
              <span className="text-[10px] text-text-muted hidden sm:block -mt-0.5">Live Patient Tracker</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <ModeSwitcher variant="icon" />
            {/* Audio chime toggle */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playChimeSound();
              }}
              className={cn(
                "p-2.5 rounded-xl border transition-colors cursor-pointer text-xs min-h-11 min-w-11 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                soundEnabled
                  ? "bg-primary-500/10 border-primary-500/30 text-accent dark:text-accent"
                  : "bg-surface border-border/70 text-text-muted hover:text-text"
              )}
              title={soundEnabled ? "Chime sound enabled" : "Chime muted"}
              aria-label={soundEnabled ? "Disable chime" : "Enable chime"}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <Button variant="ghost" size="sm"
              type="button"
              onClick={() => fetchTrackerData(false)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-surface border border-border/70 hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer min-h-11 min-w-11 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              title="Refresh Queue"
              aria-label="Refresh Queue Data"
             loading={refreshing}>
              <RotateCw className="w-4 h-4" />
            </Button>
            <span aria-label={stale ? "Reconnecting" : "Tracking updated"} title={stale ? "Reconnecting" : "Tracking updated"} className={`sm:hidden h-2 w-2 rounded-full shrink-0 ${stale ? "bg-warning" : "bg-success"}`} />
            <div className={cn("hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-semibold", stale ? "bg-warning/10 border-warning/20 text-warning-text" : "bg-success/10 border-success/20 text-success-text")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", stale ? "bg-warning" : "bg-success")} />
              {stale ? "Reconnecting" : "Updated"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {stale && <p role="alert" className="p-3 rounded-xl border border-warning text-sm">Updates are unavailable. Showing the last received queue information{lastUpdated ? ` from ${lastUpdated.toLocaleTimeString()}` : ""}. Check with reception before relying on this ETA.</p>}
        {/* Doctor Availability Warning Banner if override active */}
        {doctorUnavailable && (
          <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 text-warning-text dark:text-warning-text text-xs flex items-start gap-3 animate-fade-in shadow-xs">
            <AlertCircle className="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Doctor Availability Alert</p>
              <p className="mt-0.5 opacity-90">
                {data.doctor.name} is currently marked unavailable today{" "}
                {data.doctorAvailability.reason ? `(${data.doctorAvailability.reason})` : ""}. Please consult with the reception desk.
              </p>
            </div>
          </div>
        )}

        {/* Patient in Standby / Stepped Out Reassuring Hero Card */}
        {data.status === "standby" && (
          <div className="p-5 rounded-3xl bg-warning-subtle    border border-warning/30 text-warning-text dark:text-warning-text shadow-sm animate-fade-in space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-warning text-background flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base">You Are in Standby</h3>
                  <Badge variant="warning" size="sm" className="font-bold">
                    {data.consultationPhase === "initial_pending_investigation" ? "Awaiting investigations" : "Stepped out / on hold"}
                  </Badge>
                </div>
                <p className="text-xs text-warning-text/90 dark:text-warning-text/90 leading-relaxed">
                  Reason: <span className="font-semibold">{data.parkedReason || "Stepped out for diagnostic test / personal need"}</span>.
                </p>
                <div className="pt-2 p-3 rounded-2xl bg-surface/80 border border-warning/20 text-xs text-text space-y-1">
                  <p className="font-semibold text-text flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-success-text shrink-0" />
                    Your Token #{data.tokenNumber} is preserved safely!
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {data.consultationPhase === "initial_pending_investigation" ? "Complete the requested investigations and tell reception when your reports are ready. The doctor will arrange report review." : "Tell reception when you return. Staff will confirm your place in the queue before calling you."}
                  </p>
                </div>

                {/* Live Diagnostic Investigation Status */}
                {data.investigationResults && data.investigationResults.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-surface/90 border border-accent/30 text-xs text-text space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-accent dark:text-accent">
                        <span>🔬</span> Ordered Diagnostic Tests ({data.investigationResults.length})
                      </span>
                      <span className="text-[10px] text-text-muted font-medium">On-site laboratory</span>
                    </div>
                    <div className="space-y-1.5">
                      {data.investigationResults.map((r, i) => {
                        const isPending = r.value.toLowerCase().includes("pending");
                        return (
                          <div key={i} className="p-2 rounded-xl bg-surface-alt border border-border/60 flex items-center justify-between text-xs">
                            <span className="font-semibold text-text">{r.testName}</span>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md",
                              isPending
                                ? "bg-warning/15 text-warning-text dark:text-warning-text border border-warning/30"
                                : r.isAbnormal
                                ? "bg-danger/15 text-danger-text dark:text-danger-text border border-danger/30"
                                : "bg-success/15 text-success-text dark:text-success-text border border-success/30"
                            )}>
                              {isPending ? "⏳ Analyzing in Lab" : `✅ ${r.value}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Return to Waiting Room 1-Tap Action */}
                <div className="pt-1">
                  {data.patientReturned || returnSuccess ? (
                    <div className="p-3 rounded-2xl bg-success/15 border border-success/30 text-success-text dark:text-success-text flex items-center gap-2.5 animate-fade-in">
                      <CheckCircle2 className="w-5 h-5 text-success-text shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold">Reception Notified: Present in Waiting Room</p>
                        <p className="text-[11px] opacity-90">Please have a seat. Doctor will call Token #{data.tokenNumber} Next Up!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={handleNotifyReturn}
                        disabled={notifyingReturn}
                        className="w-full bg-success hover:bg-success active:bg-success disabled:opacity-50 text-background font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all text-xs cursor-pointer min-h-[44px]"
                      >
                        <span>🟢</span>
                        <span>{notifyingReturn ? "Notifying Reception..." : "I Have Returned to Waiting Room"}</span>
                      </button>
                      <p className="text-[10px] text-center text-warning-text/80 dark:text-warning-text/70">
                        Tap when you return to notify the desk instantly without standing in the reception queue.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAT Emergency Priority Banner */}
        {data.isEmergency && !isCompleted && (
          <div className="p-4 rounded-2xl bg-danger/15 border border-danger/40 text-danger-text dark:text-danger-text text-xs flex items-start gap-3 animate-pulse shadow-xs">
            <span className="text-2xl">🚨</span>
            <div className="space-y-0.5">
              <p className="font-black text-sm text-danger-text dark:text-danger-text">STAT Emergency Priority Activated</p>
              <p className="opacity-95 leading-relaxed font-medium">
                Your consultation is marked as STAT Emergency priority and placed at the front of the queue. Please remain seated immediately outside the doctor&apos;s consultation room.
              </p>
            </div>
          </div>
        )}

        {/* Queue Delay Alert Banner */}
        {Boolean(data.lastNotifiedDelayMinutes && data.lastNotifiedDelayMinutes >= 20 && !isInConsultation && !isCompleted && data.status !== "standby") && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-accent/30 text-accent dark:text-accent text-xs flex items-start gap-3 animate-fade-in shadow-xs">
            <Clock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Doctor Running Behind Schedule (~{data.lastNotifiedDelayMinutes} mins)</p>
              <p className="opacity-90 leading-relaxed">
                Earlier consultations are taking longer than scheduled. Your revised estimated call time is{" "}
                <span className="font-bold">{callTimeFormatted || "updated below"}</span>. No need to rush to the location prematurely!
              </p>
            </div>
          </div>
        )}

        {/* Doctor Disruption Triage Urgent Banner with Actions */}
        {data.status === "disruption_triage" && (
          <div className="p-5 rounded-2xl bg-danger/10 border border-danger/30 text-danger-text dark:text-danger-text text-sm space-y-3 animate-fade-in shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-danger-text shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Schedule Disruption — Action Required</p>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  Dr. {data.doctor.name} has experienced an unexpected schedule disruption today.
                  Please select how you would like to proceed:
                </p>
                {data.disruptionResponseDeadline && (
                  <p className="mt-2 text-[11px] font-semibold text-danger-text dark:text-danger-text">
                    ⏱ Your appointment will be cancelled if no action is taken by{" "}
                    {new Date(data.disruptionResponseDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-brand-mist font-semibold cursor-pointer"
                onClick={() => {
                  setDisruptionActionType("reschedule");
                  setIsDisruptionModalOpen(true);
                }}
              >
                <Calendar className="w-4 h-4 mr-1.5" /> Priority Reschedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-danger/40 text-danger-text dark:text-danger-text hover:bg-danger/10 cursor-pointer"
                onClick={() => {
                  setDisruptionActionType("cancel");
                  setIsDisruptionModalOpen(true);
                }}
              >
                Cancel & Refund
              </Button>
            </div>
          </div>
        )}

        {/* In-Consultation Live Banner: Call Patient In */}
        {isInConsultation && !data.reviewState && (
          <div className="p-5 rounded-3xl bg-primary   text-brand-mist shadow-lg animate-bounce-subtle">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6 text-brand-mist animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-success-text">Now Serving You</p>
                <h2 className="text-lg font-extrabold leading-tight">Please Enter Doctor's Room</h2>
              </div>
            </div>
            <p className="text-xs text-brand-mist/90 mt-2.5 bg-black/10 p-2.5 rounded-xl border border-white/10">
              Dr. {data.doctor.name} is calling Token #{data.tokenNumber}. Please proceed directly to consultation room.
            </p>
          </div>
        )}

        {data.reviewState && !isCancelled && <div role="status" className="rounded-2xl border border-warning/30 bg-warning-subtle p-4 text-sm text-text-secondary">
          <p className="font-semibold text-text">{data.reviewState === "unresolved" ? "Your visit needs a status update" : "Your scheduled time has passed"}</p>
          <p className="mt-1">The recorded appointment status has not changed. Please contact reception to confirm what happens next.{data.location.phone && <> <a className="font-medium text-accent underline" href={`tel:${data.location.phone.replace(/\s+/g, "")}`}>Call reception</a></>}</p>
        </div>}

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger-text dark:text-danger-text text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-text shrink-0" />
            <div>
              <p className="font-bold">Appointment {data.status === "no-show" ? "Marked No-Show" : "Cancelled"}</p>
              <p className="mt-0.5 opacity-90">
                This appointment is no longer active in the daily queue. If you still need care, please visit reception or book a new slot.
              </p>
            </div>
          </div>
        )}

        {/* Journey Step Progress Bar */}
        <div className="bg-surface rounded-3xl border border-border/80 p-4 shadow-xs">
          <div className="flex items-center justify-between relative px-2">
            {/* Background connecting bar */}
            <div className="absolute left-6 right-6 top-3.5 h-0.5 bg-border/80 -z-0" />

            {steps.map((step, idx) => {
              const isActive =
                (step.key === "booked" && data.status === "confirmed") ||
                (step.key === "checked-in" && data.status === "checked-in") ||
                (step.key === "in-consultation" && data.status === "in-consultation") ||
                (step.key === "completed" && data.status === "completed");

              return (
                <div key={step.key} className="flex flex-col items-center z-10">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shadow-xs",
                      step.done
                        ? "bg-primary-600 text-brand-mist"
                        : "bg-surface border-2 border-border text-text-muted",
                      isActive && "ring-4 ring-focus-ring scale-110"
                    )}
                  >
                    {step.done ? "✓" : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold mt-1.5 text-center whitespace-nowrap",
                      isActive
                        ? "text-accent dark:text-accent font-bold"
                        : step.done
                        ? "text-text"
                        : "text-text-muted"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* TRIAGE VITALS CARD */}
        {data.vitals && (
          <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-accent flex items-center justify-center font-bold text-sm">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Pre-Consultation Vital Signs</h3>
                  <p className="text-[10px] text-text-muted">Recorded at Triage Station</p>
                </div>
              </div>
              <Badge variant="outline" size="sm" className="text-[10px] font-semibold">
                🩺 Triage Logged
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {data.vitals.bpSystolic && data.vitals.bpDiastolic && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Blood Pressure</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.bpSystolic}/{data.vitals.bpDiastolic} <span className="text-[10px] font-sans font-normal text-text-muted">mmHg</span>
                  </span>
                </div>
              )}
              {data.vitals.pulse && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Pulse Rate</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.pulse} <span className="text-[10px] font-sans font-normal text-text-muted">bpm</span>
                  </span>
                </div>
              )}
              {data.vitals.spO2 && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">SpO2 Oxygen</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.spO2}%
                  </span>
                </div>
              )}
              {data.vitals.temperature && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Temperature</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.temperature}°{data.vitals.temperatureUnit || "F"}
                  </span>
                </div>
              )}
              {data.vitals.bmi && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">BMI</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.bmi} <span className="text-[10px] font-sans font-normal text-text-muted">kg/m²</span>
                  </span>
                </div>
              )}
              {data.vitals.bloodSugar && (
                <div className="p-2.5 rounded-xl bg-surface-alt border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Blood Sugar ({data.vitals.bloodSugarType || "RBS"})</span>
                  <span className="text-sm font-mono font-bold text-text">
                    {data.vitals.bloodSugar} <span className="text-[10px] font-sans font-normal text-text-muted">mg/dL</span>
                  </span>
                </div>
              )}
            </div>

            {data.vitals.allergies && data.vitals.allergies.length > 0 && (
              <div className="pt-1 text-xs">
                <span className="font-bold text-danger-text dark:text-danger-text">Allergies: </span>
                <span className="text-text-secondary">{data.vitals.allergies.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            POST-CONSULTATION DIGITAL HANDOFF (Rendered when completed)
           ========================================================================= */}
        {isCompleted ? (
          <div className="space-y-4 animate-fade-in">
            {/* Completed Hero Banner */}
            <div className="p-5 rounded-3xl bg-primary    text-brand-mist shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/20 text-brand-mist text-[11px] font-bold border-white/20">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success-text" />
                    Consultation Completed
                  </Badge>
                  <span className="text-[11px] font-semibold text-success-text">
                    Token #{data.tokenNumber}
                  </span>
                </div>

                <h2 className="text-xl font-black tracking-tight mt-1">
                  Post-Consultation Summary
                </h2>
                <p className="text-xs text-brand-mist/90 leading-relaxed">
                  Your visit with Dr. {data.doctor.name} has concluded. Your digital prescription, advice, and billing invoice are ready below.
                </p>
              </div>

              {/* Decorative background circle */}
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* DIGITAL PRESCRIPTION (Rx) CARD */}
            <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-accent flex items-center justify-center font-black text-sm">
                    Rx
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Digital Prescription</h3>
                    <p className="text-[10px] text-text-muted">Clinician Signed & Verified</p>
                  </div>
                </div>

                {/* Download / Print Prescription Action Button */}
                <PrintButton
                  variant="outline"
                  size="xs"
                  onPrint={handleDownloadPrescription}
                  className="rounded-xl border-primary-500/30 text-accent hover:bg-primary-500/10 font-bold flex items-center gap-1.5" documentName="prescription"
                >
              </PrintButton>
              </div>

              {/* Diagnoses if present */}
              {data.consultationSummary?.diagnoses && data.consultationSummary.diagnoses.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Clinical Diagnoses
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.consultationSummary.diagnoses.map((diag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-alt border border-border/70 text-text"
                      >
                        {diag.description} {diag.code ? `(${diag.code})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pharmacy Counter Fulfillment Status Banner */}
              {data.consultationSummary?.prescriptions && data.consultationSummary.prescriptions.length > 0 && (
                <div
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all space-y-1.5",
                    data.pharmacyStatus === "dispensed"
                      ? "bg-success/10 border-success/30 text-success-text dark:text-success-text"
                      : "bg-warning/10 border-warning/30 text-warning-text dark:text-warning-text"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {data.pharmacyStatus === "dispensed" ? (
                        <CheckCircle2 className="w-4 h-4 text-success-text dark:text-success-text shrink-0" />
                      ) : (
                        <Pill className="w-4 h-4 text-warning-text dark:text-warning-text shrink-0 animate-pulse" />
                      )}
                      <span className="font-bold text-xs sm:text-sm">
                        {data.pharmacyStatus === "dispensed"
                          ? "Medications Ready for Pickup"
                          : "Order Sent to In-House Pharmacy"}
                      </span>
                    </div>
                    <Badge
                      variant={data.pharmacyStatus === "dispensed" ? "success" : "warning"}
                      size="sm"
                      dot
                      pulse={data.pharmacyStatus !== "dispensed"}
                      className="font-bold text-[10px]"
                    >
                      {data.pharmacyStatus === "dispensed" ? "Ready at Counter 2" : "Packing in Progress"}
                    </Badge>
                  </div>
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    {data.pharmacyStatus === "dispensed"
                      ? "Your prescribed medications have been prepared and batch-verified. Please proceed to Pharmacy Counter 2 for collection."
                      : "Your doctor has routed your e-prescription to the location pharmacy desk. Medicines are being prepared and verified."}
                  </p>
                </div>
              )}

              {/* Prescribed Medicines List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                  Prescribed Medicines
                </span>

                {data.consultationSummary?.prescriptions && data.consultationSummary.prescriptions.length > 0 ? (
                  <div className="space-y-2">
                    {data.consultationSummary.prescriptions.map((rx, idx) => (
                      <div
                        key={rx.id || idx}
                        className="p-3.5 rounded-2xl bg-surface-alt border border-border/70 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Pill className="w-4 h-4 text-accent shrink-0" />
                            <span className="font-bold text-sm text-text">{rx.medicineName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                rx.status === "dispensed"
                                  ? "bg-success/10 text-success-text dark:text-success-text border border-success/20"
                                  : "bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20"
                              )}
                            >
                              {rx.status === "dispensed" ? "✅ Dispensed" : "⏳ In Prep"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary-500/10 text-accent dark:text-accent">
                              {rx.duration}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 text-text-muted">
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-text-muted block">Dosage:</span>
                            <span className="font-semibold text-text">{rx.dosage}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-text-muted block">Frequency:</span>
                            <span className="font-semibold text-text">{rx.frequency}</span>
                          </div>
                        </div>

                        {rx.instructions && (
                          <div className="text-[11px] text-text-muted bg-surface/60 p-2 rounded-xl border border-border/40 mt-1">
                            <strong>Instructions:</strong> {rx.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-surface-alt text-xs text-text-muted text-center border border-border/60">
                    No pharmacological medications prescribed during this encounter.
                  </div>
                )}
              </div>

              {/* Doctor's Advice & Treatment Plan */}
              {data.consultationSummary?.doctorAdvice && (
                <div className="p-3.5 rounded-2xl bg-primary-500/5 border border-primary-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-accent dark:text-accent font-bold text-xs">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Doctor's Advice & Plan
                  </div>
                  <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                    {data.consultationSummary.doctorAdvice}
                  </p>
                </div>
              )}

              {/* Follow-up recommendation & Confirmed Booking Card */}
              {data.consultationSummary?.followUp && (
                <div className="p-3.5 rounded-2xl bg-success/10 border border-success/20 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-success-text dark:text-success-text font-bold text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      Follow-Up Scheduled
                    </div>
                    {data.followUpAppointment && (
                      <Badge variant="success" size="sm" dot className="font-bold text-[10px]">
                        Token #{data.followUpAppointment.tokenNumber} Confirmed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-success-text dark:text-success-text">
                    Target Date: <strong>{new Date(data.consultationSummary.followUp.date).toLocaleDateString()}</strong>
                    {data.followUpAppointment && (
                      <span className="block text-[11px] font-semibold text-success-text dark:text-success-text mt-1">
                        ✅ Your review consultation is scheduled in the doctor's calendar (Token #{data.followUpAppointment.tokenNumber}).
                      </span>
                    )}
                    {data.consultationSummary.followUp.instructions && (
                      <span className="block mt-1 text-[11px] opacity-90">
                        Instructions: {data.consultationSummary.followUp.instructions}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Doctor signature note */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
                <span>Attending: Dr. {data.doctor.name}</span>
                <span className="flex items-center gap-1 text-success-text dark:text-success-text font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Signed & Valid
                </span>
              </div>
            </div>

            {/* INVOICE & BILLING SECTION */}
            {data.billing ? (
              <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-warning/10 text-warning-text flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text">Consultation Invoice</h3>
                      <p className="text-[10px] text-text-muted">Invoice #{data.billing.invoiceNumber}</p>
                    </div>
                  </div>

                  <Badge
                    variant={data.billing.balanceDue === 0 ? "success" : "warning"}
                    className="font-bold text-xs rounded-xl"
                  >
                    {data.billing.balanceDue === 0 ? "Paid in Full ✓" : "Amount Due"}
                  </Badge>
                </div>

                {/* Line items list */}
                {data.billing.items && data.billing.items.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                      Services & Charges
                    </span>
                    <div className="space-y-1 bg-surface-alt p-3 rounded-2xl border border-border/60">
                      {data.billing.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-text py-1">
                          <span className="text-text-muted truncate max-w-[240px]">
                            {item.description} {item.quantity > 1 ? `(x${item.quantity})` : ""}
                          </span>
                          <span className="font-semibold text-text shrink-0">{formatCurrency(item.total, data.billing?.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Totals */}
                <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Invoice Total</span>
                    <span className="font-bold text-text">{formatCurrency(data.billing.totalAmount, data.billing.currency)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Amount Paid</span>
                    <span className="font-semibold text-success-text dark:text-success-text">
                      {formatCurrency(data.billing.amountPaid, data.billing.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-border/40">
                    <span className="text-text">Balance Due</span>
                    <span
                      className={
                        data.billing.balanceDue > 0
                          ? "text-warning-text dark:text-warning-text"
                          : "text-success-text dark:text-success-text"
                      }
                    >
                      {formatCurrency(data.billing.balanceDue, data.billing.currency)}
                    </span>
                  </div>
                </div>

                {/* Action: Pay Now (if unpaid) or Paid Receipt */}
                {data.billing.balanceDue > 0 && canUseTrackerUpi ? (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full py-4 rounded-2xl shadow-md text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                      onClick={() => setIsPayModalOpen(true)}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay via UPI ({formatCurrency(data.billing.balanceDue, data.billing.currency)})</span>
                    </Button>
                    <p className="text-[10px] text-center text-text-muted mt-2">
                      Reception will verify the payment and update this invoice.
                    </p>
                  </div>
                ) : data.billing.balanceDue > 0 ? (
                  <p className="text-xs text-text-muted pt-2">Payment options for this location are available at reception.</p>
                ) : (
                  <div className="p-3 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-between text-xs text-success-text dark:text-success-text">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-success-text" />
                      Payment Verified & Settled
                    </span>
                    <span className="text-[10px] opacity-80">
                      {data.billing.paymentMethod?.toUpperCase()} &bull;{" "}
                      {data.billing.paymentDate
                        ? new Date(data.billing.paymentDate).toLocaleDateString()
                        : "Today"}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          /* =========================================================================
              ACTIVE QUEUE JOURNEY (Rendered while in queue / consultation)
             ========================================================================= */
          <>
            {/* HERO TOKEN CARD */}
            <div className="bg-surface rounded-3xl border border-border/80 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                    Your Queue Token
                  </span>
                  <div className="text-5xl font-black text-accent dark:text-accent tracking-tight mt-1">
                    #{data.tokenNumber}
                  </div>
                </div>

                <Badge
                  variant={
                    data.status === "standby"
                      ? "warning"
                      : isInConsultation
                      ? "success"
                      : isCheckedIn
                      ? "primary"
                      : isCancelled
                      ? "danger"
                      : "warning"
                  }
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xl capitalize"
                >
                  {data.status === "standby" ? (data.consultationPhase === "initial_pending_investigation" ? "Awaiting investigations" : "Stepped out / on hold") : data.status.replace("-", " ")}
                </Badge>
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-text-muted uppercase font-bold block">Patient Name</span>
                  <span className="font-bold text-text text-sm truncate block mt-0.5">{data.patientName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-text-muted uppercase font-bold block">Scheduled Slot</span>
                  <span className="font-semibold text-text text-sm block mt-0.5">
                    {apptDateFormatted}, {apptTimeFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE QUEUE INTELLIGENCE GRID */}
            {!isCancelled && (
              <div className="grid grid-cols-2 gap-3">
                {/* Serving Now Box */}
                <div className="bg-surface rounded-3xl border border-border/80 p-4 shadow-xs">
                  <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-accent" />
                    Serving Now
                  </div>
                  <div className="text-2xl font-black text-text mt-1.5">
                    {data.currentlyServingToken ? `Token #${data.currentlyServingToken}` : "Desk Ready"}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {data.currentlyServingToken
                      ? data.currentlyServingToken === data.tokenNumber
                        ? "👉 It's your turn!"
                        : data.currentlyServingToken < data.tokenNumber
                        ? `${data.tokenNumber - data.currentlyServingToken} tokens away`
                        : "Active in room"
                      : "Doctor ready for next patient"}
                  </p>
                </div>

                {/* Patients Ahead Box */}
                <div className="bg-surface rounded-3xl border border-border/80 p-4 shadow-xs">
                  <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-warning-text" />
                    Ahead of You
                  </div>
                  <div className="text-2xl font-black text-text mt-1.5">
                    {data.status === "standby" ? "Next Up!" : `${data.peopleAhead} ${data.peopleAhead === 1 ? "Patient" : "Patients"}`}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {data.status === "standby" ? "Priority upon check-in with desk" : "Waiting before your turn"}
                  </p>
                </div>

                {/* Estimated Wait Time Box */}
                <div className="col-span-2 bg-surface   rounded-3xl border border-border/80 p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      Estimated Wait Time
                    </div>

                    {data.isAdaptiveDuration && (
                      <span className="px-2 py-0.5 rounded-md bg-primary-500/10 text-accent dark:text-accent text-[10px] font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Adaptive
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3 mt-2">
                    <div className="text-3xl font-black text-text">
                      {data.status === "in-consultation" ? "0 mins" : `~${data.estimatedWaitMinutes} mins`}
                    </div>
                    {callTimeFormatted && data.status !== "in-consultation" && (
                      <span className="text-xs font-semibold text-text-muted">
                        (Approx. call: <strong className="text-text">{callTimeFormatted}</strong>)
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                    Calculated dynamically based on today's live completed consultation pace (~{data.averageDuration} min/patient).
                  </p>
                </div>
              </div>
            )}

            {/* PROMINENT ACTION: "I HAVE ARRIVED AT THE LOCATION" */}
            {!isCheckedIn && !isCancelled && (
              <div className="bg-surface rounded-3xl border border-primary-500/30 p-5 shadow-md space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-text">Are you at the location?</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Tap below once you enter the location lounge to notify reception and doctor.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full py-4 text-sm font-bold rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                  onClick={handleSelfCheckIn}
                  loading={checkingIn}
                  disabled={doctorUnavailable}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  I Have Arrived at the Location
                </Button>
              </div>
            )}

            {/* CHECKED-IN CONFIRMATION STATE */}
            {data.status === "checked-in" && (
              <div className="p-4 rounded-2xl bg-success/10 border border-success/30 text-success-text dark:text-success-text text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-text shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">You are Checked-In!</p>
                  <p className="mt-0.5 opacity-90 leading-relaxed">
                    Please take a seat in the waiting lounge. When your turn arrives, Token #{data.tokenNumber} will be called
                    and announced on the display board.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* LOCATION & DOCTOR DETAILS CARD */}
        <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-600/10 text-accent flex items-center justify-center font-bold shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-text text-sm block">Dr. {data.doctor.name}</span>
              <span className="text-text-muted">{data.doctor.specialization}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 space-y-2">
            <div className="flex items-start gap-2 text-text-muted">
              <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
              <div>
                <strong className="text-text font-semibold">{data.location.name}</strong>
                <p className="text-[11px] text-text-muted mt-0.5">{data.location.address || data.location.city}</p>
              </div>
            </div>

            {data.location.phone && (
              <div className="flex items-center gap-2 text-text-muted pt-1">
                <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>Reception: {data.location.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-[10px] text-text-muted space-y-1 pt-2">
          <p>Last synced: {lastUpdated.toLocaleTimeString()}</p>
          <p className="opacity-80">Ekavyu Smart Healthcare Cloud • Zero-Login Mobile Patient Tracker</p>
        </div>
      </main>

      {/* =========================================================================
          PAYMENT CHECKOUT MODAL
         ========================================================================= */}
      <Modal
        open={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Consultation Bill Settlement"
        description={`Settle invoice #${data.billing?.invoiceNumber} for ${data.patientName}`}
        size="md"
      >
        <div className="space-y-4 pt-2">
          {/* Bill Summary Banner */}
          <div className="p-4 rounded-2xl bg-surface-alt border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-text-muted block">Amount Due</span>
              <div className="text-2xl font-black text-text mt-0.5">
                {formatCurrency(data.billing?.balanceDue, data.billing?.currency)}
              </div>
            </div>
            <Badge variant="warning" className="text-xs font-bold rounded-lg">
              Pending
            </Badge>
          </div>

          {canUseTrackerUpi && (
            <div className="p-4 bg-surface-alt rounded-2xl border border-border/80 text-center space-y-3">
              {/* 1-Tap Mobile Intent Deep Link */}
              <a
                href={trackerUpiPayload}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 text-xs font-bold text-center rounded-xl bg-primary hover:bg-primary text-brand-mist shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Pay via UPI App (GPay / PhonePe / Paytm / CRED)</span>
              </a>

              {/* Scannable Dynamic QR for Laptop/Desktop/Tablet */}
              <div className="pt-2 border-t border-border/60">
                <div className="text-[11px] font-semibold text-text-muted mb-2">
                  Or Scan Counter QR on your phone:
                </div>
                {trackerQrDataUrl ? (
                  <div className="p-2.5 bg-surface dark:bg-surface rounded-xl inline-block border border-border/80 shadow-xs">
                    <LoadingImage
                      src={trackerQrDataUrl}
                      alt="UPI Payment QR Code"
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center mx-auto bg-surface-alt dark:bg-surface-alt rounded-xl text-xs text-text-muted">
                    Loading QR...
                  </div>
                )}
                <div className="mt-1 text-[11px] font-mono text-text-muted">
                  VPA: <strong className="text-accent">{trackerVpa}</strong>
                </div>
              </div>

              {/* Copy UPI Link */}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined") {
                    navigator.clipboard.writeText(trackerUpiPayload);
                    setCopiedUpi(true);
                    setTimeout(() => setCopiedUpi(false), 2500);
                  }
                }}
                className="text-xs text-accent hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUpi ? "Copied UPI Link!" : "Copy UPI Payment Link"}</span>
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1 rounded-xl min-h-[44px] flex items-center justify-center"
              onClick={() => setIsPayModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1 rounded-xl font-bold shadow-md min-h-[44px] flex items-center justify-center"
              onClick={() => {
                setIsPayModalOpen(false);
                toast({
                  title: "Payment verification required",
                  description: "Please complete payment at the location or through the verified checkout. Reception will update your invoice after verification.",
                  variant: "info",
                });
              }}
            >
              I&apos;ve Paid — Verify at Reception
            </Button>
          </div>
        </div>
      </Modal>

      {/* Disruption Action Modal */}
      <Modal
        isOpen={isDisruptionModalOpen}
        onClose={() => setIsDisruptionModalOpen(false)}
        title={disruptionActionType === "reschedule" ? "Priority Reschedule" : "Cancel & Refund"}
        className="max-w-md p-6"
      >
        <div className="space-y-4">
          {disruptionActionType === "reschedule" ? (
            <>
              <p className="text-xs text-text-muted">
                Choose your preferred date to reschedule your consultation with Dr. {data.doctor.name}.
                Your booking will be placed with priority at the top of the schedule.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">Select Date</label>
                <input
                  type="date"
                  value={effectiveRescheduleDate}
                  min={locationTomorrow}
                  onChange={(e) => setRescheduleTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-focus-ring"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to cancel your appointment?
              If you have prepaid, eligible online payments are refunded to the original payment method. Other payments need reception to confirm the refund.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1 rounded-xl min-h-[44px] flex items-center justify-center"
              onClick={() => setIsDisruptionModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className={cn(
                "flex-1 rounded-xl font-bold min-h-[44px] flex items-center justify-center",
                disruptionActionType === "cancel" && "bg-danger hover:bg-danger text-background"
              )}
              onClick={handleExecuteDisruptionAction}
              loading={isSubmittingDisruption}
            >
              {disruptionActionType === "reschedule" ? "Confirm Reschedule" : "Confirm Cancellation"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
