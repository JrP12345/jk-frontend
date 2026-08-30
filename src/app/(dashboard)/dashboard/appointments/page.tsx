"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  DatePicker,
  Select,
  Textarea,
  useToast,
  Spinner,
  Badge,
  ConfirmDialog,
  Stepper,
  Dropdown,
  cn,
} from "@/components/ui";
import { PatientQueueTracker } from "@/components/clinical/PatientQueueTracker";
import { PatientMedicalRecords } from "@/components/ehr/PatientMedicalRecords";
import { AppointmentCalendarView } from "@/components/clinical/AppointmentCalendarView";
import {
  RotateCw,
  Plus,
  LayoutList,
  Calendar,
  Search,
  Ticket,
  FileText,
  MoreHorizontal,
  Stethoscope,
  MapPin,
  User,
  Clock,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Printer,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarClock,
  Sparkles,
  Phone,
  Building2,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const BOOKING_STEPS = [
  { label: "Patient", description: "Search or Register" },
  { label: "Practitioner", description: "Facility & Doctor" },
  { label: "Schedule", description: "Time & Notes" },
];

interface Appointment {
  id: string;
  clinicId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; email: string; phone: string; specialization: string };
  patientId: {
    id: string;
    dob: string;
    gender: string;
    allergies: string[];
    conditions: string[];
    userId: { name: string; email: string; phone: string };
  };
  appointmentTime: string;
  appointmentType: string;
  status: string;
  tokenNumber: number;
  notes: string;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { user, activeClinicId } = useAuthStore();
  const { clinics, fetchClinics } = useClinicStore();
  const canManageAppointments = hasAnyPermission(user, "MANAGE_APPOINTMENTS");
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [doctors, setDoctors] = useState<any[]>([]);
  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [filterClinic, setFilterClinic] = useState(activeClinicId || "");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState(user?.role === "patient" ? "" : getTodayISO());
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setFilterClinic(activeClinicId || "");
  }, [activeClinicId]);

  useEffect(() => {
    if (user?.role === "patient") {
      setFilterDate("");
    }
  }, [user?.role]);

  // Modal States
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

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
  const [bookingClinicId, setBookingClinicId] = useState("");
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
  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split("T")[0]);

  // Slot Lock State
  const [currentLockId, setCurrentLockId] = useState<string | null>(null);
  const [lockingSlot, setLockingSlot] = useState(false);
  const [lockedSlotTime, setLockedSlotTime] = useState<string | null>(null);

  const [doctorBookingMode, setDoctorBookingMode] = useState<"time_slot" | "sequential_queue">("sequential_queue");
  const [nextTokenNum, setNextTokenNum] = useState<number | null>(null);
  const [tokensTodayCount, setTokensTodayCount] = useState<number>(0);

  useEffect(() => {
    if (!bookingDoctorId || !selectedSlotDate) return;
    const fetchSlots = async () => {
      try {
        setFetchingSlots(true);
        const res = await api.get(`/doctors/${bookingDoctorId}/slots?clinicId=${bookingClinicId}&date=${selectedSlotDate}`);
        const data = res.data?.data;
        const slotsData = data?.slots || [];
        setAvailableSlots(slotsData);
        const mode = data?.bookingMode || "sequential_queue";
        setDoctorBookingMode(mode);
        setNextTokenNum(data?.nextToken || null);
        setTokensTodayCount(data?.tokensToday || 0);

        if (mode === "sequential_queue") {
          setBookingTime(`${selectedSlotDate}T00:00:00`);
        }
      } catch {
        setAvailableSlots([]);
        setDoctorBookingMode("sequential_queue");
      } finally {
        setFetchingSlots(false);
      }
    };
    fetchSlots();
  }, [bookingDoctorId, bookingClinicId, selectedSlotDate]);

  // Status Update State
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

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
    setRescheduleTime(appt.appointmentTime ? new Date(appt.appointmentTime).toISOString().slice(0, 16) : "");
    setRescheduleReason("");
    setBookingDoctorId((appt.doctorId as any)?.id || (appt.doctorId as any)?._id || "");
    setBookingClinicId((appt.clinicId as any)?.id || (appt.clinicId as any)?._id || "");
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
        newTime: rescheduleTime,
        reason: rescheduleReason,
        ...(currentLockId ? { lockId: currentLockId } : {}),
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

  const handleOpenRecordModal = async (appt: Appointment) => {
    try {
      const res = await api.get(`/encounters/${appt.id}/summary-report`);
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
      setRecordModalOpen(true);
    } catch {
      setActiveRecord(appt);
      setRecordModalOpen(true);
    }
  };

  const handleViewSlip = (appt: Appointment) => {
    setCreatedTicket({
      tokenNumber: appt.tokenNumber,
      patientName: appt.patientId?.userId?.name || "Patient",
      doctorName: appt.doctorId?.name || "Doctor",
      doctorSpecialty: appt.doctorId?.specialization || "General Medicine",
      clinicName: appt.clinicId?.name || "Healthcare Facility",
      clinicAddress: appt.clinicId?.address || "Clinic Address",
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

  const handlePrintSlip = (ticketData: any) => {
    if (!ticketData) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Appointment Token Slip - #${ticketData.tokenNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; padding: 20px; }
            .ticket { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; width: 380px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: left; }
            .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
            .brand { font-size: 12px; font-weight: 800; color: #0d9488; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
            .clinic-name { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
            .token-box { text-align: center; margin: 16px 0; }
            .token-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; }
            .token-num { font-size: 48px; font-weight: 800; color: #0d9488; margin: 4px 0; line-height: 1; }
            .details { font-size: 13px; color: #4b5563; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { font-weight: 500; color: #6b7280; }
            .val { font-weight: 600; color: #1f2937; text-align: right; }
            .footer { border-top: 1px solid #f3f4f6; margin-top: 24px; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af; }
            @media print {
              body { background: white; padding: 0; }
              .ticket { box-shadow: none; border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="brand">ANANT Health OS</div>
              <h1 class="clinic-name">${ticketData.clinicName}</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${ticketData.clinicAddress}</p>
            </div>
            <div class="token-box">
              <span class="token-label">Queue Token Number</span>
              <div class="token-num">#${ticketData.tokenNumber}</div>
              <span style="font-size: 12px; color: #10b981; font-weight: 700;">✓ Confirmed Schedule</span>
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
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchAppointments = async () => {
    try {
      setIsRefreshing(true);
      const queryParams = [];
      if (filterClinic) queryParams.push(`clinicId=${filterClinic}`);
      if (filterDoctor) queryParams.push(`doctorId=${filterDoctor}`);
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
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
      const res = await api.get(`/appointments${queryString}`);
      setAppointments(res.data.data || []);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load appointments list",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchClinicsAndDoctors = async () => {
    if (!user || user.role === "patient") return;
    try {
      const [, staffRes] = await Promise.all([fetchClinics(), api.get("/onboarding/staff")]);
      setDoctors(staffRes.data.data.doctors || []);
    } catch (err) {
      console.error("Failed to load clinics or doctors", err);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filterClinic, filterDoctor, filterDate, filterStatus]);

  useEffect(() => {
    if (user) {
      fetchClinicsAndDoctors();
    }
  }, [user?.id, user?.role]);

  // Fetch doctor assignments when booking clinic changes
  useEffect(() => {
    if (!bookingClinicId) {
      setDoctorAssignments([]);
      return;
    }
    const fetchAssignments = async () => {
      try {
        const res = await api.get(`/onboarding/doctors/assignments?clinicId=${bookingClinicId}`);
        setDoctorAssignments(res.data.data || []);
      } catch (err) {
        console.error("Failed to load doctor assignments", err);
      }
    };
    fetchAssignments();
  }, [bookingClinicId]);

  const handlePatientSearch = async () => {
    if (!patientSearch) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/patients?search=${patientSearch}`);
      setSearchResults(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Patient search failed", variant: "error" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setBookingStep(2);
  };

  const handleCreateNewPatient = () => {
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

    setSubmitting(true);
    try {
      const bookingData: any = {
        clinicId: bookingClinicId,
        doctorId: bookingDoctorId,
        appointmentTime: bookingTime,
        appointmentType: bookingType,
        notes: bookingNotes,
        ...(currentLockId ? { lockId: currentLockId } : {}),
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
    setBookingClinicId("");
    setBookingDoctorId("");
    setBookingTime("");
    setBookingType("reception");
    setBookingNotes("");
  };

  const releaseCurrentLock = async () => {
    if (currentLockId && lockedSlotTime && bookingClinicId && bookingDoctorId) {
      try {
        await api.delete("/appointments/lock-slot", {
          data: {
            clinicId: bookingClinicId,
            doctorId: bookingDoctorId,
            slotTime: lockedSlotTime,
            lockId: currentLockId,
          },
        });
      } catch {
        // Non-critical: lock will auto-expire
      }
    }
    setCurrentLockId(null);
    setLockedSlotTime(null);
  };

  const handleSlotClick = async (slot: SlotInfo) => {
    if (!slot.available || slot.lockedByOther) return;
    const fullSlotISO = `${selectedSlotDate}T${slot.time}:00`;

    if (lockedSlotTime === fullSlotISO && currentLockId) {
      setBookingTime(fullSlotISO);
      return;
    }

    await releaseCurrentLock();

    setLockingSlot(true);
    try {
      const res = await api.post("/appointments/lock-slot", {
        clinicId: bookingClinicId,
        doctorId: bookingDoctorId,
        slotTime: fullSlotISO,
      });
      const lockData = res.data?.data;
      setCurrentLockId(lockData?.lockId || null);
      setLockedSlotTime(fullSlotISO);
      setBookingTime(fullSlotISO);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Could not reserve this slot";
      toast({ title: "Slot Unavailable", description: msg, variant: "error" });
      setFetchingSlots(true);
      try {
        const res = await api.get(`/doctors/${bookingDoctorId}/slots?clinicId=${bookingClinicId}&date=${selectedSlotDate}`);
        setAvailableSlots(res.data?.data?.slots || []);
      } catch {
        /* ignore */
      } finally {
        setFetchingSlots(false);
      }
    } finally {
      setLockingSlot(false);
    }
  };

  const openBookModal = () => {
    resetBookingForm();
    setIsBookModalOpen(true);
  };

  const handleCloseBookModal = () => {
    releaseCurrentLock();
    setIsBookModalOpen(false);
    resetBookingForm();
  };

  const handleUpdateStatus = async () => {
    if (!updatingStatusId || !confirmStatus) return;
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
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };

  if (!user) return null;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Appointments</h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Roster Desk
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage clinical appointments, queue tokens, slot reservations, and patient encounter workflows.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAppointments}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canManageAppointments && user.role !== "doctor" && (
              <Button
                variant="primary"
                size="sm"
                onClick={openBookModal}
                className="font-semibold rounded-xl shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Book Appointment
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Live Patient Queue Tracker (if active appointment today) */}
      {user.role === "patient" && (() => {
        const activeAppt = appointments.find((a: any) =>
          ["pending", "confirmed", "checked-in", "in-consultation"].includes(a.status)
        );
        if (!activeAppt) return null;
        return (
          <PatientQueueTracker
            appointmentId={activeAppt.id}
            clinicId={activeAppt.clinicId?.id || (activeAppt.clinicId as any)}
            doctorId={activeAppt.doctorId?.id || (activeAppt.doctorId as any)}
          />
        );
      })()}

      {/* ──────────────────────────────────────────────────────────────────────────
          2. VIEW LAYOUT SWITCHER BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-2xl border border-border/80 shadow-xs">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Schedule View Mode</span>
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit">
          <button
            type="button"
            onClick={() => setViewLayout("table")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0",
              viewLayout === "table"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <LayoutList className={cn("h-3.5 w-3.5", viewLayout === "table" ? "text-primary-500" : "text-text-muted")} />
            <span>Table List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewLayout("calendar")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0",
              viewLayout === "calendar"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Calendar className={cn("h-3.5 w-3.5", viewLayout === "calendar" ? "text-primary-500" : "text-text-muted")} />
            <span>Calendar View</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. MAIN APPOINTMENTS ROSTER (TABLE OR CALENDAR)
         ────────────────────────────────────────────────────────────────────────── */}
      {viewLayout === "calendar" ? (
        <AppointmentCalendarView
          appointments={appointments as any}
          onRescheduleClick={(appt: any) => handleOpenRescheduleModal(appt)}
        />
      ) : (
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <Table
              data={appointments || []}
              exportFilename="appointments_list"
              searchPlaceholder="Search by patient, doctor, or token..."
              loading={loading}
              toolbarFilters={
                user.role !== "patient" && (
                  <>
                    <div className="w-full sm:w-48">
                      <DatePicker
                        size="sm"
                        variant="outline"
                        mode="range"
                        placeholder="Filter Date..."
                        value={filterDate}
                        onChange={(val) => setFilterDate(typeof val === "string" ? val : val.target.value)}
                      />
                    </div>
                    {doctors.length > 1 && (
                      <div className="w-full sm:w-40">
                        <Select
                          size="sm"
                          placeholder="All Doctors"
                          value={filterDoctor}
                          onChange={(e) => setFilterDoctor(e.target.value)}
                          options={[
                            { value: "", label: "All Doctors" },
                            ...doctors.map((d) => ({
                              value: d.id,
                              label: `Dr. ${(d.name || "").replace(/^dr\.?\s+/i, "")}`,
                            })),
                          ]}
                        />
                      </div>
                    )}
                    <div className="w-full sm:w-36">
                      <Select
                        size="sm"
                        placeholder="All Statuses"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        options={[
                          { value: "", label: "All Statuses" },
                          { value: "pending", label: "Pending" },
                          { value: "confirmed", label: "Confirmed" },
                          { value: "checked-in", label: "Checked-In" },
                          { value: "in-consultation", label: "In Consultation" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                          { value: "no-show", label: "No Show" },
                        ]}
                      />
                    </div>
                  </>
                )
              }
              columns={[
                {
                  key: "tokenNumber",
                  header: "Token",
                  width: "80px",
                  sortable: true,
                  render: (row: Appointment) => (
                    <button
                      type="button"
                      onClick={() => handleViewSlip(row)}
                      className="font-mono font-bold text-xs sm:text-sm text-primary-600 dark:text-primary-400 hover:underline cursor-pointer focus:outline-none inline-flex items-center gap-1"
                      title="View Booking Slip"
                    >
                      <Ticket className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      #{row.tokenNumber}
                    </button>
                  ),
                },
                {
                  key: "patientName",
                  header: "Patient",
                  sortable: true,
                  render: (row: Appointment) => (
                    <div className="space-y-0.5 min-w-[140px]">
                      <span className="font-bold text-text text-xs sm:text-sm">
                        {row.patientId?.userId?.name || "Self"}
                      </span>
                      {row.patientId?.userId?.phone && row.patientId?.userId?.phone !== "-" && (
                        <span className="text-xs text-text-muted block flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-muted shrink-0" />
                          {row.patientId?.userId?.phone}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "clinic",
                  header: "Location",
                  sortable: true,
                  render: (row: Appointment) => (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary min-w-[120px]">
                      <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{row.clinicId?.name || "Clinic"}</span>
                    </div>
                  ),
                },
                {
                  key: "doctor",
                  header: "Doctor",
                  sortable: true,
                  render: (row: Appointment) => (
                    <div className="space-y-0.5 min-w-[140px]">
                      <div className="flex items-center gap-1 text-xs font-semibold text-text">
                        <Stethoscope className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                        <span>Dr. {(row.doctorId?.name || "Unassigned").replace(/^dr\.?\s+/i, "")}</span>
                      </div>
                      <span className="text-[10px] text-text-muted block pl-4.5">
                        {row.doctorId?.specialization || "General Medicine"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "appointmentTime",
                  header: "Date & Time",
                  sortable: true,
                  render: (row: Appointment) => (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary min-w-[140px]">
                      <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{formatDateTime(row.appointmentTime)}</span>
                    </div>
                  ),
                },
                {
                  key: "appointmentType",
                  header: "Type",
                  sortable: true,
                  render: (row: Appointment) => (
                    <span className="uppercase font-semibold text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-surface-alt border border-border/60 text-text-secondary">
                      {row.appointmentType}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  sortable: true,
                  render: (row: Appointment) => (
                    <Badge
                      variant={getStatusBadgeVariant(row.status)}
                      size="sm"
                      dot
                      className="capitalize font-semibold text-[10px]"
                    >
                      {row.status.replace("-", " ")}
                    </Badge>
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
                            className="h-7 w-7 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        }
                        items={[
                          {
                            label: "View Booking Slip",
                            icon: <Ticket className="w-4 h-4 text-text-muted" />,
                            onClick: () => handleViewSlip(row),
                          },
                          {
                            label: "View Rx / EHR Summary",
                            icon: <FileText className="w-4 h-4 text-text-muted" />,
                            onClick: () => handleOpenRecordModal(row),
                          },
                          ...(row.status !== "completed" && row.status !== "cancelled"
                            ? [
                                {
                                  label: "Reschedule Appointment",
                                  icon: <CalendarClock className="w-4 h-4 text-text-muted" />,
                                  onClick: () => handleOpenRescheduleModal(row),
                                },
                              ]
                            : []),
                          ...(user.role === "doctor" &&
                          (row.status === "confirmed" || row.status === "checked-in" || row.status === "in-consultation")
                            ? [
                                {
                                  label: "Open Encounter Workspace",
                                  icon: <Stethoscope className="w-4 h-4 text-primary-500" />,
                                  onClick: () => router.push(`/dashboard/consultations/${row.id}`),
                                },
                              ]
                            : []),
                          ...(row.status === "pending"
                            ? [
                                {
                                  label: "Mark Confirmed",
                                  icon: <CheckCircle2 className="w-4 h-4 text-primary-500" />,
                                  onClick: () => {
                                    setUpdatingStatusId(row.id);
                                    setConfirmStatus("confirmed");
                                  },
                                },
                              ]
                            : []),
                          ...(row.status === "confirmed"
                            ? [
                                {
                                  label: "Mark Checked-In",
                                  icon: <CheckCircle2 className="w-4 h-4 text-info-500" />,
                                  onClick: () => {
                                    setUpdatingStatusId(row.id);
                                    setConfirmStatus("checked-in");
                                  },
                                },
                              ]
                            : []),
                          ...(row.status === "checked-in"
                            ? [
                                {
                                  label: "Start Consultation",
                                  icon: <Stethoscope className="w-4 h-4 text-emerald-500" />,
                                  onClick: () => {
                                    setUpdatingStatusId(row.id);
                                    setConfirmStatus("in-consultation");
                                  },
                                },
                              ]
                            : []),
                          ...(row.status === "in-consultation"
                            ? [
                                {
                                  label: "Mark Completed",
                                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                                  onClick: () => {
                                    setUpdatingStatusId(row.id);
                                    setConfirmStatus("completed");
                                  },
                                },
                              ]
                            : []),
                          ...(row.status !== "completed" && row.status !== "cancelled"
                            ? [
                                { divider: true, label: "" },
                                {
                                  label: "Cancel Appointment",
                                  icon: <XCircle className="w-4 h-4 text-danger" />,
                                  variant: "danger" as any,
                                  onClick: () => {
                                    setUpdatingStatusId(row.id);
                                    setConfirmStatus("cancelled");
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
              emptyMessage="No clinical appointments found for active filters."
            />
          </CardContent>
        </Card>
      )}

      {/* Patient Medical Records & Prescription Downloads */}
      {user.role === "patient" && (
        <div className="pt-6 border-t border-border/80">
          <PatientMedicalRecords patientId={user.id} />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. BOOK APPOINTMENT MODAL (3-STEP STEPPER WIZARD)
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isBookModalOpen}
        onClose={handleCloseBookModal}
        title="Schedule Clinical Appointment"
        description="Book a patient consultation, select practitioner time slot, and reserve queue token."
        size="lg"
      >
        <div className="space-y-5">
          {/* Stepper Progress */}
          <div className="border border-border/80 bg-surface-alt/50 p-3 rounded-2xl">
            <Stepper steps={BOOKING_STEPS} currentStep={bookingStep - 1} />
          </div>

          {/* STEP 1: Patient Selection */}
          {bookingStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">Choose or Search Patient</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    placeholder="Search by patient name, email, or mobile..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handlePatientSearch} loading={searchLoading} className="font-semibold rounded-xl">
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border border-border/80 rounded-2xl overflow-hidden bg-surface max-h-56 overflow-y-auto divide-y divide-border/60">
                  {searchResults.map((pt) => (
                    <div
                      key={pt.id}
                      className="p-3 hover:bg-surface-hover flex justify-between items-center transition-colors gap-2"
                    >
                      <div>
                        <p className="font-bold text-text text-xs sm:text-sm">{pt.userId?.name}</p>
                        <p className="text-xs text-text-muted">
                          {pt.userId?.phone} &bull; {pt.userId?.email}
                        </p>
                      </div>
                      <Button size="xs" variant="primary" onClick={() => handleSelectPatient(pt)} className="rounded-lg font-semibold">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center py-6 border border-dashed border-border/80 rounded-2xl bg-surface-alt/50 space-y-2">
                <UserPlus className="w-8 h-8 mx-auto text-text-muted" />
                <p className="text-xs text-text-muted">Cannot find existing record? Register a new patient profile.</p>
                <Button variant="outline" size="sm" onClick={handleCreateNewPatient} className="rounded-xl font-semibold">
                  Register New Patient
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Location, Doctor & Registration */}
          {bookingStep === 2 && (
            <div className="space-y-4 animate-fade-in max-h-[70vh] overflow-y-auto pr-1">
              {isNewPatient && (
                <div className="space-y-3.5 border-b border-border/60 pb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">Patient Registration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
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
                        const strVal = typeof val === "string" ? val : val.target.value;
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
                      label="Mobile Phone Number"
                      placeholder="+91 98765 43210"
                      value={newPatientForm.phone}
                      onChange={(e) => handleNewPatientChange("phone", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="rahul@example.com"
                      value={newPatientForm.email}
                      onChange={(e) => handleNewPatientChange("email", e.target.value)}
                    />
                    <Input
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
                </div>
              )}

              <div className="space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">Facility & Practitioner</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Select
                    label="Choose Clinic Location *"
                    value={bookingClinicId}
                    onChange={(e) => setBookingClinicId(e.target.value)}
                    options={[{ value: "", label: "Select clinic facility..." }, ...clinics.map((c) => ({ value: c.id, label: c.name }))]}
                    required
                  />
                  <Select
                    label="Choose Doctor *"
                    value={bookingDoctorId}
                    onChange={(e) => setBookingDoctorId(e.target.value)}
                    options={[
                      { value: "", label: "Select practitioner..." },
                      ...doctorAssignments.map((a) => ({
                        value: a.doctorId?.id || a.doctorId,
                        label: `Dr. ${a.doctorId?.name} (${a.doctorId?.specialization || "General"})`,
                      })),
                    ]}
                    disabled={!bookingClinicId}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-border/60 pt-3.5 mt-4">
                <Button variant="outline" type="button" size="sm" onClick={() => setBookingStep(1)}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleStep2Next}
                  disabled={!bookingClinicId || !bookingDoctorId}
                  className="font-semibold rounded-xl shadow-xs"
                >
                  Configure Schedule
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Live Time Slots & Schedule Picker */}
          {bookingStep === 3 && (
            <form onSubmit={handleConfirmBooking} className="space-y-4 animate-fade-in max-h-[70vh] overflow-y-auto pr-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text">Date & Time Slot</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <DatePicker
                  label="Select Date *"
                  mode="date"
                  value={selectedSlotDate}
                  onChange={(val) => setSelectedSlotDate(typeof val === "string" ? val : val.target.value)}
                  fullWidth
                />

                <Select
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

              {/* Slot Availability Grid OR Sequential Queue Notice */}
              {doctorBookingMode === "sequential_queue" ? (
                <div className="p-4 bg-primary-500/[0.04] border border-primary-500/20 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-text">Sequential Token Queue</span>
                    <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                      Auto-Token
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Practitioner operates in sequential queue mode. Confirming will issue Token{" "}
                    <strong className="text-primary-600 dark:text-primary-400 font-bold">
                      #{nextTokenNum || tokensTodayCount + 1}
                    </strong>{" "}
                    for today.
                  </p>
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
                    <div className="p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                      No 15-min open slots for this date. You may specify a custom time below or choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1">
                      {availableSlots
                        .filter((s) => s.available)
                        .map((slot) => {
                          const fullSlotISO = `${selectedSlotDate}T${slot.time}:00`;
                          const isSelected = bookingTime === fullSlotISO;
                          const isHeldByOther = slot.lockedByOther;
                          const isMyLock = lockedSlotTime === fullSlotISO && currentLockId;

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!!isHeldByOther || lockingSlot}
                              onClick={() => handleSlotClick(slot)}
                              className={cn(
                                "px-2 py-1.5 text-xs font-bold rounded-xl border transition-all relative select-none cursor-pointer",
                                isSelected
                                  ? "bg-primary-500 text-white border-primary-500 shadow-xs"
                                  : isHeldByOther
                                  ? "bg-amber-500/10 text-amber-500 border-amber-300 cursor-not-allowed opacity-60"
                                  : "bg-surface hover:bg-surface-hover text-text border-border"
                              )}
                            >
                              {slot.time}
                              {isHeldByOther && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                              )}
                              {isMyLock && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <div className="pt-2">
                    <DatePicker
                      label="Selected DateTime *"
                      mode="datetime"
                      value={bookingTime}
                      onChange={(val) => setBookingTime(typeof val === "string" ? val : val.target.value)}
                      fullWidth
                    />
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

              <div className="p-3.5 bg-surface-alt border border-border/80 rounded-2xl space-y-1 text-xs">
                <h4 className="font-bold text-text">Booking Summary Confirmation</h4>
                <p className="text-text-muted">
                  <strong>Patient:</strong> {isNewPatient ? newPatientForm.name : selectedPatient?.userId?.name} &bull;{" "}
                  <strong>Doctor:</strong> Dr. {doctors.find((d) => d.id === bookingDoctorId)?.name} &bull;{" "}
                  <strong>Location:</strong> {clinics.find((c) => c.id === bookingClinicId)?.name}
                </p>
              </div>

              <div className="flex justify-between border-t border-border/60 pt-3.5 mt-4">
                <Button variant="outline" type="button" size="sm" onClick={() => setBookingStep(2)}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={submitting}
                  className="font-semibold rounded-xl shadow-xs"
                >
                  Confirm & Schedule
                </Button>
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
        title="Change Appointment Status?"
        description={`Are you sure you want to mark this appointment status as "${confirmStatus}"?`}
        variant={confirmStatus === "cancelled" || confirmStatus === "no-show" ? "danger" : "primary"}
        confirmLabel="Update Status"
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          6. APPOINTMENT TOKEN SLIP MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Token Slip"
        size="sm"
      >
        {createdTicket && (
          <div className="space-y-4 py-1">
            <div className="border border-border/80 rounded-2xl p-4 sm:p-5 bg-surface-alt relative overflow-hidden shadow-xs space-y-3">
              <div className="text-center border-b border-border/60 border-dashed pb-3">
                <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 tracking-wider uppercase block">
                  Healthcare System
                </span>
                <h3 className="text-base font-bold text-text mt-0.5">{createdTicket.clinicName}</h3>
                <p className="text-[10px] text-text-muted mt-0.5">{createdTicket.clinicAddress}</p>
              </div>

              <div className="text-center my-2">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">
                  Queue Token Number
                </span>
                <div className="text-4xl font-black text-primary-600 dark:text-primary-400 tracking-tight my-1">
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

              <div className="space-y-2 text-xs text-text-secondary border-t border-border/60 pt-3">
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

            <div className="flex gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="w-full font-semibold rounded-xl"
                onClick={() => handlePrintSlip(createdTicket)}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Slip
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full font-semibold rounded-xl shadow-xs"
                onClick={() => setTicketModalOpen(false)}
              >
                Done
              </Button>
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
      >
        <form onSubmit={handleSubmitReview} className="space-y-4 pt-1">
          <p className="text-xs text-text-muted leading-relaxed">
            How was your clinical consultation experience with Dr. {reviewDoctorName}? Please select a star rating.
          </p>

          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingValue(star)}
                className="focus:outline-none text-2xl cursor-pointer transition-transform hover:scale-110"
              >
                <span className={star <= ratingValue ? "text-amber-400" : "text-border"}>★</span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" type="button" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={reviewSubmitting} className="font-semibold rounded-xl shadow-xs">
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. EHR RECORD & PRESCRIPTION PRINT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={recordModalOpen}
        onClose={() => {
          setRecordModalOpen(false);
          setActiveRecord(null);
        }}
        title="Clinical Consultation Record"
        size="xl"
      >
        {activeRecord && (
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            <div
              id="printable-prescription"
              className="border border-border/80 rounded-2xl p-5 sm:p-6 bg-surface-alt text-text space-y-4 shadow-xs"
            >
              <div className="border-b border-border/60 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                    {activeRecord.clinicId?.name || "Healthcare Facility"}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {[activeRecord.clinicId?.address, activeRecord.clinicId?.city].filter(Boolean).join(", ") ||
                      "Main Facility Campus"}
                  </p>
                </div>
                <Badge variant="primary" size="sm" className="font-bold">
                  Token #{activeRecord.tokenNumber || "1"}
                </Badge>
              </div>

              {/* Consultation Summary Metas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-surface border border-border/60 p-3.5 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Patient</span>
                  <span className="font-bold text-text">{activeRecord.patientId?.userId?.name || "Patient"}</span>
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
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verified Record</span>
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

              {/* Prescriptions */}
              <div className="space-y-2">
                <div className="text-xl font-serif font-black italic text-primary-600 dark:text-primary-400">Rx</div>
                {activeRecord.prescriptions && activeRecord.prescriptions.length > 0 ? (
                  <div className="border border-border/60 rounded-xl overflow-hidden bg-surface">
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
                  </div>
                ) : (
                  <p className="text-xs italic text-text-muted">No medications prescribed.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecordModalOpen(false);
                  setActiveRecord(null);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="font-semibold rounded-xl shadow-xs"
                onClick={() => {
                  if (!activeRecord) return;

                  const clinicName = activeRecord.clinicId?.name || "Healthcare Facility";
                  const clinicAddress =
                    [activeRecord.clinicId?.address, activeRecord.clinicId?.city].filter(Boolean).join(", ") ||
                    "Main Facility Campus";
                  const patientName = activeRecord.patientId?.userId?.name || "Patient";
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
                      <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${m.name}</td>
                      <td style="padding: 8px 12px; color: #334155; border-bottom: 1px solid #e2e8f0;">${m.dosage}</td>
                      <td style="padding: 8px 12px; color: #334155; border-bottom: 1px solid #e2e8f0;">${m.duration}</td>
                    </tr>
                  `
                    )
                    .join("");

                  const printFrame = document.createElement("iframe");
                  printFrame.style.position = "fixed";
                  printFrame.style.right = "0";
                  printFrame.style.bottom = "0";
                  printFrame.style.width = "0";
                  printFrame.style.height = "0";
                  printFrame.style.border = "0";
                  document.body.appendChild(printFrame);

                  const frameDoc = printFrame.contentWindow?.document;
                  if (!frameDoc) return;

                  frameDoc.open();
                  frameDoc.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Prescription Slip - Token #${tokenNo}</title>
                        <style>
                          @page { size: A4 portrait; margin: 12mm; }
                          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 10px; line-height: 1.4; font-size: 12px; }
                          .header-bar { border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
                          .clinic-title { font-size: 20px; font-weight: 800; color: #0f766e; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
                          .clinic-sub { font-size: 11px; color: #6b7280; margin-top: 3px; }
                          .token-badge { background: #0f766e; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; display: inline-block; }
                          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
                          .meta-label { font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
                          .meta-value { font-weight: 700; color: #0f172a; margin-top: 1px; }
                          .rx-header { font-size: 28px; font-weight: 900; color: #0f766e; font-style: italic; margin-bottom: 6px; font-family: Georgia, serif; }
                          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f766e; border-bottom: 1.5px solid #ccfbf1; padding-bottom: 3px; margin-top: 16px; margin-bottom: 8px; letter-spacing: 0.5px; }
                          .section-body { font-size: 13px; color: #334155; margin-bottom: 12px; background: #ffffff; }
                          table { width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                          th { background: #f1f5f9; color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase; text-align: left; padding: 8px 12px; border-bottom: 2px solid #cbd5e1; }
                          .signature-box { margin-top: 40px; display: flex; justify-content: flex-end; }
                          .sig-line { border-top: 1.5px solid #94a3b8; width: 200px; text-align: center; padding-top: 4px; font-size: 11px; font-weight: 600; color: #475569; }
                          .footer-bar { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10px; color: #94a3b8; }
                        </style>
                      </head>
                      <body>
                        <div class="header-bar">
                          <div>
                            <h1 class="clinic-title">${clinicName}</h1>
                            <div class="clinic-sub">${clinicAddress}</div>
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
                            <div class="meta-value">${doctorFormatted} <span style="font-weight: 400; color: #64748b;">(${doctorSpec})</span></div>
                          </div>
                          <div>
                            <div class="meta-label">Consultation Date</div>
                            <div class="meta-value">${apptDate}</div>
                          </div>
                          <div>
                            <div class="meta-label">Medical Record Status</div>
                            <div class="meta-value" style="color: #059669;">Verified EHR Record</div>
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
                            : `<p style="font-size: 12px; color: #64748b; font-style: italic;">No medications prescribed.</p>`
                        }

                        <div class="signature-box">
                          <div class="sig-line">
                            ${doctorFormatted}<br/>
                            <span style="font-size: 10px; font-weight: 400; color: #94a3b8;">Authorized Signatory</span>
                          </div>
                        </div>

                        <div class="footer-bar">
                          Official Electronic Medical Prescription &bull; HealthOS EMR
                        </div>
                      </body>
                    </html>
                  `);
                  frameDoc.close();

                  setTimeout(() => {
                    printFrame.contentWindow?.focus();
                    printFrame.contentWindow?.print();
                    setTimeout(() => {
                      if (document.body.contains(printFrame)) {
                        document.body.removeChild(printFrame);
                      }
                    }, 1000);
                  }, 250);
                }}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Prescription Slip
              </Button>
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
        title={`Reschedule Appointment #${rescheduleTargetAppt?.tokenNumber || ""}`}
        size="md"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 text-xs space-y-1">
            <p className="font-bold text-text">Patient: {rescheduleTargetAppt?.patientId?.userId?.name}</p>
            <p className="text-text-muted">Doctor: Dr. {rescheduleTargetAppt?.doctorId?.name}</p>
            <p className="text-text-muted">
              Current Time:{" "}
              {rescheduleTargetAppt?.appointmentTime ? new Date(rescheduleTargetAppt.appointmentTime).toLocaleString() : ""}
            </p>
          </div>

          <DatePicker
            label="New Date & Time *"
            mode="datetime"
            value={rescheduleTime}
            onChange={(val) => setRescheduleTime(typeof val === "string" ? val : val.target.value)}
            fullWidth
          />

          <Textarea
            label="Reason for Rescheduling (Optional)"
            placeholder="e.g. Patient requested time change, practitioner schedule adjustment..."
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            rows={2}
          />

          <div className="flex justify-between border-t border-border/60 pt-3.5">
            <Button variant="outline" type="button" size="sm" onClick={() => setRescheduleTargetAppt(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submittingReschedule} className="font-semibold rounded-xl shadow-xs">
              Confirm Reschedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
