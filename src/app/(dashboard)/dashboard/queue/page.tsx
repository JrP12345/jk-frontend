"use client";
import { disruptionPresence } from "@/lib/disruptionPresence";
import { patientName as canonicalPatientName } from "@/lib/locationWorkflow";

import PrintButton from "@/components/ui/PrintButton";

import { confirmLeavingClinicalDraft } from "@/hooks/useUnsavedClinicalChanges";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { PatientEntryModal } from "@/components/appointments/PatientEntryModal";
import { PatientService } from "@/services/patient.service";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { organizationWorkspaceUrl } from "@/services/organization.service";
import api from "@/lib/api";
import { createReconnectingSocket, type ReconnectingSocket } from "@/utils/websocket";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { Alert, Card, CardContent, Button, Select, Input, DatePicker, useToast, Spinner, Badge, Textarea, Checkbox, Skeleton, SkeletonCard, ChartContainer, BarChart, cn, ConfirmDialog, Tabs, Dropdown } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import dynamic from "next/dynamic";
import type { UnifiedDocumentData } from "@/components/clinical/UnifiedDocumentModal";
import type { ThermalTokenSlipData } from "@/components/clinical/ThermalTokenSlipModal";

const UnifiedDocumentModal = dynamic(
  () => import("@/components/clinical/UnifiedDocumentModal").then((mod) => mod.UnifiedDocumentModal),
  { ssr: false }
);

const ThermalTokenSlipModal = dynamic(
  () => import("@/components/clinical/ThermalTokenSlipModal"),
  { ssr: false }
);

const LocationQrPosterModal = dynamic(
  () => import("@/components/dashboard/LocationQrPosterModal"),
  { ssr: false }
);

const NurseVitalsModal = dynamic(
  () => import("@/components/clinical/NurseVitalsModal").then((mod) => mod.NurseVitalsModal),
  { ssr: false }
);

const DisruptionTriageModal = dynamic(
  () => import("@/components/dashboard/DisruptionTriageModal"),
  { ssr: false }
);

const UpiPaymentModal = dynamic(
  () => import("@/components/billing/UpiPaymentModal"),
  { ssr: false }
);

const AbdmRegistrationModal = dynamic(
  () => import("@/components/clinical/AbdmRegistrationModal").then((mod) => mod.AbdmRegistrationModal),
  { ssr: false }
);

const ClinicalDocumentGeneratorModal = dynamic(
  () => import("@/components/clinical/ClinicalDocumentGeneratorModal").then((mod) => mod.ClinicalDocumentGeneratorModal),
  { ssr: false }
);

import { playChimeSound, announcePatientToken } from "@/utils/audioChimes";
import { Megaphone, Volume2, RotateCw, Users, UserCheck, Stethoscope, Clock, ChevronUp, ChevronDown, CheckCircle2, Activity, UserX, XCircle, Plus, Trash2, Sparkles, Check, Play, CalendarClock, Phone, FileText, AlertTriangle, Zap, PauseCircle, Banknote, FlaskConical, History, Send, ShieldCheck, Search, MoreHorizontal, Printer, Settings2 } from "lucide-react";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";
import { InCabinInvestigationViewerModal } from "@/components/clinical/InCabinInvestigationViewerModal";
import { DrugAllergyAlert } from "@/components/clinical/DrugAllergyAlert";
import { InCabinLabOrderModal } from "@/components/clinical/InCabinLabOrderModal";
import { OpdClinicalPresetBar } from "@/components/clinical/OpdClinicalPresetBar";
import { FollowUpRecallRegister } from "@/components/clinical/FollowUpRecallRegister";
import { DrugInteractionAlert, evaluateDrugInteractions } from "@/components/clinical/DrugInteractionAlert";

import styles from "./QueueWorkspace.module.css";
import QueueLabResults from "@/components/queue/QueueLabResults";

function hasVitalValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getCriticalVitalsAlert(vitals?: Appointment["vitals"]) {
  if (!vitals) return null;
  const criticalReasons: string[] = [];

  // Acute Hypoxia
  if (typeof vitals.spO2 === "number" && vitals.spO2 <= 90) {
    criticalReasons.push(`Acute Hypoxia (SpO₂ ${vitals.spO2}% ≤ 90%)`);
  }

  // Hypertensive Crisis
  if (
    (typeof vitals.bpSystolic === "number" && vitals.bpSystolic >= 180) ||
    (typeof vitals.bpDiastolic === "number" && vitals.bpDiastolic >= 110)
  ) {
    criticalReasons.push(`Hypertensive Crisis (${vitals.bpSystolic || "?"}/${vitals.bpDiastolic || "?"} mmHg)`);
  }

  // Severe Tachycardia / Bradycardia
  if (typeof vitals.pulse === "number") {
    if (vitals.pulse >= 130) {
      criticalReasons.push(`Severe Tachycardia (Pulse ${vitals.pulse} bpm ≥ 130)`);
    } else if (vitals.pulse <= 45) {
      criticalReasons.push(`Severe Bradycardia (Pulse ${vitals.pulse} bpm ≤ 45)`);
    }
  }

  // Severe Hyperpyrexia
  if (typeof vitals.temperature === "number") {
    const unit = vitals.temperatureUnit || "F";
    const isTempHigh = unit === "C" ? vitals.temperature >= 39.4 : vitals.temperature >= 103;
    if (isTempHigh) {
      criticalReasons.push(`Severe Hyperpyrexia (Temp ${vitals.temperature}°${unit})`);
    }
  }

  return criticalReasons.length > 0 ? criticalReasons : null;
}

const COMMON_OPD_MEDICINES = [
  { name: "Paracetamol 650mg", dosage: "1-0-1 (After Food)", duration: "3 days" },
  { name: "Pantoprazole 40mg", dosage: "1-0-0 (Before Food)", duration: "7 days" },
  { name: "Amoxicillin-Clav 625mg", dosage: "1-0-1 (After Food)", duration: "5 days" },
  { name: "Cetirizine 10mg", dosage: "0-0-1 (Bedtime)", duration: "5 days" },
  { name: "Azithromycin 500mg", dosage: "1-0-0 (1 hr Before Food)", duration: "3 days" },
  { name: "ORS Sachet", dosage: "1 sachet in 1L water", duration: "2 days" },
  { name: "Metformin 500mg", dosage: "1-0-1 (With Food)", duration: "1 month" },
];

const COMMON_LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "Random Blood Sugar (RBS)",
  "Standard 12-Lead ECG",
  "Lipid Profile",
  "Serum Creatinine",
  "Urine Routine",
  "Chest X-Ray PA View",
  "Liver Function Test (LFT)",
  "HbA1c Glycated Hemoglobin",
];

const LAB_TEST_DEFAULT_PRICES: Record<string, number> = {
  "Complete Blood Count (CBC)": 350,
  "Random Blood Sugar (RBS)": 150,
  "Standard 12-Lead ECG": 300,
  "Lipid Profile": 650,
  "Serum Creatinine": 250,
  "Urine Routine": 200,
  "Chest X-Ray PA View": 450,
  "Liver Function Test (LFT)": 750,
  "HbA1c Glycated Hemoglobin": 500,
};

interface Appointment {
  id: string;
  locationId: string;
  doctorId: any;
  patientId: {
    id: string;
    _id?: string;
    dob?: string;
    age?: number;
    gender: string;
    name?: string;
    userId: { name: string; email: string; phone: string };
  };
  appointmentTime: string;
  appointmentType: string;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show" | "disruption_triage" | "standby";
  tokenNumber: number;
  queuePosition: number;
  estimatedWaitTime?: number;
  notes?: string;
  diagnosis?: string;
  symptoms?: string;
  prescriptions?: Array<{
    name: string;
    dosage: string;
    duration: string;
    instructions?: string;
  }>;
  originalDoctorId?: any;
  originalTokenNumber?: number;
  triageAction?: string;
  disruptionResponseDeadline?: string;
  parkedAt?: string;
  parkedReason?: string;
  patientReturned?: boolean;
  patientReturnedAt?: string;
  consultationPhase?: "single" | "initial_pending_investigation" | "report_review";
  investigationSentAt?: string;
  investigationNotes?: string;
  delayNotifiedAt?: string;
  lastNotifiedDelayMinutes?: number;
  feeVariance?: number;
  feeResolution?: string;
  isEmergency?: boolean;
  emergencyTriagedAt?: string;
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
    bloodSugarType?: "fasting" | "post_prandial" | "random";
    allergies?: string[];
    triageNotes?: string;
    recordedAt?: string;
    recordedByName?: string;
  };
  paymentStatus?: "unpaid" | "paid" | "partially_paid" | "not_required";
  paymentAmount?: number;
  invoiceId?: string;
  invoiceNumber?: string;
  investigationResults?: Array<{
    testId?: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    resultNotes?: string;
    attachmentUrl?: string;
    resultedAt?: string;
    labOrderId?: string;
  }>;
}

function getAppointmentBilling(appt: Appointment) {
  const doctorFee =
    appt.paymentAmount ||
    (typeof appt.doctorId === "object"
      ? appt.doctorId?.consultationFee || appt.doctorId?.fees
      : undefined) ||
    500;

  const doctorName =
    typeof appt.doctorId === "object"
      ? appt.doctorId?.userId?.name || appt.doctorId?.name || "Doctor"
      : "Doctor";

  const items: Array<{ description: string; amount: number; quantity?: number }> = [
    {
      description: `Consultation - Dr. ${doctorName.replace(/^Dr\.\s*/i, "")}`,
      amount: doctorFee,
      quantity: 1,
    },
  ];

  if (appt.investigationResults && appt.investigationResults.length > 0) {
    const seenTests = new Set<string>();
    for (const inv of appt.investigationResults) {
      if (inv.testName && !seenTests.has(inv.testName)) {
        seenTests.add(inv.testName);
        const price = LAB_TEST_DEFAULT_PRICES[inv.testName] || 350;
        items.push({
          description: `Lab: ${inv.testName}`,
          amount: price,
          quantity: 1,
        });
      }
    }
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  return { items, totalAmount };
}

export default function QueuePage() {
  const { user } = useAuthStore();
  return <QueueWorkspace key={authScopeKey(user)} />;
}

function QueueWorkspace() {
  const { user } = useAuthStore();
  const { fetchLocations, activeLocationId } = useLocationStore();
  const { toast } = useToast();
  const router = useRouter();

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Token Slip Modal State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);
  const [callingNext, setCallingNext] = useState(false);
  const [arrivalConfirmation, setArrivalConfirmation] = useState<{ id: string; tokenNumber: number; completePrevious: boolean; locationId: string; doctorId: string; scope: string } | null>(null);

  // Thermal Slip & QR Poster State
  const [thermalSlipOpen, setThermalSlipOpen] = useState(false);
  const [thermalSlipData, setThermalSlipData] = useState<ThermalTokenSlipData | null>(null);
  const [qrPosterOpen, setQrPosterOpen] = useState(false);
  const [qrPosterLocation, setQrPosterLocation] = useState<any | null>(null);

  // ABDM / ABHA Modal State
  const [abdmModalOpen, setAbdmModalOpen] = useState(false);

  // Clinical Document Generator Modal State
  const [clinicalDocGenOpen, setClinicalDocGenOpen] = useState(false);
  const [selectedDocGenPatient, setSelectedDocGenPatient] = useState<any | null>(null);

  // Nurse Vitals Modal State
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState<{ id: string; name: string } | null>(null);
  const [selectedVitalsAppt, setSelectedVitalsAppt] = useState<Appointment | null>(null);

  // STAT Emergency Modal State
  const [statModalOpen, setStatModalOpen] = useState(false);
  const [apptToStatEmergency, setApptToStatEmergency] = useState<Appointment | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [statEmergencyLoading, setStatEmergencyLoading] = useState<string | null>(null);

  // Complete Consultation & Follow-up State
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [apptToComplete, setApptToComplete] = useState<Appointment | null>(null);
  const [recommendFollowUp, setRecommendFollowUp] = useState(false);
  const [followUpTimeline, setFollowUpTimeline] = useState("1 week");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescriptions, setPrescriptions] = useState<Array<{ name: string; dosage: string; duration: string }>>([]);
  const [completingSubmitting, setCompletingSubmitting] = useState(false);
  const [dispatchWhatsAppRx, setDispatchWhatsAppRx] = useState(true);
  const [recipientWhatsAppPhone, setRecipientWhatsAppPhone] = useState("");
  const [ddiAcknowledged, setDdiAcknowledged] = useState(false);

  // Longitudinal EHR Timeline Modal State
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelinePatient, setTimelinePatient] = useState<{ id: string; name: string } | null>(null);

  // In-Cabin Lab Investigation Report Viewer & Comparison State
  const [isInvestigationViewerOpen, setIsInvestigationViewerOpen] = useState(false);
  const [viewerPatientId, setViewerPatientId] = useState<string>("");
  const [viewerPatientName, setViewerPatientName] = useState<string>("");
  const [viewerApptId, setViewerApptId] = useState<string>("");
  const [viewerTokenNumber, setViewerTokenNumber] = useState<number | undefined>(undefined);
  const [viewerInitialResults, setViewerInitialResults] = useState<any[]>([]);

  const openInvestigationViewer = (appt: Appointment) => {
    const pId = typeof appt.patientId === "object" ? (appt.patientId?.id || appt.patientId?._id || "") : (appt.patientId || "");
    const pName = typeof appt.patientId === "object" ? (appt.patientId?.userId?.name || appt.patientId?.name || "Patient") : "Patient";
    setViewerPatientId(pId.toString());
    setViewerPatientName(pName);
    setViewerApptId(appt.id || (appt as any)._id || "");
    setViewerTokenNumber(appt.tokenNumber);
    setViewerInitialResults(appt.investigationResults || []);
    setIsInvestigationViewerOpen(true);
  };

  // In-Cabin Lab Order Modal State
  const [isLabOrderModalOpen, setIsLabOrderModalOpen] = useState(false);
  const [labOrderAppt, setLabOrderAppt] = useState<Appointment | null>(null);

  const openLabOrderModal = (appt: Appointment) => {
    setLabOrderAppt(appt);
    setIsLabOrderModalOpen(true);
  };

  // 1-Click Digital Rx Resend Modal State
  const [isResendRxModalOpen, setIsResendRxModalOpen] = useState(false);
  const [resendRxAppt, setResendRxAppt] = useState<Appointment | null>(null);
  const [resendRxPhone, setResendRxPhone] = useState("");
  const resendRxChannel = 'whatsapp' as const;
  const [resendRxReviewed, setResendRxReviewed] = useState(false), [resendRxLocked, setResendRxLocked] = useState(false);
  const resendRxRequestId = useRef(''), resendRxSubmission = useRef<{ phone?: string; channel: 'whatsapp'; clientRequestId: string } | null>(null);
  const [resendingRx, setResendingRx] = useState(false);

  const openResendRxModal = (appt: Appointment) => {
    setResendRxAppt(appt);
    const existingPhone =
      (appt.patientId && typeof appt.patientId === "object" ? (appt.patientId as any).phone : "") ||
      appt.patientId?.userId?.phone ||
      "";
    setResendRxPhone(existingPhone);
    setResendRxReviewed(false); setResendRxLocked(false); resendRxSubmission.current = null; resendRxRequestId.current = crypto.randomUUID();
    setIsResendRxModalOpen(true);
  };

  const handleResendRxSubmit = async () => {
    if (!resendRxAppt || !resendRxReviewed || resendingRx) return;
    try {
      setResendingRx(true);
      resendRxSubmission.current ??= { phone: resendRxPhone.trim() || undefined, channel: resendRxChannel, clientRequestId: resendRxRequestId.current };
      setResendRxLocked(true);
      const res = await api.post(`/appointments/${resendRxAppt.id}/resend-rx`, resendRxSubmission.current);
      toast({
        title: "Prescription message queued",
        description: res.data?.message || "Prescription message queued; delivery is not confirmed",
        variant: "success",
      });
      setIsResendRxModalOpen(false);
      setResendRxAppt(null);
    } catch (err: any) {
      toast({
        title: "Prescription could not be sent",
        description: err.response?.data?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setResendingRx(false);
    }
  };

  // Availability Override Modal & Queue Status State
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<"available" | "unavailable" | "delayed" | "extended">("unavailable");
  const [overrideStartTime, setOverrideStartTime] = useState("");
  const [overrideEndTime, setOverrideEndTime] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [activeOverride, setActiveOverride] = useState<any | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [queueStatusData, setQueueStatusData] = useState<{
    isAdaptiveDuration?: boolean;
    averageDuration?: number;
    opdSession?: {
      status: "not_started" | "active" | "ended";
      startedAt?: string;
      endedAt?: string;
      isOnBreak?: boolean;
      breakReason?: string;
      breakExpectedMinutes?: number;
      breakStartedAt?: string;
    };
  } | null>(null);

  // OPD Session & Doctor Break State
  const [isStartingOpd, setIsStartingOpd] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [breakReasonInput, setBreakReasonInput] = useState("Tea / Short Break");
  const [isTogglingBreak, setIsTogglingBreak] = useState(false);
  const [isEndOpdModalOpen, setIsEndOpdModalOpen] = useState(false);
  const [endOpdSummary, setEndOpdSummary] = useState<any | null>(null);
  const [isLoadingEndOpdSummary, setIsLoadingEndOpdSummary] = useState(false);
  const [isSubmittingEndOpd, setIsSubmittingEndOpd] = useState(false);
  const [standbyReconcileAction, setStandbyReconcileAction] = useState<"keep_unresolved" | "cancel">("keep_unresolved");
  const [waitingReconcileAction, setWaitingReconcileAction] = useState<"cancel" | "keep_unresolved">("keep_unresolved");

  // Investigation Modal State
  const [isInvestigationModalOpen, setIsInvestigationModalOpen] = useState(false);
  const [investigationAppt, setInvestigationAppt] = useState<Appointment | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);
  const [isSubmittingInvestigation, setIsSubmittingInvestigation] = useState(false);

  const toggleLabTest = (test: string) => {
    setSelectedLabTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  // Counter-Top Dynamic UPI & Payment State
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [selectedUpiAppt, setSelectedUpiAppt] = useState<Appointment | null>(null);

  // Disruption Triage State
  const [triageAppointments, setTriageAppointments] = useState<any[]>([]);
  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [loadingTriage, setLoadingTriage] = useState(false);

  // Single-Consultation Conflict Modal (Pillar 2)
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictDoctorName, setConflictDoctorName] = useState("");

  // Standby / Parked Queue State
  const [queueViewTab, setQueueViewTab] = useState<"active" | "standby" | "processed" | "recalls">("active");
  const [patientSearch, setPatientSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [parkingAppt, setParkingAppt] = useState<Appointment | null>(null);
  const [parkReason, setParkReason] = useState("Stepped out for lab / diagnostic tests");
  const [isParkModalOpen, setIsParkModalOpen] = useState(false);
  const [submittingPark, setSubmittingPark] = useState(false);
  const [resumingApptId, setResumingApptId] = useState<string | null>(null);

  // Resend Live Tracker State (P3)
  const [isResendTrackerModalOpen, setIsResendTrackerModalOpen] = useState(false);
  const [resendTrackerAppt, setResendTrackerAppt] = useState<Appointment | null>(null);
  const [resendPhone, setResendPhone] = useState("");
  const [resendingTracker, setResendingTracker] = useState(false);
  const [resendLocked, setResendLocked] = useState(false), [resendError, setResendError] = useState("");
  const resendBusy = useRef(false), resendMounted = useRef(true);
  const resendErrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { resendMounted.current = true; return () => { resendMounted.current = false; }; }, []);
  useEffect(() => { if (resendError && !resendingTracker) resendErrorRef.current?.focus(); }, [resendError, resendingTracker]);
  const resendCommand = useRef<{ appointmentId: string; phone: string; channel: "whatsapp"; clientRequestId: string } | null>(null);

  // Proactive Queue Delay State
  const [delayStatus, setDelayStatus] = useState<{ isDelayed: boolean; maxDelayMinutes: number; affectedCount: number; delayedPatients: any[] } | null>(null);
  const [sendingDelayAlerts, setSendingDelayAlerts] = useState(false);

  // Quick Walk-In Modal State
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);
  const { preferences } = useWorkflowPreferences();
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInDoctorId, setWalkInDoctorId] = useState("");
  const [walkInPriority, setWalkInPriority] = useState<"normal" | "emergency">("normal");
  const [walkInGender, setWalkInGender] = useState<"" | "male" | "female" | "other">("");
  const [walkInPatientId, setWalkInPatientId] = useState("");
  const walkInRegistrationRequest = useRef("");
  const [walkInAppointmentId, setWalkInAppointmentId] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Filter States
  const [locations, setLocations] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState(activeLocationId || "");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  useEffect(() => {
    setSelectedLocation(activeLocationId || "");
  }, [activeLocationId]);

  // Queue State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [displayedQueueScope, setDisplayedQueueScope] = useState<string | null>(null);

  // Load initial dropdown values based on user role
  useEffect(() => {
    const initFilters = async () => {
      try {
        setLoadingFilters(true);
        if (user?.role === "doctor") {
          let uniqueLocations: any[] = [];
          try {
            const res = await api.get(`/onboarding/doctors/assignments?doctorId=${user.id}`);
            const assignments = res.data?.data || [];
            uniqueLocations = assignments
              .map((a: any) => a.locationId)
              .filter(Boolean)
              .filter((c: any, idx: number, arr: any[]) => arr.findIndex((t) => (t.id || t._id) === (c.id || c._id)) === idx);
          } catch {
            const loadedLocations = await fetchLocations();
            uniqueLocations = loadedLocations;
          }

          setLocations(uniqueLocations);
          setDoctors([{ id: user.id, name: user.name }]);
          setSelectedDoctor(user.id);
          if (uniqueLocations.length > 0) {
            setSelectedLocation(uniqueLocations[0].id || uniqueLocations[0]._id);
          }
        } else {
          const [loadedLocations, staffRes] = await Promise.all([
            fetchLocations(),
            api.get("/onboarding/staff").catch(() => ({ data: { data: { doctors: [] } } })),
          ]);
          const loadedDoctors = Array.isArray(staffRes.data?.data?.doctors)
            ? staffRes.data.data.doctors
            : Array.isArray(staffRes.data?.data)
            ? staffRes.data.data
            : [];

          setLocations(loadedLocations);
          setDoctors(loadedDoctors);

          if (loadedLocations.length > 0) {
            setSelectedLocation(loadedLocations[0].id);
          }
          if (loadedDoctors.length > 0) {
            setSelectedDoctor(loadedDoctors[0].id || loadedDoctors[0]._id);
          }
        }
      } catch {
        console.error("initFilters error:");
      } finally {
        setLoadingFilters(false);
      }
    };

    if (user) initFilters();
  }, [user]);

  const beginOverrideRead = useLatestRead();
  const fetchActiveOverride = async () => {
    const request = beginOverrideRead();
    if (!selectedLocation || !selectedDoctor || !selectedDate) return;
    try {
      const res = await api.get(`/doctor-overrides?locationId=${selectedLocation}&doctorId=${selectedDoctor}&date=${selectedDate}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const overrides = res.data?.data || [];
      setActiveOverride(overrides.length > 0 ? overrides[0] : null);
    } catch {
      if (!request.isCurrent()) return;
      setActiveOverride(null);
    }
  };

  // Fetch triage appointments
  const beginTriageRead = useLatestRead();
  const fetchTriageAppointments = async () => {
    const request = beginTriageRead();
    if (!selectedLocation) {
      setTriageAppointments([]);
      return;
    }
    try {
      setLoadingTriage(true);
      const res = await api.get(`/doctor-overrides/triage?locationId=${selectedLocation}&date=${selectedDate}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      setTriageAppointments(res.data?.data || []);
    } catch {
      if (!request.isCurrent()) return;
      console.error("fetchTriageAppointments error:");
    } finally {
      if (request.isCurrent()) setLoadingTriage(false);
    }
  };

  // Fetch queue delay status
  const beginDelayRead = useLatestRead();
  const fetchDelayStatus = async () => {
    const request = beginDelayRead();
    if (!selectedLocation || !selectedDoctor) {
      setDelayStatus(null);
      return;
    }
    try {
      const res = await api.get(`/queue/delay-status?locationId=${selectedLocation}&doctorId=${selectedDoctor}&date=${selectedDate}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      setDelayStatus(res.data?.data || null);
    } catch {
      if (!request.isCurrent()) return;
      setDelayStatus(null);
    }
  };

  // Fetch queue when filters change
  const beginQueueRead = useLatestRead();
  const loadedQueueScope = useRef<string | null>(null);
  const queueReads = useRef(new Map<string, { pending: Promise<void>; dirty: boolean }>());
  const fetchQueue = () => {
    const key = `${selectedLocation}:${selectedDoctor}:${selectedDate}`;
    const existing = queueReads.current.get(key);
    if (existing) { existing.dirty = true; return existing.pending; }
    const state = { pending: Promise.resolve(), dirty: false };
    queueReads.current.set(key, state);
    state.pending = (async () => {
      do { state.dirty = false; await fetchQueueNow(); } while (state.dirty && queueReads.current.get(key) === state);
    })().finally(() => { if (queueReads.current.get(key) === state) queueReads.current.delete(key); });
    return state.pending;
  };
  const fetchQueueNow = async () => {
    const request = beginQueueRead();
    if (!selectedLocation || !selectedDoctor) {
      setAppointments([]);
      return;
    }
    try {
      const scope = `${selectedLocation}:${selectedDoctor}:${selectedDate}`;
      if (loadedQueueScope.current !== scope) setLoadingQueue(true);
      const [resQueue, resStatus] = await Promise.all([
        api.get(`/queue?locationId=${selectedLocation}&doctorId=${selectedDoctor}&date=${selectedDate}`, { signal: request.signal }),
        api.get(`/queue/status?locationId=${selectedLocation}&doctorId=${selectedDoctor}&date=${selectedDate}`, { signal: request.signal }),
      ]);
      if (!request.isCurrent()) return;
      setQueueError(null);
      loadedQueueScope.current = scope;
      setDisplayedQueueScope(scope);
      setAppointments(resQueue.data.data || []);
      setQueueStatusData(resStatus.data?.data || null);
      await Promise.all([fetchActiveOverride(), fetchTriageAppointments(), fetchDelayStatus()]);
    } catch {
      if (!request.isCurrent()) return;
      setQueueError("The queue could not be loaded. Check your connection and try again.");
      if (loadedQueueScope.current === null) toast({
        title: "Error Loading Queue",
        description: "The queue could not be loaded. Check your connection and try again.",
        variant: "error",
      });
    } finally {
      if (request.isCurrent()) setLoadingQueue(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedLocation || !selectedDoctor || !selectedDate) return;
    try {
      setSavingOverride(true);
      await api.post("/doctor-overrides", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        date: selectedDate,
        status: overrideStatus,
        effectiveStartTime: overrideStartTime || undefined,
        effectiveEndTime: overrideEndTime || undefined,
        reason: overrideReason || undefined,
      });
      toast({
        title: "Availability Updated",
        description: `Doctor schedule override set to ${overrideStatus}.`,
        variant: "success",
      });
      setIsAvailabilityModalOpen(false);
      await fetchActiveOverride();
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Failed to Update Availability",
        description: err.response?.data?.message || "Could not save doctor availability override.",
        variant: "error",
      });
    } finally {
      setSavingOverride(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!activeOverride?._id && !activeOverride?.id) return;
    try {
      setSavingOverride(true);
      const overrideId = activeOverride.id || activeOverride._id;
      await api.delete(`/doctor-overrides/${overrideId}`);
      toast({
        title: "Override Removed",
        description: "Doctor schedule returned to normal weekly working hours.",
        variant: "success",
      });
      setActiveOverride(null);
      setIsAvailabilityModalOpen(false);
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Failed to Remove Override",
        description: err.response?.data?.message || "Could not delete override.",
        variant: "error",
      });
    } finally {
      setSavingOverride(false);
    }
  };

  const handleBumpBack = async (appointmentId: string) => {
    try {
      await api.post(`/queue/${appointmentId}/bump-back`, { bumpPositions: 2 });
      toast({
        title: "Patient Bumped",
        description: "Patient moved 2 positions back in queue due to late arrival.",
        variant: "success",
      });
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Failed to Bump Patient",
        description: err.response?.data?.message || "Could not bump patient in queue.",
        variant: "error",
      });
    }
  };

  const handleTriggerStatEmergency = async () => {
    if (!apptToStatEmergency) return;
    try {
      setStatEmergencyLoading(apptToStatEmergency.id);
      await api.post(`/queue/${apptToStatEmergency.id}/stat-emergency`, {
        reason: emergencyReason.trim() || "Acute medical distress in waiting lounge",
      });
      playChimeSound("beep");
      toast({
        title: "STAT Emergency Triggered 🚨",
        description: `Token #${apptToStatEmergency.tokenNumber} prioritized to position 0 (STAT Next).`,
        variant: "warning",
      });
      setStatModalOpen(false);
      setApptToStatEmergency(null);
      setEmergencyReason("");
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "STAT Emergency Error",
        description: err.response?.data?.message || "Failed to prioritize emergency patient.",
        variant: "error",
      });
    } finally {
      setStatEmergencyLoading(null);
    }
  };

  const openParkModal = (appt: Appointment) => {
    setParkingAppt(appt);
    setParkReason("Stepped out for lab / diagnostic tests");
    setIsParkModalOpen(true);
  };

  const handleParkPatient = async () => {
    if (!parkingAppt) return;
    try {
      setSubmittingPark(true);
      await api.post(`/queue/${parkingAppt.id}/park`, { reason: parkReason });
      toast({
        title: "Patient Moved to Standby",
        description: `Token #${parkingAppt.tokenNumber} placed in standby without queue penalty.`,
        variant: "success",
      });
      setIsParkModalOpen(false);
      setParkingAppt(null);
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Failed to Park Patient",
        description: err.response?.data?.message || "Could not move patient to standby.",
        variant: "error",
      });
    } finally {
      setSubmittingPark(false);
    }
  };

  const openResendTrackerModal = (appt: Appointment) => {
    if (resendCommand.current && resendCommand.current.appointmentId !== appt.id) {
      toast({ title: "Resolve the pending tracker request first", variant: "warning" });
      return;
    }
    setResendTrackerAppt(appt);
    const existingPhone =
      (appt.patientId && typeof appt.patientId === "object" ? (appt.patientId as any).phone : "") ||
      appt.patientId?.userId?.phone ||
      "";
    setResendPhone(resendCommand.current?.phone ?? existingPhone);
    if (!resendCommand.current) setResendError("");
    setIsResendTrackerModalOpen(true);
  };

  const handleResendTrackerSubmit = async () => {
    if (!resendTrackerAppt || resendBusy.current) return;
    resendBusy.current = true;
    try {
      setResendingTracker(true);
      setResendError("");
      resendCommand.current ??= { appointmentId: resendTrackerAppt.id, phone: resendPhone.trim(), channel: "whatsapp", clientRequestId: crypto.randomUUID() };
      setResendLocked(true);
      const { appointmentId, ...payload } = resendCommand.current;
      const res = await api.post(`/queue/${appointmentId}/resend-tracker`, payload);
      if (!resendMounted.current) return;

      toast({
        title: `Tracker message ${res.data?.data?.status || "recorded"}`,
        description: res.data?.message || "The recorded message state is available. Delivery is reported separately.",
        variant: "success",
      });
      setIsResendTrackerModalOpen(false);
      setResendTrackerAppt(null);
      resendCommand.current = null; setResendLocked(false);
    } catch (err: any) {
      if (!resendMounted.current) return;
      const definite = [400, 403, 404, 409, 422].includes(err.response?.status);
      if (definite) { resendCommand.current = null; setResendLocked(false); }
      setResendError(err.response?.data?.message || "The result could not be confirmed. Retry the same submitted request.");
      toast({
        title: "Tracking link could not be sent",
        description: err.response?.data?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      resendBusy.current = false;
      if (resendMounted.current) setResendingTracker(false);
    }
  };

  const handleResumePatient = async (appointmentId: string) => {
    try {
      setResumingApptId(appointmentId);
      const res = await api.post(`/queue/${appointmentId}/resume`);
      toast({
        title: "Patient Resumed as Next Up! ⚡",
        description: res.data?.message || "Patient placed at position #1 behind active consultation.",
        variant: "success",
      });
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Failed to Resume Patient",
        description: err.response?.data?.message || "Could not resume patient from standby.",
        variant: "error",
      });
    } finally {
      setResumingApptId(null);
    }
  };

  const handleTriggerDelayAlerts = async () => {
    if (!selectedLocation || !selectedDoctor) return;
    try {
      setSendingDelayAlerts(true);
      const res = await api.post("/queue/trigger-delay-alerts", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        date: selectedDate,
        delayThresholdMinutes: 20,
      });
      const count = res.data?.data?.notifiedCount ?? 0;
      toast({
        title: "WhatsApp Delay Alerts Sent",
        description: `Updated arrival times were sent to ${count} ${count === 1 ? "patient" : "patients"}.`,
        variant: "success",
      });
      await fetchDelayStatus();
    } catch (err: any) {
      toast({
        title: "Failed to Send Delay Alerts",
        description: err.response?.data?.message || "Could not trigger delay alerts.",
        variant: "error",
      });
    } finally {
      setSendingDelayAlerts(false);
    }
  };

  const handleStartOpdSession = async () => {
    if (!selectedLocation || !selectedDoctor) return;
    setIsStartingOpd(true);
    try {
      await api.post("/queue/session/start", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
      });
      toast({
        title: "OPD Session Started",
        description: "Doctor OPD shift is now active and ready for consultations.",
        variant: "success",
      });
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Could Not Start Session",
        description: err.response?.data?.message || "Failed to start OPD session.",
        variant: "error",
      });
    } finally {
      setIsStartingOpd(false);
    }
  };

  const handleToggleDoctorBreak = async (isOnBreak: boolean, reason?: string, minutes?: number) => {
    if (!selectedLocation || !selectedDoctor) return;
    try {
      setIsTogglingBreak(true);
      const res = await api.post("/queue/session/break", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        isOnBreak,
        breakReason: reason || breakReasonInput,
        breakExpectedMinutes: minutes || breakMinutes,
      });
      const updatedSession = res.data?.data;
      setQueueStatusData((prev: any) => ({
        ...prev,
        opdSession: updatedSession,
      }));
      toast({
        title: isOnBreak ? "Doctor Break Active" : "OPD Resumed",
        description: isOnBreak
          ? `Waiting Room TV notified. Break set for ~${minutes || breakMinutes} mins.`
          : "Consultations resumed. Waiting Room TV updated.",
        variant: "success",
      });
      setIsBreakModalOpen(false);
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Break Status Error",
        description: err.response?.data?.message || "Failed to update break status.",
        variant: "error",
      });
    } finally {
      setIsTogglingBreak(false);
    }
  };

  const handleOpenEndOpdModal = async () => {
    if (!selectedLocation || !selectedDoctor) return;
    setIsEndOpdModalOpen(true);
    setIsLoadingEndOpdSummary(true);
    try {
      const res = await api.get(`/queue/session/summary?locationId=${selectedLocation}&doctorId=${selectedDoctor}&date=${selectedDate}`);
      setEndOpdSummary(res.data?.data || null);
    } catch (err: any) {
      toast({
        title: "Could Not Fetch Summary",
        description: err.response?.data?.message || "Failed to load OPD session summary.",
        variant: "error",
      });
    } finally {
      setIsLoadingEndOpdSummary(false);
    }
  };

  const handleExecuteEndOpdReconcile = async () => {
    if (!selectedLocation || !selectedDoctor) return;
    setIsSubmittingEndOpd(true);
    try {
      const res = await api.post("/queue/session/end", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        standbyAction: standbyReconcileAction,
        waitingAction: waitingReconcileAction,
      });
      toast({
        title: "OPD Session Reconciled & Closed",
        description: res.data?.message || "Shift ended successfully.",
        variant: "success",
      });
      setIsEndOpdModalOpen(false);
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Reconciliation Failed",
        description: err.response?.data?.message || "Failed to close OPD session.",
        variant: "error",
      });
    } finally {
      setIsSubmittingEndOpd(false);
    }
  };

  const handleOpenInvestigationModal = (appt: Appointment) => {
    setInvestigationAppt(appt);
    setInvestigationNotes("");
    setSelectedLabTests([]);
    setIsInvestigationModalOpen(true);
  };

  const handleSendToInvestigation = async () => {
    if (!investigationAppt) return;
    setIsSubmittingInvestigation(true);
    try {
      await api.post(`/queue/${investigationAppt.id}/order-investigations`, {
        notes: investigationNotes,
        testNames: selectedLabTests.length > 0 ? selectedLabTests : undefined,
      });
      toast({
        title: "Patient Sent for Diagnostic Tests 🔬",
        description: `Token #${investigationAppt.tokenNumber} placed on Standby. Requisition sent to on-site laboratory.`,
        variant: "success",
      });
      setIsInvestigationModalOpen(false);
      setInvestigationAppt(null);
      setSelectedLabTests([]);
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.message || "Failed to send patient for investigation.",
        variant: "error",
      });
    } finally {
      setIsSubmittingInvestigation(false);
    }
  };

  const handleResumeForReportReview = async (apptId: string, tokenNumber: number) => {
    setUpdatingStatus(apptId);
    try {
      await api.post(`/queue/${apptId}/resume-review`);
      toast({
        title: "Resumed for Report Review",
        description: `Token #${tokenNumber} prioritized as Next Up!`,
        variant: "success",
      });
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Resume Failed",
        description: err.response?.data?.message || "Could not resume patient for report review.",
        variant: "error",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  useEffect(() => {
    setAppointments([]);
    setQueueStatusData(null);
    queueReads.current.clear();
    loadedQueueScope.current = null;
    setDisplayedQueueScope(null);
    setActiveOverride(null);
    setDelayStatus(null);
    setTriageAppointments([]);
    fetchQueue();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && selectedLocation && selectedDoctor) void fetchQueue();
    }, 15000);

    // Real-time WebSocket connection to Location OPD Queue
    let ws: ReconnectingSocket | null = null;
    if (typeof window !== "undefined" && selectedLocation) {
      try {
        ws = createReconnectingSocket(`/api/clinical/ws?locationId=${selectedLocation}`, () => { void fetchQueue(); }, true);

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (["QUEUE_UPDATED", "QUEUE_REORDERED", "QUEUE_CALL_NEXT", "QUEUE_CHECK_IN", "PATIENT_CHECKED_IN", "PATIENT_CALLED"].includes(payload.type)) {
              void fetchQueue();
            } else if (payload.type === "DISRUPTION_TRIAGE_REQUIRED") {
              playChimeSound("ding-dong");
              toast({
                title: "🚨 Urgent Disruption Triage Required",
                description: payload.message || "Waiting patients require immediate transfer or assistance.",
                variant: "error",
                duration: 8000,
              });
              fetchTriageAppointments();
              fetchQueue();
            } else if (payload.type === "PATIENT_RETURNED") {
              playChimeSound("bell");
              toast({
                title: "🟢 Patient Returned to Waiting Room!",
                description: payload.message || `Token #${payload.data?.tokenNumber} is back and ready to be seen.`,
                variant: "success",
                duration: 6000,
              });
              fetchQueue();
            } else if (payload.type === "QUEUE_EMERGENCY_STAT") {
              playChimeSound("beep");
              toast({
                title: "🚨 STAT EMERGENCY ALERT!",
                description: payload.message || `Token #${payload.data?.tokenNumber} prioritized for immediate emergency attention!`,
                variant: "error",
                duration: 10000,
              });
              fetchQueue();
            } else if (payload.type === "CLINICAL_PANIC_ALERT") {
              playChimeSound("beep");
              toast({
                title: "🚨 CRITICAL LAB PANIC ALERT!",
                description: payload.message || `Token #${payload.data?.tokenNumber}: ${payload.data?.panicReason}`,
                variant: "error",
                duration: 12000,
              });
              fetchQueue();
            } else if (payload.type === "PATIENT_RECALLED_TO_CABIN") {
              playChimeSound("ding-dong");
              toast({
                title: "📢 Patient Recalled to Cabin",
                description: payload.message || `Token #${payload.data?.tokenNumber} recalled for report review`,
                variant: "info",
                duration: 6000,
              });
              fetchQueue();
            } else if (payload.type === "LAB_RESULTS_READY") {
              playChimeSound("synth");
              toast({
                title: "🔬 Lab Results Ready!",
                description: payload.message || `Results uploaded for Token #${payload.data?.tokenNumber}: ${payload.data?.testName}`,
                variant: "info",
                duration: 8000,
              });
              fetchQueue();
            } else if (payload.type === "LAB_ORDER_PLACED") {
              toast({
                title: "📋 Lab Requisition Placed",
                description: payload.message || `Diagnostic tests ordered for Token #${payload.data?.tokenNumber}`,
                variant: "info",
              });
              fetchQueue();
            } else if (payload.type === "PAYMENT_RECEIVED") {
              playChimeSound("bell");
              toast({
                title: "💰 Payment Received!",
                description: payload.message || `Payment of ₹${payload.data?.amount || ""} received for Token #${payload.data?.tokenNumber || ""}`,
                variant: "success",
                duration: 6000,
              });
              fetchQueue();
            } else if (payload.type === "QUEUE_UPDATED" || payload.type === "QUEUE_CALL_NEXT") {
              fetchQueue();
              fetchTriageAppointments();
            }
          } catch {
            console.error("[Queue WS Message Error]");
          }
        };
      } catch {
        console.warn("[Queue WS Connection Error]");
      }
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [selectedLocation, selectedDoctor, selectedDate]);

  // Split appointments into Active, Standby, and Finished categories
  const activeStatuses = ["pending", "confirmed", "checked-in", "in-consultation"];
  const activeQueue = appointments.filter((a) => activeStatuses.includes(a.status));
  const standbyQueue = appointments.filter((a) => a.status === "standby");
  const finishedQueue = appointments.filter((a) => !activeStatuses.includes(a.status) && a.status !== "standby");

  // Compute live statistics
  const stats = {
    waiting: activeQueue.filter((a) => ["pending", "confirmed", "checked-in"].includes(a.status)).length,
    checkedIn: activeQueue.filter((a) => a.status === "checked-in").length,
    standby: standbyQueue.length,
    activeConsultation: activeQueue.filter((a) => a.status === "in-consultation").length,
    nextInLine: activeQueue.filter((a) => ["checked-in", "confirmed", "pending"].includes(a.status)).sort((a,b) => { const rank = (status: string) => status === "checked-in" ? 0 : status === "confirmed" ? 1 : 2; return rank(a.status) - rank(b.status) || (a.queuePosition ?? a.tokenNumber ?? 999) - (b.queuePosition ?? b.tokenNumber ?? 999); })[0]?.tokenNumber || null,
  };

  const chimeType = preferences.queueChime || "bell";
  const voiceLanguage = preferences.queueVoiceLanguage || "en";

  // Status transitions
  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      setUpdatingStatus(appointmentId);
      await api.put(`/appointments/${appointmentId}/status`, { status: newStatus });
      if (newStatus === "in-consultation") {
        playChimeSound(chimeType);
      }
      toast({ title: "Status Updated", description: `Appointment updated to ${newStatus.replace("-", " ")}.`, variant: "success" });
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.response?.data?.message || "Failed to update appointment status.", variant: "error" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCallNext = async (completePrevious = false, confirmedAppointmentId?: string) => {
    if (selectedDate !== new Date().toISOString().slice(0, 10)) { toast({ title: "Select today", description: "Call Next operates on today's queue. Change the date before calling a patient.", variant: "warning" }); return; }
    if (!confirmLeavingClinicalDraft()) return;
    try {
      setCallingNext(true);
      const res = await api.post("/queue/call-next", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        completePrevious,
        requireArrivalConfirmation: true,
        confirmedAppointmentId,
      });
      if (res.data?.data) {
        const docObj = doctors.find((d) => (d.id || d._id) === selectedDoctor);
        announcePatientToken({
          tokenNumber: res.data.data.tokenNumber,
          doctorName: docObj?.name,
          language: voiceLanguage,
          chimeType,
        });
        toast({
          title: "Patient Called 🩺",
          description: res.data.message || `Token #${res.data.data.tokenNumber} has been summoned for consultation.`,
          variant: "success",
        });
        setConflictModalOpen(false);
      } else {
        toast({
          title: "Queue Clear",
          description: res.data?.message || "No waiting patients remaining in this queue.",
          variant: "default",
        });
      }
      await fetchQueue();
    } catch (err: any) {
      if ((err.response?.data?.error || err.response?.data?.details) === "ARRIVAL_CONFIRMATION_REQUIRED") {
        const candidate = err.response.data.data;
        setArrivalConfirmation({ id: candidate.id, tokenNumber: candidate.tokenNumber, completePrevious,
          locationId: selectedLocation, doctorId: selectedDoctor, scope: authScopeKey(user) });
      } else if (err.response?.status === 409 && (err.response?.data?.error || err.response?.data?.details) === "ACTIVE_CONSULTATION_IN_PROGRESS") {
        const docObj = doctors.find((d) => (d.id || d._id) === selectedDoctor);
        setConflictDoctorName(docObj?.name || user?.name || "Doctor");
        setConflictModalOpen(true);
      } else {
        toast({
          title: "Call Failed",
          description: err.response?.data?.message || "Could not call next patient in queue.",
          variant: "error",
        });
      }
    } finally {
      setCallingNext(false);
    }
  };

  const handleCheckInAndPrintToken = async (appt: Appointment) => {
    try {
      setUpdatingStatus(appt.id);
      if (appt.status !== "checked-in") {
        await api.put(`/appointments/${appt.id}/status`, { status: "checked-in" });
      }
      const locationObj = locations.find((c) => (c.id || c._id) === selectedLocation);
      const doctorObj = doctors.find((d) => (d.id || d._id) === selectedDoctor);

      setUnifiedDoc({
        documentType: "token_slip",
        title: `TOKEN SLIP #${appt.tokenNumber}`,
        locationName: locationObj?.name || "Healthcare Center",
        locationAddress: locationObj?.city,
        doctorName: doctorObj?.name || user?.name || "Doctor",
        doctorSpecialization: doctorObj?.specialization,
        patientName: canonicalPatientName(appt.patientId),
        patientId: appt.patientId?.id,
        date: new Date(appt.appointmentTime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        referenceNumber: `TKN-${appt.tokenNumber}`,
        tokenDetails: {
          tokenNumber: appt.tokenNumber,
          estWaitTime: appt.estimatedWaitTime,
        },
      });
      setTokenModalOpen(true);
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Check-In Error", description: err.response?.data?.message || "Failed to check-in patient.", variant: "error" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openThermalSlip = (appt: Appointment) => {
    const locationObj = locations.find((c) => (c.id || c._id) === selectedLocation);
    const doctorObj = doctors.find((d) => (d.id || d._id) === selectedDoctor || (d.id || d._id) === appt.doctorId);
    const apptIdx = activeQueue.findIndex((a) => a.id === appt.id);
    const ahead = apptIdx >= 0 ? apptIdx : 0;

    setThermalSlipData({
      appointmentId: appt.id,
      tokenNumber: appt.tokenNumber,
      locationName: locationObj?.name || "Healthcare facility",
      locationAddress: typeof locationObj?.address === "string" ? locationObj.address : locationObj?.city || "",
      locationPhone: locationObj?.phone || "",
      doctorName: doctorObj?.name || user?.name || "Doctor",
      doctorSpecialization: doctorObj?.specialization || "OPD Consultation",
      patientName: canonicalPatientName(appt.patientId),
      appointmentTime: new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      patientsAhead: ahead,
      date: new Date(appt.appointmentTime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    });
    setThermalSlipOpen(true);
  };

  const openQuickWalkInModal = () => {
    walkInRegistrationRequest.current = crypto.randomUUID();
    setWalkInName("");
    setWalkInPhone("");
    setWalkInDoctorId(selectedDoctor || (doctors[0]?.id || doctors[0]?._id || ""));
    setWalkInPriority("normal");
    setWalkInGender("");
    setWalkInPatientId("");
    setWalkInAppointmentId("");
    setWalkInNotes("");
    setIsQuickWalkInOpen(true);
  };

  const handleQuickWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) {
      toast({ title: "Validation Error", description: "Please enter patient name", variant: "error" });
      return;
    }
    const cleanPhone = walkInPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({ title: "Validation Error", description: "Please enter a valid 10-digit mobile phone number", variant: "error" });
      return;
    }
    const targetDoc = walkInDoctorId || selectedDoctor;
    if (!targetDoc || !selectedLocation) {
      toast({ title: "Validation Error", description: "Location and doctor must be selected", variant: "error" });
      return;
    }

    setSubmittingWalkIn(true);
    try {
      const isEmergency = walkInPriority === "emergency";
      let canonicalPatientId = walkInPatientId;
      if (!canonicalPatientId && !walkInAppointmentId) {
        const patient = await PatientService.createPatient({ name: walkInName.trim(), phone: cleanPhone, locationId: selectedLocation, clientRequestId: walkInRegistrationRequest.current, ...(walkInGender ? { gender: walkInGender } : {}) });
        canonicalPatientId = patient.id || patient._id;
        setWalkInPatientId(canonicalPatientId);
      }
      const payload: any = {
        locationId: selectedLocation,
        doctorId: targetDoc,
        appointmentTime: new Date().toISOString(),
        appointmentType: "walk-in",
        patientId: canonicalPatientId,
        forceBooking: isEmergency,
        notes: isEmergency
          ? `[EMERGENCY WALK-IN] Priority Triage${walkInNotes.trim() ? ` - ${walkInNotes.trim()}` : ""}`
          : (walkInNotes.trim() || "Front-desk walk-in"),
      };

      const res = walkInAppointmentId ? await api.get(`/appointments/${walkInAppointmentId}`) : await api.post("/appointments", payload);
      const newAppt = res.data?.data;
      const savedAppointmentId = newAppt?.id || newAppt?._id;
      if (savedAppointmentId) setWalkInAppointmentId(savedAppointmentId);
      const assignedToken = newAppt?.tokenNumber;

      // Immediately set status to checked-in for physical walk-in arrival
      if (newAppt?.id || newAppt?._id) {
        if (newAppt.status === "pending_payment") throw new Error("Visit booked. Collect the required payment before marking arrival.");
        await api.put(`/appointments/${newAppt.id || newAppt._id}/status`, { status: "checked-in" });
      }

      toast({
        title: isEmergency ? "Emergency Walk-In Queued 🚨" : "Walk-In Registered ✓",
        description: `Token #${assignedToken} assigned to ${walkInName}. Patient added to live queue.`,
        variant: "success",
      });

      setIsQuickWalkInOpen(false);
      await fetchQueue();

      // Offer immediate Thermal Token Slip
      const locationObj = locations.find((c) => (c.id || c._id) === selectedLocation);
      const doctorObj = doctors.find((d) => (d.id || d._id) === targetDoc);

      setThermalSlipData({
        appointmentId: newAppt?.id || newAppt?._id || "",
        tokenNumber: assignedToken,
        locationName: locationObj?.name || "Healthcare facility",
        locationAddress: typeof locationObj?.address === "string" ? locationObj.address : locationObj?.city || "",
        locationPhone: locationObj?.phone || "",
        doctorName: doctorObj?.name || user?.name || "Doctor",
        doctorSpecialization: doctorObj?.specialization || "OPD Consultation",
        patientName: walkInName.trim(),
        appointmentTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        patientsAhead: stats.waiting,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      });
      setThermalSlipOpen(true);
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || err.message || "Could not register walk-in patient.",
        variant: "error",
      });
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const openCompleteModal = (appt: Appointment) => {
    setApptToComplete(appt);
    setRecommendFollowUp(false);
    setFollowUpTimeline("1 week");
    setFollowUpNotes("");
    setSymptoms(appt.symptoms || "");
    setDiagnosis(appt.diagnosis || "");
    setPrescriptions(
      appt.prescriptions && appt.prescriptions.length > 0
        ? appt.prescriptions.map((p) => ({ name: p.name, dosage: p.dosage || "1-0-1 (After Food)", duration: p.duration || "5 days" }))
        : [{ name: "", dosage: "", duration: "" }]
    );
    const existingPhone =
      (appt.patientId && typeof appt.patientId === "object" ? (appt.patientId as any).phone : "") ||
      appt.patientId?.userId?.phone ||
      "";
    setRecipientWhatsAppPhone(existingPhone);
    setDispatchWhatsAppRx(true);
    setDdiAcknowledged(false);
    setCompleteModalOpen(true);
  };

  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptToComplete) return;

    const hasInvalidPrescriptions = prescriptions.some(
      (p) => (p.name || p.dosage || p.duration) && !(p.name && p.dosage && p.duration)
    );

    if (hasInvalidPrescriptions) {
      toast({
        title: "Prescription Incomplete",
        description: "Please fill in Name, Dosage, and Duration for all prescribed medication rows.",
        variant: "error",
      });
      return;
    }

    const activePrescriptions = prescriptions.filter((p) => p.name && p.dosage && p.duration);

    // Drug-Drug Interaction Safety Intercept Check
    const ddiEvaluations = evaluateDrugInteractions(activePrescriptions);
    const hasCriticalDdi = ddiEvaluations.some((i) => i.severity === "critical");
    if (hasCriticalDdi && !ddiAcknowledged) {
      toast({
        title: "Critical Drug Interaction Intercept ⚠️",
        description: "A critical drug-drug interaction was detected. Please review the Clinical Decision Support alert and acknowledge the override before finalizing.",
        variant: "error",
      });
      return;
    }

    try {
      setCompletingSubmitting(true);
      await api.put(`/appointments/${apptToComplete.id}/status`, {
        status: "completed",
        followUpRecommended: recommendFollowUp,
        followUpTimeline: recommendFollowUp ? followUpTimeline : undefined,
        followUpNotes: recommendFollowUp ? followUpNotes : undefined,
        symptoms: symptoms || undefined,
        diagnosis: diagnosis || undefined,
        prescriptions: activePrescriptions,
        dispatchWhatsAppRx,
        recipientPhone: recipientWhatsAppPhone.trim() || undefined,
      });
      toast({ title: "Consultation Concluded", description: "Patient visit and clinical records saved.", variant: "success" });

      // Automatically construct and present official Prescription print slip
      const activeLocationObj = locations.find((c) => (c.id || c._id) === selectedLocation);
      const activeDoctorObj = doctors.find((d) => (d.id || d._id) === selectedDoctor);
      const doctorData = (typeof apptToComplete.doctorId === "object" ? apptToComplete.doctorId : null) || activeDoctorObj;
      const patientName = apptToComplete.patientId?.userId?.name || (apptToComplete.patientId as any)?.name || "Patient";
      const patientAgeGender = [
        apptToComplete.patientId?.gender,
        apptToComplete.patientId?.age ? `${apptToComplete.patientId.age}y` : null,
      ]
        .filter(Boolean)
        .join(" / ");

      const rxDoc: UnifiedDocumentData = {
        documentType: "prescription",
        title: "Official Medical Prescription (Rx)",
        locationName: activeLocationObj?.name || "Healthcare facility",
        locationAddress: [activeLocationObj?.address, activeLocationObj?.city].filter(Boolean).join(", "),
        locationPhone: activeLocationObj?.phone || activeLocationObj?.contactNumber,
        locationEmail: activeLocationObj?.email,
        doctorName: doctorData?.userId?.name || doctorData?.name || user?.name || "Attending Physician",
        doctorSpecialization: doctorData?.specialization || "General Medicine",
        doctorRegistrationNumber: doctorData?.registrationNumber || "",
        doctorQualification: doctorData?.qualifications || "",
        doctorSignatureUrl: doctorData?.digitalSignatureUrl,
        letterheadMode: (doctorData?.letterheadDefaultMode as any) || "plain_a4",
        patientName,
        patientAgeGender: patientAgeGender || undefined,
        patientId: apptToComplete.patientId?.id || apptToComplete.patientId?._id,
        patientPhone: apptToComplete.patientId?.userId?.phone || (apptToComplete.patientId as any)?.phone || recipientWhatsAppPhone,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        referenceNumber: `OPD-${apptToComplete.tokenNumber}`,
        symptoms: symptoms || undefined,
        diagnoses: diagnosis ? [{ description: diagnosis }] : undefined,
        advice: followUpNotes || undefined,
        followUpTimeline: recommendFollowUp ? followUpTimeline : undefined,
        followUpNotes: recommendFollowUp ? followUpNotes : undefined,
        prescriptions: activePrescriptions.map((p) => ({
          name: p.name,
          dosage: p.dosage,
          duration: p.duration,
          instructions: followUpNotes || undefined,
        })),
        vitals: apptToComplete.vitals || undefined,
      };

      setUnifiedDoc(rxDoc);
      setTokenModalOpen(true);

      setCompleteModalOpen(false);
      setApptToComplete(null);
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Completion Error", description: err.response?.data?.message || "Failed to complete consultation.", variant: "error" });
    } finally {
      setCompletingSubmitting(false);
    }
  };

  const handlePrintAppointmentPrescription = (appt: Appointment) => {
    const activeLocationObj = locations.find((c) => (c.id || c._id) === (appt.locationId as any)?.id || (c.id || c._id) === (appt.locationId as any) || (c.id || c._id) === selectedLocation);
    const activeDoctorObj = doctors.find((d) => (d.id || d._id) === (appt.doctorId as any)?.id || (d.id || d._id) === (appt.doctorId as any) || (d.id || d._id) === selectedDoctor);
    const doctorData = (typeof appt.doctorId === "object" ? appt.doctorId : null) || activeDoctorObj;
    const patientName = appt.patientId?.userId?.name || (appt.patientId as any)?.name || "Patient";
    const patientAgeGender = [
      appt.patientId?.gender,
      appt.patientId?.age ? `${appt.patientId.age}y` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    const activePrescriptions = Array.isArray(appt.prescriptions)
      ? appt.prescriptions.filter((p) => p.name && p.dosage && p.duration)
      : [];

    const rxDoc: UnifiedDocumentData = {
      documentType: "prescription",
      title: "Official Medical Prescription (Rx)",
      locationName: activeLocationObj?.name || "Healthcare facility",
      locationAddress: [activeLocationObj?.address, activeLocationObj?.city].filter(Boolean).join(", "),
      locationPhone: activeLocationObj?.phone || activeLocationObj?.contactNumber,
      locationEmail: activeLocationObj?.email,
      doctorName: doctorData?.userId?.name || doctorData?.name || user?.name || "Attending Physician",
      doctorSpecialization: doctorData?.specialization || "General Medicine",
      doctorRegistrationNumber: doctorData?.registrationNumber || "",
      doctorQualification: doctorData?.qualifications || "",
      doctorSignatureUrl: doctorData?.digitalSignatureUrl,
      letterheadMode: (doctorData?.letterheadDefaultMode as any) || "plain_a4",
      patientName,
      patientAgeGender: patientAgeGender || undefined,
      patientId: appt.patientId?.id || appt.patientId?._id,
      patientPhone: appt.patientId?.userId?.phone || (appt.patientId as any)?.phone,
      date: new Date(appt.appointmentTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      referenceNumber: `OPD-${appt.tokenNumber}`,
      symptoms: appt.symptoms || undefined,
      diagnoses: appt.diagnosis ? [{ description: appt.diagnosis }] : undefined,
      advice: appt.notes || undefined,
      prescriptions: activePrescriptions.map((p) => ({
        name: p.name,
        dosage: p.dosage,
        duration: p.duration,
        instructions: p.instructions,
      })),
      vitals: appt.vitals || undefined,
    };

    setUnifiedDoc(rxDoc);
    setTokenModalOpen(true);
  };

  const handlePrintTokenSlip = (appt: Appointment) => {
    const activeLocationObj = locations.find((c) => c.id === (appt.locationId as any)?.id || c.id === selectedLocation);
    const patientName = appt.patientId?.userId?.name || (appt.patientId as any)?.name || "Patient";
    const tokenDoc: UnifiedDocumentData = {
      documentType: "token_slip",
      title: "OPD Queue Token Slip",
      locationName: activeLocationObj?.name || "Healthcare facility",
      locationAddress: [activeLocationObj?.address, activeLocationObj?.city].filter(Boolean).join(", "),
      doctorName: (appt.doctorId as any)?.name || "Attending Physician",
      patientName,
      patientId: appt.patientId?.id || appt.patientId?._id,
      date: new Date(appt.appointmentTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      referenceNumber: `TOKEN-${appt.tokenNumber}`,
      tokenDetails: {
        tokenNumber: appt.tokenNumber,
        estWaitTime: (appt.queuePosition || 1) * 15,
      },
    };
    setUnifiedDoc(tokenDoc);
    setTokenModalOpen(true);
  };

  // Reorder queue locally and update in backend (VIP Override)
  const moveQueueItem = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= activeQueue.length) return;

    const updatedActive = [...activeQueue];
    const temp = updatedActive[index];
    updatedActive[index] = updatedActive[newIndex];
    updatedActive[newIndex] = temp;

    const reorderedAppointments = [...updatedActive, ...finishedQueue];
    setAppointments(reorderedAppointments);

    try {
      const orderedAppointmentIds = updatedActive.map((a) => a.id);
      await api.put("/queue/reorder", {
        locationId: selectedLocation,
        doctorId: selectedDoctor,
        date: selectedDate,
        orderedAppointmentIds,
      });
      toast({ title: "VIP Order Updated", description: "Queue order modified successfully.", variant: "success" });
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Reorder Failed", description: err.response?.data?.message || "Failed to reorder queue.", variant: "error" });
      await fetchQueue();
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "primary" | "success" | "warning" | "danger" | "info" => {
    switch (status) {
      case "pending":
        return "warning";
      case "confirmed":
        return "primary";
      case "checked-in":
        return "info";
      case "in-consultation":
        return "success";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      case "no-show":
        return "danger";
      case "disruption_triage":
        return "danger";
      case "standby":
        return "warning";
      default:
        return "default";
    }
  };

  const getWaitTimeLabel = (minutes?: number) => {
    if (minutes === undefined || minutes === 0) return "Next in Line";
    return `Est. Wait: ${minutes}m`;
  };

  if (!user) return null;

  const canManageQueue = hasAnyPermission(user, "MANAGE_QUEUE");
  const canCommunicatePatients = hasAnyPermission(user, "COMMUNICATE_PATIENTS");

  const searchTerm = patientSearch.trim().toLowerCase().replace(/^#/, "");
  const matchesPatient = (appt: Appointment) => !searchTerm || [
    canonicalPatientName(appt.patientId),
    appt.tokenNumber,
    appt.patientId?.userId?.phone,
    (appt.patientId as any)?.phone,
  ].join(" ").toLowerCase().includes(searchTerm);
  const scopeLoaded = displayedQueueScope === `${selectedLocation}:${selectedDoctor}:${selectedDate}`;

  const reviewView = queueViewTab === "processed" || queueViewTab === "recalls";
  const sessionReady = scopeLoaded && !queueError;
  const sessionLabel = !scopeLoaded ? "Loading session..." : queueError ? "Session unavailable" : queueStatusData?.opdSession?.status === "active" ? (queueStatusData.opdSession.isOnBreak ? "OPD on break" : "OPD in progress") : queueStatusData?.opdSession?.status === "ended" ? "OPD ended" : "OPD not started";
  const sessionVariant = !sessionReady ? "neutral" : queueStatusData?.opdSession?.status === "active" ? (queueStatusData.opdSession.isOnBreak ? "warning" : "success") : queueStatusData?.opdSession?.status === "ended" ? "neutral" : "warning";
  const doctorName = doctors.find(doctor => (doctor.id || doctor._id) === selectedDoctor)?.name || "Choose a doctor";
  const locationName = locations.find(location => (location.id || location._id) === selectedLocation)?.name || "Choose a location";
  const canChooseLocation = locations.length > 1;
  const canChooseDoctor = doctors.length > 1 && user.role !== "doctor";
  const scopeIdentity = <span id="queue-scope" className={styles.scopeIdentity}><strong title={doctorName}>{doctorName}</strong><span title={locationName}>{locationName}</span></span>;
  const queueTools = (<Dropdown align="right" width="w-64" trigger={<Button variant="outline" size="sm" aria-label="Queue tools" className={styles.toolsTrigger}><MoreHorizontal className="h-4 w-4" /></Button>} items={[
          { label: "Refresh queue", icon: <RotateCw />, disabled: loadingQueue, onClick: fetchQueue },
          { label: "Availability", icon: <CalendarClock />, disabled: !selectedLocation || !selectedDoctor, onClick: () => { fetchActiveOverride(); setIsAvailabilityModalOpen(true); } },
          { label: "Preview poster", icon: <Printer />, disabled: !selectedLocation || selectedLocation === "all", onClick: () => { const location = locations.find(item => (item.id || item._id) === selectedLocation); setQrPosterLocation(location || { id: selectedLocation, name: "Our location" }); setQrPosterOpen(true); } },
          { label: "ABHA registration", icon: <ShieldCheck />, onClick: () => setAbdmModalOpen(true) },
          { label: "Certificates", icon: <FileText />, onClick: () => { setSelectedDocGenPatient(null); setClinicalDocGenOpen(true); } },
          ...(!reviewView && canManageQueue && sessionReady ? [
            { label: "", divider: true },
            ...(queueStatusData?.opdSession?.status === "active" ? [
              { label: queueStatusData.opdSession.isOnBreak ? "Resume OPD" : "Take break", icon: <PauseCircle />, disabled: isTogglingBreak, onClick: () => { if (queueStatusData?.opdSession?.isOnBreak) void handleToggleDoctorBreak(false); else setIsBreakModalOpen(true); } },
              { label: "End OPD and reconcile", icon: <CheckCircle2 />, danger: true, onClick: handleOpenEndOpdModal },
            ] : [{ label: queueStatusData?.opdSession?.status === "ended" ? "Reopen session" : "Start OPD", icon: <Play />, disabled: isStartingOpd, onClick: handleStartOpdSession }]),
          ] : []),
          ...(user.organization_id && hasAnyPermission(user, "MANAGE_ORGANIZATION") ? [
            { label: "", divider: true },
            { label: "Announcement settings", icon: <Settings2 />, onClick: () => router.push(organizationWorkspaceUrl(user.organization_id, "configuration")) },
          ] : []),
        ]} />);

  return (
    <div className={styles.workspace}>
      <ConfirmDialog open={Boolean(arrivalConfirmation)} title="Confirm booked patient arrival"
        description={`Token #${arrivalConfirmation?.tokenNumber ?? ''} has not checked in. Call this booked patient now?`}
        confirmLabel="Confirm arrival and call" loading={callingNext}
        onClose={() => { if (!callingNext) setArrivalConfirmation(null); }}
        onConfirm={() => {
          const pending = arrivalConfirmation;
          if (!pending || pending.locationId !== selectedLocation || pending.doctorId !== selectedDoctor || pending.scope !== authScopeKey(user)) {
            setArrivalConfirmation(null);
            return;
          }
          setArrivalConfirmation(null);
          void handleCallNext(pending.completePrevious, pending.id);
        }} />
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <h1 className="sr-only">Patient queue</h1>
      <section className={styles.scopePanel} aria-label="Queue selection">
        {canChooseLocation || canChooseDoctor ? <button type="button" aria-label="Change queue filters" aria-expanded={filtersExpanded} aria-controls="queue-scope-fields" onClick={() => setFiltersExpanded(!filtersExpanded)} className={styles.scopeHeading}>
          {scopeIdentity}<ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button> : <div className={styles.scopeHeading}>{scopeIdentity}</div>}
        <div className={styles.scopeDateSummary}>
          {queueViewTab === "recalls" ? <span className={styles.scopeDate}>All dates</span> : <button type="button" className={styles.scopeDate} aria-label="Change queue date" aria-expanded={filtersExpanded} aria-controls="queue-scope-fields" onClick={() => setFiltersExpanded(!filtersExpanded)}><time dateTime={selectedDate}>{selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Choose a date"}</time><ChevronDown className="h-3 w-3" aria-hidden="true" /></button>}
          <div className={styles.scopeContext}>{reviewView ? <span>{queueViewTab === "recalls" ? "Follow-up register" : "Processed visits"}</span> : <Badge variant={sessionVariant} dot>{sessionLabel}</Badge>}</div>
        </div>
        <div className={styles.scopeTools}>{queueTools}</div>
        <div id="queue-scope-fields" className={cn(styles.scopeFields, (filtersExpanded || (!loadingFilters && (!selectedLocation || !selectedDoctor))) && styles.scopeFieldsOpen)}>
          {loadingFilters ? [0, 1, 2].map(index => <div key={index} className={styles.fieldLoading}><Skeleton width="5rem" height="1.25rem" /><Skeleton height="2.75rem" /></div>) : <>
            {locations.length === 1 ? <div className={styles.fixedScopeField}><span>Location</span><p title={locationName}>{locationName}</p></div> : <Select size="sm" label="Location" value={selectedLocation} disabled={!canChooseLocation} onChange={event => setSelectedLocation(event.target.value)} placeholder="Choose location" options={locations.map(location => ({ value: location.id || location._id, label: location.name }))} />}
            {doctors.length === 1 || user.role === "doctor" ? <div className={styles.fixedScopeField}><span>Doctor</span><p title={doctorName}>Dr. {doctorName.replace(/^dr\.?\s+/i, "")}</p></div> : <Select size="sm" label="Doctor" value={selectedDoctor} disabled={!canChooseDoctor} onChange={event => setSelectedDoctor(event.target.value)} options={doctors.map(doctor => ({ value: doctor.id || doctor._id, label: `Dr. ${(doctor.name || "").replace(/^dr\.?\s+/i, "")}` }))} />}
            {queueViewTab === "recalls" ? <div className={styles.recallRange}><span>Follow-up dates</span><p>All dates, filtered below</p></div> : <DatePicker label="Queue date" size="sm" value={selectedDate} onChange={setSelectedDate} />}
          </>}
        </div>
      </section>
      <nav aria-label="Patient queue views">
        <Tabs className={styles.tabs} variant="pills" scrollActiveIntoView={false} activeTab={queueViewTab} onChange={id => { setQueueViewTab(id as typeof queueViewTab); setPatientSearch(""); }} tabs={[{ id: "active", label: "Queue" }, { id: "standby", label: "Standby" }, { id: "processed", label: "Processed" }, { id: "recalls", label: "Recalls" }]} />
      </nav>
      {!reviewView && <section className={styles.operationsBar} aria-label="OPD session and queue controls">
        <div className={styles.sessionBar}>
          {!scopeLoaded || queueError ? <span className="text-xs text-text-muted" role="status">{queueError ? "Session unavailable" : "Loading session..."}</span> : queueStatusData?.opdSession?.status === "active" ? <>
            <Badge variant={queueStatusData.opdSession.isOnBreak ? "warning" : "success"} dot>{queueStatusData.opdSession.isOnBreak ? "OPD on break" : "OPD in progress"}</Badge>
            {queueStatusData.opdSession.isOnBreak && <span className={styles.breakDetail}>{queueStatusData.opdSession.breakReason || "Intermission"} (~{queueStatusData.opdSession.breakExpectedMinutes || 15}m)</span>}
            {canManageQueue && <Dropdown align="left" width="w-64" trigger={<Button variant="ghost" size="sm" className={styles.sessionTrigger} disabled={isTogglingBreak}>Session <ChevronDown className="h-3.5 w-3.5" /></Button>} items={[
              queueStatusData.opdSession.isOnBreak
                ? { label: "Resume OPD", icon: <Play />, onClick: () => handleToggleDoctorBreak(false) }
                : { label: "Take break", icon: <PauseCircle />, onClick: () => setIsBreakModalOpen(true) },
              { label: "End OPD and reconcile", icon: <CheckCircle2 />, variant: "danger", onClick: handleOpenEndOpdModal },
            ]} />}
          </> : <>
            <Badge variant={queueStatusData?.opdSession?.status === "ended" ? "neutral" : "warning"} dot>{queueStatusData?.opdSession?.status === "ended" ? "OPD ended" : "OPD not started"}</Badge>
            {canManageQueue && <Button size="sm" variant="outline" onClick={handleStartOpdSession} loading={isStartingOpd}>{queueStatusData?.opdSession?.status === "ended" ? "Reopen session" : "Start OPD"}</Button>}
          </>}
        </div>
        <div className={styles.queueActions} role="group" aria-label="Queue controls">
          <Button variant="outline" size="sm" onClick={openQuickWalkInModal} disabled={!selectedLocation || !selectedDoctor || loadingFilters}><Plus className="h-3.5 w-3.5" />Walk-in</Button>
          <Button variant="primary" size="sm" onClick={() => handleCallNext(false)} loading={callingNext} disabled={!scopeLoaded || Boolean(queueError) || loadingFilters}><Megaphone className="h-3.5 w-3.5" />Call Next</Button>
        </div>
      </section>}

      {queueError && <Alert variant="error" title="Unable to load queue" action={<Button variant="outline" size="sm" onClick={fetchQueue} loading={loadingQueue}>Try again</Button>}>{queueError}</Alert>}
      {activeOverride && (
        <div className={cn(
          "p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-sm font-medium",
          activeOverride.status === "unavailable" ? "bg-danger/10 border-danger/30 text-danger-text dark:text-danger-text" :
          activeOverride.status === "delayed" ? "bg-warning/10 border-warning/30 text-warning-text dark:text-warning-text" :
          "bg-primary/10 border-primary/30 text-accent"
        )}>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold capitalize">Today&apos;s Override: {activeOverride.status}</span>
              {activeOverride.effectiveStartTime && <span className="ml-2 font-normal">Starts: {activeOverride.effectiveStartTime}</span>}
              {activeOverride.effectiveEndTime && <span className="ml-2 font-normal">Ends: {activeOverride.effectiveEndTime}</span>}
              {activeOverride.reason && <span className="ml-2 text-xs opacity-85">({activeOverride.reason})</span>}
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleRemoveOverride}
            disabled={savingOverride}
            className="text-xs rounded-xl font-semibold"
           loading={savingOverride}>
            Revert to Normal Schedule
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          URGENT DISRUPTION TRIAGE ALERT BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      {triageAppointments.length > 0 && (
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-danger-subtle    border-2 border-danger/40 shadow-sm animate-fade-in text-danger-text dark:text-danger-text">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-danger text-background flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-danger-text dark:text-danger-text">
                    Doctor Disruption Triage Active — {triageAppointments.length} Patient{triageAppointments.length === 1 ? "" : "s"} Stranded
                  </h3>
                  <Badge variant="danger" size="sm" dot pulse className="font-bold text-[10px]">
                    Urgent Action Required
                  </Badge>
                </div>
                <p className="text-xs text-danger-text/90 dark:text-danger-text/90 max-w-2xl leading-relaxed">
                  A physician schedule disruption was processed today. {triageAppointments.filter((a) => disruptionPresence(a) === "waiting").length} waiting patient(s) need immediate transfer to an available colleague to avoid clinical abandonment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setTriageModalOpen(true)}
                className="bg-danger hover:bg-danger text-background font-bold flex items-center gap-2 cursor-pointer"
              >
                <Stethoscope className="w-4 h-4" />
                Open Triage Cockpit ({triageAppointments.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {queueStatusData?.isAdaptiveDuration && (
        <div className="p-2.5 px-3.5 rounded-xl bg-primary-500/[0.06] border border-primary-500/20 text-text-secondary flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="font-medium text-text">
              Live Adaptive Wait Times Active: Calculated dynamically from today&apos;s completed consultations (~{queueStatusData.averageDuration || 15} mins/patient).
            </span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          QUEUE OVERRUN & DELAY CASCADE BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      {delayStatus?.isDelayed && delayStatus.affectedCount > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-warning/10 border border-warning/30 text-warning-text dark:text-warning-text flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warning-text shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-sm">
                Queue Overrun Detected — Dr. {doctors.find((d) => (d.id || d._id) === selectedDoctor)?.name || user?.name || "Doctor"} is running ~{delayStatus.maxDelayMinutes} mins behind schedule
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {delayStatus.affectedCount} remote patient(s) have projected delays exceeding 20 minutes. Send proactive WhatsApp delay alerts with revised arrival times to minimize waiting room congestion.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="xs"
            onClick={handleTriggerDelayAlerts}
            loading={sendingDelayAlerts}
            className="bg-warning hover:bg-warning text-background font-bold rounded-xl shrink-0 text-xs"
          >
            <Phone className="w-3.5 h-3.5 mr-1" />
            Send WhatsApp Delay Alerts ({delayStatus.affectedCount})
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. STATS OVERVIEW
         ────────────────────────────────────────────────────────────────────────── */}
      {selectedLocation && selectedDoctor && queueViewTab === "active" && (
        <dl className={styles.summary} aria-label="Queue summary" aria-busy={loadingQueue || loadingFilters}>
          {[
            { label: "Not arrived", value: stats.waiting - stats.checkedIn },
            { label: "Waiting", value: stats.checkedIn },
            { label: "In visit", value: stats.activeConsultation },
            { label: "Next token", value: stats.nextInLine ? `#${stats.nextInLine}` : "None" },
          ].map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{loadingQueue || loadingFilters || queueError || !scopeLoaded ? "—" : value}</dd></div>)}
        </dl>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. HOURLY TRAFFIC & BOTTLENECK CHART
         ────────────────────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN QUEUE WORKSPACE
         ────────────────────────────────────────────────────────────────────────── */}
      {queueViewTab !== "recalls" && <div className={styles.searchRow}><Input aria-label="Find patient in queue" type="search" placeholder="Find name, phone or token" icon={<Search className="h-4 w-4" />} value={patientSearch} onChange={event => setPatientSearch(event.target.value)} onClear={() => setPatientSearch("")} containerClassName={styles.patientSearch} /></div>}
      {loadingFilters ? <div className={styles.queueLoading} aria-label="Loading queue"><SkeletonCard /></div> : !selectedLocation || !selectedDoctor ? (
        <Card className="text-center py-16 rounded-2xl border border-border/80 bg-surface">
          <CardContent className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center text-text-secondary">
              <Stethoscope className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-base font-bold text-text">Select Location and Doctor</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Please choose a facility location and physician from the filters above to access the live queue.
            </p>
          </CardContent>
        </Card>
      ) : loadingQueue || (!scopeLoaded && !queueError) ? (
        <div className={styles.queueLoading} aria-label="Loading queue"><SkeletonCard /></div>
      ) : queueError && !scopeLoaded ? <div className={styles.emptyState}><p>Queue information is unavailable for this selection. Refresh to retry.</p></div> : (
        <div className={styles.queueWorkspace}>
          {/* Queue tabs and patient search */}
          <div className={styles.queueList}>

            {/* View Tab 1: Active Queue */}
            {queueViewTab === "active" && (
              <>
                {activeQueue.filter(matchesPatient).length === 0 ? (
                  <Card padding="none" className={styles.emptyState}>
                    <CardContent className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-success-text">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-text text-sm">{patientSearch ? "No matching patients" : "No Active Patients in Queue"}</p>
                      <p className="text-xs text-text-muted">{patientSearch ? "Try another name, phone number or token." : "All appointments for this shift have been processed or checked out."}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activeQueue.map((appt, idx) => {
                      if (!matchesPatient(appt)) return null;
                      const isFirst = idx === 0;
                      const isLast = idx === activeQueue.length - 1;
                      const isInConsultation = appt.status === "in-consultation";
                      const isCheckedIn = appt.status === "checked-in";
                      const isEmergency = Boolean(appt.isEmergency || appt.queuePosition === 0);
                      const criticalVitalsAlert = getCriticalVitalsAlert(appt.vitals);
                      const hasCriticalVitals = Boolean(criticalVitalsAlert && criticalVitalsAlert.length > 0);
                      const vitals = appt.vitals;
                      const recordedVitals = [
                        ...(hasVitalValue(vitals?.bpSystolic) || hasVitalValue(vitals?.bpDiastolic) ? [{ label: "BP", value: `${hasVitalValue(vitals?.bpSystolic) ? vitals.bpSystolic : "—"}/${hasVitalValue(vitals?.bpDiastolic) ? vitals.bpDiastolic : "—"}` }] : []),
                        ...(hasVitalValue(vitals?.pulse) ? [{ label: "HR", value: `${vitals.pulse} bpm` }] : []),
                        ...(hasVitalValue(vitals?.spO2) ? [{ label: "SpO₂", value: `${vitals.spO2}%` }] : []),
                        ...(hasVitalValue(vitals?.temperature) ? [{ label: "Temp", value: `${vitals.temperature}°${vitals.temperatureUnit || "F"}` }] : []),
                        ...(hasVitalValue(vitals?.bmi) ? [{ label: "BMI", value: String(vitals.bmi) }] : []),
                      ];
                      const patientPhone = appt.patientId?.userId?.phone || (appt.patientId as any)?.phone;

                      return (
                        <Card
                          padding="none"
                          key={appt.id}
                          className={cn(
                            styles.patientCard,
                            isEmergency
                              ? "border-danger bg-danger/[0.04] dark:bg-danger/[0.08] ring-1 ring-danger/40"
                              : hasCriticalVitals
                              ? "border-danger/80 bg-danger/[0.03] dark:bg-danger/[0.06] ring-1 ring-danger/30"
                              : isInConsultation
                              ? "border-success/40 bg-success/[0.03] dark:bg-success/[0.06]"
                              : isCheckedIn
                              ? "border-primary-500/30 bg-surface"
                              : "border-border/80 bg-surface"
                          )}
                        >
                          <CardContent className={styles.queuePatientBody}>
                            <div className={styles.patientInformation}>
                            {/* Token & Patient details */}
                            <div className={styles.patientHeading}>
                              <div
                                className={cn(
                                  "w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold shrink-0",
                                  isEmergency
                                    ? "bg-danger text-background shadow-danger/30 animate-pulse"
                                    : isInConsultation
                                    ? "bg-success text-background shadow-success/20"
                                    : isCheckedIn
                                    ? "bg-primary-500 text-brand-mist "
                                    : "bg-surface-alt border border-border text-text"
                                )}
                              >
                                <span className="text-[9px] font-sans uppercase font-bold tracking-wider opacity-80">
                                  {isEmergency ? "STAT" : "Token"}
                                </span>
                                <span className="text-base leading-none">#{appt.tokenNumber}</span>
                              </div>

                              <div className={styles.patientIdentity}>
                                <div className={styles.patientTitle}>
                                  <span className="min-w-0 font-bold text-text text-sm break-words">
                                    {canonicalPatientName(appt.patientId)}
                                  </span>
                                  {isEmergency && (
                                    <Badge variant="danger" size="sm" pulse className="font-bold text-[10px] uppercase">
                                      🚨 STAT Emergency
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={getStatusBadgeVariant(appt.status)}
                                    size="sm"
                                    dot={isInConsultation}
                                    pulse={isInConsultation}
                                    className="capitalize font-semibold text-[10px]"
                                  >
                                    {appt.status.replace("-", " ")}
                                  </Badge>

                                  {/* Payment Status Badge */}
                                  {appt.paymentStatus === "paid" ? (
                                    <Badge variant="success" size="sm" className="font-semibold text-[10px] bg-success/10 text-success-text dark:text-success-text border border-success/20">
                                      ✓ Paid ₹{appt.paymentAmount || 500}
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" size="sm" className="font-semibold text-[10px] bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20">
                                      Unpaid ₹{appt.paymentAmount || 500}
                                    </Badge>
                                  )}
                                </div>
                                <div className={styles.patientMeta}>
                                  {patientPhone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {patientPhone}
                                    </span>
                                  )}
                                  {appt.appointmentType && <span className="capitalize">{appt.appointmentType.replace(/[_-]/g, " ")}</span>}
                                  {!isInConsultation && <span className={styles.patientWait}><Clock className="h-3 w-3" aria-hidden="true" />{getWaitTimeLabel(appt.estimatedWaitTime)}</span>}
                                </div>
                                {appt.notes && (
                                  <p className={styles.patientNote} title={appt.notes}>
                                    Note: &ldquo;{appt.notes}&rdquo;
                                  </p>
                                )}

                              </div>
                            </div>
                                {/* Vitals Display Strip if Recorded */}
                                {recordedVitals.length > 0 && appt.vitals && (
                                  <div className={styles.vitalsStrip} aria-label="Recorded vitals">
                                    <dl className={styles.vitalsValues}>{recordedVitals.map(vital => <div key={vital.label}><dt>{vital.label}</dt><dd>{vital.value}</dd></div>)}</dl>
                                    {((appt.vitals.bpSystolic && appt.vitals.bpSystolic >= 140) || (appt.vitals.bpDiastolic && appt.vitals.bpDiastolic >= 90)) && (
                                      <Badge variant="danger" size="sm" className="text-[9px] px-1.5 py-0">
                                        Stage 2 HTN
                                      </Badge>
                                    )}
                                    {appt.vitals.spO2 && appt.vitals.spO2 < 95 && (
                                      <Badge variant="danger" size="sm" className="text-[9px] px-1.5 py-0">
                                        Hypoxia &lt;95%
                                      </Badge>
                                    )}
                                    {appt.vitals.temperature && appt.vitals.temperature >= 100.4 && (
                                      <Badge variant="warning" size="sm" className="text-[9px] px-1.5 py-0">
                                        Fever
                                      </Badge>
                                    )}
                                    {canManageQueue && (
                                      <Button type="button" onClick={() => {
                                          setSelectedVitalsAppt(appt);
                                          setVitalsModalOpen(true);
                                        }} variant="ghost" size="xs" className="text-accent">
                                        Edit Vitals
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {/* Investigation / Diagnostic Lab Results Strip */}

                            </div>

                            {canManageQueue && <div className={styles.patientControls}>
                                <div className={styles.primaryActions}>                                  {appt.status !== "checked-in" && !isInConsultation && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      onClick={() => handleCheckInAndPrintToken(appt)}
                                      loading={updatingStatus === appt.id}
                                      className="font-semibold text-xs rounded-xl"
                                    >
                                      <UserCheck className="w-3 h-3 mr-1" />
                                      Check In
                                    </Button>
                                  )}

                                  {/* Collect Payment via Counter-Top BharatPe UPI Modal */}
                                  {appt.paymentStatus !== "paid" && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      onClick={() => {
                                        setSelectedUpiAppt(appt);
                                        setIsUpiModalOpen(true);
                                      }}
                                      className="font-bold text-xs rounded-xl border-success/40 text-success-text dark:text-success-text hover:bg-success/10 cursor-pointer"
                                      title="Collect Consultation Fee via Counter-Top BharatPe UPI QR Code"
                                    >
                                      <Banknote className="w-3.5 h-3.5 mr-1 text-success-text dark:text-success-text" />
                                      Pay ₹{getAppointmentBilling(appt).totalAmount}
                                    </Button>
                                  )}

{isInConsultation ? (<Button
                                        variant="primary"
                                        size="xs"
                                        onClick={() => openCompleteModal(appt)}
                                        loading={updatingStatus === appt.id}
                                        className="bg-success hover:bg-success text-background font-bold text-xs rounded-xl"
                                      >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Conclude Visit
                                      </Button>) : (<Button
                                      variant="primary"
                                      size="xs"
                                      onClick={() => {
                                        updateStatus(appt.id, "in-consultation");
                                        announcePatientToken({
                                          tokenNumber: appt.tokenNumber,
                                          doctorName: appt.doctorId?.userId?.name || appt.doctorId?.name,
                                          cabinName: appt.doctorId?.cabinNumber ? `Cabin ${appt.doctorId.cabinNumber}` : undefined,
                                          language: voiceLanguage,
                                          chimeType,
                                        });
                                      }}
                                      loading={updatingStatus === appt.id}
                                      className="font-bold text-xs rounded-xl bg-primary-600 hover:bg-primary-700"
                                    >
                                      <Stethoscope className="w-3 h-3 mr-1" />
                                      Call In
                                    </Button>)}</div>
                                <Dropdown align="right" width="w-64" className={styles.patientTools}
                                  trigger={<Button variant="outline" size="xs" aria-label="More patient actions" title={`Actions for ${canonicalPatientName(appt.patientId)}`} className={styles.toolsTrigger}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button>}
                                  items={[
                                    ...(!isInConsultation ? [{ label: "Move to standby", icon: <PauseCircle />, onClick: () => openParkModal(appt) }] : []),
                                    { label: "Move back 2 places", icon: <Clock />, onClick: () => handleBumpBack(appt.id) },
                                    { label: "Move up", icon: <ChevronUp />, disabled: isFirst, onClick: () => moveQueueItem(idx, "up") },
                                    { label: "Move down", icon: <ChevronDown />, disabled: isLast, onClick: () => moveQueueItem(idx, "down") },
                                    { label: "", divider: true },
                                    ...(canCommunicatePatients ? [{ label: "Send live tracker", icon: <Send />, onClick: () => openResendTrackerModal(appt) }] : []),
                                    { label: "Patient history", icon: <History />, onClick: () => { const pId = typeof appt.patientId === "object" ? appt.patientId.id : appt.patientId; setTimelinePatient({ id: pId, name: canonicalPatientName(appt.patientId) }); setTimelineModalOpen(true); } },
                                    { label: "Lab reports", icon: <FlaskConical />, onClick: () => openInvestigationViewer(appt) },
                                    ...(recordedVitals.length === 0 && !isInConsultation ? [{ label: "Record vitals", icon: <Stethoscope />, onClick: () => { setSelectedVitalsAppt(appt); setVitalsModalOpen(true); } }] : []),
                                    ...(isInConsultation ? [
                                      { label: "Summon patient", icon: <Volume2 />, onClick: () => { announcePatientToken({ tokenNumber: appt.tokenNumber, doctorName: appt.doctorId?.userId?.name || appt.doctorId?.name, cabinName: appt.doctorId?.cabinNumber ? `Cabin ${appt.doctorId.cabinNumber}` : undefined, language: voiceLanguage, chimeType }); toast({ title: `Summoning Token #${appt.tokenNumber}`, description: "Doorway voice announcer and calling chime sounded.", variant: "default" }); } },
                                      { label: "Send for lab", icon: <FlaskConical />, onClick: () => handleOpenInvestigationModal(appt) },
                                    ] : []),
                                    ...(!isEmergency && !isInConsultation ? [{ label: "", divider: true }, { label: "STAT priority", icon: <AlertTriangle />, danger: true, onClick: () => { setApptToStatEmergency(appt); setEmergencyReason(""); setStatModalOpen(true); } }] : []),
                                  ]} />
                            </div>}
                                {/* Critical Vitals Early Warning Score (MEWS Alert Banner) */}
                                {criticalVitalsAlert && (
                                  <div className={styles.criticalAlert}>
                                    <div className="flex items-center gap-2 text-danger-text dark:text-danger-text">
                                      <AlertTriangle className="w-4 h-4 text-danger-text dark:text-danger-text shrink-0" />
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold uppercase tracking-wider text-[10px] text-danger-text dark:text-danger-text">
                                            Critical Vitals MEWS Alert
                                          </span>
                                          <Badge variant="danger" size="sm" className="font-mono text-[9px] px-1 py-0">
                                            HIGH TRIAGE RISK
                                          </Badge>
                                        </div>
                                        <p className="text-[11px] text-danger-text dark:text-danger-text mt-0.5 font-medium">
                                          {criticalVitalsAlert.join(" • ")}
                                        </p>
                                      </div>
                                    </div>
                                    {!isEmergency && !isInConsultation && (
                                      <Button
                                        type="button"
                                        variant="danger"
                                        size="xs"
                                        onClick={() => {
                                          setApptToStatEmergency(appt);
                                          setEmergencyReason(`Critical Vitals MEWS Triage: ${criticalVitalsAlert.join(", ")}`);
                                          setStatModalOpen(true);
                                        }}
                                        className="shrink-0 font-semibold text-xs rounded-xl"
                                      >
                                        <Zap className="w-3 h-3 mr-1 fill-white" />
                                        Escalate to STAT Next
                                      </Button>
                                    )}
                                  </div>
                                )}

                            {Boolean(appt.investigationResults?.length) && <div className={styles.patientLabResults}><QueueLabResults results={appt.investigationResults || []} onOpen={() => openInvestigationViewer(appt)} /></div>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* View Tab 2: Parked / Standby Queue */}
            {queueViewTab === "standby" && (
              <div className="space-y-3">
                {standbyQueue.filter(matchesPatient).length === 0 ? (
                  <Card padding="none" className={styles.emptyState}>
                    <CardContent className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-warning-text">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-text text-sm">{patientSearch ? "No matching standby patients" : "No Patients in Standby"}</p>
                      <p className="text-xs text-text-muted">No checked-in patients are currently stepped out or held in standby.</p>
                    </CardContent>
                  </Card>
                ) : (
                  standbyQueue.filter(matchesPatient).map((appt) => {
                  const isReportReview = appt.consultationPhase === "initial_pending_investigation";
                  const isReturned = appt.patientReturned;

                  return (
                    <Card
                      padding="none"
                      key={appt.id}
                      className={cn(
                        "rounded-2xl border transition-all shadow-xs overflow-hidden",
                        isReturned
                          ? "border-success/50 bg-success/[0.04] ring-2 ring-success/20"
                          : isReportReview
                          ? "border-accent/40 bg-primary/[0.02]"
                          : "border-warning/30 bg-warning/[0.02]"
                      )}
                    >
                      <CardContent className={styles.patientBody}>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-2xl text-brand-mist flex flex-col items-center justify-center font-mono font-bold shadow-xs shrink-0",
                              isReturned ? "bg-success" : isReportReview ? "bg-primary" : "bg-warning"
                            )}
                          >
                            <span className="text-[9px] font-sans uppercase font-bold tracking-wider opacity-80">
                              Tkn
                            </span>
                            <span className="text-base leading-none">#{appt.tokenNumber}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-text text-sm truncate">
                                {canonicalPatientName(appt.patientId)}
                              </span>
                              {isReturned ? (
                                <Badge variant="success" size="sm" pulse dot className="font-bold text-[10px] bg-success/15 text-success-text dark:text-success-text border border-success/30">
                                  🟢 Returned & Ready in Waiting Room
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                                  Standby / Stepped Out
                                </Badge>
                              )}
                              {isReportReview && (
                                <Badge variant="neutral" size="sm" className="font-bold text-[10px] bg-primary/15 text-accent dark:text-accent border border-accent/30">
                                  🔬 In Lab: {appt.investigationNotes || "Diagnostic Tests"}
                                </Badge>
                              )}

                              <QueueLabResults results={appt.investigationResults || []} onOpen={() => openInvestigationViewer(appt)} />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                              {appt.patientId?.userId?.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {appt.patientId?.userId?.phone}
                                </span>
                              )}
                              <span>&bull;</span>
                              <span>Parked: {appt.parkedReason || "Stepped out"}</span>
                              {appt.parkedAt && (
                                <span>({new Date(appt.parkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={styles.standbyActions}>
                          {canCommunicatePatients && <Button type="button" onClick={() => openResendTrackerModal(appt)} title="Queue live tracking link via WhatsApp" variant="outline" size="xs">
                            <Send className="w-3 h-3" />
                            Tracker
                          </Button>}
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => openInvestigationViewer(appt)}
                            className="font-bold text-xs rounded-xl border-accent/30 text-accent dark:text-accent hover:bg-primary/10 cursor-pointer shadow-xs"
                            title="View lab investigation results and parameter comparisons"
                          >
                            <FlaskConical className="w-3.5 h-3.5 mr-1 text-accent dark:text-accent" />
                            Lab Reports
                          </Button>
                          {isReportReview ? (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => handleResumeForReportReview(appt.id, appt.tokenNumber)}
                              loading={updatingStatus === appt.id}
                              className="hover:bg-primary font-bold text-xs rounded-xl"
                            >
                              <span>🔬</span> Resume for Report Review
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => handleResumePatient(appt.id)}
                              loading={updatingStatus === appt.id}
                              className="bg-success hover:bg-success text-background font-bold text-xs rounded-xl"
                            >
                              <Play className="w-3 h-3 mr-1 fill-current" />
                              Resume (Next Up!)
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
                )}
              </div>
            )}

            {/* View Tab 3: Outpatient Care-Gap & Follow-Up Recall Register */}
            {queueViewTab === "recalls" && (
              <FollowUpRecallRegister
                locationId={selectedLocation}
                doctorId={selectedDoctor}
                onCheckInSuccess={fetchQueue}
              />
            )}
          </div>

          {/* Completed, cancelled and inactive visits */}
          {queueViewTab === "processed" && <section className={styles.processed}>
            <div className={styles.processedHeading}>
              <h3 className="text-base font-bold text-text">Processed Patients</h3>
              <Badge variant="neutral" size="sm" className="font-semibold">
                {finishedQueue.length} records
              </Badge>
            </div>

            <Card padding="none" className={styles.processedPanel}>
              <CardContent className="p-0">
                {finishedQueue.filter(matchesPatient).length === 0 ? (
                  <div className="text-center py-14 px-4 text-text-muted text-xs">
                    {patientSearch ? "No matching processed patients. Try another name, phone number or token." : "No processed visits for the selected date."}
                  </div>
                ) : (
                  <div className={styles.processedList}>
                    {finishedQueue.filter(matchesPatient).map((appt) => (
                      <div
                        key={appt.id}
                        className={styles.processedRow}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-text-secondary">
                              #{appt.tokenNumber}
                            </span>
                            <Badge
                              variant={getStatusBadgeVariant(appt.status)}
                              size="sm"
                              className="capitalize text-[9px] font-bold"
                            >
                              {appt.status}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-text break-words">
                            {canonicalPatientName(appt.patientId)}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Clock className="w-3 h-3 text-text-muted" />
                            <span>
                              {new Date(appt.appointmentTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className={styles.processedActions}>
                          {appt.status === "completed" && (
                            <>
                              <PrintButton
                                type="button"
                                onPrint={() => handlePrintAppointmentPrescription(appt)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-xl border border-primary-500/30 text-accent dark:text-accent hover:bg-primary-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Print Official Prescription (Rx)" documentName="prescription" preview
                              >
              </PrintButton>
                              <Button type="button" onClick={() => openResendRxModal(appt)} title="Queue the prescription for the reviewed WhatsApp recipient" variant="outline" size="xs">
                                <Send className="w-3.5 h-3.5" />
                                Send Rx
                              </Button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDocGenPatient({
                                    _id: typeof appt.patientId === "object" ? (appt.patientId?.id || appt.patientId?._id) : appt.patientId,
                                    firstName: typeof appt.patientId === "object" ? (appt.patientId?.userId?.name?.split(" ")[0] || appt.patientId?.name?.split(" ")[0]) : "Patient",
                                    lastName: typeof appt.patientId === "object" ? (appt.patientId?.userId?.name?.split(" ").slice(1).join(" ") || appt.patientId?.name?.split(" ").slice(1).join(" ")) : "",
                                    phone: typeof appt.patientId === "object" ? (appt.patientId?.userId?.phone || (appt.patientId as any)?.phone || "") : "",
                                    gender: typeof appt.patientId === "object" ? appt.patientId?.gender : undefined,
                                  });
                                  setClinicalDocGenOpen(true);
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-xl border border-accent/30 text-accent dark:text-accent hover:bg-primary/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Generate Medical Sick Leave, Referral Letter, or Fitness Certificate"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Certificates
                              </button>
                            </>
                          )}
                          <PrintButton
                            type="button"
                            onPrint={() => handlePrintTokenSlip(appt)}
                            className="px-2 py-1 text-[11px] font-medium rounded-xl border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Re-print Token Slip" documentName="token slip" preview
                          >
              </PrintButton>
                          {appt.status === "completed" && (
                            <div className="w-7 h-7 rounded-xl bg-success/10 text-success-text dark:text-success-text border border-success/20 flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          {appt.status === "cancelled" && (
                            <div className="w-7 h-7 rounded-xl bg-danger/10 text-danger-text dark:text-danger-text border border-danger/20 flex items-center justify-center shrink-0">
                              <XCircle className="w-4 h-4" />
                            </div>
                          )}
                          {appt.status === "no-show" && (
                            <div className="w-7 h-7 rounded-xl bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20 flex items-center justify-center shrink-0">
                              <UserX className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          6. COMPLETE CONSULTATION & EHR DOCUMENTATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      {!reviewView && selectedLocation && selectedDoctor && !loadingQueue && appointments.length > 0 && (
        <details className={styles.flowChart}>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Hourly patient flow</summary>
        <ChartContainer
          title="Hourly patient flow"
          description="Distribution of patient tokens across operating hours"
          loading={loadingQueue}
          height="auto"
          className={styles.chartPanel}
        >
          <BarChart
            data={["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map(
              (hStr) => {
                const targetHour = parseInt(hStr.split(":")[0], 10);
                const apptsInHour = appointments.filter((a) => {
                  if (!a.appointmentTime) return false;
                  const d = new Date(a.appointmentTime);
                  return d.getHours() === targetHour;
                });
                const waiting = apptsInHour.filter((a) => a.status === "pending" || a.status === "checked-in").length;
                const consulted = apptsInHour.filter(
                  (a) => a.status === "in-consultation" || a.status === "completed"
                ).length;
                return { label: hStr, waiting, consulted };
              }
            )}
            series={[
              { key: "waiting", name: "Waiting in Line", color: "var(--chart-3)" },
              { key: "consulted", name: "Completed / Active", color: "var(--chart-2)" },
            ]}
            layout="stacked"
            height={200}
            valueFormatter={(v) => `${v} patients`}
          />
        </ChartContainer>
        </details>
      )}

      <Modal
        bodyClassName={styles.modalBody}
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete consultation"
        description={`${canonicalPatientName(apptToComplete?.patientId)} · Token #${apptToComplete?.tokenNumber}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => setCompleteModalOpen(false)}
              disabled={completingSubmitting}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              form="complete-consultation-form"
              type="submit"
              variant="primary"
              size="sm"
              loading={completingSubmitting}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Conclude Visit & Save Record
            </Button>
          </>
        }
      >
        <form id="complete-consultation-form" onSubmit={handleCompleteConsultation} className="space-y-4 pt-1 pr-1">
          {/* Patient Quick Context & Longitudinal EHR Timeline Launcher */}
          {apptToComplete && (
            <div className={styles.clinicalContext}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-600 text-brand-mist font-bold text-sm flex items-center justify-center shadow-xs">
                  {canonicalPatientName(apptToComplete.patientId)[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text">
                      {canonicalPatientName(apptToComplete.patientId)}
                    </span>
                    <Badge variant="primary" size="sm" className="font-mono">
                      Token #{apptToComplete.tokenNumber}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {apptToComplete.patientId?.gender || "Unknown Gender"} • {apptToComplete.patientId?.dob ? `DOB: ${new Date(apptToComplete.patientId.dob).toLocaleDateString()}` : "Age not specified"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => openInvestigationViewer(apptToComplete)}
                  className="font-bold text-xs rounded-xl border-accent/40 text-accent dark:text-accent hover:bg-primary/15 cursor-pointer shadow-xs shrink-0"
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1 text-accent" />
                  Lab reports
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const pId = typeof apptToComplete.patientId === "object" ? apptToComplete.patientId.id : apptToComplete.patientId;
                    const pName = canonicalPatientName(apptToComplete.patientId);
                    setTimelinePatient({ id: pId, name: pName });
                    setTimelineModalOpen(true);
                  }}
                  className="font-bold text-xs rounded-xl border-primary-500/40 text-accent dark:text-accent hover:bg-primary-500/15 cursor-pointer shadow-xs shrink-0"
                >
                  <History className="w-3.5 h-3.5 mr-1 text-accent" />
                  Patient history
                </Button>
              </div>
            </div>
          )}

          {/* 1-Click OPD Clinical Presets & Custom Combos Bar */}
          <details className={styles.clinicalPresets}><summary>Clinical presets<ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
          <OpdClinicalPresetBar
            onSelectPreset={(preset) => {
              setSymptoms(preset.symptoms);
              setDiagnosis(preset.diagnosis);
              if (preset.prescriptions && preset.prescriptions.length > 0) {
                setPrescriptions(
                  preset.prescriptions.map((p) => ({
                    name: p.name,
                    dosage: p.dosage || "1-0-1 (After Food)",
                    duration: p.duration || "5 days",
                  }))
                );
              }
              if (preset.followUpRecommended !== undefined) {
                setRecommendFollowUp(preset.followUpRecommended);
              }
              if (preset.followUpTimeline) {
                setFollowUpTimeline(preset.followUpTimeline);
              }
              if (preset.followUpNotes || preset.advice) {
                setFollowUpNotes(preset.followUpNotes || preset.advice || "");
              }
            }}
            currentSymptoms={symptoms}
            currentDiagnosis={diagnosis}
            currentPrescriptions={prescriptions}
            currentFollowUpRecommended={recommendFollowUp}
            currentFollowUpTimeline={followUpTimeline}
            currentFollowUpNotes={followUpNotes}
            locationId={selectedLocation}
          />
          </details>

          {/* Patient Clinical Context: Allergies & Triage Vitals Banner */}
          {apptToComplete && (apptToComplete.vitals || (apptToComplete.investigationResults && apptToComplete.investigationResults.length > 0)) && (
            <div className="p-3 rounded-2xl bg-surface-alt border border-border/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accent" />
                  Pre-Consultation Vitals & Triage Data
                </span>
                {apptToComplete.vitals?.recordedByName && (
                  <span className="text-[10px] text-text-muted">
                    Recorded by: <strong>{apptToComplete.vitals.recordedByName}</strong>
                  </span>
                )}
              </div>

              {/* Documented Allergies Alert */}
              {apptToComplete.vitals?.allergies && apptToComplete.vitals.allergies.length > 0 && (
                <div className="p-2 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-2 text-danger-text dark:text-danger-text text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger-text" />
                  <span>KNOWN DRUG / FOOD ALLERGIES: {apptToComplete.vitals.allergies.join(", ")}</span>
                </div>
              )}

              {/* Vitals Metric Pills */}
              {apptToComplete.vitals && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {apptToComplete.vitals.bpSystolic && apptToComplete.vitals.bpDiastolic && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      BP: <strong>{apptToComplete.vitals.bpSystolic}/{apptToComplete.vitals.bpDiastolic} mmHg</strong>
                    </span>
                  )}
                  {apptToComplete.vitals.pulse && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      Pulse: <strong>{apptToComplete.vitals.pulse} bpm</strong>
                    </span>
                  )}
                  {apptToComplete.vitals.spO2 && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      SpO₂: <strong>{apptToComplete.vitals.spO2}%</strong>
                    </span>
                  )}
                  {apptToComplete.vitals.temperature && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      Temp: <strong>{apptToComplete.vitals.temperature}°{apptToComplete.vitals.temperatureUnit || "F"}</strong>
                    </span>
                  )}
                  {apptToComplete.vitals.bmi && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      BMI: <strong>{apptToComplete.vitals.bmi.toFixed(1)}</strong>
                    </span>
                  )}
                  {apptToComplete.vitals.bloodSugar && (
                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text font-semibold">
                      Blood Sugar: <strong>{apptToComplete.vitals.bloodSugar} mg/dL</strong> ({apptToComplete.vitals.bloodSugarType || "random"})
                    </span>
                  )}
                </div>
              )}

              {/* Lab Investigation Findings */}
              {apptToComplete.investigationResults && apptToComplete.investigationResults.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-text-muted flex items-center gap-1">
                      <FlaskConical className="w-3 h-3 text-accent" />
                      Laboratory Diagnostic Findings
                    </span>
                    <button
                      type="button"
                      onClick={() => openInvestigationViewer(apptToComplete)}
                      className="text-[11px] font-bold text-accent hover:text-accent dark:text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-warning-text" />
                      View Full Reports & 1-Click Comparison
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {apptToComplete.investigationResults.map((inv, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-xs font-semibold border",
                          inv.isAbnormal
                            ? "bg-danger/10 border-danger/20 text-danger-text dark:text-danger-text font-bold"
                            : "bg-surface border-border/60 text-text"
                        )}
                      >
                        {inv.testName}: {inv.value} {inv.unit || ""} {inv.isAbnormal && "(ABNORMAL)"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clinical Record Documentation */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Clinical EHR Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Input
                label="Chief Complaints / Symptoms"
                placeholder="e.g. Fever, dry cough, body ache for 3 days"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
              <Input
                label="Primary Diagnosis"
                placeholder="e.g. Acute Upper Respiratory Infection"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Clinical Drug-Allergy Safety Intercept Component */}
            {apptToComplete && (
              <DrugAllergyAlert
                allergies={apptToComplete.vitals?.allergies || []}
                prescriptions={prescriptions}
              />
            )}

            {/* Prescriptions Dynamic Builder */}
            <div className="space-y-3 border-t border-border/60 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text">Prescribed Medications (Rx)</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPrescriptions([...prescriptions, { name: "", dosage: "", duration: "" }])}
                  className="rounded-lg font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Medicine
                </Button>
              </div>

              {/* Quick Add Common OPD Medicines */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-surface-alt border border-border/60">
                <span className="text-[11px] font-bold text-text-muted flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-warning-text" /> Quick Add:
                </span>
                {COMMON_OPD_MEDICINES.map((med, mIdx) => (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => {
                      if (prescriptions.length === 1 && !prescriptions[0].name.trim()) {
                        setPrescriptions([{ name: med.name, dosage: med.dosage, duration: med.duration }]);
                      } else {
                        setPrescriptions([...prescriptions, { name: med.name, dosage: med.dosage, duration: med.duration }]);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface hover:bg-primary-500/15 hover:text-accent dark:hover:text-accent border border-border/70 hover:border-primary-500/40 transition-all cursor-pointer shadow-2xs"
                  >
                    + {med.name}
                  </button>
                ))}
              </div>

              <div className={styles.medicineList}>
                {prescriptions.map((prescription, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-surface-alt/60 border border-border/70 space-y-1.5">
                    <div className={styles.medicineRow}>
                      <div className="flex-1">
                        <Input
                          label="Medicine Name"
                          placeholder="e.g. Paracetamol 650mg"
                          value={prescription.name}
                          onChange={(e) => {
                            const updated = [...prescriptions];
                            updated[idx].name = e.target.value;
                            setPrescriptions(updated);
                          }}
                        />
                      </div>
                      <div className="w-40">
                        <Input
                          label="Dosage"
                          placeholder="e.g. 1-0-1 (After Food)"
                          value={prescription.dosage}
                          onChange={(e) => {
                            const updated = [...prescriptions];
                            updated[idx].dosage = e.target.value;
                            setPrescriptions(updated);
                          }}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          label="Duration"
                          placeholder="e.g. 5 days"
                          value={prescription.duration}
                          onChange={(e) => {
                            const updated = [...prescriptions];
                            updated[idx].duration = e.target.value;
                            setPrescriptions(updated);
                          }}
                        />
                      </div>
                      {prescriptions.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          aria-label={`Remove medicine ${idx + 1}`}
                          className="mb-0.5 px-2.5 cursor-pointer"
                          onClick={() => {
                            setPrescriptions(prescriptions.filter((_, i) => i !== idx));
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Dosing & Duration Quick Selection Chips */}
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-text-muted pl-0.5">
                      <span className="font-semibold text-text-secondary">Dose:</span>
                      {["1-0-1 (After Food)", "1-0-0 (Morning)", "0-0-1 (Night)", "1-1-1", "SOS"].map((dose) => (
                        <button
                          key={dose}
                          type="button"
                          onClick={() => {
                            const updated = [...prescriptions];
                            updated[idx].dosage = dose;
                            setPrescriptions(updated);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded-md border text-[9px] font-medium transition-colors cursor-pointer",
                            prescription.dosage === dose
                              ? "bg-primary-500/20 border-primary-500/40 text-accent dark:text-accent font-bold"
                              : "bg-surface border-border/60 hover:bg-surface-hover text-text-secondary"
                          )}
                        >
                          {dose}
                        </button>
                      ))}
                      <span className="font-semibold text-text-secondary ml-2">Dur:</span>
                      {["3 days", "5 days", "7 days", "14 days", "1 month"].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => {
                            const updated = [...prescriptions];
                            updated[idx].duration = dur;
                            setPrescriptions(updated);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded-md border text-[9px] font-medium transition-colors cursor-pointer",
                            prescription.duration === dur
                              ? "bg-primary-500/20 border-primary-500/40 text-accent dark:text-accent font-bold"
                              : "bg-surface border-border/60 hover:bg-surface-hover text-text-secondary"
                          )}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-Time Drug-Drug Interaction & Duplicate Therapy Clinical Decision Support */}
          <DrugInteractionAlert
            prescriptions={prescriptions}
            onOverrideChange={setDdiAcknowledged}
          />

          {/* Digital e-Prescription WhatsApp Dispatch Channel */}
          <div className="p-3.5 bg-success/[0.04] rounded-2xl border border-success/20 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dispatchWhatsAppRx"
                  label="Send prescription by WhatsApp"
                  checked={dispatchWhatsAppRx}
                  onChange={(e) => setDispatchWhatsAppRx(e.target.checked)}
                />
                <Badge variant="success" size="sm" className="font-mono text-[9px]">
                  AUTOMATED
                </Badge>
              </div>
              <span className="text-[11px] text-text-muted hidden sm:inline">
                Includes medicine schedule & direct printable PDF link
              </span>
            </div>

            {dispatchWhatsAppRx && (
              <div className="pl-6 pt-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 animate-fade-in">
                <label className="text-xs text-text-secondary font-medium shrink-0">
                  Recipient WhatsApp Number:
                </label>
                <Input
                  value={recipientWhatsAppPhone}
                  onChange={(e) => setRecipientWhatsAppPhone(e.target.value)}
                  placeholder="e.g. 9876543210 (10 digits)"
                  className="w-full sm:w-64 text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-alt rounded-xl border border-border/80">
            <Checkbox
              id="recommendFollowUp"
              label="Recommend a care follow-up?"
              checked={recommendFollowUp}
              onChange={(e) => setRecommendFollowUp(e.target.checked)}
            />
          </div>

          {recommendFollowUp && (
            <div className="space-y-3.5 animate-fade-in p-3.5 rounded-2xl bg-warning/[0.04] border border-warning/20">
              <p className="text-sm text-text-muted">This records a recommendation and a staff task. Reception must arrange a booking with the patient; no confirmed appointment is created.</p>
              <Select
                label="Recommended Timeframe *"
                value={followUpTimeline}
                onChange={(e) => setFollowUpTimeline(e.target.value)}
                options={[
                  { value: "1 week", label: "Within 1 Week" },
                  { value: "2 weeks", label: "Within 2 Weeks" },
                  { value: "3 weeks", label: "Within 3 Weeks" },
                  { value: "1 month", label: "Within 1 Month" },
                  { value: "2 months", label: "Within 2 Months" },
                  { value: "3 months", label: "Within 3 Months" },
                ]}
                required
              />
              <Textarea
                label="Follow-Up Instructions"
                placeholder="e.g. Review blood glucose reports, suture inspection, adjust medication dosage..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

        </form>
      </Modal>

      {/* Doctor OPD Break Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isBreakModalOpen}
        onClose={() => !isTogglingBreak && setIsBreakModalOpen(false)}
        title="Take a break"
       footer={<>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBreakModalOpen(false)}
              disabled={isTogglingBreak}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleToggleDoctorBreak(true, breakReasonInput, breakMinutes)}
              loading={isTogglingBreak}
              className="font-bold bg-warning hover:bg-warning text-background min-h-[44px] w-full sm:w-auto justify-center"
            >
              Start Break ({breakMinutes}m)
            </Button>
          </>}>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-text-muted">
            This will pause queue calls and display a soothing informational notice on the <strong>Waiting Room TV</strong> so patients are informed of your expected return.
          </p>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Expected Break Duration</label>
            <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setBreakMinutes(mins)}
                  className={cn(
                    "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer min-h-[44px] flex items-center justify-center",
                    breakMinutes === mins
                      ? "border-warning bg-warning/15 text-warning-text dark:text-warning-text ring-2 ring-warning/20"
                      : "border-border hover:bg-surface-hover text-text-secondary"
                  )}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Reason / Intermission Note</label>
            <Select
              value={breakReasonInput}
              onChange={(e) => setBreakReasonInput(e.target.value)}
              options={[
                { value: "Tea / Short Refreshment", label: "☕ Tea / Short Refreshment" },
                { value: "Emergency Ward Round", label: "🚨 Emergency Ward Round" },
                { value: "Lunch Intermission", label: "🍽️ Lunch Intermission" },
                { value: "Case Review / Discussion", label: "📋 Case Review / Discussion" },
              ]}
            />
          </div>

          <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-[11px] text-warning-text dark:text-warning-text flex items-center gap-2">
            <span>ℹ️</span>
            <span>Patients in waiting lounge will be notified via TV chime and display banner.</span>
          </div>


        </div>
      </Modal>

      {/* Token Slip Printable Modal */}
      <UnifiedDocumentModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        document={unifiedDoc}
      />

      {/* Thermal POS Token Slip Modal (58mm / 80mm) */}
      <ThermalTokenSlipModal
        open={thermalSlipOpen}
        onClose={() => setThermalSlipOpen(false)}
        tokenData={thermalSlipData}
      />

      {/* Location QR Poster Modal (A4 / Standee) */}
      <LocationQrPosterModal
        open={qrPosterOpen}
        onClose={() => setQrPosterOpen(false)}
        location={qrPosterLocation}
      />

      {/* ABDM / ABHA Modal */}
      <AbdmRegistrationModal
        open={abdmModalOpen}
        onClose={() => setAbdmModalOpen(false)}
        locationId={selectedLocation}
        doctors={doctors.map((d) => ({ id: d.id || d._id, name: d.name }))}
        selectedDoctorId={selectedDoctor}
        onPatientCheckedIn={() => {
          fetchQueue();
          toast({
            title: "Check-In Complete",
            description: "ABHA patient registered and added to the queue.",
            variant: "success",
          });
        }}
      />

      {/* Clinical Document Generator Modal (Referral, Sick Leave, Fitness) */}
      <ClinicalDocumentGeneratorModal
        open={clinicalDocGenOpen}
        onClose={() => {
          setClinicalDocGenOpen(false);
          setSelectedDocGenPatient(null);
        }}
        locationName={locations.find((c) => (c.id || c._id) === selectedLocation)?.name || ""}
        locationAddress={locations.find((c) => (c.id || c._id) === selectedLocation)?.address}
        locationPhone={locations.find((c) => (c.id || c._id) === selectedLocation)?.phone}
        defaultDoctorName={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.name}
        defaultDoctorSpecialization={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.specialty}
        defaultDoctorRegistrationNumber={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.registrationNumber}
        defaultDoctorQualification={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.qualifications}
        patient={selectedDocGenPatient}
      />

      {/* Nurse Vitals Pre-Check Modal */}
      <NurseVitalsModal
        open={vitalsModalOpen}
        onClose={() => {
          setVitalsModalOpen(false);
          setSelectedVitalsAppt(null);
        }}
        appointmentId={selectedVitalsAppt?.id}
        patientId={selectedVitalsAppt?.patientId?.id || vitalsPatient?.id || ""}
        patientName={selectedVitalsAppt ? canonicalPatientName(selectedVitalsAppt.patientId) : vitalsPatient?.name || "Patient"}
        initialVitals={selectedVitalsAppt?.vitals}
        onSaved={fetchQueue}
      />

      {/* STAT Emergency Interruption Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={statModalOpen}
        onClose={() => {
          setStatModalOpen(false);
          setApptToStatEmergency(null);
          setEmergencyReason("");
        }}
        title="STAT priority"
        size="md"
       footer={<>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatModalOpen(false);
                setApptToStatEmergency(null);
                setEmergencyReason("");
              }}
              className="min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={Boolean(statEmergencyLoading)}
              onClick={handleTriggerStatEmergency}
              className="bg-danger hover:bg-danger text-background font-bold cursor-pointer min-h-[44px] w-full sm:w-auto justify-center"
            >
              🚨 Confirm STAT Priority
            </Button>
          </>}>
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-danger/10 border border-danger/30 rounded-xl text-xs space-y-1 text-danger-text dark:text-danger-text">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-danger-text dark:text-danger-text" />
              STAT Emergency Line Interruption
            </p>
            <p>
              This action interrupts the scheduled queue sequence for Token #{apptToStatEmergency?.tokenNumber} (
              {canonicalPatientName(apptToStatEmergency?.patientId)}), moving them to Position 0 (Stat Next) and sounding the waiting room emergency alert.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Emergency Triage Reason / Medical Indication</label>
            <Input
              placeholder="e.g. Acute chest pain, respiratory distress, severe trauma"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              required
            />
          </div>


        </div>
      </Modal>

      {/* Doctor Availability Override Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        title="Doctor availability"
        size="md"
        busy={savingOverride}
       footer={<>
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={() => setIsAvailabilityModalOpen(false)}
                disabled={savingOverride}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingOverride}
               form="queue-form-page-tsx-2">
                Save Availability
              </Button>
          </>}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveOverride();
          }}
          className="space-y-4 pt-1"
         id="queue-form-page-tsx-2">
          <p className="text-xs text-text-secondary leading-relaxed">
            Set today&apos;s actual working status. Setting a doctor as unavailable or ending early will protect waiting patients, notify un-arrived bookings, and flag checked-in patients for immediate reassignment.
          </p>

          {activeOverride && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-warning-text dark:text-warning-text">
                Active Override for {selectedDate}:
              </span>
              <p className="text-text-secondary">
                Status: <strong className="capitalize">{activeOverride.status}</strong>
                {activeOverride.effectiveStartTime && ` | Start: ${activeOverride.effectiveStartTime}`}
                {activeOverride.effectiveEndTime && ` | End: ${activeOverride.effectiveEndTime}`}
                {activeOverride.reason && ` | Reason: ${activeOverride.reason}`}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={handleRemoveOverride} disabled={savingOverride}>
                Revert to Standard
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Select
              label="Today's Availability Status *"
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value as any)}
              options={[
                { value: "available", label: "Standard Available" },
                { value: "unavailable", label: "Unavailable / Absent Today (Emergency, Sick)" },
                { value: "delayed", label: "Running Late (Shift Start Time)" },
                { value: "extended", label: "Leaving Early or Extending Hours" },
              ]}
              required
            />
          </div>

          {overrideStatus === "delayed" && (
            <div className="space-y-1.5">
              <DatePicker
                label="New Effective Start Time *"
                mode="time"
                value={overrideStartTime}
                onChange={(value) => setOverrideStartTime(value)}
                required
              />
            </div>
          )}

          {overrideStatus === "extended" && (
            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                label="Effective Start Time"
                mode="time"
                value={overrideStartTime}
                onChange={(value) => setOverrideStartTime(value)}
              />
              <DatePicker
                label="New Effective End Time *"
                mode="time"
                value={overrideEndTime}
                onChange={(value) => setOverrideEndTime(value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Input
              label="Reason (Optional)"
              placeholder="e.g. Attending emergency surgery, unwell, traffic delay"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>


        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. QUICK WALK-IN REGISTRATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <PatientEntryModal open={isQuickWalkInOpen && preferences.registration === "essential"} onClose={() => setIsQuickWalkInOpen(false)} locationId={selectedLocation}
        onBooked={() => { setIsQuickWalkInOpen(false); void fetchQueue(); }} />
      <Modal
        bodyClassName={styles.modalBody}
        isOpen={isQuickWalkInOpen && preferences.registration !== "essential"}
        onClose={() => setIsQuickWalkInOpen(false)}
        title="Add walk-in patient"
        size="md"
       footer={<>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickWalkInOpen(false)}
              disabled={submittingWalkIn}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submittingWalkIn}
              className={cn(
                "font-bold rounded-xl shadow-xs min-h-[44px] w-full sm:w-auto justify-center",
                walkInPriority === "emergency" ? "bg-danger hover:bg-danger text-background border-none" : "bg-success hover:bg-success text-background border-none"
              )}
             form="queue-form-page-tsx-3">
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Register & Queue Token
            </Button>
          </>}>
        <form onSubmit={handleQuickWalkInSubmit} className="space-y-4 text-xs" id="queue-form-page-tsx-3">
          <p className="text-text-muted leading-relaxed text-xs">
            Register an arriving patient and add them to the selected doctor's queue.
          </p>

          {/* Priority Segmented Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text block">Priority Triage *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWalkInPriority("normal")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  walkInPriority === "normal"
                    ? "bg-accent-subtle dark:bg-primary-950/40 border-primary-500 text-accent dark:text-accent shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Normal Walk-In
              </button>

              <button
                type="button"
                onClick={() => setWalkInPriority("emergency")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  walkInPriority === "emergency"
                    ? "bg-danger-subtle dark:bg-danger/40 border-danger text-danger-text dark:text-danger-text shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-danger-text" />
                Emergency Priority 🚨
              </button>
            </div>
            {walkInPriority === "emergency" && (
              <p className="text-[11px] text-danger-text dark:text-danger-text bg-danger/10 p-2.5 rounded-xl border border-danger/20 font-semibold leading-relaxed">
                🚨 Emergency Walk-In: Bypasses closing time queue cutoffs and flags appointment as Priority Triage for immediate doctor attention.
              </p>
            )}
          </div>

          {/* Doctor Selection */}
          <div className="space-y-1.5">
            <Select
              label="Assigned Doctor *"
              value={walkInDoctorId}
              onChange={(e) => setWalkInDoctorId(e.target.value)}
              options={doctors.map((d) => ({ value: d.id || d._id, label: `Dr. ${d.name}` }))}
              required
            />
          </div>

          {/* Patient Demographics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Patient Full Name *"
              placeholder="e.g. Rajesh Verma"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              required
            />

            <Input
              label="10-Digit Mobile Number *"
              placeholder="e.g. 9876543210"
              type="tel"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Select
                label="Gender (optional)"
                value={walkInGender}
                onChange={(e) => setWalkInGender(e.target.value as any)}
                options={[
                  { value: "", label: "Not recorded" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Chief Complaint / Notes (Optional)"
                placeholder="e.g. High fever, acute headache"
                value={walkInNotes}
                onChange={(e) => setWalkInNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}

        </form>
      </Modal>

      {/* Disruption Triage Reception Cockpit Modal */}
      <DisruptionTriageModal
        open={triageModalOpen}
        onClose={() => setTriageModalOpen(false)}
        locationId={selectedLocation}
        date={selectedDate}
        triageAppointments={triageAppointments}
        onActionComplete={async () => {
          await fetchTriageAppointments();
          await fetchQueue();
        }}
      />

      {/* Single Active Consultation Conflict Modal (Pillar 2 Guard) */}
      <Modal
        bodyClassName={styles.modalBody}
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Active visit in progress"
        size="sm"
       footer={<>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConflictModalOpen(false)}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Keep Current & Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCallNext(true)}
              loading={callingNext}
              className="font-bold bg-primary-600 hover:bg-primary-700 min-h-[44px] w-full sm:w-auto justify-center"
            >
              Complete & Call Next
            </Button>
          </>}>
        <div className="space-y-4 pt-1 font-sans text-xs">
          <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/25 text-warning-text dark:text-warning-text flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Consultation Active</p>
              <p className="mt-1 leading-relaxed">
                Dr. {conflictDoctorName} currently has an ongoing consultation with a patient in room.
                Platform safety rules mandate exactly one active consultation at a time.
              </p>
            </div>
          </div>

          <p className="text-text-secondary leading-relaxed">
            Would you like to auto-complete the previous consultation and summon the next waiting patient now?
           Save and sign required clinical notes first. This explicit close does not save or sign unsaved notes.</p>


        </div>
      </Modal>

      {/* Resend Live Tracker Modal (P3) */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isResendTrackerModalOpen}
        busy={resendingTracker}
        onClose={() => { if (!resendBusy.current) setIsResendTrackerModalOpen(false); }}
        title={`Resend Live Queue Tracker (Token #${resendTrackerAppt?.tokenNumber})`}
        size="sm"
       footer={<>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResendTrackerModalOpen(false)}
              disabled={resendingTracker}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResendTrackerSubmit}
              loading={resendingTracker}
              disabled={!resendPhone.trim() || resendingTracker}
              className="font-bold bg-success hover:bg-success text-background min-h-[44px] w-full sm:w-auto justify-center"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {resendLocked ? "Retry submitted tracker" : "Queue Live Tracker"}
            </Button>
          </>}>
        <div className="space-y-4 pt-1 font-sans text-xs">
          <div className="p-3.5 rounded-xl bg-success/10 border border-success/25 text-success-text dark:text-success-text flex items-start gap-2.5">
            <Send className="w-5 h-5 text-success-text shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Live Token Tracking Link</p>
              <p className="mt-0.5 leading-relaxed">
                Queues a link for the current authorized patient recipient after checking consent. Delivery is reported separately.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-text-secondary font-medium">Patient:</span>{" "}
            <strong className="text-text">
              {resendTrackerAppt?.patientId?.userId?.name ||
                (resendTrackerAppt?.patientId && typeof resendTrackerAppt.patientId === "object"
                  ? (resendTrackerAppt.patientId as any).name
                  : "Patient")}
            </strong>
            <span className="text-text-muted mx-2">&bull;</span>
            <span className="text-text-secondary font-medium">Token:</span>{" "}
            <strong className="text-text">#{resendTrackerAppt?.tokenNumber}</strong>
          </div>

          {resendError && <div ref={resendErrorRef} tabIndex={-1}><Alert variant="error">{resendError}</Alert></div>}
          <p>WhatsApp uses the current authorized recipient and purpose-specific consent.</p>

          <div className="space-y-1.5">
            <Input
              label="Recipient Mobile Phone"
              type="tel"
              placeholder="+919876543210"
              value={resendPhone}
              disabled={resendLocked || resendingTracker}
              onChange={(e) => setResendPhone(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-text-muted">
              Use the current patient recipient. Reception must review contact corrections before sending to a different number.
            </p>
          </div>


        </div>
      </Modal>

      {/* Park Patient in Standby Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isParkModalOpen}
        onClose={() => setIsParkModalOpen(false)}
        title={`Move Token #${parkingAppt?.tokenNumber} to Standby`}
        size="sm"
       footer={<>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsParkModalOpen(false)}
              className="font-semibold min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleParkPatient}
              loading={submittingPark}
              className="font-bold bg-warning hover:bg-warning text-background min-h-[44px] w-full sm:w-auto justify-center"
            >
              Hold in Standby
            </Button>
          </>}>
        <div className="space-y-4 pt-1 font-sans text-xs">
          <p className="text-text-secondary leading-relaxed">
            Move <strong>{canonicalPatientName(parkingAppt?.patientId)}</strong> to Standby. This will temporarily hold their token without blocking the queue. When they return, you can resume them directly as <strong>Next Up</strong>.
          </p>

          <div className="space-y-1.5">
            <label className="font-semibold text-text">Reason for Standby *</label>
            <Select
              value={parkReason}
              onChange={(e) => setParkReason(e.target.value)}
              options={[
                { value: "Stepped out for lab / diagnostic tests", label: "🧪 Stepped out for lab / diagnostic tests" },
                { value: "Did not respond to summon", label: "📢 Did not respond to summon" },
                { value: "Restroom / Cafeteria", label: "🚶 Stepped out (Restroom / Cafeteria)" },
                { value: "Billing / Pharmacy clearance", label: "💳 At billing or pharmacy" },
                { value: "Other / Personal delay", label: "⏳ Other temporary delay" },
              ]}
            />
          </div>


        </div>
      </Modal>

      {/* Lab Diagnostic Investigation Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isInvestigationModalOpen}
        onClose={() => setIsInvestigationModalOpen(false)}
        title={`Send Token #${investigationAppt?.tokenNumber} for Diagnostic Investigation`}
        size="md"
       footer={<>
            <Button variant="ghost" size="sm" onClick={() => setIsInvestigationModalOpen(false)} className="min-h-[44px] w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendToInvestigation}
              loading={isSubmittingInvestigation}
              className="hover:bg-primary font-bold min-h-[44px] w-full sm:w-auto justify-center"
            >
              <span>🔬</span> Send for Tests & Free Room
            </Button>
          </>}>
        <div className="space-y-4 p-1">
          <p className="text-xs text-text-muted leading-relaxed">
            This patient will be placed on <strong>Standby</strong> while lab tests/investigations are conducted. The consultation room will be freed immediately for the next patient. When they return with reports, click <strong>Resume for Report Review</strong> to call them Next Up without duplicate fees.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text">Select Diagnostic Lab Investigations</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LAB_TESTS.map((test) => {
                const isSelected = selectedLabTests.includes(test);
                return (
                  <button
                    key={test}
                    type="button"
                    onClick={() => toggleLabTest(test)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-xl font-medium border transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary text-brand-mist border-accent shadow-xs"
                        : "bg-surface-alt hover:bg-surface border-border text-text-secondary"
                    )}
                  >
                    {isSelected ? "✓ " : "+ "}{test}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">

            <Input type="text" placeholder="e.g. STAT Fasting sample, urgent lipid panel, fever workup" value={investigationNotes} onChange={(e) => setInvestigationNotes(e.target.value)} label="Additional Requisition Notes / Clinical Instructions" size="sm" />
          </div>


        </div>
      </Modal>

      {/* End OPD Reconciliation Modal */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isEndOpdModalOpen}
        onClose={() => setIsEndOpdModalOpen(false)}
        title="Close OPD session"
        size="lg"
       footer={!isLoadingEndOpdSummary && <>
                <Button variant="ghost" size="sm" onClick={() => setIsEndOpdModalOpen(false)} className="min-h-[44px] w-full sm:w-auto justify-center">
                  Keep OPD Open
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteEndOpdReconcile}
                  loading={isSubmittingEndOpd}
                  className="bg-danger hover:bg-danger text-background font-bold min-h-[44px] w-full sm:w-auto justify-center"
                >
                  <span>🛑</span> Confirm & Close OPD Shift
                </Button>
              </>}>
        <div className="space-y-5 p-1">
          {isLoadingEndOpdSummary ? (
            <div className="py-12 text-center space-y-2">
              <Spinner size="lg" className="mx-auto" />
              <p className="text-xs text-text-muted">Loading queue reconciliation summary...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-surface-alt border border-border text-center">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Completed</p>
                  <p className="text-xl font-black text-success-text">{endOpdSummary?.counts?.completed ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-alt border border-border text-center">
                  <p className="text-[10px] uppercase font-bold text-text-muted">In Consultation</p>
                  <p className="text-xl font-black text-accent">{endOpdSummary?.counts?.inConsultation ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-center">
                  <p className="text-[10px] uppercase font-bold text-warning-text dark:text-warning-text">Unresumed Standby</p>
                  <p className="text-xl font-black text-warning-text">{endOpdSummary?.counts?.standby ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-alt border border-border text-center">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Unserved Waiting</p>
                  <p className="text-xl font-black text-danger-text">{endOpdSummary?.counts?.waiting ?? 0}</p>
                </div>
              </div>

              {(endOpdSummary?.counts?.inConsultation ?? 0) > 0 && <p role="status" className="text-xs text-warning-text">Consultations still in progress will remain open for clinician review after closing this shift.</p>}

              {/* Standby Reconciliation Policy */}
              <div className="p-4 rounded-2xl border border-border bg-surface-alt space-y-2.5">
                <h4 className="text-xs font-bold text-text">
                  1. Standby Patients ({endOpdSummary?.counts?.standby ?? 0} stranded)
                </h4>
                <p className="text-[11px] text-text-muted">
                  Patients who stepped out need individual follow-up before their outcome is recorded.
                </p>
                <Select label="Standby outcome" value={standbyReconcileAction} onChange={event => setStandbyReconcileAction(event.target.value as "keep_unresolved" | "cancel")} options={[{ value: "keep_unresolved", label: "Keep unresolved for individual review" }, { value: "cancel", label: "Cancel appointments; review invoices separately" }]} />
              </div>

              {/* Waiting Reconciliation Policy */}
              <div className="p-4 rounded-2xl border border-border bg-surface-alt space-y-2.5">
                <h4 className="text-xs font-bold text-text">
                  2. Unserved Waiting Patients ({endOpdSummary?.counts?.waiting ?? 0} remaining)
                </h4>
                <p className="text-[11px] text-text-muted">
                  Registered patients who were not called before concluding consultations for today.
                </p>
                <Select label="Waiting outcome" value={waitingReconcileAction} onChange={event => setWaitingReconcileAction(event.target.value as "keep_unresolved" | "cancel")} options={[{ value: "keep_unresolved", label: "Keep unresolved for individual review" }, { value: "cancel", label: "Cancel appointments; review invoices separately" }]} />
              </div>


            </>
          )}
        </div>
      </Modal>

      {/* Dynamic BharatPe / NPCI UPI QR Counter-Top Payment Modal */}
      {selectedUpiAppt && (() => {
        const activeLocationObj = locations.find(
          (c) => c._id === selectedLocation || c.id === selectedLocation
        );
        const billing = getAppointmentBilling(selectedUpiAppt);

        return (
          <UpiPaymentModal
            open={isUpiModalOpen}
            onClose={() => {
              setIsUpiModalOpen(false);
              setSelectedUpiAppt(null);
            }}
            appointmentId={selectedUpiAppt.id}
            invoiceId={selectedUpiAppt.invoiceId}
            invoiceNumber={selectedUpiAppt.invoiceNumber}
            patientName={canonicalPatientName(selectedUpiAppt.patientId)}
            tokenNumber={selectedUpiAppt.tokenNumber}
            amount={billing.totalAmount}
            items={billing.items}
            doctorName={
              typeof selectedUpiAppt.doctorId === "object"
                ? selectedUpiAppt.doctorId?.userId?.name || selectedUpiAppt.doctorId?.name
                : undefined
            }
            locationName={activeLocationObj?.name || "Reception counter"}
            upiVpa={activeLocationObj?.upiVpa}
            merchantName={activeLocationObj?.merchantName}
            onPaymentSuccess={() => {
              fetchQueue();
            }}
          />
        );
      })()}

      {/* ──────────────────────────────────────────────────────────────────────────
          7. LONGITUDINAL PATIENT EHR TIMELINE & CLINICAL HISTORY MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        bodyClassName={styles.modalBody}
        open={timelineModalOpen}
        onClose={() => {
          setTimelineModalOpen(false);
          setTimelinePatient(null);
        }}
        title={timelinePatient ? `Patient history: ${timelinePatient.name}` : "Patient EHR History"}
        description="Visits, prescriptions, vitals and diagnostic reports."
        size="xl"
      >
        {timelinePatient && (
          <div className="pt-1">
            <PatientTimeline patientId={timelinePatient.id} />
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. IN-CABIN LAB INVESTIGATION REPORT VIEWER & 1-CLICK COMPARISON MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <InCabinInvestigationViewerModal
        open={isInvestigationViewerOpen}
        onClose={() => setIsInvestigationViewerOpen(false)}
        patientId={viewerPatientId}
        patientName={viewerPatientName}
        tokenNumber={viewerTokenNumber}
        appointmentId={viewerApptId}
        initialResults={viewerInitialResults}
        onRecalled={() => {
          setIsInvestigationViewerOpen(false);
          fetchQueue();
        }}
        onInsertIntoNote={(summary) => {
          setDiagnosis((prev) => (prev ? `${prev} | ${summary}` : summary));
        }}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          9. IN-CABIN 1-CLICK DIAGNOSTIC LAB REQUISITION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      {isLabOrderModalOpen && labOrderAppt && (
        <InCabinLabOrderModal
          open={isLabOrderModalOpen}
          onClose={() => {
            setIsLabOrderModalOpen(false);
            setLabOrderAppt(null);
          }}
          appointmentId={labOrderAppt.id}
          patientName={
            labOrderAppt.patientId?.userId?.name ||
            (labOrderAppt.patientId as any)?.name ||
            "Patient"
          }
          tokenNumber={labOrderAppt.tokenNumber}
          onSuccess={fetchQueue}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          10. 1-CLICK DIGITAL e-PRESCRIPTION RE-DISPATCH MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        bodyClassName={styles.modalBody}
        open={isResendRxModalOpen}
        onClose={() => {
          if (!resendingRx) {
            setIsResendRxModalOpen(false);
            setResendRxAppt(null);
          }
        }}
        title="Send prescription"
        description={
          resendRxAppt
            ? `Send official electronic prescription with medicines, dosage schedule, and direct printable PDF to ${
                resendRxAppt.patientId?.userId?.name || (resendRxAppt.patientId as any)?.name || "Patient"
              } (Token #${resendRxAppt.tokenNumber}).`
            : "Send official electronic prescription to patient."
        }
        size="md"
       footer={<>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsResendRxModalOpen(false);
                setResendRxAppt(null);
              }}
              disabled={resendingRx}
              className="font-semibold cursor-pointer min-h-[44px] w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResendRxSubmit}
              disabled={!resendRxReviewed}
              loading={resendingRx}
              className="bg-success hover:bg-success text-background font-bold flex items-center gap-1.5 cursor-pointer min-h-[44px] w-full sm:w-auto justify-center"
            >
              <Send className="w-3.5 h-3.5" />
              {resendRxLocked ? 'Retry submitted prescription message' : 'Queue reviewed prescription'}
            </Button>
          </>}>
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-2xl bg-success/10 border border-success/20 text-xs space-y-1">
            <div className="font-bold text-success-text dark:text-success-text flex items-center gap-1.5">
              <span>📄</span> Official Digital Rx WhatsApp Delivery
            </div>
            <p className="text-success-text/80 dark:text-success-text/80 text-[11px]">
              The existing prescription is queued for the reviewed patient recipient. Provider acceptance, delivery and read states are recorded separately.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Delivery Channel</label>
            <p className="text-sm">WhatsApp, subject to current recorded consent.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">
              Recipient Mobile Number ({resendRxChannel.toUpperCase()})
            </label>
            <Input
              disabled={resendRxLocked || resendingRx}
              value={resendRxPhone}
              onChange={(e) => setResendRxPhone(e.target.value)}
              placeholder="e.g. 9876543210 (10 digits)"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-text-muted mt-1">
              Leave blank to use the current organization contact. Correct changed contacts through the patient record before sending.
            </p>
          </div>

          <Checkbox disabled={resendRxLocked || resendingRx} checked={resendRxReviewed} onChange={event => setResendRxReviewed(event.target.checked)} label="I reviewed the selected patient and current prescription recipient." />

        </div>
      </Modal>
    </div>
  );
}
