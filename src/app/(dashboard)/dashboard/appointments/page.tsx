"use client";

import PrintDialogActions from "@/components/ui/PrintDialogActions";


import { getPrintBrandStyles, printHtml } from "@/lib/printBrand";

import { useLatestRead } from "@/hooks/useLatestRead";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { patientName as appointmentPatientName, patientPhone as appointmentPatientPhone } from "@/lib/locationWorkflow";
import { PatientEntryModal } from "@/components/appointments/PatientEntryModal";
import { useState, useEffect, useRef, Suspense } from "react";
import { AppointmentLinkSummary } from "@/components/appointments/AppointmentLinkSummary";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { canRecordNoShow } from "@/lib/appointmentNoShow";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { locationDateKey, locationLocalDateTimeInput, locationLocalTimeToIso } from "@/lib/locationTime";
import { Alert, Table, Button, Input, DatePicker, Select, Textarea, useToast, Spinner, Badge, ConfirmDialog, Dropdown, Checkbox, cn } from "@/components/ui";
import dynamic from "next/dynamic";
import Modal from "@/components/queue/QueueDialog";
import styles from "./Appointments.module.css";
import { RotateCw, Plus, LayoutList, Calendar, Search, SlidersHorizontal, Ticket, FileText, MoreHorizontal, Stethoscope, MapPin, User, Clock, UserPlus, ArrowRight, ArrowLeft, CheckCircle2, XCircle, CalendarClock, Phone, Building2, Mail, CalendarOff } from "lucide-react";

const AppointmentCalendarView = dynamic(
  () => import("@/components/clinical/AppointmentCalendarView").then((mod) => mod.AppointmentCalendarView),
  {
    ssr: false,
    loading: () => (
      <div className={styles.calendarPlaceholder} role="status">
        <Spinner size="sm" />
        <p>Loading calendar…</p>
      </div>
    ),
  }
);

const PatientMedicalRecords = dynamic(
  () => import("@/components/ehr/PatientMedicalRecords").then((mod) => mod.PatientMedicalRecords),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-text-muted space-y-2">
        <Spinner size="md" className="mx-auto" />
        <p className="text-xs">Loading health records...</p>
      </div>
    ),
  }
);

const PatientQueueTracker = dynamic(
  () => import("@/components/clinical/PatientQueueTracker").then((mod) => mod.PatientQueueTracker),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-center text-text-muted space-y-2 bg-surface rounded-2xl border border-border">
        <Spinner size="sm" className="mx-auto" />
        <p className="text-xs">Connecting to live queue status...</p>
      </div>
    ),
  }
);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const BOOKING_STEPS = [
  { label: "Patient", description: "Search or Register" },
  { label: "Practitioner", description: "Facility & Doctor" },
  { label: "Schedule", description: "Time & Notes" },
];

interface Appointment {
  id: string;
  locationId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; email: string; phone: string; specialization: string };
  patientId: {
    id: string;
    name?: string;
    phone?: string;
    dob: string;
    gender: string;
    allergies: string[];
    conditions: string[];
    userId: { name: string; email: string; phone: string };
  };
  appointmentTime: string;
  appointmentType: string;
  status: string;
  reviewState?: "overdue" | "unresolved" | null;
  tokenNumber: number;
  notes: string;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { preferences } = useWorkflowPreferences();
  const [isEssentialEntryOpen, setIsEssentialEntryOpen] = useState(false);
  const { locations, fetchLocations, activeLocationId } = useLocationStore();
  const timezoneForLocation = (locationId: string) => locations.find(location => location.id === locationId)?.effectiveTimezone || "Asia/Kolkata";
  const canManageAppointments = hasAnyPermission(user, "MANAGE_APPOINTMENTS");
  const { toast } = useToast();

  const beginAppointmentsRead = useLatestRead();
  const beginSlotsRead = useLatestRead();
  const beginAssignmentsRead = useLatestRead();
  const beginRecordRead = useLatestRead();
  const beginPatientSearch = useLatestRead();
  const [listPage, setListPage] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [listPages, setListPages] = useState(1);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadedScope, setLoadedScope] = useState("");
  const [readError, setReadError] = useState<{ scope: string; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [doctors, setDoctors] = useState<any[]>([]);
  const getTodayISO = () => locationDateKey(new Date(), timezoneForLocation(activeLocationId || ""));

  const [filterLocation, setFilterLocation] = useState(activeLocationId || "");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState(user?.role === "patient" ? "" : getTodayISO());
  const [filterStatus, setFilterStatus] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const readScope = JSON.stringify([user?.organization_id, user?.id, filterLocation, filterDoctor, filterDate, filterStatus, listPage, listSearch, reviewOnly]);
  const loadError = readError?.scope === readScope ? readError.message : null;
  const scopeReady = loadedScope === readScope;
  const visibleAppointments = scopeReady ? appointments : [];
  const loading = !scopeReady && !loadError;

  useEffect(() => {
    setFilterLocation(activeLocationId || "");
  }, [activeLocationId]);

  useEffect(() => {
    if (user?.role === "patient") {
      setFilterDate("");
    }
  }, [user?.role]);

  // Modal States
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [forceBooking, setForceBooking] = useState(false);

  // Search Patient State
  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // New Patient Form
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name: "",
    dob: "",
    gender: "male",
    phone: "",
    email: "",
    password: "",
    address: "",
    allergies: "",
    conditions: "",
    medicalNotes: "",
  });

  // Doctor & Slot Booking Details
  const [bookingLocationId, setBookingLocationId] = useState("");
  const [bookingDoctorId, setBookingDoctorId] = useState("");
  const [doctorAssignments, setDoctorAssignments] = useState<any[]>([]);
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState<"walk-in" | "reception" | "online">("reception");
  const [bookingNotes, setBookingNotes] = useState("");

  // Slot Engine State
  interface SlotInfo {
    time: string;
    available: boolean;
    reason?: string;
    isLocked?: boolean;
    lockedByOther?: boolean;
  }
  const [availableSlots, setAvailableSlots] = useState<SlotInfo[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [slotRetry, setSlotRetry] = useState(0);
  const [loadedSlotScope, setLoadedSlotScope] = useState("");
  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split("T")[0]);

  // Slot Lock State
  const [currentLockId, setCurrentLockId] = useState<string | null>(null);
  const reservation = useRef<{ lockId: string; slotTime: string; locationId: string; doctorId: string } | null>(null);
  const [lockingSlot, setLockingSlot] = useState(false);
  const slotLockPending = useRef(false);
  const [lockedSlotTime, setLockedSlotTime] = useState<string | null>(null);

  const [doctorBookingMode, setDoctorBookingMode] = useState<"time_slot" | "sequential_queue">("sequential_queue");
  const [doctorHolidayInfo, setDoctorHolidayInfo] = useState<{ isHoliday: boolean; reason: string | null } | null>(null);

  const slotScope = [bookingLocationId, bookingDoctorId, selectedSlotDate].join(":");
  const slotsReady = loadedSlotScope === slotScope && !slotError;
  useEffect(() => {
    const request = beginSlotsRead();
    setSlotError("");
    setBookingTime("");
    if (!bookingLocationId || !bookingDoctorId || !selectedSlotDate) return;
    const fetchSlots = async () => {
      try {
        setFetchingSlots(true);
        const res = await api.get(`/doctors/${bookingDoctorId}/slots?locationId=${bookingLocationId}&date=${selectedSlotDate}`, { signal: request.signal });
        if (!request.isCurrent()) return;
        const data = res.data?.data;
        setLoadedSlotScope(slotScope);
        const slotsData = data?.slots || [];
        setAvailableSlots(slotsData);
        const mode = data?.bookingMode || "sequential_queue";
        setDoctorBookingMode(mode);

        if (data?.isHoliday) {
          setDoctorHolidayInfo({ isHoliday: true, reason: data.holidayReason || "Doctor Holiday / Leave" });
        } else {
          setDoctorHolidayInfo(null);
        }

        if (mode === "sequential_queue") {
          setBookingTime(`${selectedSlotDate}T00:00:00`);
        }
      } catch {
        if (!request.isCurrent()) return;
        setAvailableSlots([]);
        setSlotError("Availability could not be loaded. Try again or choose another date.");
      } finally {
        if (request.isCurrent()) setFetchingSlots(false);
      }
    };
    fetchSlots();
  }, [bookingDoctorId, bookingLocationId, selectedSlotDate, slotScope, beginSlotsRead, slotRetry]);

  // Status Update State
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Validation States for Patient Booking
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});

  const validateNewPatientField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Patient Full Name is required";
    } else if (field === "dob" && !value.trim()) {
      error = "Date of Birth is required";
    } else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) {
      error = "Please enter a valid email address";
    } else if (field === "password") {
      if (!value) error = "Password is required";
      else if (value.length < 8) error = "Password must be at least 8 characters";
      else if (!/[A-Z]/.test(value)) error = "Password must contain an uppercase letter";
      else if (!/[a-z]/.test(value)) error = "Password must contain a lowercase letter";
      else if (!/[0-9]/.test(value)) error = "Password must contain a digit";
    }

    setBookingErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return !error;
  };

  const handleNewPatientChange = (field: string, value: string) => {
    setNewPatientForm((prev) => ({ ...prev, [field]: value }));
    if (bookingErrors[field]) {
      setBookingErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleStep2Next = () => {
    if (isNewPatient) {
      const isNameValid = validateNewPatientField("name", newPatientForm.name);
      const isDobValid = validateNewPatientField("dob", newPatientForm.dob);
      const isEmailValid = validateNewPatientField("email", newPatientForm.email);
      const isPasswordValid = validateNewPatientField("password", newPatientForm.password);
      if (!isNameValid || !isDobValid || !isEmailValid || !isPasswordValid) {
        toast({
          title: "Validation Error",
          description: "Please correct highlighted fields before proceeding.",
          variant: "error",
        });
        return;
      }
    }
    setBookingStep(3);
  };

  // View Layout Toggle State
  const [viewLayout, setViewLayout] = useState<"table" | "calendar">("table");

  // Ticket Slip State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  // Reschedule Appointment State
  const [rescheduleTargetAppt, setRescheduleTargetAppt] = useState<Appointment | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const handleOpenRescheduleModal = (appt: Appointment) => {
    setRescheduleTargetAppt(appt);
    const locationId = (appt.locationId as any)?.id || (appt.locationId as any)?._id || "";
    setRescheduleTime(appt.appointmentTime ? locationLocalDateTimeInput(new Date(appt.appointmentTime), timezoneForLocation(locationId)) : "");
    setRescheduleReason("");
    setBookingDoctorId((appt.doctorId as any)?.id || (appt.doctorId as any)?._id || "");
    setBookingLocationId((appt.locationId as any)?.id || (appt.locationId as any)?._id || "");
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTargetAppt || !rescheduleTime) {
      toast({
        title: "Validation Error",
        description: "Please select a valid new appointment date & time.",
        variant: "error",
      });
      return;
    }

    setSubmittingReschedule(true);
    try {
      const res = await api.patch(`/appointments/${rescheduleTargetAppt.id}/reschedule`, {
        newTime: locationLocalTimeToIso(rescheduleTime.slice(0, 10), rescheduleTime.slice(11, 16), timezoneForLocation((rescheduleTargetAppt.locationId as any)?.id || (rescheduleTargetAppt.locationId as any)?._id || "")),
        reason: rescheduleReason,
      });

      toast({
        title: "Appointment Rescheduled",
        description: res.data?.message || "Appointment successfully updated.",
        variant: "success",
      });
      setRescheduleTargetAppt(null);
      fetchAppointments();
    } catch (err: any) {
      toast({
        title: "Reschedule Failed",
        description: err.response?.data?.message || "Could not reschedule appointment.",
        variant: "error",
      });
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Doctor Reviews State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDoctorId, setReviewDoctorId] = useState("");
  const [reviewDoctorName, setReviewDoctorName] = useState("");
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // EHR Record Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<any | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState("");

  const handleOpenRecordModal = async (appt: Appointment) => {
    const request = beginRecordRead();
    setActiveRecord(appt);
    setRecordError("");
    setRecordLoading(true);
    setRecordModalOpen(true);
    try {
      const res = await api.get(`/encounters/${appt.id}/summary-report`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const report = res.data?.data || res.data || {};
      const symptoms = report.chiefComplaint || (report.symptoms || []).join(", ") || "";
      const diagnosis =
        report.primaryDiagnosis || (report.diagnoses || []).map((d: any) => d.description || d.code).join(", ") || "";
      const prescriptions = report.prescriptions || [];

      setActiveRecord({
        ...appt,
        symptoms,
        diagnosis,
        prescriptions,
      });
    } catch {
      if (request.isCurrent()) setRecordError("The clinical record could not be loaded. No clinical findings are available in this view.");
    } finally {
      if (request.isCurrent()) setRecordLoading(false);
    }
  };

  const handleViewSlip = (appt: Appointment) => {
    setCreatedTicket({
      tokenNumber: appt.tokenNumber,
      patientName: appointmentPatientName(appt.patientId),
      doctorName: appt.doctorId?.name || "Doctor",
      doctorSpecialty: appt.doctorId?.specialization || "General Medicine",
      locationName: appt.locationId?.name || "Healthcare Facility",
      locationAddress: appt.locationId?.address || "Location Address",
      appointmentTime: appt.appointmentTime,
      status: appt.status,
    });
    setTicketModalOpen(true);
  };

  const handleOpenReviewModal = (appt: Appointment) => {
    setReviewDoctorId(appt.doctorId.id);
    setReviewDoctorName(appt.doctorId.name);
    setRatingValue(5);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      await api.post(`/doctors/${reviewDoctorId}/reviews`, { rating: ratingValue });
      toast({
        title: "Review Submitted",
        description: `Thank you for rating Dr. ${reviewDoctorName}!`,
        variant: "success",
      });
      setReviewModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Review Error",
        description: err.response?.data?.message || "Failed to submit review.",
        variant: "error",
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handlePrintSlip = async (ticketData: any) => {
    if (!ticketData) return;
    await printHtml(`
      <html>
        <head>
          <title>Appointment Token Slip - #${ticketData.tokenNumber}</title>
          <style>${getPrintBrandStyles()}
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: var(--print-surface-muted); padding: 20px; }
            .ticket { background: white; border: 1px solid var(--print-border); border-radius: 16px; padding: 32px; width: 380px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: left; }
            .header { text-align: center; border-bottom: 2px dashed var(--print-border); padding-bottom: 20px; margin-bottom: 20px; }
            .brand { font-size: 12px; font-weight: 800; color: var(--print-accent); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
            .location-name { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
            .token-box { text-align: center; margin: 16px 0; }
            .token-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--print-muted); font-weight: 600; }
            .token-num { font-size: 48px; font-weight: 800; color: var(--print-accent); margin: 4px 0; line-height: 1; }
            .details { font-size: 13px; color: var(--print-secondary); }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { font-weight: 500; color: var(--print-muted); }
            .val { font-weight: 600; color: #1f2937; text-align: right; }
            .footer { border-top: 1px solid var(--print-surface-muted); margin-top: 24px; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af; }
            @media print {
              body { background: white; padding: 0; }
              .ticket { box-shadow: none; border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="brand">Ekavyu</div>
              <h1 class="location-name">${ticketData.locationName}</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--print-muted);">${ticketData.locationAddress}</p>
            </div>
            <div class="token-box">
              <span class="token-label">Queue Token Number</span>
              <div class="token-num">#${ticketData.tokenNumber}</div>
              <span style="font-size: 12px; color: var(--print-success); font-weight: 700;">✓ Confirmed Schedule</span>
            </div>
            <div class="details">
              <div class="row">
                <span class="label">Patient Name:</span>
                <span class="val">${ticketData.patientName}</span>
              </div>
              <div class="row">
                <span class="label">Practitioner:</span>
                <span class="val">Dr. ${ticketData.doctorName}</span>
              </div>
              <div class="row">
                <span class="label">Specialty:</span>
                <span class="val">${ticketData.doctorSpecialty}</span>
              </div>
              <div class="row">
                <span class="label">Schedule Slot:</span>
                <span class="val">${new Date(ticketData.appointmentTime).toLocaleString()}</span>
              </div>
            </div>
            <div class="footer">
              Please present this slip at the reception upon arrival.
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const fetchAppointments = async () => {
    const request = beginAppointmentsRead();
    try {
      setReadError(null);
      setIsRefreshing(true);
      const queryParams = [`page=${listPage}`, "limit=50", `search=${encodeURIComponent(listSearch)}`];
      if (filterLocation) queryParams.push(`locationId=${filterLocation}`);
      if (filterDoctor) queryParams.push(`doctorId=${filterDoctor}`);
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
      if (reviewOnly && user && !["patient", "family_member"].includes(user.role)) queryParams.push("reviewOnly=1");
      if (filterDate) {
        if (filterDate.includes(" to ")) {
          const [start, end] = filterDate.split(" to ");
          if (start) queryParams.push(`startDate=${start}`);
          if (end) queryParams.push(`endDate=${end}`);
        } else {
          queryParams.push(`date=${filterDate}`);
        }
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const res = await api.get(`/appointments${queryString}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const pages = Math.max(1, Number(res.headers["x-total-pages"]) || 1);
      setListPages(pages);
      setTotalAppointments(Number(res.headers["x-total-count"]) || 0);
      if (listPage > pages) { setListPage(pages); return; }
      setAppointments(res.data.data || []);
      setLoadedScope(readScope);
    } catch {
      if (!request.isCurrent()) return;
      if (!scopeReady) setAppointments([]);
      setLoadedScope(readScope);
      setReadError({ scope: readScope, message: "Appointments could not be loaded. Check your connection and try again." });
      toast({
        title: "Error",
        description: "Failed to load appointments list",
        variant: "error",
      });
    } finally {
      if (!request.isCurrent()) return;
      setIsRefreshing(false);
    }
  };

  const fetchLocationsAndDoctors = async () => {
    if (!user || user.role === "patient") return;
    try {
      const [, staffRes] = await Promise.all([fetchLocations(), api.get("/onboarding/staff")]);
      setDoctors(staffRes.data.data.doctors || []);
    } catch {
      console.error("Failed to load locations or doctors");
    }
  };

  useEffect(() => { setListPage(1); setReadError(null); }, [filterLocation, filterDoctor, filterDate, filterStatus, listSearch, reviewOnly]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void fetchAppointments(); };
    const initial = window.setTimeout(refresh, 250);
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [filterLocation, filterDoctor, filterDate, filterStatus, listPage, listSearch, reviewOnly, user?.id, user?.organization_id]);

  useEffect(() => {
    if (user) {
      fetchLocationsAndDoctors();
    }
  }, [user?.id, user?.role]);

  // Clear the old practitioner immediately and ignore late assignment responses.
  useEffect(() => {
    const request = beginAssignmentsRead();
    setDoctorAssignments([]);
    setBookingDoctorId("");
    if (!bookingLocationId) return;
    api.get("/onboarding/doctors/assignments?locationId=" + bookingLocationId, { signal: request.signal }).then(res => {
      if (!request.isCurrent()) return;
      const assignments = res.data.data || [];
      setDoctorAssignments(assignments);
      if (assignments.length === 1) setBookingDoctorId(assignments[0].doctorId?.id || assignments[0].doctorId?._id || assignments[0].doctorId);
    }).catch(() => { if (request.isCurrent()) toast({ title: "Practitioners unavailable", description: "Select the location again to retry.", variant: "error" }); });
  }, [bookingLocationId, beginAssignmentsRead, toast]);

  const handlePatientSearch = async () => {
    if (!patientSearch.trim()) return;
    const request = beginPatientSearch();
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await api.get(`/patients?search=${encodeURIComponent(patientSearch.trim())}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      setSearchResults(res.data.data || []);
    } catch {
      if (request.isCurrent()) toast({ title: "Error", description: "Patient search failed", variant: "error" });
    } finally {
      if (request.isCurrent()) setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setIsNewPatient(false);
    setBookingStep(2);
  };

  const handleCreateNewPatient = () => {
    setSelectedPatient(null);
    setIsNewPatient(true);
    setBookingStep(2);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewPatient) {
      const isNameValid = validateNewPatientField("name", newPatientForm.name);
      const isDobValid = validateNewPatientField("dob", newPatientForm.dob);
      if (!isNameValid || !isDobValid) {
        setBookingStep(2);
        toast({
          title: "Validation Error",
          description: "Please enter patient name and date of birth before submitting.",
          variant: "error",
        });
        return;
      }
    }

    if (!slotsReady || fetchingSlots || lockingSlot || !bookingTime) {
      toast({ title: "Choose an available appointment", description: "Wait for availability and select a valid date or time.", variant: "error" });
      return;
    }
    if (doctorHolidayInfo?.isHoliday && !forceBooking) {
      toast({
        title: "Doctor on Holiday / Leave",
        description: `Doctor is unavailable on this date (${doctorHolidayInfo.reason || "Doctor Away"}). Check "Emergency Walk-in / Capacity Override" below if this is an exceptional override.`,
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const bookingData: any = {
        locationId: bookingLocationId,
        doctorId: bookingDoctorId,
        appointmentTime: locationLocalTimeToIso(bookingTime.slice(0, 10), bookingTime.slice(11, 16), timezoneForLocation(bookingLocationId)),
        appointmentType: bookingType,
        notes: bookingNotes,
        ...(currentLockId ? { lockId: currentLockId } : {}),
        ...(forceBooking ? { forceBooking: true } : {}),
      };

      if (isNewPatient) {
        bookingData.patientDetails = {
          ...newPatientForm,
          allergies: newPatientForm.allergies ? newPatientForm.allergies.split(",").map((s) => s.trim()) : [],
          conditions: newPatientForm.conditions ? newPatientForm.conditions.split(",").map((s) => s.trim()) : [],
        };
      } else {
        bookingData.patientId = selectedPatient.id;
      }

      const res = await api.post("/appointments", bookingData);
      const token = res.data.data.tokenNumber;

      toast({
        title: "Appointment Booked",
        description: `Successfully scheduled with Token #${token}.`,
        variant: "success",
        duration: 5000,
      });

      reservation.current = null;
      setCurrentLockId(null); setLockedSlotTime(null);
      setIsBookModalOpen(false);
      fetchAppointments();
      resetBookingForm();
    } catch (err: any) {
      toast({
        title: "Booking Failed",
        description: err.response?.data?.message || "Failed to book appointment.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetBookingForm = () => {
    beginPatientSearch();
    setSearchLoading(false);
    setBookingStep(1);
    setPatientSearch("");
    setSearchResults([]);
    setSelectedPatient(null);
    setIsNewPatient(false);
    setBookingErrors({});
    setNewPatientForm({
      name: "",
      dob: "",
      gender: "male",
      phone: "",
      email: "",
      password: "",
      address: "",
      allergies: "",
      conditions: "",
      medicalNotes: "",
    });
    setBookingLocationId("");
    setBookingDoctorId("");
    setBookingTime("");
    setBookingType("reception");
    setBookingNotes("");
    setForceBooking(false);
  };

  const releaseCurrentLock = async () => {
    const held = reservation.current;
    reservation.current = null;
    setCurrentLockId(null); setLockedSlotTime(null);
    if (!held) return;
    try { await api.delete("/appointments/lock-slot", { data: held }); }
    catch { /* The server reservation expires if release cannot be delivered. */ }
  };

  const handleSlotClick = async (slot: SlotInfo) => {
    if (!slot.available || slot.lockedByOther || slotLockPending.current) return;
    const fullSlotLocal = `${selectedSlotDate}T${slot.time}`;
    const fullSlotISO = locationLocalTimeToIso(selectedSlotDate, slot.time, timezoneForLocation(bookingLocationId));

    if (lockedSlotTime === fullSlotISO && currentLockId) {
      setBookingTime(fullSlotLocal);
      return;
    }

    slotLockPending.current = true;
    setLockingSlot(true);
    try {
      await releaseCurrentLock();
      const res = await api.post("/appointments/lock-slot", {
        locationId: bookingLocationId,
        doctorId: bookingDoctorId,
        slotTime: fullSlotISO,
      });
      const lockData = res.data?.data;
      if (!lockData?.lockId) throw new Error("The slot reservation could not be confirmed.");
      if (lockData?.lockId) reservation.current = { lockId: lockData.lockId, slotTime: fullSlotISO, locationId: bookingLocationId, doctorId: bookingDoctorId };
      setCurrentLockId(lockData?.lockId || null);
      setLockedSlotTime(fullSlotISO);
      setBookingTime(fullSlotLocal);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Could not reserve this slot";
      toast({ title: "Slot Unavailable", description: msg, variant: "error" });
      setFetchingSlots(true);
      try {
        const res = await api.get(`/doctors/${bookingDoctorId}/slots?locationId=${bookingLocationId}&date=${selectedSlotDate}`);
        setAvailableSlots(res.data?.data?.slots || []);
      } catch {
        /* ignore */
      } finally {
        setFetchingSlots(false);
      }
    } finally {
      slotLockPending.current = false;
      setLockingSlot(false);
    }
  };

  const openBookModal = () => {
    resetBookingForm();
    const locationId = filterLocation || (locations.length === 1 ? locations[0].id : "");
    setBookingLocationId(locationId);
    if (locationId) setSelectedSlotDate(locationDateKey(new Date(), timezoneForLocation(locationId)));
    setIsBookModalOpen(true);
  };

  const handleCloseBookModal = () => {
    releaseCurrentLock();
    setIsBookModalOpen(false);
    resetBookingForm();
  };

  const handleUpdateStatus = async () => {
    if (!updatingStatusId || !confirmStatus || statusSaving) return;
    setStatusSaving(true);
    const targetId = updatingStatusId;
    const targetStatus = confirmStatus;
    try {
      await api.put(`/appointments/${targetId}/status`, { status: targetStatus });
      toast({
        title: "Status Updated",
        description: `Appointment updated to ${targetStatus.replace("-", " ")}.`,
        variant: "success",
      });
      fetchAppointments();
      if (targetStatus === "in-consultation") {
        router.push(`/dashboard/consultations/${targetId}`);
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update appointment status.",
        variant: "error",
      });
    } finally {
      setStatusSaving(false);
      setUpdatingStatusId(null);
      setConfirmStatus(null);
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
      default:
        return "default";
    }
  };

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getAppointmentDropdownItems = (row: Appointment) => [
    {
      label: "View Booking Slip",
      icon: <Ticket className="w-4 h-4 text-text-muted" />,
      onClick: () => handleViewSlip(row),
    },
    ...(user?.role === "patient" && row.status === "completed" ? [{ label: "Review doctor", icon: <Stethoscope size={16} />, onClick: () => handleOpenReviewModal(row) }] : []),
    {
      label: "View Rx / EHR Summary",
      icon: <FileText className="w-4 h-4 text-text-muted" />,
      onClick: () => handleOpenRecordModal(row),
    },
    ...(canRecordNoShow(user, row)
      ? [{
          label: "Record no-show",
          icon: <CalendarOff className="w-4 h-4 text-warning" />,
          onClick: () => {
            setUpdatingStatusId(row.id);
            setConfirmStatus("no-show");
          },
        }]
      : []),
    ...((canManageAppointments || ["patient", "family_member"].includes(user?.role || "")) && !["completed", "cancelled", "no-show"].includes(row.status)
      ? [
          {
            label: "Reschedule Appointment",
            icon: <CalendarClock className="w-4 h-4 text-text-muted" />,
            onClick: () => handleOpenRescheduleModal(row),
          },
        ]
      : []),
    ...(user?.role === "doctor" &&
    (row.status === "confirmed" || row.status === "checked-in" || row.status === "in-consultation")
      ? [
          {
            label: "Open Encounter Workspace",
            icon: <Stethoscope className="w-4 h-4 text-accent" />,
            onClick: () => router.push(`/dashboard/consultations/${row.id}`),
          },
        ]
      : []),
    ...(canManageAppointments && row.status === "pending"
      ? [
          {
            label: "Mark Confirmed",
            icon: <CheckCircle2 className="w-4 h-4 text-accent" />,
            onClick: () => {
              setUpdatingStatusId(row.id);
              setConfirmStatus("confirmed");
            },
          },
        ]
      : []),
    ...(canManageAppointments && row.status === "confirmed"
      ? [
          {
            label: "Mark Checked-In",
            icon: <CheckCircle2 className="w-4 h-4 text-info" />,
            onClick: () => {
              setUpdatingStatusId(row.id);
              setConfirmStatus("checked-in");
            },
          },
        ]
      : []),
    ...(canManageAppointments && row.status === "checked-in"
      ? [
          {
            label: "Start Consultation",
            icon: <Stethoscope className="w-4 h-4 text-success-text" />,
            onClick: () => {
              setUpdatingStatusId(row.id);
              setConfirmStatus("in-consultation");
            },
          },
        ]
      : []),
    ...(canManageAppointments && row.status === "in-consultation"
      ? [
          {
            label: "Mark Completed",
            icon: <CheckCircle2 className="w-4 h-4 text-success-text" />,
            onClick: () => {
              setUpdatingStatusId(row.id);
              setConfirmStatus("completed");
            },
          },
        ]
      : []),
    ...(!["completed", "cancelled", "no-show"].includes(row.status)
      ? [
          { divider: true, label: "" },
          {
            label: "Cancel Appointment",
            icon: <XCircle className="w-4 h-4 text-danger" />,
            variant: "danger" as const,
            onClick: () => {
              setUpdatingStatusId(row.id);
              setConfirmStatus("cancelled");
            },
          },
        ]
      : []),
  ];

  if (!user) return null;

  return (
    <div className={styles.workspace}>
      <Suspense fallback={<p role="status">Loading linked booking...</p>}><AppointmentLinkSummary key={`${user.organization_id}:${user.id}`} /></Suspense>
      {loadError && <Alert variant="error" title="Unable to load appointments" action={<Button variant="outline" size="sm" onClick={fetchAppointments}>Try again</Button>}>{loadError}</Alert>}
      <header className={styles.header}>
        <div className={styles.heading}><h1>Appointments</h1><span aria-live="polite">{scopeReady ? totalAppointments : "—"}</span></div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" aria-label="Refresh appointments" onClick={fetchAppointments} disabled={isRefreshing} className={styles.iconButton}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>
          {user.role === "patient" ? <Button size="sm" onClick={() => router.push("/browse")}><Plus size={16} /> Book visit</Button>
            : canManageAppointments && user.role !== "doctor" ? <Button size="sm" onClick={() => preferences.registration === "essential" ? setIsEssentialEntryOpen(true) : openBookModal()}><Plus size={16} /> New booking</Button> : null}
        </div>
      </header>

      {/* Live Patient Queue Tracker (if active appointment today) */}
      {user.role === "patient" && (() => {
        const activeAppt = visibleAppointments.find((a: any) =>
          ["pending", "confirmed", "checked-in", "in-consultation"].includes(a.status) && a.reviewState !== "unresolved"
        );
        if (!activeAppt) return null;
        const locationObj = activeAppt.locationId as any;
        const doctorObj = activeAppt.doctorId as any;
        const resolvedLocationId = locationObj?._id || locationObj?.id || (typeof locationObj === "string" ? locationObj : "");
        const resolvedDoctorId = doctorObj?._id || doctorObj?.id || (typeof doctorObj === "string" ? doctorObj : "");
        if (!resolvedLocationId || !resolvedDoctorId) return null;
        return (
          <PatientQueueTracker
            appointmentId={activeAppt.id || (activeAppt as any)._id}
            locationId={resolvedLocationId}
            doctorId={resolvedDoctorId}
          />
        );
      })()}

      <section className={styles.toolbar} aria-label="Appointment controls">
        <div className={styles.viewRow}>
          <div className={styles.viewSwitch} role="group" aria-label="Schedule view">
            <button type="button" aria-pressed={viewLayout === "table"} onClick={() => setViewLayout("table")}><LayoutList size={16} /> List</button>
            <button type="button" aria-pressed={viewLayout === "calendar"} onClick={() => { setReviewOnly(false); setViewLayout("calendar"); }}><Calendar size={16} /> Calendar</button>
          </div>
          {!["patient", "family_member"].includes(user.role) && <Button size="sm" variant={reviewOnly ? "primary" : "ghost"} aria-pressed={reviewOnly} onClick={() => {
            const next = !reviewOnly; setReviewOnly(next); setFilterDate(next ? "" : getTodayISO()); setFilterStatus(""); if (next) setViewLayout("table");
          }}>Needs review</Button>}
          {filterLocation && <span className={styles.locationContext}><MapPin size={14} />{locations.find(location => location.id === filterLocation)?.name}</span>}
        </div>
        <div className={styles.searchRow}>
          <Input type="search" icon={<Search size={16} />} aria-label="Search all appointments" placeholder="Patient, doctor or token" value={listSearch} onChange={e => setListSearch(e.target.value)} />
          <Button variant="outline" size="sm" aria-label="Filter appointments" onClick={() => setFiltersOpen(true)} className={styles.filterButton}><SlidersHorizontal size={16} /><span className={styles.filterLabel}>Filters</span>{(filterStatus || filterDoctor || (filterDate && filterDate !== getTodayISO())) && <i className={styles.filterDot} />}</Button>
        </div>
        <div className={styles.filterSummary}>
          <span>{reviewOnly ? "Overdue and unresolved visits" : viewLayout === "calendar" ? "Calendar schedule" : filterDate ? filterDate.includes(" to ") ? filterDate.replace(" to ", " – ") : new Date(filterDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "All dates"}{filterStatus ? " · " + filterStatus.replaceAll("-", " ") : ""}</span>
          <span role="status" aria-live="polite">{loading ? "Loading appointments…" : isRefreshing ? "Updating…" : scopeReady ? totalAppointments + " matches" : ""}</span>
        </div>
      </section>
      {reviewOnly && <p className={styles.reviewNotice}>Recorded statuses stay unchanged until staff reviews attendance.</p>}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter appointments" size="md" footer={<><Button variant="outline" onClick={() => { setFilterDoctor(""); setFilterStatus(""); setReviewOnly(false); if (viewLayout !== "calendar") setFilterDate(getTodayISO()); }}>Reset filters</Button><Button onClick={() => setFiltersOpen(false)}>Done</Button></>}>
        <div className="space-y-4">
          {locations.length > 1 && <Select label="Location" value={filterLocation} onChange={e => { setFilterLocation(e.target.value); setFilterDoctor(""); }} options={[{ value: "", label: "All locations" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} />}
          {doctors.length > 1 && <Select label="Doctor" value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} options={[{ value: "", label: "All doctors" }, ...doctors.map(doctor => ({ value: doctor.id, label: doctor.name }))]} />}
          {viewLayout !== "calendar" && <DatePicker label="Date or date range" mode="range" value={filterDate} onChange={value => { setReviewOnly(false); setFilterDate(value); }} />}
          <Select label="Status" value={filterStatus} onChange={e => { setReviewOnly(false); setFilterStatus(e.target.value); }} options={[{ value: "", label: "All statuses" }, ...["pending", "pending_payment", "confirmed", "checked-in", "in-consultation", "completed", "cancelled", "no-show"].map(value => ({ value, label: value.replaceAll("-", " ").replaceAll("_", " ") }))]} />
        </div>
      </Modal>
      {viewLayout === "calendar" ? (
        <AppointmentCalendarView
          appointments={visibleAppointments as any}
          initialDate={filterDate.split(" to ")[0]}
          timeZone={filterLocation ? timezoneForLocation(filterLocation) : undefined}
          onRangeChange={(start, end) => setFilterDate(start === end ? start : `${start} to ${end}`)}
          loading={loading || isRefreshing}
          canReschedule={canManageAppointments || ["patient", "family_member"].includes(user.role)}
          onRescheduleClick={(appt: any) => handleOpenRescheduleModal(appt)}
        />
      ) : (
        <section className={styles.roster} aria-label="Appointment results" aria-busy={loading || isRefreshing}>
          <div className={styles.mobileList}>
            {loading ? <div className={styles.emptyState} role="status"><Spinner size="sm" /><p>Loading appointments…</p></div> : visibleAppointments.length ? visibleAppointments.map(row => (
              <article key={row.id} className={styles.appointmentCard}>
                <div className={styles.cardHeading}>
                  <button type="button" onClick={() => handleViewSlip(row)} className={styles.token} aria-label={"View booking slip for token " + (row.tokenNumber || "unassigned")}><Ticket size={14} /><strong>{row.tokenNumber ? "#" + row.tokenNumber : "—"}</strong></button>
                  <div className={styles.patientIdentity}><h2>{appointmentPatientName(row.patientId)}</h2><span>{appointmentPatientPhone(row.patientId) || "Phone not recorded"}</span></div>
                  <Dropdown align="right" trigger={<Button variant="ghost" size="sm" className={styles.iconButton} aria-label={"Options for " + appointmentPatientName(row.patientId)}><MoreHorizontal size={18} /></Button>} items={getAppointmentDropdownItems(row)} />
                </div>
                <div className={styles.cardStatus}><Badge variant={getStatusBadgeVariant(row.status)} size="sm" dot>{row.status.replaceAll("-", " ").replaceAll("_", " ")}</Badge><span>{row.appointmentType.replaceAll("-", " ").replaceAll("_", " ")}</span></div>
                {row.reviewState && <p className={styles.attendanceNotice}>{user.role === "patient" ? "Please contact reception" : row.reviewState === "unresolved" ? "Unresolved · review needed" : "Overdue · verify attendance"}</p>}
                <div className={styles.cardDetails}><span><Stethoscope size={14} />Dr. {(row.doctorId?.name || "Unassigned").replace(/^dr\.?\s+/i, "")}</span><span><Clock size={14} />{formatDateTime(row.appointmentTime)}</span><span><MapPin size={14} />{row.locationId?.name || "Location unavailable"}</span></div>
                {user.role === "doctor" && ["confirmed", "checked-in", "in-consultation"].includes(row.status) && <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/consultations/" + row.id)}>Open consultation <ArrowRight size={14} /></Button>}
              </article>
            )) : <div className={styles.emptyState}><Calendar size={24} /><h2>{loadError ? "Appointments unavailable" : "No appointments found"}</h2><p>{loadError ? "Try loading this view again." : "Change the search or filters to find a visit."}</p></div>}
          </div>
          <div className={styles.desktopList}>
            <Table<Appointment> data={visibleAppointments} loading={loading || isRefreshing} density="compact" variant="flat" pagination={false} searchable={false} showColumnVisibility={false} mobileCardView={false}
              columns={[
                {
                  key: "patientName",
                  header: "Patient",
                  sortable: false,
                  render: (row: Appointment) => (
                    <div className="space-y-0.5 min-w-[140px]">
                      <span className="font-bold text-text text-xs sm:text-sm">
                        {appointmentPatientName(row.patientId)}
                      </span>
                      <span className="text-xs text-accent block">{row.tokenNumber ? `Token #${row.tokenNumber}` : "Token not assigned"}</span>
                      {appointmentPatientPhone(row.patientId) && appointmentPatientPhone(row.patientId) !== "-" && (
                        <span className="text-xs text-text-muted block flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-muted shrink-0" />
                          {appointmentPatientPhone(row.patientId)}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "doctor",
                  header: "Practitioner",
                  sortable: false,
                  render: (row: Appointment) => (
                    <div className="space-y-0.5 min-w-[140px]">
                      <div className="flex items-center gap-1 text-xs font-semibold text-text">
                        <Stethoscope className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>Dr. {(row.doctorId?.name || "Unassigned").replace(/^dr\.?\s+/i, "")}</span>
                      </div>
                      <span className="text-[10px] text-text-muted block pl-4.5">
                        {row.locationId?.name || "Location unavailable"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "appointmentTime",
                  header: "Date & Time",
                  sortable: false,
                  render: (row: Appointment) => (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary min-w-[140px]">
                      <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{formatDateTime(row.appointmentTime)}<small className="block text-text-muted mt-1 capitalize">{row.appointmentType.replaceAll("-", " ")}</small></span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  sortable: false,
                  render: (row: Appointment) => (
                    <div className="space-y-1">
                    <Badge
                      variant={getStatusBadgeVariant(row.status)}
                      size="sm"
                      dot
                      className="capitalize font-semibold text-[10px]"
                    >
                      {row.status.replace("-", " ")}
                    </Badge>
                    {row.reviewState && <p className="text-[11px] text-warning-text">
                      {user?.role === "patient" ? "Please contact reception" : row.reviewState === "unresolved" ? "Unresolved · review needed" : "Overdue · verify attendance"}
                    </p>}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  width: "180px",
                  render: (row: Appointment) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleViewSlip(row)}
                        className="font-semibold rounded-lg text-xs shrink-0"
                      >
                        <Ticket className="w-3.5 h-3.5 mr-1" />
                        Slip
                      </Button>
                      <Dropdown
                        align="right"
                        trigger={
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-8 w-8 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text cursor-pointer"
                            aria-label="Appointment options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                        items={getAppointmentDropdownItems(row)}
                      />
                    </div>
                  ),
                },
              ]}
              emptyMessage={
                user.role === "patient"
                  ? "No visits found. Click 'Book Consultation' to schedule a doctor visit."
                  : "No clinical appointments found for active filters."
              }
            />
          </div>
        </section>
      )}
      <footer className={styles.pagination}><span>{scopeReady ? `${visibleAppointments.length} of ${totalAppointments} appointments` : "Loading appointments"}{viewLayout === "calendar" && listPages > 1 ? " ? Calendar shows this page" : ""}</span>{listPages > 1 && <div><Button variant="outline" size="sm" disabled={listPage <= 1 || isRefreshing || !scopeReady} onClick={() => setListPage(page => page - 1)}>Previous</Button><span>{listPage} / {listPages}</span><Button variant="outline" size="sm" disabled={listPage >= listPages || isRefreshing || !scopeReady} onClick={() => setListPage(page => page + 1)}>Next</Button></div>}</footer>

      {/* Patient Medical Records & Prescription Downloads */}
      {user.role === "patient" && (
        <div className="pt-6 border-t border-border/80">
          <PatientMedicalRecords patientId={user.id} />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. BOOK APPOINTMENT MODAL (3-STEP STEPPER WIZARD)
         ────────────────────────────────────────────────────────────────────────── */}
      <PatientEntryModal open={isEssentialEntryOpen} onClose={() => setIsEssentialEntryOpen(false)} locationId={filterLocation}
        onBooked={() => { setIsEssentialEntryOpen(false); fetchAppointments(); }}
        onFullRegistration={() => { setIsEssentialEntryOpen(false); openBookModal(); }} />
      <Modal
        open={isBookModalOpen}
        onClose={handleCloseBookModal}
        title="New appointment"
        description="Choose a patient, practitioner and appointment time."
        size="lg"
        busy={submitting || lockingSlot}
        footer={bookingStep === 1 ? <Button variant="outline" onClick={handleCloseBookModal}>Cancel</Button> : <><Button variant="outline" disabled={submitting || lockingSlot} onClick={() => setBookingStep(bookingStep - 1)}><ArrowLeft size={15} /> Back</Button>{bookingStep === 2 ? <Button onClick={handleStep2Next} disabled={!bookingLocationId || !bookingDoctorId}>Continue <ArrowRight size={15} /></Button> : <Button type="submit" form="appointment-booking" loading={submitting} disabled={!slotsReady || fetchingSlots || lockingSlot || !bookingTime}>Confirm booking</Button>}</>}
      >
        <div className={styles.bookingBody}>
          <nav className={styles.bookingProgress} aria-label="Booking progress">{BOOKING_STEPS.map((step, index) => <span key={step.label} aria-current={bookingStep === index + 1 ? "step" : undefined}>{index + 1}. {step.label}</span>)}</nav>

          {/* STEP 1: Patient Selection */}
          {bookingStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">Choose or Search Patient</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  icon={<Search className="w-4 h-4 text-text-muted" />}
                  aria-label="Search patients by name, email or mobile"
                  placeholder="Search by patient name, email, or mobile..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                  fullWidth
                />
                <Button onClick={handlePatientSearch} loading={searchLoading} className="font-semibold min-h-[44px] w-full sm:w-auto justify-center shrink-0">
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border border-border/80 rounded-2xl overflow-hidden bg-surface max-h-56 overflow-y-auto divide-y divide-border/60">
                  {searchResults.map((pt) => (
                    <div
                      key={pt.id}
                      className="p-3 hover:bg-surface-hover flex flex-col sm:flex-row justify-between sm:items-center transition-colors gap-2"
                    >
                      <div>
                        <p className="font-bold text-text text-xs sm:text-sm">{appointmentPatientName(pt)}</p>
                        <p className="text-xs text-text-muted">
                          {appointmentPatientPhone(pt)} &bull; {pt.userId?.email}
                        </p>
                      </div>
                      <Button size="xs" variant="primary" onClick={() => handleSelectPatient(pt)} className="rounded-lg font-semibold min-h-[38px] sm:min-h-[32px] px-3.5 w-full sm:w-auto justify-center">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center py-6 border border-dashed border-border/80 rounded-2xl bg-surface-alt/50 space-y-2 px-4">
                <UserPlus className="w-8 h-8 mx-auto text-text-muted" />
                <p className="text-xs text-text-muted">Cannot find existing record? Register a new patient profile.</p>
                <Button variant="outline" size="sm" onClick={handleCreateNewPatient} className="font-semibold min-h-[44px] w-full sm:w-auto">
                  Register New Patient
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Location, Doctor & Registration */}
          {bookingStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              {!isNewPatient && selectedPatient && <div className={styles.bookingPatient}><span>Patient</span><strong>{appointmentPatientName(selectedPatient)}</strong><small>{appointmentPatientPhone(selectedPatient)}</small></div>}
              {isNewPatient && (
                <div className="space-y-3.5 border-b border-border/60 pb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">Patient Registration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      icon={<User className="w-4 h-4 text-text-muted" />}
                      label="Full Name *"
                      placeholder="e.g. Rahul Sharma"
                      value={newPatientForm.name}
                      onChange={(e) => handleNewPatientChange("name", e.target.value)}
                      onBlur={() => validateNewPatientField("name", newPatientForm.name)}
                      error={bookingErrors.name}
                      required
                    />
                    <DatePicker
                      label="Date of Birth *"
                      value={newPatientForm.dob}
                      maxDate={new Date()}
                      onChange={(val) => {
                        const strVal = val;
                        handleNewPatientChange("dob", strVal);
                        validateNewPatientField("dob", strVal);
                      }}
                      error={bookingErrors.dob}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Select
                      label="Gender *"
                      value={newPatientForm.gender}
                      onChange={(e) => handleNewPatientChange("gender", e.target.value)}
                      options={[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                        { value: "other", label: "Other" },
                      ]}
                      required
                    />
                    <Input
                      icon={<Phone className="w-4 h-4 text-text-muted" />}
                      prefix="+91"
                      label="Mobile Phone Number"
                      placeholder="98765 43210"
                      value={newPatientForm.phone}
                      onChange={(e) => handleNewPatientChange("phone", e.target.value)} type="tel" inputMode="tel"
                    />
                  </div>
                  <details className={styles.patientDetails}><summary>More patient details</summary><div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      icon={<Mail className="w-4 h-4 text-text-muted" />}
                      label="Email Address"
                      type="email"
                      placeholder="rahul@example.com"
                      value={newPatientForm.email}
                      onChange={(e) => handleNewPatientChange("email", e.target.value)}
                    />
                    <Input
                      icon={<MapPin className="w-4 h-4 text-text-muted" />}
                      label="Address"
                      placeholder="City, District"
                      value={newPatientForm.address}
                      onChange={(e) => handleNewPatientChange("address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Allergies (comma separated)"
                      placeholder="e.g. Penicillin, Peanuts"
                      value={newPatientForm.allergies}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, allergies: e.target.value })}
                    />
                    <Input
                      label="Chronic Conditions (comma separated)"
                      placeholder="e.g. Hypertension, Diabetes"
                      value={newPatientForm.conditions}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, conditions: e.target.value })}
                    />
                  </div>
                  <Textarea
                    label="Medical Notes / Medical History"
                    placeholder="Relevant clinical background..."
                    value={newPatientForm.medicalNotes}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, medicalNotes: e.target.value })}
                    rows={2}
                  />
                  </div></details>
                </div>
              )}

              <div className="space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">Facility & Practitioner</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {locations.length === 1 ? <div className={styles.scopeContext}><span>Location</span><strong>{locations[0].name}</strong></div> : <Select
                    icon={<Building2 className="w-4 h-4 text-text-muted" />}
                    label="Choose Location *"
                    disabled={lockingSlot}
                    value={bookingLocationId}
                    onChange={(e) => {
                      void releaseCurrentLock();
                      setBookingLocationId(e.target.value);
                      setSelectedSlotDate(locationDateKey(new Date(), timezoneForLocation(e.target.value)));
                    }}
                    options={[{ value: "", label: "Select location..." }, ...locations.map((c) => ({ value: c.id, label: c.name }))]}
                    required
                  />}
                  {doctorAssignments.length === 1 ? <div className={styles.scopeContext}><span>Practitioner</span><strong>{doctorAssignments[0].doctorId?.name || doctors.find(doctor => doctor.id === bookingDoctorId)?.name || "Assigned practitioner"}</strong></div> : <Select
                    icon={<Stethoscope className="w-4 h-4 text-text-muted" />}
                    label="Choose Doctor *"
                    value={bookingDoctorId}
                    onChange={(e) => { void releaseCurrentLock(); setBookingDoctorId(e.target.value); }}
                    options={[
                      { value: "", label: "Select practitioner..." },
                      ...doctorAssignments.map((a) => ({
                        value: a.doctorId?.id || a.doctorId,
                        label: `Dr. ${a.doctorId?.name} (${a.doctorId?.specialization || "General"})`,
                      })),
                    ]}
                    disabled={!bookingLocationId || lockingSlot}
                    required
                  />}
                </div>
              </div>


            </div>
          )}

          {/* STEP 3: Live Time Slots & Schedule Picker */}
          {bookingStep === 3 && (
            <form id="appointment-booking" onSubmit={handleConfirmBooking} className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text">Date & Time Slot</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <DatePicker
                  label="Select Date *"
                  mode="date"
                  value={selectedSlotDate}
                  onChange={(val) => { void releaseCurrentLock(); setSelectedSlotDate(val); }}
                  disabled={lockingSlot}
                  fullWidth
                />

                <Select
                  icon={<Ticket className="w-4 h-4 text-text-muted" />}
                  label="Appointment Type"
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value as any)}
                  options={[
                    { value: "reception", label: "Reception Booking" },
                    { value: "walk-in", label: "Walk-In Consultation" },
                    { value: "online", label: "Online Telehealth Booking" },
                  ]}
                />
              </div>

              {slotsReady && doctorHolidayInfo?.isHoliday && <Alert variant="warning" title="Practitioner unavailable">{doctorHolidayInfo.reason || "Leave has been recorded for this date."} Choose another date, or use the emergency override for an exceptional booking.</Alert>}
              {/* Slot Availability Grid OR Sequential Queue Notice */}
              {!slotsReady || fetchingSlots ? <div className="min-h-32 flex items-center justify-center text-sm text-text-muted" role="status">{slotError ? <Alert variant="error" action={<Button variant="outline" size="sm" onClick={() => setSlotRetry(value => value + 1)}>Retry availability</Button>}>{slotError}</Alert> : <><Spinner size="sm" /> Loading availability...</>}</div> : doctorBookingMode === "sequential_queue" ? (
                <div className="p-4 bg-primary-500/[0.04] border border-primary-500/20 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-text">Sequential Token Queue</span>
                    <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                      Auto-Token
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">A queue token will be assigned when the appointment is confirmed for the selected date.</p>
                </div>
              ) : (
                <div className="space-y-2 border-t border-border/60 pt-3">


                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-text">Available Time Slots for {selectedSlotDate}</span>
                    {fetchingSlots && <span className="text-text-muted text-[11px]">Calculating...</span>}
                  </div>

                  {fetchingSlots ? (
                    <div className="py-4 text-center">
                      <Spinner size="sm" label="Fetching time slots..." />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-3 bg-warning/[0.06] border border-warning/20 rounded-xl text-xs text-warning-text dark:text-warning-text">
                      No 15-min open slots for this date. You may specify a custom time below or choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                      {availableSlots
                        .filter((s) => s.available)
                        .map((slot) => {
                          const fullSlotLocal = `${selectedSlotDate}T${slot.time}`;
                          const isSelected = bookingTime === fullSlotLocal;
                          const isHeldByOther = slot.lockedByOther;
                          const isMyLock = isSelected && currentLockId;

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!!isHeldByOther || lockingSlot}
                              onClick={() => handleSlotClick(slot)}
                              className={cn(
                                "px-2 py-2 text-xs font-bold rounded-xl border transition-all relative select-none cursor-pointer min-h-[40px] flex items-center justify-center",
                                isSelected
                                    ? "bg-primary-500 text-brand-mist border-primary-500 shadow-xs"
                                    : isHeldByOther
                                    ? "bg-warning/10 text-warning-text border-warning cursor-not-allowed opacity-60"
                                    : "bg-surface hover:bg-surface-hover text-text border-border"
                              )}
                            >
                              {slot.time}
                              {isHeldByOther && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning" />
                              )}
                              {isMyLock && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-success" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <div className="pt-2">
                    <DatePicker mode="time" label="Selected time *" value={bookingTime.slice(11, 16)} onChange={value => { void releaseCurrentLock(); setBookingTime(value ? selectedSlotDate + "T" + value : ""); }} disabled={lockingSlot} required />
                  </div>
                </div>
              )}

              <Textarea
                label="Appointment Notes"
                placeholder="Reason for visit, presenting symptoms..."
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                rows={2}
              />

              <div className="p-3 bg-warning/[0.06] border border-warning/20 rounded-xl">
                <Checkbox
                  id="forceBooking"
                  label="Emergency Walk-in / Capacity Override (Bypass Closing Cutoff)"
                  checked={forceBooking}
                  onChange={(e) => setForceBooking(e.target.checked)}
                />
                <p className="text-[11px] text-text-muted mt-1 ml-6 leading-relaxed">
                  Enable this to book an urgent patient even if queue backlog exceeds doctor&apos;s remaining hours today.
                </p>
              </div>

              <div className="p-3.5 bg-surface-alt border border-border/80 rounded-2xl space-y-1 text-xs">
                <h4 className="font-bold text-text">Booking Summary Confirmation</h4>
                <p className="text-text-muted">
                  <strong>Patient:</strong> {isNewPatient ? newPatientForm.name : appointmentPatientName(selectedPatient)} &bull;{" "}
                  <strong>Doctor:</strong> Dr. {doctors.find((d) => d.id === bookingDoctorId)?.name} &bull;{" "}
                  <strong>Location:</strong> {locations.find((c) => c.id === bookingLocationId)?.name}
                </p>
              </div>


            </form>
          )}
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. CONFIRM STATUS CHANGE DIALOG
         ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!updatingStatusId && !!confirmStatus}
        onClose={() => {
          setUpdatingStatusId(null);
          setConfirmStatus(null);
        }}
        onConfirm={handleUpdateStatus}
        loading={statusSaving}
        title="Change Appointment Status?"
        description={confirmStatus === "no-show" ? "Confirm that this patient did not attend the scheduled visit. Reception will receive a recovery task; invoices and payments require separate review." : `Mark this appointment as ${confirmStatus}? Staff and the patient will see the updated status.`}
        variant={confirmStatus === "cancelled" || confirmStatus === "no-show" ? "danger" : "primary"}
        confirmLabel={confirmStatus === "cancelled" ? "Cancel appointment" : confirmStatus === "no-show" ? "Mark no-show" : "Update status"}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          6. APPOINTMENT TOKEN SLIP MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment token slip"
        size="md"
        footerClassName={styles.printFooter}
        footer={<PrintDialogActions documentName="token slip" onPrint={() => handlePrintSlip(createdTicket)} onClose={() => setTicketModalOpen(false)} disabled={!createdTicket} closeLabel="Done" />}
      >
        {createdTicket && (
          <div className="space-y-4 py-1">
            <div className="border border-border/80 rounded-2xl p-4 sm:p-5 bg-surface-alt relative overflow-hidden shadow-xs space-y-3">
              <div className="text-center border-b border-border/60 border-dashed pb-3">
                <span className="text-[10px] font-bold text-accent dark:text-accent tracking-wider uppercase block">
                  Healthcare System
                </span>
                <h3 className="text-base font-bold text-text mt-0.5">{createdTicket.locationName}</h3>
                <p className="text-[10px] text-text-muted mt-0.5">{createdTicket.locationAddress}</p>
              </div>

              <div className="text-center my-2">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">
                  Queue Token Number
                </span>
                <div className="text-4xl font-black text-accent dark:text-accent tracking-tight my-1">
                  #{createdTicket.tokenNumber}
                </div>
                <Badge
                  variant={getStatusBadgeVariant(createdTicket.status)}
                  size="sm"
                  className="capitalize font-bold text-[10px]"
                >
                  {createdTicket.status.replace("-", " ")}
                </Badge>
              </div>

              <div className={cn(styles.slipDetails, "space-y-2 text-xs text-text-secondary border-t border-border/60 pt-3")}>
                <div className="flex justify-between">
                  <span className="text-text-muted">Patient:</span>
                  <span className="font-semibold text-text">{createdTicket.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Practitioner:</span>
                  <span className="font-semibold text-text">Dr. {createdTicket.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Specialty:</span>
                  <span className="font-semibold text-text">{createdTicket.doctorSpecialty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Scheduled Slot:</span>
                  <span className="font-semibold text-text">
                    {formatDateTime(createdTicket.appointmentTime)}
                  </span>
                </div>
              </div>
            </div>


          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. DOCTOR REVIEW MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review Dr. ${reviewDoctorName}`}
        size="sm"
        busy={reviewSubmitting}
        footer={<><Button variant="outline" disabled={reviewSubmitting} onClick={() => setReviewModalOpen(false)}>Cancel</Button><Button type="submit" form="appointment-review" loading={reviewSubmitting}>Submit review</Button></>}
      >
        <form id="appointment-review" onSubmit={handleSubmitReview} className="space-y-4 pt-1">
          <p className="text-xs text-text-muted leading-relaxed">
            How was your clinical consultation experience with Dr. {reviewDoctorName}? Please select a star rating.
          </p>

          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                onClick={() => setRatingValue(star)}
                className="focus:outline-none text-3xl cursor-pointer transition-transform hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl"
              >
                <span className={star <= ratingValue ? "text-warning-text" : "text-border"}>★</span>
              </button>
            ))}
          </div>


        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. EHR RECORD & PRESCRIPTION PRINT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={recordModalOpen}
        onClose={() => {
          beginRecordRead();
          setRecordModalOpen(false);
          setActiveRecord(null);
        }}
        title="Clinical Consultation Record"
        size="xl"
        footerClassName={styles.printFooter}
        footer={<PrintDialogActions documentName="prescription" onPrint={async () => {
                  if (!activeRecord) return;

                  const locationName = activeRecord.locationId?.name || "Healthcare Facility";
                  const locationAddress =
                    [activeRecord.locationId?.address, activeRecord.locationId?.city].filter(Boolean).join(", ") ||
                    "Main Facility Campus";
                  const patientName = appointmentPatientName(activeRecord.patientId);
                  const rawDoctorName = activeRecord.doctorId?.name || "Practitioner";
                  const cleanDoctorName = rawDoctorName.replace(/^dr\.?\s+/i, "");
                  const doctorFormatted = `Dr. ${cleanDoctorName}`;
                  const doctorSpec = activeRecord.doctorId?.specialization || "General Medicine";
                  const apptDate = new Date(activeRecord.appointmentTime).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  const tokenNo = activeRecord.tokenNumber || "1";
                  const symptoms = activeRecord.symptoms || "No symptoms recorded.";
                  const diagnosis = activeRecord.diagnosis || "No diagnosis recorded.";
                  const rxItems = (activeRecord.prescriptions || [])
                    .map(
                      (m: any) => `
                    <tr>
                      <td style="padding: 8px 12px; font-weight: 700; color: var(--print-text); border-bottom: 1px solid var(--print-border);">${m.name}</td>
                      <td style="padding: 8px 12px; color: var(--print-secondary); border-bottom: 1px solid var(--print-border);">${m.dosage}</td>
                      <td style="padding: 8px 12px; color: var(--print-secondary); border-bottom: 1px solid var(--print-border);">${m.duration}</td>
                    </tr>
                  `
                    )
                    .join("");

                  await printHtml(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Prescription Slip - Token #${tokenNo}</title>
                        <style>${getPrintBrandStyles()}
                          @page { size: A4 portrait; margin: 12mm; }
                          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: var(--print-text); background: #ffffff; margin: 0; padding: 10px; line-height: 1.4; font-size: 12px; }
                          .header-bar { border-bottom: 3px solid var(--print-accent); padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
                          .location-title { font-size: 20px; font-weight: 800; color: var(--print-accent); margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
                          .location-sub { font-size: 11px; color: var(--print-muted); margin-top: 3px; }
                          .token-badge { background: var(--print-accent); color: #ffffff; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; display: inline-block; }
                          .meta-box { background: var(--print-background); border: 1px solid var(--print-border); border-radius: 8px; padding: 12px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
                          .meta-label { font-weight: 600; color: var(--print-muted); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
                          .meta-value { font-weight: 700; color: var(--print-text); margin-top: 1px; }
                          .rx-header { font-size: 28px; font-weight: 900; color: var(--print-accent); font-style: italic; margin-bottom: 6px; font-family: Georgia, serif; }
                          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--print-accent); border-bottom: 1.5px solid var(--print-surface-muted); padding-bottom: 3px; margin-top: 16px; margin-bottom: 8px; letter-spacing: 0.5px; }
                          .section-body { font-size: 13px; color: var(--print-secondary); margin-bottom: 12px; background: #ffffff; }
                          table { width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid var(--print-border); border-radius: 6px; overflow: hidden; }
                          th { background: var(--print-surface-muted); color: var(--print-secondary); font-weight: 700; font-size: 11px; text-transform: uppercase; text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--print-input-border); }
                          .signature-box { margin-top: 40px; display: flex; justify-content: flex-end; }
                          .sig-line { border-top: 1.5px solid var(--print-muted); width: 200px; text-align: center; padding-top: 4px; font-size: 11px; font-weight: 600; color: var(--print-secondary); }
                          .footer-bar { margin-top: 30px; border-top: 1px solid var(--print-border); padding-top: 10px; text-align: center; font-size: 10px; color: var(--print-muted); }
                        </style>
                      </head>
                      <body>
                        <div class="header-bar">
                          <div>
                            <h1 class="location-title">${locationName}</h1>
                            <div class="location-sub">${locationAddress}</div>
                          </div>
                          <div>
                            <span class="token-badge">Token #${tokenNo}</span>
                          </div>
                        </div>

                        <div class="meta-box">
                          <div>
                            <div class="meta-label">Patient Name</div>
                            <div class="meta-value">${patientName}</div>
                          </div>
                          <div>
                            <div class="meta-label">Attending Doctor</div>
                            <div class="meta-value">${doctorFormatted} <span style="font-weight: 400; color: var(--print-muted);">(${doctorSpec})</span></div>
                          </div>
                          <div>
                            <div class="meta-label">Consultation Date</div>
                            <div class="meta-value">${apptDate}</div>
                          </div>
                          <div>
                            <div class="meta-label">Medical Record Status</div>
                            <div class="meta-value" style="color: var(--print-success);">Verified EHR Record</div>
                          </div>
                        </div>

                        <div class="section-title">Chief Complaints / Presenting Symptoms</div>
                        <div class="section-body">${symptoms}</div>

                        <div class="section-title">Diagnosis & Clinical Assessment</div>
                        <div class="section-body"><strong>${diagnosis}</strong></div>

                        <div class="rx-header">Rx</div>
                        ${
                          rxItems.length > 0
                            ? `
                          <table>
                            <thead>
                              <tr>
                                <th>Medication Name</th>
                                <th>Dosage / Instructions</th>
                                <th>Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${rxItems}
                            </tbody>
                          </table>
                        `
                            : `<p style="font-size: 12px; color: var(--print-muted); font-style: italic;">No medications prescribed.</p>`
                        }

                        <div class="signature-box">
                          <div class="sig-line">
                            ${doctorFormatted}<br/>
                            <span style="font-size: 10px; font-weight: 400; color: var(--print-muted);">Authorized Signatory</span>
                          </div>
                        </div>

                        <div class="footer-bar">
                          Official Electronic Medical Prescription &bull; Ekavyu EMR
                        </div>
                      </body>
                    </html>
                  `);

                }} onClose={() => {
          beginRecordRead();
          setRecordModalOpen(false);
          setActiveRecord(null);
        }} disabled={!activeRecord || recordLoading || !!recordError} />}
      >
        {recordLoading ? <div className={styles.emptyState} role="status"><Spinner size="sm" /><p>Loading clinical record...</p></div> : recordError ? <Alert variant="error" title="Clinical record unavailable" action={<Button variant="outline" onClick={() => activeRecord && handleOpenRecordModal(activeRecord)}>Try again</Button>}>{recordError}</Alert> : activeRecord && (
          <div className="space-y-4 pt-1">
            <div
              id="printable-prescription"
              className={styles.recordPreview}
            >
              <div className="border-b border-border/60 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-accent dark:text-accent uppercase tracking-wide">
                    {activeRecord.locationId?.name || "Healthcare Facility"}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {[activeRecord.locationId?.address, activeRecord.locationId?.city].filter(Boolean).join(", ") ||
                      "Main Facility Campus"}
                  </p>
                </div>
                <Badge variant="primary" size="sm" className="font-bold">
                  Token #{activeRecord.tokenNumber || "1"}
                </Badge>
              </div>

              {/* Consultation Summary Metas */}
              <div className={styles.recordMeta}>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Patient</span>
                  <span className="font-bold text-text">{appointmentPatientName(activeRecord.patientId)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Practitioner</span>
                  <span className="font-bold text-text">
                    Dr. {(activeRecord.doctorId?.name || "Doctor").replace(/^dr\.?\s+/i, "")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Date</span>
                  <span className="font-medium text-text">
                    {new Date(activeRecord.appointmentTime).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">EHR Status</span>
                  <span className="font-semibold text-success-text dark:text-success-text">Recorded summary</span>
                </div>
              </div>

              {/* Symptoms */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted block border-b border-border/60 pb-1">
                  Chief Complaints / Presenting Symptoms
                </span>
                <p className="text-xs text-text-secondary pt-0.5">{activeRecord.symptoms || "No symptoms recorded."}</p>
              </div>

              {/* Diagnosis */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted block border-b border-border/60 pb-1">
                  Diagnosis & Clinical Assessment
                </span>
                <p className="text-xs text-text font-bold pt-0.5">{activeRecord.diagnosis || "No diagnosis recorded."}</p>
              </div>

              {/* Prescriptions Table */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted block border-b border-border/60 pb-1">
                  Prescribed Medications
                </span>
                {activeRecord.prescriptions && activeRecord.prescriptions.length > 0 ? (
                  <><dl className={styles.medications}>{activeRecord.prescriptions.map((med: any, index: number) => <div key={index}><dt>{med.name}</dt><dd>{med.dosage || "Instructions not recorded"}</dd><dd>Duration: {med.duration || "Not recorded"}</dd></div>)}</dl><div className={cn(styles.recordTable, "border border-border/60 rounded-xl bg-surface")}>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-alt border-b border-border/60 text-text font-bold uppercase text-[10px]">
                          <th className="p-2.5">Medication Name</th>
                          <th className="p-2.5">Dosage / Instructions</th>
                          <th className="p-2.5">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-text-secondary">
                        {activeRecord.prescriptions.map((med: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-text">{med.name}</td>
                            <td className="p-2.5">{med.dosage}</td>
                            <td className="p-2.5">{med.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div></>
                ) : (
                  <p className="text-xs italic text-text-muted">No medications prescribed.</p>
                )}
              </div>
            </div>


          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          9. RESCHEDULE APPOINTMENT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!rescheduleTargetAppt}
        onClose={() => setRescheduleTargetAppt(null)}
        title={`Reschedule appointment #${rescheduleTargetAppt?.tokenNumber || ""}`}
        size="md"
        busy={submittingReschedule}
        footer={<><Button variant="outline" disabled={submittingReschedule} onClick={() => setRescheduleTargetAppt(null)}>Cancel</Button><Button type="submit" form="appointment-reschedule" loading={submittingReschedule}>Confirm reschedule</Button></>}
      >
        <form id="appointment-reschedule" onSubmit={handleRescheduleSubmit} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 text-xs space-y-1">
            <p className="font-bold text-text">Patient: {appointmentPatientName(rescheduleTargetAppt?.patientId)}</p>
            <p className="text-text-muted">Doctor: Dr. {rescheduleTargetAppt?.doctorId?.name}</p>
            <p className="text-text-muted">
              Current Time:{" "}
              {rescheduleTargetAppt?.appointmentTime ? formatDateTime(rescheduleTargetAppt.appointmentTime) : ""}
            </p>
          </div>

          <DatePicker
            label="New Date & Time *"
            mode="datetime"
            value={rescheduleTime}
            onChange={(val) => setRescheduleTime(val)}
            fullWidth
          />

          <Textarea
            label="Reason for Rescheduling (Optional)"
            placeholder="e.g. Patient requested time change, practitioner schedule adjustment..."
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            rows={2}
          />


        </form>
      </Modal>
    </div>
  );
}
