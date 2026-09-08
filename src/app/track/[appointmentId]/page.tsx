"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  Modal,
  useToast,
  cn,
} from "@/components/ui";
import {
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  MapPin,
  RotateCw,
  ArrowLeft,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  BellRing,
  Phone,
  Printer,
  FileDown,
  Receipt,
  CreditCard,
  Pill,
  Volume2,
  VolumeX,
  FileCheck2,
  Check,
  QrCode,
  Smartphone,
  ExternalLink,
  Copy,
} from "lucide-react";
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
  clinic: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    upiVpa?: string;
    merchantName?: string;
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
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Audio / Vibration Sensory Feedback Controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevStatusRef = useRef<string | null>(null);

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "online">("upi");
  const [isPaying, setIsPaying] = useState(false);
  const [trackerQrDataUrl, setTrackerQrDataUrl] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  const trackerVpa = data?.clinic?.upiVpa?.trim() || "ananta.health@icici";
  const trackerMerchant = data?.clinic?.merchantName?.trim() || data?.clinic?.name || "Ananta Health Clinic";
  const trackerDueAmt = data?.billing?.balanceDue || 0;
  const trackerInvoiceNum = data?.billing?.invoiceNumber || "INV-OPD";
  const trackerUpiPayload = `upi://pay?pa=${encodeURIComponent(trackerVpa)}&pn=${encodeURIComponent(
    trackerMerchant
  )}&am=${trackerDueAmt.toFixed(2)}&tr=${encodeURIComponent(trackerInvoiceNum)}&tn=${encodeURIComponent(
    `Token #${data?.tokenNumber || "OPD"} ${data?.patientName || "Patient"} Visit Settlement`
  )}&cu=INR`;

  useEffect(() => {
    if (isPayModalOpen && paymentMethod === "upi" && trackerDueAmt > 0) {
      QRCode.toDataURL(trackerUpiPayload, {
        width: 220,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then((url) => setTrackerQrDataUrl(url))
        .catch((err) => console.error("Tracker QR generation error:", err));
    }
  }, [isPayModalOpen, paymentMethod, trackerUpiPayload, trackerDueAmt]);

  // Disruption Self-Service Action State
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState(false);
  const [disruptionActionType, setDisruptionActionType] = useState<"reschedule" | "cancel" | null>(null);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [isSubmittingDisruption, setIsSubmittingDisruption] = useState(false);

  // Standby "I'm Back" Notification State
  const [notifyingReturn, setNotifyingReturn] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);

  const handleNotifyReturn = async () => {
    if (!appointmentId) return;
    setNotifyingReturn(true);
    try {
      const res = await api.post(`/public/track/${appointmentId}/return`);
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
      await api.post("/doctor-overrides/patient-action", {
        appointmentId,
        action: disruptionActionType,
        targetDate: disruptionActionType === "reschedule" ? rescheduleTargetDate : undefined,
        reason: "Patient selected choice via live tracker",
      });
      toast({
        title: disruptionActionType === "reschedule" ? "Rescheduled with Priority" : "Appointment Cancelled",
        description: disruptionActionType === "reschedule"
          ? "Your appointment has been booked for the selected date with high priority."
          : "Your appointment has been cancelled and refund initiated.",
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
    try {
      if (!isBackground) setRefreshing(true);
      const res = await api.get(`/public/track/${appointmentId}`);
      if (res.data?.data) {
        setData(res.data.data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (!isBackground) {
        setError(err.response?.data?.message || "Unable to load live queue tracking. Link may be invalid or expired.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchTrackerData(false);
    // Live poll every 5 seconds as fallback
    const interval = setInterval(() => {
      fetchTrackerData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTrackerData]);

  // Real-time WebSocket connection to clinic updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    const clinicId = data?.clinic?.id;
    if (typeof window !== "undefined" && clinicId) {
      try {
        const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const wsHost = apiUrl.replace(/^https?:\/\//, "").replace(/\/api\/?$/, "");
        ws = new WebSocket(`${wsProto}//${wsHost}/api/queue/ws?clinicId=${clinicId}`);

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

        ws.onerror = (err) => {
          console.warn("Tracker WS warning:", err);
        };
      } catch (wsErr) {
        console.warn("Could not initiate Tracker WS:", wsErr);
      }
    }

    return () => {
      if (ws) ws.close();
    };
  }, [data?.clinic?.id, appointmentId, fetchTrackerData]);

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
      const storageKey = `ananta_call_alert_${appointmentId}`;
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
      const res = await api.post(`/public/track/${appointmentId}/check-in`);
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

  const handleProcessPayment = async () => {
    if (!appointmentId || isPaying) return;
    setIsPaying(true);
    try {
      const res = await api.post(`/public/track/${appointmentId}/pay`, {
        paymentMethod,
      });

      toast({
        title: "Payment Received! ✓",
        description: res.data?.message || "Your consultation bill has been settled successfully.",
        variant: "success",
      });

      setIsPayModalOpen(false);
      // Immediately refresh data
      await fetchTrackerData(false);
    } catch (err: any) {
      toast({
        title: "Payment Failed",
        description: err.response?.data?.message || "Payment could not be processed. Please retry or pay at reception.",
        variant: "error",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const getPrintPrescriptionUrl = () => {
    let backendBase = process.env.NEXT_PUBLIC_API_URL;
    if (!backendBase && typeof window !== "undefined") {
      backendBase = `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }
    const cleanBase = (backendBase || "http://localhost:5000/api").replace(/\/+$/, "");
    return `${cleanBase}/public/track/${appointmentId}/prescription/print?autoPrint=1`;
  };

  const handleDownloadPrescription = () => {
    const url = getPrintPrescriptionUrl();
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4">
        <Spinner size="lg" label="Connecting to Live Queue Tracker..." />
        <p className="text-xs text-text-muted mt-3">Syncing real-time clinic queue metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 border border-border/80 shadow-sm rounded-3xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-danger-500/10 text-danger-500 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-text mb-2">Tracking Unavailable</h1>
          <p className="text-xs text-text-muted mb-6 leading-relaxed">
            {error || "We could not find an active appointment corresponding to this tracking link."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={() => fetchTrackerData(false)}>
              <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
            </Button>
            <Link href="/browse">
              <Button size="sm">Browse Clinics</Button>
            </Link>
          </div>
        </Card>
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090a0f] text-text font-sans antialiased pb-16">
      {/* Top Floating App Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border/70 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
              ⚡
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text">ANANTA</span>
              <span className="text-[10px] text-text-muted block -mt-0.5">Live Patient Tracker</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio chime toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playChimeSound();
              }}
              className={cn(
                "p-2 rounded-xl border transition-colors cursor-pointer text-xs",
                soundEnabled
                  ? "bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400"
                  : "bg-surface border-border/70 text-text-muted hover:text-text"
              )}
              title={soundEnabled ? "Chime sound enabled" : "Chime muted"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => fetchTrackerData(false)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-surface border border-border/70 hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer"
              title="Refresh Queue"
            >
              <RotateCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin text-primary-500")} />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Doctor Availability Warning Banner if override active */}
        {doctorUnavailable && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 animate-fade-in shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
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
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-amber-600/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 shadow-sm animate-fade-in space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base">You Are in Standby</h3>
                  <Badge variant="warning" size="sm" className="font-bold">
                    Stepped Out
                  </Badge>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                  Reason: <span className="font-semibold">{data.parkedReason || "Stepped out for diagnostic test / personal need"}</span>.
                </p>
                <div className="pt-2 p-3 rounded-2xl bg-surface/80 border border-amber-500/20 text-xs text-text space-y-1">
                  <p className="font-semibold text-text flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    Your Token #{data.tokenNumber} is preserved safely!
                  </p>
                  <p className="text-[11px] text-text-muted">
                    When you return to the clinic, simply notify the reception desk or attend the counter. You will be prioritized as <strong>Next Up</strong> immediately behind the current consultation.
                  </p>
                </div>

                {/* Live Diagnostic Investigation Status */}
                {data.investigationResults && data.investigationResults.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-surface/90 border border-purple-500/30 text-xs text-text space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300">
                        <span>🔬</span> Ordered Diagnostic Tests ({data.investigationResults.length})
                      </span>
                      <span className="text-[10px] text-text-muted font-medium">In-Clinic Lab</span>
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
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30"
                                : r.isAbnormal
                                ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30"
                                : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30"
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
                    <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5 animate-fade-in">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
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
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all text-xs cursor-pointer"
                      >
                        <span>🟢</span>
                        <span>{notifyingReturn ? "Notifying Reception..." : "I Have Returned to Waiting Room"}</span>
                      </button>
                      <p className="text-[10px] text-center text-amber-800/80 dark:text-amber-200/70">
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
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-900 dark:text-red-200 text-xs flex items-start gap-3 animate-pulse shadow-xs">
            <span className="text-2xl">🚨</span>
            <div className="space-y-0.5">
              <p className="font-black text-sm text-red-600 dark:text-red-400">STAT Emergency Priority Activated</p>
              <p className="opacity-95 leading-relaxed font-medium">
                Your consultation is marked as STAT Emergency priority and placed at the front of the queue. Please remain seated immediately outside the doctor&apos;s consultation room.
              </p>
            </div>
          </div>
        )}

        {/* Queue Delay Alert Banner */}
        {Boolean(data.lastNotifiedDelayMinutes && data.lastNotifiedDelayMinutes >= 20 && !isInConsultation && !isCompleted && data.status !== "standby") && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3 animate-fade-in shadow-xs">
            <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Doctor Running Behind Schedule (~{data.lastNotifiedDelayMinutes} mins)</p>
              <p className="opacity-90 leading-relaxed">
                Earlier consultations are taking longer than scheduled. Your revised estimated call time is{" "}
                <span className="font-bold">{callTimeFormatted || "updated below"}</span>. No need to rush to the clinic prematurely!
              </p>
            </div>
          </div>
        )}

        {/* Doctor Disruption Triage Urgent Banner with Actions */}
        {data.status === "disruption_triage" && (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-sm space-y-3 animate-fade-in shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Schedule Disruption — Action Required</p>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  Dr. {data.doctor.name} has experienced an unexpected schedule disruption today.
                  Please select how you would like to proceed:
                </p>
                {data.disruptionResponseDeadline && (
                  <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    ⏱ Automatic refund will be processed if no action is taken by{" "}
                    {new Date(data.disruptionResponseDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold cursor-pointer"
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
                className="w-full sm:w-auto border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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
        {isInConsultation && (
          <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg animate-bounce-subtle">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">Now Serving You</p>
                <h2 className="text-lg font-extrabold leading-tight">Please Enter Doctor's Room</h2>
              </div>
            </div>
            <p className="text-xs text-white/90 mt-2.5 bg-black/10 p-2.5 rounded-xl border border-white/10">
              Dr. {data.doctor.name} is calling Token #{data.tokenNumber}. Please proceed directly to consultation room.
            </p>
          </div>
        )}

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="p-4 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-900 dark:text-danger-200 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-500 shrink-0" />
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
                        ? "bg-primary-600 text-white"
                        : "bg-surface border-2 border-border text-text-muted",
                      isActive && "ring-4 ring-primary-500/20 scale-110"
                    )}
                  >
                    {step.done ? "✓" : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold mt-1.5 text-center whitespace-nowrap",
                      isActive
                        ? "text-primary-600 dark:text-primary-400 font-bold"
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
                <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center font-bold text-sm">
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
                <span className="font-bold text-red-600 dark:text-red-400">Allergies: </span>
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
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-primary-700 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/20 text-white text-[11px] font-bold border-white/20">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-200" />
                    Consultation Completed
                  </Badge>
                  <span className="text-[11px] font-semibold text-emerald-100">
                    Token #{data.tokenNumber}
                  </span>
                </div>

                <h2 className="text-xl font-black tracking-tight mt-1">
                  Post-Consultation Summary
                </h2>
                <p className="text-xs text-white/90 leading-relaxed">
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
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center font-black text-sm">
                    Rx
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Digital Prescription</h3>
                    <p className="text-[10px] text-text-muted">Clinician Signed & Verified</p>
                  </div>
                </div>

                {/* Download / Print Prescription Action Button */}
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleDownloadPrescription}
                  className="rounded-xl border-primary-500/30 text-primary-600 hover:bg-primary-500/10 font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </Button>
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
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {data.pharmacyStatus === "dispensed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Pill className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
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
                      : "Your doctor has routed your e-prescription to the clinic pharmacy desk. Medicines are being prepared and verified."}
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
                            <Pill className="w-4 h-4 text-primary-500 shrink-0" />
                            <span className="font-bold text-sm text-text">{rx.medicineName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                rx.status === "dispensed"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              )}
                            >
                              {rx.status === "dispensed" ? "✅ Dispensed" : "⏳ In Prep"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400">
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
                  <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-bold text-xs">
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
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      Follow-Up Scheduled
                    </div>
                    {data.followUpAppointment && (
                      <Badge variant="success" size="sm" dot className="font-bold text-[10px]">
                        Token #{data.followUpAppointment.tokenNumber} Confirmed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">
                    Target Date: <strong>{new Date(data.consultationSummary.followUp.date).toLocaleDateString()}</strong>
                    {data.followUpAppointment && (
                      <span className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mt-1">
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
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Signed & Valid
                </span>
              </div>
            </div>

            {/* INVOICE & BILLING SECTION */}
            {data.billing ? (
              <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
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
                          <span className="font-semibold text-text shrink-0">₹{item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Totals */}
                <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Invoice Total</span>
                    <span className="font-bold text-text">₹{data.billing.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Amount Paid</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ₹{data.billing.amountPaid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-border/40">
                    <span className="text-text">Balance Due</span>
                    <span
                      className={
                        data.billing.balanceDue > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      ₹{data.billing.balanceDue.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action: Pay Now (if unpaid) or Paid Receipt */}
                {data.billing.balanceDue > 0 ? (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full py-4 rounded-2xl shadow-md text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                      onClick={() => setIsPayModalOpen(true)}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Now (₹{data.billing.balanceDue.toFixed(2)})</span>
                    </Button>
                    <p className="text-[10px] text-center text-text-muted mt-2">
                      Secure payment via UPI, Debit/Credit Card, or Net Banking
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
                  <div className="text-5xl font-black text-primary-600 dark:text-primary-400 tracking-tight mt-1">
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
                  {data.status === "standby" ? "Standby / Stepped Out" : data.status.replace("-", " ")}
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
                    <Users className="w-3.5 h-3.5 text-primary-500" />
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
                    <Users className="w-3.5 h-3.5 text-amber-500" />
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
                <div className="col-span-2 bg-gradient-to-br from-surface to-surface-alt rounded-3xl border border-border/80 p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-primary-500" />
                      Estimated Wait Time
                    </div>

                    {data.isAdaptiveDuration && (
                      <span className="px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center gap-1">
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

            {/* PROMINENT ACTION: "I HAVE ARRIVED AT THE CLINIC" */}
            {!isCheckedIn && !isCancelled && (
              <div className="bg-surface rounded-3xl border border-primary-500/30 p-5 shadow-md space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-text">Are you at the clinic?</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Tap below once you enter the clinic lounge to notify reception and doctor.
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
                  I Have Arrived at the Clinic
                </Button>
              </div>
            )}

            {/* CHECKED-IN CONFIRMATION STATE */}
            {data.status === "checked-in" && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
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

        {/* CLINIC & DOCTOR DETAILS CARD */}
        <div className="bg-surface rounded-3xl border border-border/80 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-600/10 text-primary-600 flex items-center justify-center font-bold shrink-0">
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
                <strong className="text-text font-semibold">{data.clinic.name}</strong>
                <p className="text-[11px] text-text-muted mt-0.5">{data.clinic.address || data.clinic.city}</p>
              </div>
            </div>

            {data.clinic.phone && (
              <div className="flex items-center gap-2 text-text-muted pt-1">
                <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>Reception: {data.clinic.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-[10px] text-text-muted space-y-1 pt-2">
          <p>Last synced: {lastUpdated.toLocaleTimeString()}</p>
          <p className="opacity-80">ANANTA Smart Healthcare Cloud • Zero-Login Mobile Patient Tracker</p>
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
                ₹{data.billing?.balanceDue.toFixed(2)}
              </div>
            </div>
            <Badge variant="warning" className="text-xs font-bold rounded-lg">
              Pending
            </Badge>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text block">Select Payment Method</label>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={cn(
                  "p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5",
                  paymentMethod === "upi"
                    ? "bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border hover:text-text"
                )}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-xs">UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={cn(
                  "p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5",
                  paymentMethod === "card"
                    ? "bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border hover:text-text"
                )}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("online")}
                className={cn(
                  "p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5",
                  paymentMethod === "online"
                    ? "bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400 font-bold shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border hover:text-text"
                )}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs">Net Banking</span>
              </button>
            </div>
          </div>

          {paymentMethod === "upi" && (
            <div className="p-4 bg-surface-alt rounded-2xl border border-border/80 text-center space-y-3">
              {/* 1-Tap Mobile Intent Deep Link */}
              <a
                href={trackerUpiPayload}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 text-xs font-bold text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl inline-block border border-border/80 shadow-xs">
                    <img
                      src={trackerQrDataUrl}
                      alt="UPI Payment QR Code"
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center mx-auto bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-text-muted">
                    Loading QR...
                  </div>
                )}
                <div className="mt-1 text-[11px] font-mono text-text-muted">
                  VPA: <strong className="text-primary-600">{trackerVpa}</strong>
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
                className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUpi ? "Copied UPI Link!" : "Copy UPI Payment Link"}</span>
              </button>
            </div>
          )}

          <div className="flex gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1 rounded-xl"
              onClick={() => setIsPayModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1 rounded-xl font-bold shadow-md"
              onClick={handleProcessPayment}
              loading={isPaying}
            >
              Confirm & Pay ₹{data.billing?.balanceDue.toFixed(2)}
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
                  value={rescheduleTargetDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRescheduleTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to cancel your appointment?
              If you have made a prepayment, a 100% full refund will be processed back to your original payment method.
            </p>
          )}

          <div className="flex gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1 rounded-xl"
              onClick={() => setIsDisruptionModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className={cn(
                "flex-1 rounded-xl font-bold",
                disruptionActionType === "cancel" && "bg-rose-600 hover:bg-rose-700 text-white"
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
