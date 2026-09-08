"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Select,
  Input,
  DatePicker,
  useToast,
  Spinner,
  Badge,
  StatCard,
  Modal,
  Textarea,
  Checkbox,
  Skeleton,
  SkeletonCard,
  ChartContainer,
  BarChart,
  cn,
} from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "@/components/clinical/UnifiedDocumentModal";
import ThermalTokenSlipModal, { ThermalTokenSlipData } from "@/components/clinical/ThermalTokenSlipModal";
import ClinicQrPosterModal from "@/components/dashboard/ClinicQrPosterModal";
import { NurseVitalsModal } from "@/components/clinical/NurseVitalsModal";
import DisruptionTriageModal from "@/components/dashboard/DisruptionTriageModal";
import UpiPaymentModal from "@/components/billing/UpiPaymentModal";
import { AbdmRegistrationModal } from "@/components/clinical/AbdmRegistrationModal";
import { ClinicalDocumentGeneratorModal } from "@/components/clinical/ClinicalDocumentGeneratorModal";
import { playChimeSound, CHIME_OPTIONS, ChimeType, announcePatientToken, VoiceAnnounceLanguage } from "@/utils/audioChimes";
import {
  Megaphone,
  Volume2,
  RotateCw,
  Users,
  UserCheck,
  Stethoscope,
  Ticket,
  Clock,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Activity,
  Printer,
  UserX,
  XCircle,
  Plus,
  Trash2,
  Calendar,
  ArrowRight,
  Sparkles,
  Check,
  Play,
  CalendarClock,
  Phone,
  FileText,
  AlertTriangle,
  Zap,
  QrCode,
  Receipt,
  PauseCircle,
  Banknote,
  FlaskConical,
  History,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";
import { InCabinInvestigationViewerModal } from "@/components/clinical/InCabinInvestigationViewerModal";
import { DrugAllergyAlert } from "@/components/clinical/DrugAllergyAlert";
import { InCabinLabOrderModal } from "@/components/clinical/InCabinLabOrderModal";
import { OpdClinicalPresetBar } from "@/components/clinical/OpdClinicalPresetBar";
import { FollowUpRecallRegister } from "@/components/clinical/FollowUpRecallRegister";
import { DrugInteractionAlert, evaluateDrugInteractions } from "@/components/clinical/DrugInteractionAlert";

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
  clinicId: string;
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
  const { fetchClinics, activeClinicId } = useClinicStore();
  const { toast } = useToast();

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Token Slip Modal State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);
  const [callingNext, setCallingNext] = useState(false);

  // Thermal Slip & QR Poster State
  const [thermalSlipOpen, setThermalSlipOpen] = useState(false);
  const [thermalSlipData, setThermalSlipData] = useState<ThermalTokenSlipData | null>(null);
  const [qrPosterOpen, setQrPosterOpen] = useState(false);
  const [qrPosterClinic, setQrPosterClinic] = useState<any | null>(null);

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
  const [resendRxChannel, setResendRxChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [resendingRx, setResendingRx] = useState(false);

  const openResendRxModal = (appt: Appointment) => {
    setResendRxAppt(appt);
    const existingPhone =
      (appt.patientId && typeof appt.patientId === "object" ? (appt.patientId as any).phone : "") ||
      appt.patientId?.userId?.phone ||
      "";
    setResendRxPhone(existingPhone);
    setResendRxChannel("whatsapp");
    setIsResendRxModalOpen(true);
  };

  const handleResendRxSubmit = async () => {
    if (!resendRxAppt) return;
    try {
      setResendingRx(true);
      const res = await api.post(`/appointments/${resendRxAppt.id}/resend-rx`, {
        phone: resendRxPhone.trim() || undefined,
        channel: resendRxChannel,
      });
      toast({
        title: "Prescription Dispatched! 📄",
        description: res.data?.message || `Digital e-Prescription sent via ${resendRxChannel.toUpperCase()}`,
        variant: "success",
      });
      setIsResendRxModalOpen(false);
      setResendRxAppt(null);
    } catch (err: any) {
      toast({
        title: "Dispatch Failed",
        description: err.response?.data?.message || "Failed to dispatch digital prescription",
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
  const [standbyReconcileAction, setStandbyReconcileAction] = useState<"mark_no_show" | "cancel_refund">("mark_no_show");
  const [waitingReconcileAction, setWaitingReconcileAction] = useState<"cancel_refund" | "keep_unresolved">("cancel_refund");

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
  const [queueViewTab, setQueueViewTab] = useState<"active" | "standby" | "recalls">("active");
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceAnnounceLanguage>("en");
  const [parkingAppt, setParkingAppt] = useState<Appointment | null>(null);
  const [parkReason, setParkReason] = useState("Stepped out for lab / diagnostic tests");
  const [isParkModalOpen, setIsParkModalOpen] = useState(false);
  const [submittingPark, setSubmittingPark] = useState(false);
  const [resumingApptId, setResumingApptId] = useState<string | null>(null);

  // Resend Live Tracker State (P3)
  const [isResendTrackerModalOpen, setIsResendTrackerModalOpen] = useState(false);
  const [resendTrackerAppt, setResendTrackerAppt] = useState<Appointment | null>(null);
  const [resendPhone, setResendPhone] = useState("");
  const [resendChannel, setResendChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [resendingTracker, setResendingTracker] = useState(false);

  // Proactive Queue Delay State
  const [delayStatus, setDelayStatus] = useState<{ isDelayed: boolean; maxDelayMinutes: number; affectedCount: number; delayedPatients: any[] } | null>(null);
  const [sendingDelayAlerts, setSendingDelayAlerts] = useState(false);

  // Quick Walk-In Modal State
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInDoctorId, setWalkInDoctorId] = useState("");
  const [walkInPriority, setWalkInPriority] = useState<"normal" | "emergency">("normal");
  const [walkInGender, setWalkInGender] = useState<"male" | "female" | "other">("male");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Filter States
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedClinic, setSelectedClinic] = useState(activeClinicId || "");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  useEffect(() => {
    setSelectedClinic(activeClinicId || "");
  }, [activeClinicId]);

  // Queue State
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Load initial dropdown values based on user role
  useEffect(() => {
    const initFilters = async () => {
      try {
        setLoadingFilters(true);
        if (user?.role === "doctor") {
          let uniqueClinics: any[] = [];
          try {
            const res = await api.get(`/onboarding/doctors/assignments?doctorId=${user.id}`);
            const assignments = res.data?.data || [];
            uniqueClinics = assignments
              .map((a: any) => a.clinicId)
              .filter(Boolean)
              .filter((c: any, idx: number, arr: any[]) => arr.findIndex((t) => (t.id || t._id) === (c.id || c._id)) === idx);
          } catch {
            const loadedClinics = await fetchClinics();
            uniqueClinics = loadedClinics;
          }

          setClinics(uniqueClinics);
          setDoctors([{ id: user.id, name: user.name }]);
          setSelectedDoctor(user.id);
          if (uniqueClinics.length > 0) {
            setSelectedClinic(uniqueClinics[0].id || uniqueClinics[0]._id);
          }
        } else {
          const [loadedClinics, staffRes] = await Promise.all([
            fetchClinics(),
            api.get("/onboarding/staff").catch(() => ({ data: { data: { doctors: [] } } })),
          ]);
          const loadedDoctors = Array.isArray(staffRes.data?.data?.doctors)
            ? staffRes.data.data.doctors
            : Array.isArray(staffRes.data?.data)
            ? staffRes.data.data
            : [];

          setClinics(loadedClinics);
          setDoctors(loadedDoctors);

          if (loadedClinics.length > 0) {
            setSelectedClinic(loadedClinics[0].id);
          }
          if (loadedDoctors.length > 0) {
            setSelectedDoctor(loadedDoctors[0].id || loadedDoctors[0]._id);
          }
        }
      } catch (err) {
        console.error("initFilters error:", err);
      } finally {
        setLoadingFilters(false);
      }
    };

    if (user) initFilters();
  }, [user]);

  const fetchActiveOverride = async () => {
    if (!selectedClinic || !selectedDoctor || !selectedDate) return;
    try {
      const res = await api.get(`/doctor-overrides?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`);
      const overrides = res.data?.data || [];
      setActiveOverride(overrides.length > 0 ? overrides[0] : null);
    } catch {
      setActiveOverride(null);
    }
  };

  // Fetch triage appointments
  const fetchTriageAppointments = async () => {
    if (!selectedClinic) {
      setTriageAppointments([]);
      return;
    }
    try {
      setLoadingTriage(true);
      const res = await api.get(`/doctor-overrides/triage?clinicId=${selectedClinic}&date=${selectedDate}`);
      setTriageAppointments(res.data?.data || []);
    } catch (err) {
      console.error("fetchTriageAppointments error:", err);
    } finally {
      setLoadingTriage(false);
    }
  };

  // Fetch queue delay status
  const fetchDelayStatus = async () => {
    if (!selectedClinic || !selectedDoctor) {
      setDelayStatus(null);
      return;
    }
    try {
      const res = await api.get(`/queue/delay-status?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`);
      setDelayStatus(res.data?.data || null);
    } catch {
      setDelayStatus(null);
    }
  };

  // Fetch queue when filters change
  const fetchQueue = async () => {
    if (!selectedClinic || !selectedDoctor) {
      setAppointments([]);
      return;
    }
    try {
      setLoadingQueue(true);
      const [resQueue, resStatus] = await Promise.all([
        api.get(`/queue?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`),
        api.get(`/queue/status?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`).catch(() => ({ data: { data: null } })),
      ]);
      setAppointments(resQueue.data.data || []);
      setQueueStatusData(resStatus.data?.data || null);
      await Promise.all([fetchActiveOverride(), fetchTriageAppointments(), fetchDelayStatus()]);
    } catch (err: any) {
      toast({
        title: "Error Loading Queue",
        description: err.response?.data?.message || "Failed to load active queue records.",
        variant: "error",
      });
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedClinic || !selectedDoctor || !selectedDate) return;
    try {
      setSavingOverride(true);
      await api.post("/doctor-overrides", {
        clinicId: selectedClinic,
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
    setResendTrackerAppt(appt);
    const existingPhone =
      (appt.patientId && typeof appt.patientId === "object" ? (appt.patientId as any).phone : "") ||
      appt.patientId?.userId?.phone ||
      "";
    setResendPhone(existingPhone);
    setResendChannel("whatsapp");
    setIsResendTrackerModalOpen(true);
  };

  const handleResendTrackerSubmit = async () => {
    if (!resendTrackerAppt) return;
    try {
      setResendingTracker(true);
      const res = await api.post(`/queue/${resendTrackerAppt.id}/resend-tracker`, {
        phone: resendPhone.trim() || undefined,
        channel: resendChannel,
      });

      toast({
        title: "Tracker Dispatched! 🚀",
        description: res.data?.message || `Live tracking link successfully sent via ${resendChannel.toUpperCase()}`,
        variant: "success",
      });
      setIsResendTrackerModalOpen(false);
      setResendTrackerAppt(null);
    } catch (err: any) {
      toast({
        title: "Dispatch Failed",
        description: err.response?.data?.message || "Failed to dispatch queue tracking link",
        variant: "error",
      });
    } finally {
      setResendingTracker(false);
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
    if (!selectedClinic || !selectedDoctor) return;
    try {
      setSendingDelayAlerts(true);
      const res = await api.post("/queue/trigger-delay-alerts", {
        clinicId: selectedClinic,
        doctorId: selectedDoctor,
        date: selectedDate,
        delayThresholdMinutes: 20,
      });
      const count = res.data?.data?.notifiedCount ?? 0;
      toast({
        title: "WhatsApp Delay Alerts Sent",
        description: `Dispatched proactive delay notifications with revised arrival times to ${count} patient(s).`,
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
    if (!selectedClinic || !selectedDoctor) return;
    setIsStartingOpd(true);
    try {
      await api.post("/queue/session/start", {
        clinicId: selectedClinic,
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
    if (!selectedClinic || !selectedDoctor) return;
    try {
      setIsTogglingBreak(true);
      const res = await api.post("/queue/session/break", {
        clinicId: selectedClinic,
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
    if (!selectedClinic || !selectedDoctor) return;
    setIsEndOpdModalOpen(true);
    setIsLoadingEndOpdSummary(true);
    try {
      const res = await api.get(`/queue/session/summary?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`);
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
    if (!selectedClinic || !selectedDoctor) return;
    setIsSubmittingEndOpd(true);
    try {
      const res = await api.post("/queue/session/end", {
        clinicId: selectedClinic,
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
      await api.post(`/queue/${investigationAppt.id}/send-investigation`, {
        notes: investigationNotes,
        testNames: selectedLabTests.length > 0 ? selectedLabTests : undefined,
      });
      toast({
        title: "Patient Sent for Diagnostic Tests 🔬",
        description: `Token #${investigationAppt.tokenNumber} placed on Standby. Requisition sent to in-clinic laboratory.`,
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
    fetchQueue();
    fetchTriageAppointments();

    const interval = setInterval(() => {
      if (selectedClinic && selectedDoctor) {
        api
          .get(`/queue?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`)
          .then((res) => setAppointments(res.data.data || []))
          .catch(() => {});
        fetchTriageAppointments();
      }
    }, 15000);

    // Real-time WebSocket connection to Clinic OPD Queue
    let ws: WebSocket | null = null;
    if (typeof window !== "undefined" && selectedClinic) {
      try {
        const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const wsHost = apiUrl.replace(/^https?:\/\//, "").replace(/\/api\/?$/, "");
        ws = new WebSocket(`${wsProto}//${wsHost}/api/queue/ws?clinicId=${selectedClinic}`);

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "DISRUPTION_TRIAGE_REQUIRED") {
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
          } catch (err) {
            console.error("[Queue WS Message Error]", err);
          }
        };
      } catch (err) {
        console.warn("[Queue WS Connection Error]", err);
      }
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [selectedClinic, selectedDoctor, selectedDate]);

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
    nextInLine: activeQueue.find((a) => ["checked-in", "confirmed", "pending"].includes(a.status))?.tokenNumber || null,
  };

  const [chimeType, setChimeType] = useState<ChimeType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ananta_queue_chime_sound") as ChimeType) || "bell";
    }
    return "bell";
  });

  const handleChimeChange = (newType: ChimeType) => {
    setChimeType(newType);
    if (typeof window !== "undefined") {
      localStorage.setItem("ananta_queue_chime_sound", newType);
    }
    playChimeSound(newType);
  };

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

  const handleCallNext = async (completePrevious = false) => {
    try {
      setCallingNext(true);
      const res = await api.post("/queue/call-next", {
        clinicId: selectedClinic,
        doctorId: selectedDoctor,
        completePrevious,
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
      if (err.response?.status === 409 && err.response?.data?.error === "ACTIVE_CONSULTATION_IN_PROGRESS") {
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
      const clinicObj = clinics.find((c) => (c.id || c._id) === selectedClinic);
      const doctorObj = doctors.find((d) => (d.id || d._id) === selectedDoctor);

      setUnifiedDoc({
        documentType: "token_slip",
        title: `TOKEN SLIP #${appt.tokenNumber}`,
        clinicName: clinicObj?.name || "Healthcare Center",
        clinicAddress: clinicObj?.city,
        doctorName: doctorObj?.name || user?.name || "Doctor",
        doctorSpecialization: doctorObj?.specialization,
        patientName: appt.patientId?.userId?.name || "Patient",
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
    const clinicObj = clinics.find((c) => (c.id || c._id) === selectedClinic);
    const doctorObj = doctors.find((d) => (d.id || d._id) === selectedDoctor || (d.id || d._id) === appt.doctorId);
    const apptIdx = activeQueue.findIndex((a) => a.id === appt.id);
    const ahead = apptIdx >= 0 ? apptIdx : 0;

    setThermalSlipData({
      appointmentId: appt.id,
      tokenNumber: appt.tokenNumber,
      clinicName: clinicObj?.name || "Healthcare Clinic",
      clinicAddress: typeof clinicObj?.address === "string" ? clinicObj.address : clinicObj?.city || "",
      clinicPhone: clinicObj?.phone || "",
      doctorName: doctorObj?.name || user?.name || "Doctor",
      doctorSpecialization: doctorObj?.specialization || "OPD Consultation",
      patientName: appt.patientId?.userId?.name || "Patient",
      appointmentTime: new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      patientsAhead: ahead,
      date: new Date(appt.appointmentTime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    });
    setThermalSlipOpen(true);
  };

  const openQuickWalkInModal = () => {
    setWalkInName("");
    setWalkInPhone("");
    setWalkInDoctorId(selectedDoctor || (doctors[0]?.id || doctors[0]?._id || ""));
    setWalkInPriority("normal");
    setWalkInGender("male");
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
    if (!targetDoc || !selectedClinic) {
      toast({ title: "Validation Error", description: "Clinic and doctor must be selected", variant: "error" });
      return;
    }

    setSubmittingWalkIn(true);
    try {
      const isEmergency = walkInPriority === "emergency";
      const payload: any = {
        clinicId: selectedClinic,
        doctorId: targetDoc,
        appointmentTime: new Date().toISOString(),
        appointmentType: "walk-in",
        patientDetails: {
          name: walkInName.trim(),
          phone: cleanPhone,
          gender: walkInGender,
          dob: "2000-01-01",
        },
        forceBooking: isEmergency,
        notes: isEmergency
          ? `[EMERGENCY WALK-IN] Priority Triage${walkInNotes.trim() ? ` - ${walkInNotes.trim()}` : ""}`
          : (walkInNotes.trim() || "Front-desk walk-in"),
      };

      const res = await api.post("/appointments", payload);
      const newAppt = res.data?.data;
      const assignedToken = newAppt?.tokenNumber;

      // Immediately set status to checked-in for physical walk-in arrival
      if (newAppt?.id || newAppt?._id) {
        try {
          await api.put(`/appointments/${newAppt.id || newAppt._id}/status`, { status: "checked-in" });
        } catch {
          // Non-blocking
        }
      }

      toast({
        title: isEmergency ? "Emergency Walk-In Queued 🚨" : "Walk-In Registered ✓",
        description: `Token #${assignedToken} assigned to ${walkInName}. Patient added to live queue.`,
        variant: "success",
      });

      setIsQuickWalkInOpen(false);
      await fetchQueue();

      // Offer immediate Thermal Token Slip
      const clinicObj = clinics.find((c) => (c.id || c._id) === selectedClinic);
      const doctorObj = doctors.find((d) => (d.id || d._id) === targetDoc);

      setThermalSlipData({
        appointmentId: newAppt?.id || newAppt?._id || "",
        tokenNumber: assignedToken,
        clinicName: clinicObj?.name || "Healthcare Clinic",
        clinicAddress: typeof clinicObj?.address === "string" ? clinicObj.address : clinicObj?.city || "",
        clinicPhone: clinicObj?.phone || "",
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
        description: err.response?.data?.message || "Could not register walk-in patient.",
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
      const activeClinicObj = clinics.find((c) => (c.id || c._id) === selectedClinic);
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
        clinicName: activeClinicObj?.name || "Medical Clinic",
        clinicAddress: [activeClinicObj?.address, activeClinicObj?.city].filter(Boolean).join(", "),
        clinicPhone: activeClinicObj?.phone || activeClinicObj?.contactNumber,
        clinicEmail: activeClinicObj?.email,
        doctorName: doctorData?.userId?.name || doctorData?.name || user?.name || "Attending Physician",
        doctorSpecialization: doctorData?.specialization || "General Medicine",
        doctorRegistrationNumber: doctorData?.registrationNumber || "MCI/NMC-REG-PENDING",
        doctorQualification: doctorData?.qualifications || "MBBS",
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
    const activeClinicObj = clinics.find((c) => (c.id || c._id) === (appt.clinicId as any)?.id || (c.id || c._id) === (appt.clinicId as any) || (c.id || c._id) === selectedClinic);
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
      clinicName: activeClinicObj?.name || "Medical Clinic",
      clinicAddress: [activeClinicObj?.address, activeClinicObj?.city].filter(Boolean).join(", "),
      clinicPhone: activeClinicObj?.phone || activeClinicObj?.contactNumber,
      clinicEmail: activeClinicObj?.email,
      doctorName: doctorData?.userId?.name || doctorData?.name || user?.name || "Attending Physician",
      doctorSpecialization: doctorData?.specialization || "General Medicine",
      doctorRegistrationNumber: doctorData?.registrationNumber || "MCI/NMC-REG-PENDING",
      doctorQualification: doctorData?.qualifications || "MBBS",
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
    const activeClinicObj = clinics.find((c) => c.id === (appt.clinicId as any)?.id || c.id === selectedClinic);
    const patientName = appt.patientId?.userId?.name || (appt.patientId as any)?.name || "Patient";
    const tokenDoc: UnifiedDocumentData = {
      documentType: "token_slip",
      title: "OPD Queue Token Slip",
      clinicName: activeClinicObj?.name || "Medical Clinic",
      clinicAddress: [activeClinicObj?.address, activeClinicObj?.city].filter(Boolean).join(", "),
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
        clinicId: selectedClinic,
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

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Outpatient Queue Desk
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Live Stream
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Live token streaming, patient check-ins, VIP queue reordering, and consultation workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Chime selector pill */}
            <div className="flex items-center gap-1.5 bg-surface-alt p-1 rounded-xl border border-border/80">
              <Select
                size="sm"
                value={chimeType}
                onChange={(e) => handleChimeChange(e.target.value as ChimeType)}
                options={CHIME_OPTIONS.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))}
                className="w-44 text-xs font-semibold"
              />
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => playChimeSound(chimeType)}
                className="text-xs font-semibold rounded-lg px-2 text-text-secondary hover:text-text"
                title="Test Chime Sound"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchActiveOverride();
                setIsAvailabilityModalOpen(true);
              }}
              className="font-semibold rounded-xl border-border/80 hover:bg-surface-hover text-text"
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Doctor Availability
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const currentClinic = clinics.find((c) => (c.id || c._id) === selectedClinic);
                setQrPosterClinic(currentClinic || { id: selectedClinic, name: "Our Clinic" });
                setQrPosterOpen(true);
              }}
              className="font-semibold rounded-xl border-border/80 hover:bg-surface-hover text-text"
              title="Print A4 QR poster for clinic waiting room entrance"
            >
              <QrCode className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Clinic QR Poster
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAbdmModalOpen(true)}
              className="font-bold rounded-xl border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:text-blue-400"
              title="Ayushman Bharat Digital Mission (ABHA) & 3-Second Counter Scan & Share"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
              ABHA / ABDM (3s)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDocGenPatient(null);
                setClinicalDocGenOpen(true);
              }}
              className="font-semibold rounded-xl border-border/80 hover:bg-surface-hover text-text"
              title="Generate Hospital Referral Letter, Medical Sick Leave, or Fitness Certificate"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Certificates & Referral
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={openQuickWalkInModal}
              className="font-bold rounded-xl shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Quick Walk-In (+)
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCallNext(false)}
              loading={callingNext}
              className="font-semibold rounded-xl shadow-xs"
            >
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              Call Next Patient
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchQueue}
              loading={loadingQueue}
              className="font-semibold rounded-xl hover:bg-surface-hover"
            >
              <RotateCw className={cn("w-3.5 h-3.5 mr-1.5 text-text-secondary", loadingQueue && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. FILTER STRIP
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs">
        {loadingFilters ? (
          <div className="flex items-center gap-3 w-full">
            <Skeleton height="2.25rem" rounded="lg" className="flex-1" />
            <Skeleton height="2.25rem" rounded="lg" className="flex-1" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 w-full">
            {doctors.length > 1 && user.role !== "doctor" && (
              <div className="flex-1 min-w-[160px] sm:max-w-xs">
                <Select
                  size="sm"
                  placeholder="Select Doctor"
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  options={doctors.map((d) => ({
                    value: d.id,
                    label: `Dr. ${(d.name || "").replace(/^dr\.?\s+/i, "")}`,
                  }))}
                />
              </div>
            )}
            <div className="flex-1 min-w-[150px] sm:max-w-[180px]">
              <DatePicker
                size="sm"
                variant="outline"
                placeholder="Select Date"
                value={selectedDate}
                onChange={(val) => setSelectedDate(typeof val === "string" ? val : val.target.value)}
              />
            </div>

            {/* Doctor OPD Session Controls */}
            {selectedClinic && selectedDoctor && (
              <div className="ml-auto flex items-center gap-2">
                {queueStatusData?.opdSession?.status === "active" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {queueStatusData.opdSession.isOnBreak ? (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        ☕ On Break: {queueStatusData.opdSession.breakReason || "Intermission"}
                        <span className="font-normal text-[11px] opacity-85">
                          (~{queueStatusData.opdSession.breakExpectedMinutes || 15}m)
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        OPD In Progress
                        {queueStatusData.opdSession.startedAt && (
                          <span className="font-normal text-[11px] opacity-85">
                            (since {new Date(queueStatusData.opdSession.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                          </span>
                        )}
                      </div>
                    )}
                    {canManageQueue && (
                      <>
                        {queueStatusData.opdSession.isOnBreak ? (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleToggleDoctorBreak(false)}
                            loading={isTogglingBreak}
                            className="font-bold text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <span>▶</span> Resume OPD
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setIsBreakModalOpen(true)}
                            loading={isTogglingBreak}
                            className="font-bold text-xs rounded-xl border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                          >
                            <span>☕</span> Take Break
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={handleOpenEndOpdModal}
                          className="font-bold text-xs rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                        >
                          <span>🛑</span> End OPD & Reconcile
                        </Button>
                      </>
                    )}
                  </div>
                ) : queueStatusData?.opdSession?.status === "ended" ? (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 text-xs font-bold flex items-center gap-1.5">
                      <span>🏁</span> OPD Ended for Today
                    </div>
                    {canManageQueue && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={handleStartOpdSession}
                        loading={isStartingOpd}
                        className="font-bold text-xs rounded-xl text-primary-600 border-primary-500/30 hover:bg-primary-500/10"
                      >
                        Re-open Session
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
                      <span>⏳</span> OPD Not Started
                    </div>
                    {canManageQueue && (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={handleStartOpdSession}
                        loading={isStartingOpd}
                        className="font-bold text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <span>🟢</span> Start OPD Session
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          2B. ACTIVE OVERRIDES & AT-RISK PATIENT BANNERS
         ────────────────────────────────────────────────────────────────────────── */}
      {activeOverride && (
        <div className={cn(
          "p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-sm font-medium",
          activeOverride.status === "unavailable" ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300" :
          activeOverride.status === "delayed" ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" :
          "bg-primary/10 border-primary/30 text-primary"
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
          >
            Revert to Normal Schedule
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          URGENT DISRUPTION TRIAGE ALERT BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      {triageAppointments.length > 0 && (
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-rose-500/15 border-2 border-rose-500/40 shadow-sm animate-fade-in text-rose-950 dark:text-rose-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-rose-900 dark:text-rose-100">
                    Doctor Disruption Triage Active — {triageAppointments.length} Patient{triageAppointments.length === 1 ? "" : "s"} Stranded
                  </h3>
                  <Badge variant="danger" size="sm" dot pulse className="font-bold text-[10px]">
                    Urgent Action Required
                  </Badge>
                </div>
                <p className="text-xs text-rose-800/90 dark:text-rose-200/90 max-w-2xl leading-relaxed">
                  A physician schedule disruption was processed today. {triageAppointments.filter((a) => a.status === "checked-in" || a.notes?.includes("checked-in")).length} waiting patient(s) need immediate transfer to an available colleague to avoid clinical abandonment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setTriageModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
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
            <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
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
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
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
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 text-xs shadow-xs"
          >
            <Phone className="w-3.5 h-3.5 mr-1" />
            Send WhatsApp Delay Alerts ({delayStatus.affectedCount})
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. STATS OVERVIEW
         ────────────────────────────────────────────────────────────────────────── */}
      {selectedClinic && selectedDoctor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Waiting"
            value={stats.waiting.toString()}
            description="Patients in queue line"
            icon={<Users className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Checked-In"
            value={stats.checkedIn.toString()}
            description="Present at waiting area"
            icon={<UserCheck className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="In Consultation"
            value={stats.activeConsultation.toString()}
            description="Currently with physician"
            icon={<Stethoscope className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Next Token"
            value={stats.nextInLine ? `#${stats.nextInLine}` : "None"}
            description="Next summoned patient"
            icon={<Ticket className="w-5 h-5 text-text-secondary" />}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. HOURLY TRAFFIC & BOTTLENECK CHART
         ────────────────────────────────────────────────────────────────────────── */}
      {selectedClinic && selectedDoctor && !loadingQueue && appointments.length > 0 && (
        <ChartContainer
          title="Hourly Patient Flow & Rush Distribution"
          description="Distribution of patient tokens across operating hours"
          loading={loadingQueue}
          height={200}
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
              { key: "waiting", name: "Waiting in Line", color: "var(--s-chart-3, #f59e0b)" },
              { key: "consulted", name: "Completed / Active", color: "var(--s-chart-2, #10b981)" },
            ]}
            layout="stacked"
            height={200}
            valueFormatter={(v) => `${v} patients`}
          />
        </ChartContainer>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          5. MAIN QUEUE WORKSPACE (ACTIVE LIST + SERVED SIDEBAR)
         ────────────────────────────────────────────────────────────────────────── */}
      {!selectedClinic || !selectedDoctor ? (
        <Card className="text-center py-16 rounded-2xl border border-border/80 bg-surface">
          <CardContent className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center text-text-secondary">
              <Stethoscope className="w-6 h-6 text-primary-500" />
            </div>
            <h3 className="text-base font-bold text-text">Select Clinic and Doctor</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Please choose a facility location and physician from the filters above to access the live queue.
            </p>
          </CardContent>
        </Card>
      ) : loadingQueue ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div>
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Columns: Active Queue Waitlist */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/70 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setQueueViewTab("active")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    queueViewTab === "active"
                      ? "bg-surface text-text shadow-xs border border-border/60"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Active Queue ({activeQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueViewTab("standby")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    queueViewTab === "standby"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-amber-600 dark:text-amber-400 hover:text-amber-700"
                  )}
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  Parked / Standby ({standbyQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueViewTab("recalls")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    queueViewTab === "recalls"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                  )}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  Follow-Up Recalls
                </button>
              </div>

              {/* Doorway Voice Calling Bell Language Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/70 text-xs">
                <Volume2 className="w-3.5 h-3.5 text-primary-500 ml-1.5 shrink-0" />
                <span className="text-[11px] font-bold text-text-muted hidden sm:inline">Voice Announcer:</span>
                {(["off", "en", "hi", "both"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setVoiceLanguage(lang);
                      if (lang !== "off") {
                        playChimeSound("beep");
                        toast({
                          title: `Voice Announcer: ${lang.toUpperCase()}`,
                          description: `Calling bell set to ${lang === "both" ? "Dual (English + Hindi)" : lang === "hi" ? "Hindi" : "English"}.`,
                          variant: "default",
                        });
                      }
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer",
                      voiceLanguage === lang
                        ? "bg-primary-600 text-white shadow-2xs"
                        : "text-text-muted hover:text-text hover:bg-surface"
                    )}
                    title={`Doorway Calling Bell: ${lang.toUpperCase()}`}
                  >
                    {lang === "both" ? "Dual" : lang}
                  </button>
                ))}
              </div>
            </div>

            {/* View Tab 1: Active Queue */}
            {queueViewTab === "active" && (
              <>
                {activeQueue.length === 0 ? (
                  <Card className="py-14 text-center text-text-muted rounded-2xl border border-border/80 bg-surface">
                    <CardContent className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-emerald-500">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-text text-sm">No Active Patients in Queue</p>
                      <p className="text-xs text-text-muted">All appointments for this shift have been processed or checked out.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activeQueue.map((appt, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === activeQueue.length - 1;
                      const isInConsultation = appt.status === "in-consultation";
                      const isCheckedIn = appt.status === "checked-in";
                      const isEmergency = Boolean(appt.isEmergency || appt.queuePosition === 0);
                      const criticalVitalsAlert = getCriticalVitalsAlert(appt.vitals);
                      const hasCriticalVitals = Boolean(criticalVitalsAlert && criticalVitalsAlert.length > 0);

                      return (
                        <Card
                          key={appt.id}
                          className={cn(
                            "rounded-2xl border transition-all shadow-xs overflow-hidden",
                            isEmergency
                              ? "border-red-500 bg-red-500/[0.04] dark:bg-red-500/[0.08] ring-1 ring-red-500/40"
                              : hasCriticalVitals
                              ? "border-red-500/80 bg-red-500/[0.03] dark:bg-red-500/[0.06] ring-1 ring-red-500/30"
                              : isInConsultation
                              ? "border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06]"
                              : isCheckedIn
                              ? "border-primary-500/30 bg-surface"
                              : "border-border/80 bg-surface"
                          )}
                        >
                          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Token & Patient details */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-mono font-bold shadow-xs shrink-0",
                                  isEmergency
                                    ? "bg-red-600 text-white shadow-red-600/30 animate-pulse"
                                    : isInConsultation
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                                    : isCheckedIn
                                    ? "bg-primary-500 text-white shadow-primary-500/20"
                                    : "bg-surface-alt border border-border text-text"
                                )}
                              >
                                <span className="text-[9px] font-sans uppercase font-bold tracking-wider opacity-80">
                                  {isEmergency ? "STAT" : "Token"}
                                </span>
                                <span className="text-base leading-none">#{appt.tokenNumber}</span>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-text text-sm truncate">
                                    {appt.patientId?.userId?.name || "Patient Profile"}
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
                                    <Badge variant="success" size="sm" className="font-semibold text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                      ✓ Paid ₹{appt.paymentAmount || 500}
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" size="sm" className="font-semibold text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                      Unpaid ₹{appt.paymentAmount || 500}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                                  {appt.patientId?.userId?.phone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {appt.patientId?.userId?.phone}
                                    </span>
                                  )}
                                  <span>&bull;</span>
                                  <span className="uppercase font-semibold text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-surface-alt border border-border/60">
                                    {appt.appointmentType}
                                  </span>
                                </div>
                                {appt.notes && (
                                  <p className="text-xs text-text-muted italic line-clamp-1">
                                    Note: &ldquo;{appt.notes}&rdquo;
                                  </p>
                                )}

                                {/* Vitals Display Strip if Recorded */}
                                {appt.vitals && (
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-alt border border-border/80 text-text font-medium text-[11px]">
                                      <Stethoscope className="w-3 h-3 text-primary-500 shrink-0" />
                                      <span>BP: <strong>{appt.vitals.bpSystolic}/{appt.vitals.bpDiastolic}</strong></span>
                                      <span>&bull;</span>
                                      <span>HR: <strong>{appt.vitals.pulse}</strong></span>
                                      <span>&bull;</span>
                                      <span>SpO2: <strong>{appt.vitals.spO2}%</strong></span>
                                      <span>&bull;</span>
                                      <span>Temp: <strong>{appt.vitals.temperature}°{appt.vitals.temperatureUnit || "F"}</strong></span>
                                      {appt.vitals.bmi && (
                                        <>
                                          <span>&bull;</span>
                                          <span>BMI: <strong>{appt.vitals.bmi}</strong></span>
                                        </>
                                      )}
                                    </span>
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
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedVitalsAppt(appt);
                                          setVitalsModalOpen(true);
                                        }}
                                        className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-semibold cursor-pointer"
                                      >
                                        Edit Vitals
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Critical Vitals Early Warning Score (MEWS Alert Banner) */}
                                {criticalVitalsAlert && (
                                  <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold uppercase tracking-wider text-[10px] text-red-600 dark:text-red-400">
                                            Critical Vitals MEWS Alert
                                          </span>
                                          <Badge variant="danger" size="sm" className="font-mono text-[9px] px-1 py-0">
                                            HIGH TRIAGE RISK
                                          </Badge>
                                        </div>
                                        <p className="text-[11px] text-red-800 dark:text-red-200 mt-0.5 font-medium">
                                          {criticalVitalsAlert.join(" • ")}
                                        </p>
                                      </div>
                                    </div>
                                    {!isEmergency && !isInConsultation && (
                                      <Button
                                        type="button"
                                        size="xs"
                                        onClick={() => {
                                          setApptToStatEmergency(appt);
                                          setEmergencyReason(`Critical Vitals MEWS Triage: ${criticalVitalsAlert.join(", ")}`);
                                          setStatModalOpen(true);
                                        }}
                                        className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                                      >
                                        <Zap className="w-3 h-3 mr-1 fill-white" />
                                        Escalate to STAT Next
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {/* Investigation / Diagnostic Lab Results Strip */}
                                {appt.investigationResults && appt.investigationResults.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-medium text-[11px]">
                                      <FlaskConical className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                      <strong className="font-bold">Lab Findings:</strong>
                                      {appt.investigationResults.map((inv, i) => (
                                        <span key={i} className="inline-flex items-center gap-1">
                                          {i > 0 && <span className="opacity-40">&bull;</span>}
                                          <span className="font-medium">{inv.testName}:</span>
                                          <strong className={inv.isAbnormal ? "text-red-600 dark:text-red-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                                            {inv.value} {inv.unit || ""}
                                          </strong>
                                          {inv.isAbnormal && (
                                            <span className="text-[9px] px-1 py-0 rounded bg-red-500/20 text-red-700 dark:text-red-300 font-bold">
                                              Abnormal
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openInvestigationViewer(appt)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-800 dark:text-purple-200 font-bold text-[11px] transition-all cursor-pointer shadow-2xs border border-purple-500/30"
                                      title="Open in-cabin viewer & compare past diagnostic trends"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-500" />
                                      <span>View Reports & Trends</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Controls & Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                              {/* Wait Time Indicator */}
                              {!isInConsultation && (
                                <span className="text-xs bg-surface-alt border border-border/80 text-text-secondary px-2.5 py-1 rounded-xl font-medium inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-text-muted" />
                                  {getWaitTimeLabel(appt.estimatedWaitTime)}
                                </span>
                              )}

                              {/* VIP Queue Reorder, Bump Late, and Park Standby */}
                              {canManageQueue && (
                                <div className="flex items-center gap-1">
                                  {!isInConsultation && (
                                    <button
                                      type="button"
                                      onClick={() => openParkModal(appt)}
                                      className="px-2 py-1 text-[10px] font-semibold rounded-lg text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
                                      title="Patient stepped out: Hold in Standby"
                                    >
                                      <PauseCircle className="w-3 h-3" />
                                      Park
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleBumpBack(appt.id)}
                                    className="px-2 py-1 text-[10px] font-semibold rounded-lg text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors cursor-pointer"
                                    title="Late Arrival: Move 2 positions back in queue"
                                  >
                                    Bump (+2)
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openResendTrackerModal(appt)}
                                    className="px-2 py-1 text-[10px] font-semibold rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Resend live queue tracking link via WhatsApp / SMS"
                                  >
                                    <Send className="w-3 h-3" />
                                    Tracker
                                  </button>

                                  <div className="flex items-center bg-surface-alt border border-border/80 rounded-xl p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moveQueueItem(idx, "up")}
                                      disabled={isFirst}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                                        isFirst ? "text-text-muted/40 cursor-not-allowed" : "text-text-secondary hover:text-text hover:bg-surface"
                                      )}
                                      title="Move Up (VIP Override)"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveQueueItem(idx, "down")}
                                      disabled={isLast}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                                        isLast ? "text-text-muted/40 cursor-not-allowed" : "text-text-secondary hover:text-text hover:bg-surface"
                                      )}
                                      title="Move Down (VIP Override)"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Consultation Flow Buttons */}
                              {canManageQueue && (
                                <div className="flex items-center gap-1.5">
                                  {/* Longitudinal EHR Patient History Button */}
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => {
                                      const pId = typeof appt.patientId === "object" ? appt.patientId.id : appt.patientId;
                                      const pName = appt.patientId?.userId?.name || "Patient";
                                      setTimelinePatient({ id: pId, name: pName });
                                      setTimelineModalOpen(true);
                                    }}
                                    className="font-semibold text-xs rounded-xl border-border/80 text-text-secondary hover:bg-surface-hover hover:text-text cursor-pointer"
                                    title="View Patient's Longitudinal Medical History & Clinical Timeline"
                                  >
                                    <History className="w-3 h-3 mr-1 text-primary-600 dark:text-primary-400" />
                                    EHR History
                                  </Button>

                                  {/* In-Cabin Lab Reports & Comparison Button */}
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => openInvestigationViewer(appt)}
                                    className={cn(
                                      "font-semibold text-xs rounded-xl cursor-pointer transition-all",
                                      appt.investigationResults && appt.investigationResults.length > 0
                                        ? "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 shadow-xs"
                                        : "border-border/80 text-text-secondary hover:bg-surface-hover hover:text-text"
                                    )}
                                    title="View Lab Reports, Attachments & 1-Click Trends"
                                  >
                                    <FlaskConical className="w-3 h-3 mr-1 text-purple-600 dark:text-purple-400" />
                                    Lab Reports{appt.investigationResults && appt.investigationResults.length > 0 ? ` (${appt.investigationResults.length})` : ""}
                                  </Button>

                                  {/* Nurse Vitals Entry Button (if not already recorded) */}
                                  {!appt.vitals && !isInConsultation && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      onClick={() => {
                                        setSelectedVitalsAppt(appt);
                                        setVitalsModalOpen(true);
                                      }}
                                      className="font-semibold text-xs rounded-xl border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 cursor-pointer"
                                      title="Record pre-consultation nursing vitals"
                                    >
                                      <Stethoscope className="w-3 h-3 mr-1" />
                                      Vitals
                                    </Button>
                                  )}

                                  {/* STAT Emergency Priority Button */}
                                  {!isEmergency && !isInConsultation && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      onClick={() => {
                                        setApptToStatEmergency(appt);
                                        setEmergencyReason("");
                                        setStatModalOpen(true);
                                      }}
                                      className="font-semibold text-xs rounded-xl border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                      title="STAT Emergency Priority (Interrupts queue to Position 0)"
                                    >
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      STAT
                                    </Button>
                                  )}

                                  {appt.status !== "checked-in" && !isInConsultation && (
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
                                      className="font-bold text-xs rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                      title="Collect Consultation Fee via Counter-Top BharatPe UPI QR Code"
                                    >
                                      <Banknote className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                      Pay ₹{getAppointmentBilling(appt).totalAmount}
                                    </Button>
                                  )}

                                  {isInConsultation ? (
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => {
                                          announcePatientToken({
                                            tokenNumber: appt.tokenNumber,
                                            doctorName: appt.doctorId?.userId?.name || appt.doctorId?.name,
                                            cabinName: appt.doctorId?.cabinNumber ? `Cabin ${appt.doctorId.cabinNumber}` : undefined,
                                            language: voiceLanguage,
                                            chimeType,
                                          });
                                          toast({
                                            title: `Summoning Token #${appt.tokenNumber}`,
                                            description: "Doorway voice announcer and calling chime sounded.",
                                            variant: "default",
                                          });
                                        }}
                                        className="font-bold text-xs rounded-xl border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                                        title="Sound doorway calling bell chime and re-summon patient"
                                      >
                                        <Volume2 className="w-3.5 h-3.5 mr-1 text-amber-500 animate-pulse" />
                                        Summon
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        onClick={() => handleOpenInvestigationModal(appt)}
                                        className="font-bold text-xs rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10"
                                      >
                                        <span>🔬</span> Send for Lab
                                      </Button>
                                      <Button
                                        variant="primary"
                                        size="xs"
                                        onClick={() => openCompleteModal(appt)}
                                        loading={updatingStatus === appt.id}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                                      >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Conclude Visit
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
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
                                      className="font-bold text-xs rounded-xl shadow-xs bg-primary-600 hover:bg-primary-700 text-white"
                                    >
                                      <Stethoscope className="w-3 h-3 mr-1" />
                                      Call In
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
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
                {standbyQueue.length === 0 ? (
                  <Card className="py-14 text-center text-text-muted rounded-2xl border border-border/80 bg-surface">
                    <CardContent className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-amber-500">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-text text-sm">No Patients in Standby</p>
                      <p className="text-xs text-text-muted">No checked-in patients are currently stepped out or held in standby.</p>
                    </CardContent>
                  </Card>
                ) : (
                  standbyQueue.map((appt) => {
                  const isReportReview = appt.consultationPhase === "initial_pending_investigation";
                  const isReturned = appt.patientReturned;

                  return (
                    <Card
                      key={appt.id}
                      className={cn(
                        "rounded-2xl border transition-all shadow-xs overflow-hidden",
                        isReturned
                          ? "border-emerald-500/50 bg-emerald-500/[0.04] ring-2 ring-emerald-500/20"
                          : isReportReview
                          ? "border-purple-500/40 bg-purple-500/[0.02]"
                          : "border-amber-500/30 bg-amber-500/[0.02]"
                      )}
                    >
                      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-2xl text-white flex flex-col items-center justify-center font-mono font-bold shadow-xs shrink-0",
                              isReturned ? "bg-emerald-600" : isReportReview ? "bg-purple-600" : "bg-amber-500"
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
                                {appt.patientId?.userId?.name || "Patient Profile"}
                              </span>
                              {isReturned ? (
                                <Badge variant="success" size="sm" pulse dot className="font-bold text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  🟢 Returned & Ready in Waiting Room
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                                  Standby / Stepped Out
                                </Badge>
                              )}
                              {isReportReview && (
                                <Badge variant="neutral" size="sm" className="font-bold text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                  🔬 In Lab: {appt.investigationNotes || "Diagnostic Tests"}
                                </Badge>
                              )}

                              {appt.investigationResults && appt.investigationResults.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-medium text-[11px]">
                                    <FlaskConical className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                    <strong className="font-bold">Reports Ready:</strong>
                                    {appt.investigationResults.map((inv, i) => (
                                      <span key={i} className="inline-flex items-center gap-1">
                                        {i > 0 && <span className="opacity-40">&bull;</span>}
                                        <span>{inv.testName}:</span>
                                        <strong className={inv.isAbnormal ? "text-red-600 dark:text-red-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                                          {inv.value} {inv.unit || ""}
                                        </strong>
                                        {inv.isAbnormal && (
                                          <span className="text-[9px] px-1 py-0 rounded bg-red-500/20 text-red-700 dark:text-red-300 font-bold">
                                            ⚠️
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openInvestigationViewer(appt)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-800 dark:text-purple-200 font-bold text-[11px] transition-all cursor-pointer shadow-2xs border border-purple-500/30"
                                    title="Open in-cabin viewer & compare past trends"
                                  >
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span>Compare Trends</span>
                                  </button>
                                </div>
                              )}
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

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openResendTrackerModal(appt)}
                            className="px-2 py-1 text-[10px] font-semibold rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1"
                            title="Resend live queue tracking link via WhatsApp / SMS"
                          >
                            <Send className="w-3 h-3" />
                            Tracker
                          </button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => openInvestigationViewer(appt)}
                            className="font-bold text-xs rounded-xl border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer shadow-xs"
                            title="View lab investigation results and parameter comparisons"
                          >
                            <FlaskConical className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />
                            Lab Reports
                          </Button>
                          {isReportReview ? (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => handleResumeForReportReview(appt.id, appt.tokenNumber)}
                              loading={updatingStatus === appt.id}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs"
                            >
                              <span>🔬</span> Resume for Report Review
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="primary"
                              onClick={() => handleResumePatient(appt.id)}
                              loading={updatingStatus === appt.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
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
                clinicId={selectedClinic}
                doctorId={selectedDoctor}
                onCheckInSuccess={fetchQueue}
              />
            )}
          </div>

          {/* Right Column: Served & Inactive Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">Processed Patients</h3>
              <Badge variant="neutral" size="sm" className="font-semibold">
                {finishedQueue.length} Served
              </Badge>
            </div>

            <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
              <CardContent className="p-0">
                {finishedQueue.length === 0 ? (
                  <div className="text-center py-14 px-4 text-text-muted text-xs">
                    No completed patient visits recorded yet today.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                    {finishedQueue.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3.5 flex justify-between items-center hover:bg-surface-hover transition-colors gap-3"
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
                          <p className="text-xs font-bold text-text truncate">
                            {appt.patientId?.userId?.name || "Patient Profile"}
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          {appt.status === "completed" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePrintAppointmentPrescription(appt)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-xl border border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Print Official Prescription (Rx)"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Print Rx
                              </button>
                              <button
                                type="button"
                                onClick={() => openResendRxModal(appt)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Dispatch Digital e-Prescription via WhatsApp / SMS"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Send Rx
                              </button>
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
                                className="px-2 py-1 text-[11px] font-bold rounded-xl border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Generate Medical Sick Leave, Referral Letter, or Fitness Certificate"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Certificates
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintTokenSlip(appt)}
                            className="px-2 py-1 text-[11px] font-medium rounded-xl border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Re-print Token Slip"
                          >
                            <Printer className="w-3 h-3" />
                            Slip
                          </button>
                          {appt.status === "completed" && (
                            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          {appt.status === "cancelled" && (
                            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <XCircle className="w-4 h-4" />
                            </div>
                          )}
                          {appt.status === "no-show" && (
                            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
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
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          6. COMPLETE CONSULTATION & EHR DOCUMENTATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Clinical Consultation"
        description={`Document medical diagnosis, prescriptions, and follow-up plan for ${apptToComplete?.patientId?.userId?.name || "Patient"} (Token #${apptToComplete?.tokenNumber}).`}
        size="lg"
      >
        <form onSubmit={handleCompleteConsultation} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Patient Quick Context & Longitudinal EHR Timeline Launcher */}
          {apptToComplete && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-primary-500/10 border border-primary-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                  {apptToComplete.patientId?.userId?.name?.[0]?.toUpperCase() || "P"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text">
                      {apptToComplete.patientId?.userId?.name || "Patient Record"}
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
                  className="font-bold text-xs rounded-xl bg-surface border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 cursor-pointer shadow-xs shrink-0"
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  Lab Reports & Compare
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const pId = typeof apptToComplete.patientId === "object" ? apptToComplete.patientId.id : apptToComplete.patientId;
                    const pName = apptToComplete.patientId?.userId?.name || "Patient";
                    setTimelinePatient({ id: pId, name: pName });
                    setTimelineModalOpen(true);
                  }}
                  className="font-bold text-xs rounded-xl bg-surface border-primary-500/40 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 cursor-pointer shadow-xs shrink-0"
                >
                  <History className="w-3.5 h-3.5 mr-1 text-primary-600" />
                  View Longitudinal EHR History
                </Button>
              </div>
            </div>
          )}

          {/* 1-Click OPD Clinical Presets & Custom Combos Bar */}
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
            clinicId={selectedClinic}
          />

          {/* Patient Clinical Context: Allergies & Triage Vitals Banner */}
          {apptToComplete && (apptToComplete.vitals || (apptToComplete.investigationResults && apptToComplete.investigationResults.length > 0)) && (
            <div className="p-3 rounded-2xl bg-surface-alt border border-border/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary-500" />
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
                <div className="p-2 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-center gap-2 text-danger-700 dark:text-danger-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger-500" />
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
                      <FlaskConical className="w-3 h-3 text-secondary-500" />
                      Laboratory Diagnostic Findings
                    </span>
                    <button
                      type="button"
                      onClick={() => openInvestigationViewer(apptToComplete)}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
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
                            ? "bg-danger-500/10 border-danger-500/20 text-danger-700 dark:text-danger-400 font-bold"
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
                  <Sparkles className="w-3 h-3 text-amber-500" /> Quick Add:
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
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface hover:bg-primary-500/15 hover:text-primary-700 dark:hover:text-primary-300 border border-border/70 hover:border-primary-500/40 transition-all cursor-pointer shadow-2xs"
                  >
                    + {med.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {prescriptions.map((prescription, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-surface-alt/60 border border-border/70 space-y-1.5">
                    <div className="flex gap-2.5 items-end">
                      <div className="flex-1">
                        <Input
                          label={idx === 0 ? "Medicine Name" : ""}
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
                          label={idx === 0 ? "Dosage" : ""}
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
                          label={idx === 0 ? "Duration" : ""}
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
                              ? "bg-primary-500/20 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
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
                              ? "bg-primary-500/20 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
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
          <div className="p-3.5 bg-emerald-500/[0.04] rounded-2xl border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dispatchWhatsAppRx"
                  label="Dispatch Digital e-Prescription via WhatsApp"
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
              label="Recommend follow-up appointment consultation?"
              checked={recommendFollowUp}
              onChange={(e) => setRecommendFollowUp(e.target.checked)}
            />
          </div>

          {recommendFollowUp && (
            <div className="space-y-3.5 animate-fade-in p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20">
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

          <div className="flex justify-end gap-2.5 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => setCompleteModalOpen(false)}
              disabled={completingSubmitting}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={completingSubmitting}
              className="font-semibold rounded-xl shadow-xs"
            >
              Conclude Visit & Save Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Doctor OPD Break Modal */}
      <Modal
        open={isBreakModalOpen}
        onClose={() => !isTogglingBreak && setIsBreakModalOpen(false)}
        title="☕ Pause Consultations / Take OPD Break"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-text-muted">
            This will pause queue calls and display a soothing informational notice on the <strong>Waiting Room TV</strong> so patients are informed of your expected return.
          </p>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Expected Break Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setBreakMinutes(mins)}
                  className={cn(
                    "py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer",
                    breakMinutes === mins
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
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

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span>ℹ️</span>
            <span>Patients in waiting lounge will be notified via TV chime and display banner.</span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBreakModalOpen(false)}
              disabled={isTogglingBreak}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleToggleDoctorBreak(true, breakReasonInput, breakMinutes)}
              loading={isTogglingBreak}
              className="font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
            >
              Start Break ({breakMinutes}m)
            </Button>
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

      {/* Clinic QR Poster Modal (A4 / Standee) */}
      <ClinicQrPosterModal
        open={qrPosterOpen}
        onClose={() => setQrPosterOpen(false)}
        clinic={qrPosterClinic}
      />

      {/* ABDM / ABHA Modal */}
      <AbdmRegistrationModal
        open={abdmModalOpen}
        onClose={() => setAbdmModalOpen(false)}
        clinicId={selectedClinic}
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
        clinicName={clinics.find((c) => (c.id || c._id) === selectedClinic)?.name || "Our Clinic"}
        clinicAddress={clinics.find((c) => (c.id || c._id) === selectedClinic)?.address}
        clinicPhone={clinics.find((c) => (c.id || c._id) === selectedClinic)?.phone}
        defaultDoctorName={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.name}
        defaultDoctorSpecialization={doctors.find((d) => (d.id || d._id) === selectedDoctor)?.specialty}
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
        patientName={selectedVitalsAppt?.patientId?.userId?.name || vitalsPatient?.name || "Patient"}
        initialVitals={selectedVitalsAppt?.vitals}
        onSaved={fetchQueue}
      />

      {/* STAT Emergency Interruption Modal */}
      <Modal
        open={statModalOpen}
        onClose={() => {
          setStatModalOpen(false);
          setApptToStatEmergency(null);
          setEmergencyReason("");
        }}
        title="🚨 STAT Emergency Priority Interruption"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs space-y-1 text-red-700 dark:text-red-300">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              STAT Emergency Line Interruption
            </p>
            <p>
              This action interrupts the scheduled queue sequence for Token #{apptToStatEmergency?.tokenNumber} (
              {apptToStatEmergency?.patientId?.userId?.name || "Patient"}), moving them to Position 0 (Stat Next) and sounding the waiting room emergency alert.
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

          <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatModalOpen(false);
                setApptToStatEmergency(null);
                setEmergencyReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={Boolean(statEmergencyLoading)}
              onClick={handleTriggerStatEmergency}
              className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
            >
              🚨 Confirm STAT Priority
            </Button>
          </div>
        </div>
      </Modal>

      {/* Doctor Availability Override Modal */}
      <Modal
        open={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        title="Manage Doctor's Real-Time Availability"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveOverride();
          }}
          className="space-y-4 pt-1"
        >
          <p className="text-xs text-text-secondary leading-relaxed">
            Set today&apos;s actual working status. Setting a doctor as unavailable or ending early will protect waiting patients, notify un-arrived bookings, and flag checked-in patients for immediate reassignment.
          </p>

          {activeOverride && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                Active Override for {selectedDate}:
              </span>
              <p className="text-text-secondary">
                Status: <strong className="capitalize">{activeOverride.status}</strong>
                {activeOverride.effectiveStartTime && ` | Start: ${activeOverride.effectiveStartTime}`}
                {activeOverride.effectiveEndTime && ` | End: ${activeOverride.effectiveEndTime}`}
                {activeOverride.reason && ` | Reason: ${activeOverride.reason}`}
              </p>
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
              <Input
                label="New Effective Start Time *"
                type="time"
                value={overrideStartTime}
                onChange={(e) => setOverrideStartTime(e.target.value)}
                required
              />
            </div>
          )}

          {overrideStatus === "extended" && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Effective Start Time"
                type="time"
                value={overrideStartTime}
                onChange={(e) => setOverrideStartTime(e.target.value)}
              />
              <Input
                label="New Effective End Time *"
                type="time"
                value={overrideEndTime}
                onChange={(e) => setOverrideEndTime(e.target.value)}
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

          <div className="flex justify-between items-center border-t border-border/60 pt-3">
            {activeOverride ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveOverride}
                disabled={savingOverride}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 font-semibold"
              >
                Revert to Standard
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={() => setIsAvailabilityModalOpen(false)}
                disabled={savingOverride}
                className="rounded-xl font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingOverride}
                className="font-semibold rounded-xl shadow-xs"
              >
                Save Availability
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. QUICK WALK-IN REGISTRATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isQuickWalkInOpen}
        onClose={() => setIsQuickWalkInOpen(false)}
        title="Quick Walk-In Patient Registration"
        size="md"
      >
        <form onSubmit={handleQuickWalkInSubmit} className="space-y-4 text-xs">
          <p className="text-text-muted leading-relaxed text-xs">
            Register an arriving front-desk walk-in directly into the live OPD queue. Atomic token generation and automatic queue placement are executed immediately.
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
                    ? "bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 shadow-xs"
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
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs"
                    : "bg-surface border-border/80 text-text-muted hover:border-border"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Emergency Priority 🚨
              </button>
            </div>
            {walkInPriority === "emergency" && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 font-semibold leading-relaxed">
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
                label="Gender *"
                value={walkInGender}
                onChange={(e) => setWalkInGender(e.target.value as any)}
                options={[
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
          <div className="flex justify-end items-center gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickWalkInOpen(false)}
              disabled={submittingWalkIn}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submittingWalkIn}
              className={cn(
                "font-bold rounded-xl shadow-xs",
                walkInPriority === "emergency" ? "bg-rose-600 hover:bg-rose-700 text-white border-none" : "bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              )}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Register & Queue Token
            </Button>
          </div>
        </form>
      </Modal>

      {/* Disruption Triage Reception Cockpit Modal */}
      <DisruptionTriageModal
        open={triageModalOpen}
        onClose={() => setTriageModalOpen(false)}
        clinicId={selectedClinic}
        date={selectedDate}
        triageAppointments={triageAppointments}
        onActionComplete={async () => {
          await fetchTriageAppointments();
          await fetchQueue();
        }}
      />

      {/* Single Active Consultation Conflict Modal (Pillar 2 Guard) */}
      <Modal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Active Consultation In Progress"
        size="sm"
      >
        <div className="space-y-4 pt-1 font-sans text-xs">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
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
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConflictModalOpen(false)}
              className="rounded-xl font-semibold"
            >
              Keep Current & Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCallNext(true)}
              loading={callingNext}
              className="rounded-xl font-bold bg-primary-600 hover:bg-primary-700 text-white"
            >
              Complete & Call Next
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resend Live Tracker Modal (P3) */}
      <Modal
        open={isResendTrackerModalOpen}
        onClose={() => setIsResendTrackerModalOpen(false)}
        title={`Resend Live Queue Tracker (Token #${resendTrackerAppt?.tokenNumber})`}
        size="sm"
      >
        <div className="space-y-4 pt-1 font-sans text-xs">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <Send className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Live Token Tracking Link</p>
              <p className="mt-0.5 leading-relaxed">
                Dispatches real-time web tracker URL (<code>/track/{resendTrackerAppt?.id}</code>) to the patient or attendee phone with live token status and doctor cabin information.
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

          <div className="space-y-1.5">
            <label className="font-semibold text-text">Dispatch Channel</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResendChannel("whatsapp")}
                className={cn(
                  "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  resendChannel === "whatsapp"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-surface-alt hover:bg-surface border-border text-text-secondary"
                )}
              >
                <span>💬</span> WhatsApp (Default)
              </button>
              <button
                type="button"
                onClick={() => setResendChannel("sms")}
                className={cn(
                  "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  resendChannel === "sms"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-surface-alt hover:bg-surface border-border text-text-secondary"
                )}
              >
                <span>📱</span> SMS Message
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-text">Recipient Mobile Phone *</label>
            <Input
              type="tel"
              placeholder="+919876543210"
              value={resendPhone}
              onChange={(e) => setResendPhone(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-text-muted">
              Pre-filled with patient's registered phone. You can update this to an attendant or alternate number if requested.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResendTrackerModalOpen(false)}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResendTrackerSubmit}
              loading={resendingTracker}
              disabled={!resendPhone.trim()}
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send Live Tracker
            </Button>
          </div>
        </div>
      </Modal>

      {/* Park Patient in Standby Modal */}
      <Modal
        open={isParkModalOpen}
        onClose={() => setIsParkModalOpen(false)}
        title={`Move Token #${parkingAppt?.tokenNumber} to Standby`}
        size="sm"
      >
        <div className="space-y-4 pt-1 font-sans text-xs">
          <p className="text-text-secondary leading-relaxed">
            Move <strong>{parkingAppt?.patientId?.userId?.name || "Patient"}</strong> to Standby. This will temporarily hold their token without blocking the queue. When they return, you can resume them directly as <strong>Next Up</strong>.
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

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsParkModalOpen(false)}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleParkPatient}
              loading={submittingPark}
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              Hold in Standby
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lab Diagnostic Investigation Modal */}
      <Modal
        open={isInvestigationModalOpen}
        onClose={() => setIsInvestigationModalOpen(false)}
        title={`Send Token #${investigationAppt?.tokenNumber} for Diagnostic Investigation`}
        size="md"
      >
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
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
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
            <label className="text-xs font-bold text-text">Additional Requisition Notes / Clinical Instructions</label>
            <input
              type="text"
              placeholder="e.g. STAT Fasting sample, urgent lipid panel, fever workup"
              value={investigationNotes}
              onChange={(e) => setInvestigationNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setIsInvestigationModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendToInvestigation}
              loading={isSubmittingInvestigation}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
            >
              <span>🔬</span> Send for Tests & Free Room
            </Button>
          </div>
        </div>
      </Modal>

      {/* End OPD Reconciliation Modal */}
      <Modal
        open={isEndOpdModalOpen}
        onClose={() => setIsEndOpdModalOpen(false)}
        title="End OPD Shift & Reconcile Today's Queue"
        size="lg"
      >
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
                  <p className="text-xl font-black text-emerald-600">{endOpdSummary?.counts?.completed ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-alt border border-border text-center">
                  <p className="text-[10px] uppercase font-bold text-text-muted">In Consultation</p>
                  <p className="text-xl font-black text-primary-600">{endOpdSummary?.counts?.inConsultation ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">Unresumed Standby</p>
                  <p className="text-xl font-black text-amber-600">{endOpdSummary?.counts?.standby ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center">
                  <p className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Unserved Waiting</p>
                  <p className="text-xl font-black text-rose-600">{endOpdSummary?.counts?.waiting ?? 0}</p>
                </div>
              </div>

              {/* Standby Reconciliation Policy */}
              <div className="p-4 rounded-2xl border border-border bg-surface-alt space-y-2.5">
                <h4 className="text-xs font-bold text-text">
                  1. Standby Patients ({endOpdSummary?.counts?.standby ?? 0} stranded)
                </h4>
                <p className="text-[11px] text-text-muted">
                  Patients who stepped out for lab tests or personal breaks and never returned to the clinic.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="standbyAction"
                      value="mark_no_show"
                      checked={standbyReconcileAction === "mark_no_show"}
                      onChange={() => setStandbyReconcileAction("mark_no_show")}
                      className="accent-primary-600"
                    />
                    <span>Mark as No-Show (Abandoned)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="standbyAction"
                      value="cancel_refund"
                      checked={standbyReconcileAction === "cancel_refund"}
                      onChange={() => setStandbyReconcileAction("cancel_refund")}
                      className="accent-primary-600"
                    />
                    <span>Cancel & Auto-Refund</span>
                  </label>
                </div>
              </div>

              {/* Waiting Reconciliation Policy */}
              <div className="p-4 rounded-2xl border border-border bg-surface-alt space-y-2.5">
                <h4 className="text-xs font-bold text-text">
                  2. Unserved Waiting Patients ({endOpdSummary?.counts?.waiting ?? 0} remaining)
                </h4>
                <p className="text-[11px] text-text-muted">
                  Registered patients who were not called before concluding consultations for today.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="waitingAction"
                      value="cancel_refund"
                      checked={waitingReconcileAction === "cancel_refund"}
                      onChange={() => setWaitingReconcileAction("cancel_refund")}
                      className="accent-primary-600"
                    />
                    <span>Cancel & Auto-Refund Invoices (Recommended)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="waitingAction"
                      value="keep_unresolved"
                      checked={waitingReconcileAction === "keep_unresolved"}
                      onChange={() => setWaitingReconcileAction("keep_unresolved")}
                      className="accent-primary-600"
                    />
                    <span>Leave as Pending</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setIsEndOpdModalOpen(false)}>
                  Keep OPD Open
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteEndOpdReconcile}
                  loading={isSubmittingEndOpd}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  <span>🛑</span> Confirm & Close OPD Shift
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Dynamic BharatPe / NPCI UPI QR Counter-Top Payment Modal */}
      {selectedUpiAppt && (() => {
        const activeClinicObj = clinics.find(
          (c) => c._id === selectedClinic || c.id === selectedClinic
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
            patientName={selectedUpiAppt.patientId?.userId?.name || "Patient Profile"}
            tokenNumber={selectedUpiAppt.tokenNumber}
            amount={billing.totalAmount}
            items={billing.items}
            doctorName={
              typeof selectedUpiAppt.doctorId === "object"
                ? selectedUpiAppt.doctorId?.userId?.name || selectedUpiAppt.doctorId?.name
                : undefined
            }
            clinicName={activeClinicObj?.name || "Clinic Counter"}
            upiVpa={activeClinicObj?.upiVpa}
            merchantName={activeClinicObj?.merchantName}
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
        open={timelineModalOpen}
        onClose={() => {
          setTimelineModalOpen(false);
          setTimelinePatient(null);
        }}
        title={timelinePatient ? `Longitudinal EHR Medical Timeline: ${timelinePatient.name}` : "Patient EHR History"}
        description="Comprehensive chronological record of medical encounters, previous prescriptions, historical vitals trajectories, and laboratory diagnostic reports."
        size="xl"
      >
        {timelinePatient && (
          <div className="max-h-[75vh] overflow-y-auto pr-1 pt-1">
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
        open={isResendRxModalOpen}
        onClose={() => {
          if (!resendingRx) {
            setIsResendRxModalOpen(false);
            setResendRxAppt(null);
          }
        }}
        title="Dispatch Digital e-Prescription (Rx)"
        description={
          resendRxAppt
            ? `Send official electronic prescription with medicines, dosage schedule, and direct printable PDF to ${
                resendRxAppt.patientId?.userId?.name || (resendRxAppt.patientId as any)?.name || "Patient"
              } (Token #${resendRxAppt.tokenNumber}).`
            : "Send official electronic prescription to patient."
        }
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>📄</span> Official Digital Rx WhatsApp Delivery
            </div>
            <p className="text-emerald-700/80 dark:text-emerald-400/80 text-[11px]">
              Patient receives an instant interactive summary including medication dosages, instructions, dietary advice, follow-up timeline, and a tamper-evident digital prescription link.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Delivery Channel</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResendRxChannel("whatsapp")}
                className={cn(
                  "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-2",
                  resendRxChannel === "whatsapp"
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                    : "border-border hover:bg-surface-hover text-text-secondary"
                )}
              >
                <span>💬 WhatsApp Official</span>
              </button>
              <button
                type="button"
                onClick={() => setResendRxChannel("sms")}
                className={cn(
                  "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-2",
                  resendRxChannel === "sms"
                    ? "border-primary-500 bg-primary-500/15 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20"
                    : "border-border hover:bg-surface-hover text-text-secondary"
                )}
              >
                <span>📱 SMS Notification</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">
              Recipient Mobile Number ({resendRxChannel.toUpperCase()})
            </label>
            <Input
              value={resendRxPhone}
              onChange={(e) => setResendRxPhone(e.target.value)}
              placeholder="e.g. 9876543210 (10 digits)"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-text-muted mt-1">
              Leave blank to default to patient registered profile number.
            </p>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsResendRxModalOpen(false);
                setResendRxAppt(null);
              }}
              disabled={resendingRx}
              className="rounded-xl font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResendRxSubmit}
              loading={resendingRx}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Digital Rx Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
