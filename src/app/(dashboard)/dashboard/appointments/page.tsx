"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, DatePicker, Select, Textarea, useToast, Spinner, Badge, ConfirmDialog, Stepper, Dropdown
} from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const BOOKING_STEPS = [
  { label: "Patient", description: "Search/Register" },
  { label: "Practitioner", description: "Facility & Doctor" },
  { label: "Schedule", description: "DateTime & Notes" }
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
    userId: { name: string; email: string; phone: string } 
  };
  appointmentTime: string;
  appointmentType: string;
  status: string;
  tokenNumber: number;
  notes: string;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [filterClinic, setFilterClinic] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState(getTodayISO());
  const [filterStatus, setFilterStatus] = useState("");

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
    name: "", dob: "", gender: "male", phone: "", email: "", address: "", allergies: "", conditions: "", medicalNotes: ""
  });

  // Doctor & Slot Booking Details
  const [bookingClinicId, setBookingClinicId] = useState("");
  const [bookingDoctorId, setBookingDoctorId] = useState("");
  const [doctorAssignments, setDoctorAssignments] = useState<any[]>([]);
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState<"walk-in" | "reception" | "online">("reception");
  const [bookingNotes, setBookingNotes] = useState("");

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
    setNewPatientForm(prev => ({ ...prev, [field]: value }));
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
      if (!isNameValid || !isDobValid || !isEmailValid) {
        toast({ title: "Validation Error", description: "Please correct highlighted fields before proceeding.", variant: "error" });
        return;
      }
    }
    setBookingStep(3);
  };

  // Phase 2: Ticket Slip State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  // Phase 2: Doctor Reviews State
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
      const diagnosis = report.primaryDiagnosis || (report.diagnoses || []).map((d: any) => d.description || d.code).join(", ") || "";
      const prescriptions = report.prescriptions || [];

      setActiveRecord({
        ...appt,
        symptoms,
        diagnosis,
        prescriptions
      });
      setRecordModalOpen(true);
    } catch (err) {
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
      clinicName: appt.clinicId?.name || "MedLife Clinic",
      clinicAddress: appt.clinicId?.address || "Clinic Address",
      appointmentTime: appt.appointmentTime,
      status: appt.status
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
      toast({ title: "Review Submitted", description: `Thank you for rating Dr. ${reviewDoctorName}!`, variant: "success" });
      setReviewModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to submit review", variant: "error" });
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
            .brand { font-size: 12px; font-weight: 800; color: #2563eb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
            .clinic-name { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
            .token-box { text-align: center; margin: 16px 0; }
            .token-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; }
            .token-num { font-size: 48px; font-weight: 800; color: #2563eb; margin: 4px 0; line-height: 1; }
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
              <div class="brand">MedLife HealthOS</div>
              <h1 class="clinic-name">${ticketData.clinicName}</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${ticketData.clinicAddress}</p>
            </div>
            <div class="token-box">
              <span class="token-label">Queue Token Number</span>
              <div class="token-num">#${ticketData.tokenNumber}</div>
              <span style="font-size: 12px; color: #10b981; font-weight: 700;">✓ Booked Successfully</span>
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
                <span class="label">Appt Time:</span>
                <span class="val">${new Date(ticketData.appointmentTime).toLocaleString()}</span>
              </div>
            </div>
            <div class="footer">
              Please present this slip at the front desk upon arrival.<br>
              Powered by HealthOS Security Queue Systems.
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
      setLoading(true);
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
    } catch (err) {
      toast({ title: "Error", description: "Failed to load appointments list", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicsAndDoctors = async () => {
    if (!user || user.role === "patient") return;
    try {
      const [clinicsRes, staffRes] = await Promise.all([
        api.get("/onboarding/clinics"),
        api.get("/onboarding/staff")
      ]);
      setClinics(clinicsRes.data.data || []);
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
  }, [user]);

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
        console.error("Failed to load doctor assignments");
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
    } catch (err) {
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
      const isEmailValid = validateNewPatientField("email", newPatientForm.email);
      if (!isNameValid || !isDobValid || !isEmailValid) {
        setBookingStep(2);
        toast({ title: "Validation Error", description: "Please correct highlighted fields before submitting.", variant: "error" });
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
        notes: bookingNotes
      };

      if (isNewPatient) {
        bookingData.patientDetails = {
          ...newPatientForm,
          allergies: newPatientForm.allergies ? newPatientForm.allergies.split(",").map(s => s.trim()) : [],
          conditions: newPatientForm.conditions ? newPatientForm.conditions.split(",").map(s => s.trim()) : []
        };
      } else {
        bookingData.patientId = selectedPatient.id;
      }

      const res = await api.post("/appointments", bookingData);
      const token = res.data.data.tokenNumber;

      toast({ 
        title: "Appointment Booked!", 
        description: `Successfully booked. Assigned Token: #${token}`, 
        variant: "success", 
        duration: 5000 
      });

      setIsBookModalOpen(false);
      fetchAppointments();
      resetBookingForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to book appointment", variant: "error" });
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
      name: "", dob: "", gender: "male", phone: "", email: "", address: "", allergies: "", conditions: "", medicalNotes: ""
    });
    setBookingClinicId("");
    setBookingDoctorId("");
    setBookingTime("");
    setBookingType("reception");
    setBookingNotes("");
  };

  const openBookModal = () => {
    resetBookingForm();
    setIsBookModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!updatingStatusId || !confirmStatus) return;
    const targetId = updatingStatusId;
    const targetStatus = confirmStatus;
    try {
      await api.put(`/appointments/${targetId}/status`, { status: targetStatus });
      toast({ title: "Success", description: `Appointment updated to ${targetStatus}`, variant: "success" });
      fetchAppointments();
      if (targetStatus === "in-consultation") {
        router.push(`/dashboard/consultations/${targetId}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update appointment status", variant: "error" });
    } finally {
      setUpdatingStatusId(null);
      setConfirmStatus(null);
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "primary" | "success" | "warning" | "danger" | "outline" => {
    switch (status) {
      case "pending": return "warning";
      case "confirmed": return "primary";
      case "checked-in": return "primary";
      case "in-consultation": return "success";
      case "completed": return "success";
      case "cancelled": return "danger";
      case "no-show": return "danger";
      default: return "default";
    }
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">Appointments</h2>
          <p className="text-xs sm:text-sm text-text-secondary">View and schedule clinic visits and token queue bookings.</p>
        </div>
      </div>

      {/* Main Roster Table */}
      <Table
        onAddClick={user.role !== "patient" && user.role !== "doctor" ? openBookModal : undefined}
        actionLabel="Book Appointment"
        exportFilename="appointments_list"
        searchPlaceholder="Search appointments..."
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
              {clinics.length > 1 && (
                <div className="w-full sm:w-40">
                  <Select
                    size="sm"
                    placeholder="All Clinics"
                    value={filterClinic}
                    onChange={(e) => setFilterClinic(e.target.value)}
                    options={[{ value: "", label: "All Clinics" }, ...clinics.map(c => ({ value: c.id, label: c.name }))]}
                  />
                </div>
              )}
              {doctors.length > 1 && (
                <div className="w-full sm:w-40">
                  <Select
                    size="sm"
                    placeholder="All Doctors"
                    value={filterDoctor}
                    onChange={(e) => setFilterDoctor(e.target.value)}
                    options={[{ value: "", label: "All Doctors" }, ...doctors.map(d => ({ value: d.id, label: `Dr. ${(d.name || "").replace(/^dr\.?\s+/i, "")}` }))]}
                  />
                </div>
              )}
              <div className="w-full sm:w-40">
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
            width: "70px",
            sortable: true,
            filterable: true,
            render: (row: Appointment) => (
              <button 
                onClick={() => handleViewSlip(row)}
                className="font-bold text-base text-primary-500 hover:text-primary-400 hover:underline cursor-pointer focus:outline-none"
                title="View Booking Slip"
              >
                #{row.tokenNumber}
              </button>
            )
          },
          { 
            key: "patientName", 
            header: "Patient",
            sortable: true,
            filterable: true,
            render: (row: Appointment) => (
              <div className="flex flex-col">
                <span className="font-medium text-text">{row.patientId?.userId?.name || "Self"}</span>
                {row.patientId?.userId?.phone && row.patientId?.userId?.phone !== "-" && (
                  <span className="text-xs text-text-muted">{row.patientId?.userId?.phone}</span>
                )}
              </div>
            )
          },
          { 
            key: "clinic", 
            header: "Location", 
            sortable: true,
            filterable: true,
            render: (row: Appointment) => <span>{row.clinicId?.name}</span>
          },
          { 
            key: "doctor", 
            header: "Doctor", 
            sortable: true,
            filterable: true,
            render: (row: Appointment) => <span>Dr. {(row.doctorId?.name || "Unassigned").replace(/^dr\.?\s+/i, "")}</span>
          },
          { 
            key: "appointmentTime", 
            header: "Date & Time",
            sortable: true,
            render: (row: Appointment) => <span>{formatDateTime(row.appointmentTime)}</span>
          },
          { 
            key: "appointmentType", 
            header: "Type",
            sortable: true,
            filterable: true,
            render: (row: Appointment) => <span className="capitalize">{row.appointmentType}</span>
          },
          { 
            key: "status", 
            header: "Status",
            sortable: true,
            filterable: true,
            filterType: "select",
            filterOptions: [
              { label: "Pending", value: "pending" },
              { label: "Confirmed", value: "confirmed" },
              { label: "Checked-In", value: "checked-in" },
              { label: "In Consultation", value: "in-consultation" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" },
              { label: "No Show", value: "no-show" },
            ],
            render: (row: Appointment) => (
              <Badge variant={getStatusBadgeVariant(row.status)} className="capitalize">{row.status.replace("-", " ")}</Badge>
            )
          },
          {
            key: "actions",
            header: "Actions",
            width: "180px",
            render: (row: Appointment) => (
              <Dropdown
                align="right"
                trigger={
                  <Button size="xs" variant="outline" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg cursor-pointer" title="Row Actions">
                    <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </Button>
                }
                items={[
                  { label: "View Booking Slip", onClick: () => handleViewSlip(row) },
                  { label: "View Rx / EHR Summary", onClick: () => handleOpenRecordModal(row) },
                  ...(user.role === "doctor" && (row.status === "confirmed" || row.status === "checked-in" || row.status === "in-consultation")
                    ? [{ label: "Open Encounter Workspace", onClick: () => router.push(`/dashboard/consultations/${row.id}`) }]
                    : []),
                  ...(row.status === "pending" ? [{ label: "Mark Confirmed", onClick: () => { setUpdatingStatusId(row.id); setConfirmStatus("confirmed"); } }] : []),
                  ...(row.status === "confirmed" ? [{ label: "Mark Checked-In", onClick: () => { setUpdatingStatusId(row.id); setConfirmStatus("checked-in"); } }] : []),
                  ...(row.status === "checked-in" ? [{ label: "Start Consultation", onClick: () => { setUpdatingStatusId(row.id); setConfirmStatus("in-consultation"); } }] : []),
                  ...(row.status === "in-consultation" ? [{ label: "Mark Completed", onClick: () => { setUpdatingStatusId(row.id); setConfirmStatus("completed"); } }] : []),
                  ...(row.status !== "completed" && row.status !== "cancelled" ? [{ label: "Cancel Appointment", onClick: () => { setUpdatingStatusId(row.id); setConfirmStatus("cancelled"); } }] : [])
                ]}
              />
            )
          }
        ]}
        data={appointments}
        emptyMessage="No appointments scheduled."
      />

      {/* Book Appointment Modal (Multi-step flow) */}
      <Modal
        open={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Clinic Appointment"
        size="lg"
      >
        <div className="space-y-6">
          {/* Booking Progress Indicator */}
          <div className="border-b border-border bg-surface-alt/50 p-4 rounded-xl">
            <Stepper
              steps={BOOKING_STEPS}
              currentStep={bookingStep - 1}
            />
          </div>

          {/* STEP 1: Patient Selection */}
          {bookingStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text">Choose Patient</h3>
              <div className="flex gap-2">
                <Input 
                  placeholder="Search by patient name, email, or mobile..." 
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                />
                <Button onClick={handlePatientSearch} loading={searchLoading}>Search</Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden bg-surface max-h-60 overflow-y-auto">
                  {searchResults.map((pt) => (
                    <div key={pt.id} className="p-3 border-b border-border hover:bg-surface-hover flex justify-between items-center transition-colors">
                      <div>
                        <p className="font-semibold text-text">{pt.userId?.name}</p>
                        <p className="text-xs text-text-secondary">{pt.userId?.phone} • {pt.userId?.email}</p>
                      </div>
                      <Button size="xs" onClick={() => handleSelectPatient(pt)}>Select</Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center py-6 border border-dashed border-border rounded-lg bg-surface-alt mt-2">
                <p className="text-sm text-text-secondary mb-3">Cannot find patient? Register a new patient profile.</p>
                <Button variant="outline" onClick={handleCreateNewPatient}>Register New Patient</Button>
              </div>
            </div>
          )}

          {/* STEP 2: Location, Doctor & Clinical Profile (if new patient) */}
          {bookingStep === 2 && (
            <div className="space-y-5">
              {isNewPatient && (
                <div className="space-y-4 border-b border-border pb-5">
                  <h3 className="text-sm font-bold text-text">Patient Registration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Full Name *" 
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
                  <div className="grid grid-cols-2 gap-4">
                    <Select 
                      label="Gender *"
                      value={newPatientForm.gender} 
                      onChange={(e) => handleNewPatientChange("gender", e.target.value)} 
                      options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]}
                      required 
                    />
                    <Input 
                      label="Mobile Phone Number" 
                      value={newPatientForm.phone} 
                      onChange={(e) => handleNewPatientChange("phone", e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Email Address" 
                      type="email"
                      value={newPatientForm.email} 
                      onChange={(e) => handleNewPatientChange("email", e.target.value)} 
                      onBlur={() => validateNewPatientField("email", newPatientForm.email)}
                      error={bookingErrors.email}
                    />
                    <Input 
                      label="Full Address" 
                      value={newPatientForm.address} 
                      onChange={(e) => handleNewPatientChange("address", e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Allergies (comma separated)" 
                      placeholder="e.g. Penicillin, Peanuts"
                      value={newPatientForm.allergies} 
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, allergies: e.target.value })} 
                    />
                    <Input 
                      label="Chronic Conditions (comma separated)" 
                      placeholder="e.g. Asthma, Hypertension"
                      value={newPatientForm.conditions} 
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, conditions: e.target.value })} 
                    />
                  </div>
                  <Textarea
                    label="Clinical Medical Notes"
                    placeholder="Past medical history details..."
                    value={newPatientForm.medicalNotes}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, medicalNotes: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text">Select Facility & Practitioner</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Choose Clinic Location *"
                    value={bookingClinicId}
                    onChange={(e) => setBookingClinicId(e.target.value)}
                    options={[{ value: "", label: "Select clinic..." }, ...clinics.map(c => ({ value: c.id, label: c.name }))]}
                    required
                  />
                  <Select
                    label="Choose Doctor *"
                    value={bookingDoctorId}
                    onChange={(e) => setBookingDoctorId(e.target.value)}
                    options={[
                      { value: "", label: "Select doctor..." },
                      ...doctorAssignments.map(a => ({ value: a.doctorId?.id || a.doctorId, label: `Dr. ${a.doctorId?.name} (${a.doctorId?.specialization || "General"})` }))
                    ]}
                    disabled={!bookingClinicId}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-border pt-4 mt-6">
                <Button variant="outline" type="button" onClick={() => setBookingStep(1)}>Back</Button>
                <Button type="button" onClick={handleStep2Next} disabled={!bookingClinicId || !bookingDoctorId}>Next</Button>
              </div>
            </div>
          )}

          {/* STEP 3: DateTime & Notes Slot Picker */}
          {bookingStep === 3 && (
            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <h3 className="text-sm font-semibold text-text">Choose Schedule Time</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Appointment Date & Time *"
                  type="datetime-local"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  required
                />
                <Select
                  label="Appointment Booking Type"
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value as any)}
                  options={[
                    { value: "reception", label: "Reception Booking" },
                    { value: "walk-in", label: "Walk-In" },
                    { value: "online", label: "Online" }
                  ]}
                />
              </div>

              <Textarea 
                label="Appointment Notes" 
                placeholder="Reason for visit, symptoms..." 
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
              />

              <div className="p-4 bg-surface-alt border border-border rounded-lg space-y-2">
                <h4 className="text-sm font-semibold text-text">Booking Summary Confirmation</h4>
                <p className="text-xs text-text-secondary">
                  <strong>Patient:</strong> {isNewPatient ? newPatientForm.name : selectedPatient?.userId?.name} <br />
                  <strong>Location:</strong> {clinics.find(c => c.id === bookingClinicId)?.name} <br />
                  <strong>Doctor:</strong> Dr. {doctors.find(d => d.id === bookingDoctorId)?.name} <br />
                  <strong>Type:</strong> <span className="capitalize">{bookingType}</span>
                </p>
              </div>

              <div className="flex justify-between border-t border-border pt-4 mt-6">
                <Button variant="outline" type="button" onClick={() => setBookingStep(2)}>Back</Button>
                <Button type="submit" loading={submitting}>Book Appointment</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Confirm Status Change dialog */}
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

      {/* Appointment Ticket Slip Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Token Slip"
        size="sm"
      >
        {createdTicket && (
          <div className="space-y-6 py-2">
            <div className="border border-border rounded-xl p-5 bg-surface-alt relative overflow-hidden shadow-sm">
              <div className="text-center border-b border-border/80 border-dashed pb-4 mb-4">
                <span className="text-[10px] font-extrabold text-primary-600 tracking-wider uppercase block">JK Healthcare System</span>
                <h3 className="text-base font-bold text-text mt-0.5">{createdTicket.clinicName}</h3>
                <p className="text-[10px] text-text-muted mt-0.5">{createdTicket.clinicAddress}</p>
              </div>

              <div className="text-center my-4">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Queue Token Number</span>
                <div className="text-4xl font-extrabold text-primary-600 tracking-tight my-1">#{createdTicket.tokenNumber}</div>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 capitalize ${
                  createdTicket.status === "completed" 
                    ? "bg-success-50 text-success-700 border-success-200" 
                    : createdTicket.status === "cancelled" 
                    ? "bg-danger-50 text-danger-700 border-danger-200" 
                    : "bg-primary-50 text-primary-700 border-primary-200"
                }`}>
                  ✓ {createdTicket.status.replace("-", " ")}
                </span>
              </div>

              <div className="space-y-2 text-xs text-text-secondary border-t border-border/40 pt-4">
                <div className="flex justify-between">
                  <span className="text-text-muted">Patient Name:</span>
                  <span className="font-semibold text-text">{createdTicket.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Specialist Doctor:</span>
                  <span className="font-semibold text-text">Dr. {createdTicket.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Specialization:</span>
                  <span className="font-semibold text-text">{createdTicket.doctorSpecialty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Schedule Slot:</span>
                  <span className="font-semibold text-text">
                    {formatDateTime(createdTicket.appointmentTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="w-full text-center" onClick={() => handlePrintSlip(createdTicket)}>
                Print Token Slip
              </Button>
              <Button variant="primary" className="w-full text-center" onClick={() => setTicketModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Leave Review Modal */}
      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review Dr. ${reviewDoctorName}`}
        size="sm"
      >
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            How was your clinical consultation experience with Dr. {reviewDoctorName}? Please select a star rating.
          </p>

          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingValue(star)}
                className="focus:outline-none text-2xl cursor-pointer transition-transform duration-100 hover:scale-110"
              >
                <span className={star <= ratingValue ? "text-warning-500" : "text-text-muted"}>★</span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button variant="outline" type="button" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={reviewSubmitting}>
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* EHR Summary Record Modal */}
      <Modal
        open={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); setActiveRecord(null); }}
        title="Clinical Consultation Record"
        size="xl"
      >
        {activeRecord && (
          <div className="space-y-6 py-2">
            <div id="printable-prescription" className="border border-border/80 rounded-xl p-6 bg-surface-alt text-text space-y-5 shadow-sm relative overflow-hidden">
              <div className="border-b border-border/80 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-primary-500 uppercase tracking-wider">{activeRecord.clinicId?.name || "MedLife Specialist Clinic"}</h1>
                  <p className="text-xs text-text-muted mt-1">{[activeRecord.clinicId?.address, activeRecord.clinicId?.city].filter(Boolean).join(", ") || "Main HealthOS Campus"}</p>
                </div>
                <div className="text-right">
                  <Badge variant="primary" className="text-xs font-bold px-3 py-1">Token #{activeRecord.tokenNumber || "1"}</Badge>
                </div>
              </div>

              {/* Consultation Summary Metas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-surface/80 border border-border/60 p-4 rounded-xl rx-meta-box">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Patient Name</span>
                  <span className="font-semibold text-text text-sm">{activeRecord.patientId?.userId?.name || "Patient"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Attending Doctor</span>
                  <span className="font-semibold text-text text-sm">
                    {`Dr. ${(activeRecord.doctorId?.name || "Practitioner").replace(/^dr\.?\s+/i, "")}`} ({activeRecord.doctorId?.specialization || "General Medicine"})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Consultation Date</span>
                  <span className="font-semibold text-text">{new Date(activeRecord.appointmentTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Medical Record Status</span>
                  <span className="font-semibold text-success-500">Verified EHR Record</span>
                </div>
              </div>

              {/* Chief Complaints / Symptoms */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-text-muted block border-b border-border/40 pb-1">Chief Complaints / Symptoms</span>
                <p className="text-sm text-text-secondary pt-1 font-medium">
                  {activeRecord.symptoms || "No symptoms recorded."}
                </p>
              </div>

              {/* Clinical Diagnosis */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-text-muted block border-b border-border/40 pb-1">Diagnosis & Clinical Assessment</span>
                <p className="text-sm text-text font-bold">
                  {activeRecord.diagnosis || "No diagnosis recorded."}
                </p>
              </div>

              {/* Prescriptions Table */}
              <div className="space-y-2">
                <div className="text-2xl font-serif font-black italic text-primary-500">Rx</div>
                {activeRecord.prescriptions && activeRecord.prescriptions.length > 0 ? (
                  <div className="border border-border/60 rounded-xl overflow-hidden bg-surface">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-alt border-b border-border/60 text-text font-bold uppercase">
                          <th className="p-3">Medicine Name</th>
                          <th className="p-3">Dosage / Instructions</th>
                          <th className="p-3">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-text-secondary">
                        {activeRecord.prescriptions.map((med: any, idx: number) => (
                          <tr key={idx} className="hover:bg-surface-hover/30">
                            <td className="p-3 font-bold text-text">{med.name}</td>
                            <td className="p-3">{med.dosage}</td>
                            <td className="p-3">{med.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs italic text-text-muted">No medications prescribed.</p>
                )}
              </div>

              {/* Follow-up Note */}
              {activeRecord.followUpRecommended && (
                <div className="pt-2 space-y-1 text-xs">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-text-muted block border-b border-border/40 pb-1">Follow-up Plan</span>
                  <p className="font-semibold text-text">Recommended follow-up within {activeRecord.followUpTimeline}</p>
                  {activeRecord.followUpNotes && (
                    <p className="text-text-secondary italic">&ldquo;{activeRecord.followUpNotes}&rdquo;</p>
                  )}
                </div>
              )}

              {/* Signature Line */}
              <div className="pt-8 flex justify-end">
                <div className="border-t border-border/80 pt-2 text-center w-56">
                  <div className="font-bold text-xs text-text">{`Dr. ${(activeRecord.doctorId?.name || "Practitioner").replace(/^dr\.?\s+/i, "")}`}</div>
                  <div className="text-[10px] text-text-muted">Authorized Signatory</div>
                </div>
              </div>

              <div className="border-t border-border/40 pt-3 text-center text-[10px] text-text-muted">
                Official Electronic Medical Prescription • Generated by MedLife HealthOS EMR
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setRecordModalOpen(false); setActiveRecord(null); }}>
                Close
              </Button>
              <Button 
                variant="primary"
                onClick={() => {
                  if (!activeRecord) return;
                  
                  const clinicName = activeRecord.clinicId?.name || "MedLife Specialist Clinic";
                  const clinicAddress = [activeRecord.clinicId?.address, activeRecord.clinicId?.city].filter(Boolean).join(", ") || "Main HealthOS Campus";
                  const patientName = activeRecord.patientId?.userId?.name || "Patient";
                  const rawDoctorName = activeRecord.doctorId?.name || "Practitioner";
                  const cleanDoctorName = rawDoctorName.replace(/^dr\.?\s+/i, "");
                  const doctorFormatted = `Dr. ${cleanDoctorName}`;
                  const doctorSpec = activeRecord.doctorId?.specialization || "General Medicine";
                  const apptDate = new Date(activeRecord.appointmentTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                  const tokenNo = activeRecord.tokenNumber || "1";
                  const symptoms = activeRecord.symptoms || "No symptoms recorded.";
                  const diagnosis = activeRecord.diagnosis || "No diagnosis recorded.";
                  const rxItems = (activeRecord.prescriptions || []).map((m: any) => `
                    <tr>
                      <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${m.name}</td>
                      <td style="padding: 8px 12px; color: #334155; border-bottom: 1px solid #e2e8f0;">${m.dosage}</td>
                      <td style="padding: 8px 12px; color: #334155; border-bottom: 1px solid #e2e8f0;">${m.duration}</td>
                    </tr>
                  `).join("");

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
                          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 18px; display: grid; grid-template-cols: 1fr 1fr; gap: 10px; font-size: 12px; }
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
                        ${rxItems.length > 0 ? `
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
                        ` : `<p style="font-size: 12px; color: #64748b; font-style: italic;">No medications prescribed.</p>`}

                        ${activeRecord.followUpRecommended ? `
                          <div class="section-title" style="margin-top: 16px;">Follow-up Plan</div>
                          <div class="section-body">
                            Recommended follow-up within <strong>${activeRecord.followUpTimeline || "1 week"}</strong>.<br/>
                            ${activeRecord.followUpNotes ? `Instructions: <em>"${activeRecord.followUpNotes}"</em>` : ""}
                          </div>
                        ` : ""}

                        <div class="signature-box">
                          <div class="sig-line">
                            ${doctorFormatted}<br/>
                            <span style="font-size: 10px; font-weight: 400; color: #94a3b8;">Authorized Signatory</span>
                          </div>
                        </div>

                        <div class="footer-bar">
                          Official Electronic Medical Prescription • Generated by MedLife HealthOS EMR
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
                Print Prescription Slip
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
