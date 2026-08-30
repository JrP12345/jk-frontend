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
import { NurseVitalsModal } from "@/components/clinical/NurseVitalsModal";
import { playChimeSound, CHIME_OPTIONS, ChimeType } from "@/utils/audioChimes";
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
} from "lucide-react";

interface Appointment {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId: {
    id: string;
    dob: string;
    gender: string;
    userId: { name: string; email: string; phone: string };
  };
  appointmentTime: string;
  appointmentType: string;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show";
  tokenNumber: number;
  queuePosition: number;
  estimatedWaitTime?: number;
  notes?: string;
}

export default function QueuePage() {
  const { user, activeClinicId } = useAuthStore();
  const { fetchClinics } = useClinicStore();
  const { toast } = useToast();

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Token Slip Modal State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);
  const [callingNext, setCallingNext] = useState(false);

  // Nurse Vitals Modal State
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState<{ id: string; name: string } | null>(null);

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

  // Fetch queue when filters change
  const fetchQueue = async () => {
    if (!selectedClinic || !selectedDoctor) {
      setAppointments([]);
      return;
    }
    try {
      setLoadingQueue(true);
      const res = await api.get(`/queue?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`);
      setAppointments(res.data.data || []);
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

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      if (selectedClinic && selectedDoctor) {
        api
          .get(`/queue?clinicId=${selectedClinic}&doctorId=${selectedDoctor}&date=${selectedDate}`)
          .then((res) => setAppointments(res.data.data || []))
          .catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedClinic, selectedDoctor, selectedDate]);

  // Split appointments into Active and Finished categories
  const activeStatuses = ["pending", "confirmed", "checked-in", "in-consultation"];
  const activeQueue = appointments.filter((a) => activeStatuses.includes(a.status));
  const finishedQueue = appointments.filter((a) => !activeStatuses.includes(a.status));

  // Compute live statistics
  const stats = {
    waiting: activeQueue.filter((a) => ["pending", "confirmed", "checked-in"].includes(a.status)).length,
    checkedIn: activeQueue.filter((a) => a.status === "checked-in").length,
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

  const handleCallNext = async () => {
    try {
      setCallingNext(true);
      const res = await api.post("/queue/call-next", {
        clinicId: selectedClinic,
        doctorId: selectedDoctor,
      });
      if (res.data?.data) {
        playChimeSound(chimeType);
        toast({
          title: "Patient Called",
          description: res.data.message || `Token #${res.data.data.tokenNumber} has been summoned for consultation.`,
          variant: "success",
        });
      } else {
        toast({
          title: "Queue Clear",
          description: res.data?.message || "No waiting patients remaining in this queue.",
          variant: "default",
        });
      }
      await fetchQueue();
    } catch (err: any) {
      toast({
        title: "Call Failed",
        description: err.response?.data?.message || "Could not call next patient in queue.",
        variant: "error",
      });
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

  const openCompleteModal = (appt: Appointment) => {
    setApptToComplete(appt);
    setRecommendFollowUp(false);
    setFollowUpTimeline("1 week");
    setFollowUpNotes("");
    setSymptoms("");
    setDiagnosis("");
    setPrescriptions([{ name: "", dosage: "", duration: "" }]);
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
      });
      toast({ title: "Consultation Concluded", description: "Patient visit and clinical records saved.", variant: "success" });
      setCompleteModalOpen(false);
      setApptToComplete(null);
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Completion Error", description: err.response?.data?.message || "Failed to complete consultation.", variant: "error" });
    } finally {
      setCompletingSubmitting(false);
    }
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
              variant="primary"
              size="sm"
              onClick={handleCallNext}
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
          </div>
        )}
      </Card>

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text">Active Queue Waitlist</h3>
                <Badge variant="primary" size="sm" className="font-semibold">
                  {activeQueue.length} Waiting
                </Badge>
              </div>
            </div>

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

                  return (
                    <Card
                      key={appt.id}
                      className={cn(
                        "rounded-2xl border transition-all shadow-xs overflow-hidden",
                        isInConsultation
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
                              isInConsultation
                                ? "bg-emerald-500 text-white shadow-emerald-500/20"
                                : isCheckedIn
                                ? "bg-primary-500 text-white shadow-primary-500/20"
                                : "bg-surface-alt border border-border text-text"
                            )}
                          >
                            <span className="text-[9px] font-sans uppercase font-bold tracking-wider opacity-80">
                              Token
                            </span>
                            <span className="text-base leading-none">#{appt.tokenNumber}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-text text-sm truncate">
                                {appt.patientId?.userId?.name || "Patient Profile"}
                              </span>
                              <Badge
                                variant={getStatusBadgeVariant(appt.status)}
                                size="sm"
                                dot={isInConsultation}
                                pulse={isInConsultation}
                                className="capitalize font-semibold text-[10px]"
                              >
                                {appt.status.replace("-", " ")}
                              </Badge>
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

                          {/* VIP Queue Reorder Up/Down arrows */}
                          {canManageQueue && (
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
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            {(appt.status === "pending" || appt.status === "confirmed") && (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => handleCheckInAndPrintToken(appt)}
                                loading={updatingStatus === appt.id}
                                className="font-semibold rounded-lg shadow-xs"
                              >
                                <Ticket className="w-3.5 h-3.5 mr-1" />
                                Check-In
                              </Button>
                            )}

                            {isCheckedIn && (
                              <>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    setVitalsPatient({
                                      id: appt.patientId?.id || (appt.patientId as any)?._id || (appt.patientId as any),
                                      name: appt.patientId?.userId?.name || "Patient",
                                    });
                                    setVitalsModalOpen(true);
                                  }}
                                  className="font-semibold rounded-lg"
                                >
                                  <Activity className="w-3.5 h-3.5 mr-1 text-text-muted" />
                                  Vitals
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handleCheckInAndPrintToken(appt)}
                                  className="font-semibold rounded-lg"
                                >
                                  <Printer className="w-3.5 h-3.5 mr-1 text-text-muted" />
                                  Slip
                                </Button>
                                <Button
                                  size="xs"
                                  variant="primary"
                                  onClick={() => updateStatus(appt.id, "in-consultation")}
                                  loading={updatingStatus === appt.id}
                                  className="font-semibold rounded-lg shadow-xs"
                                >
                                  <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                                  Consult
                                </Button>
                              </>
                            )}

                            {isInConsultation && (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => openCompleteModal(appt)}
                                loading={updatingStatus === appt.id}
                                className="font-semibold rounded-lg shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Complete Visit
                              </Button>
                            )}

                            {!isInConsultation && (
                              <>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => updateStatus(appt.id, "no-show")}
                                  loading={updatingStatus === appt.id}
                                  className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-border font-semibold rounded-lg"
                                >
                                  No-Show
                                </Button>
                                <Button
                                  size="xs"
                                  variant="danger"
                                  onClick={() => updateStatus(appt.id, "cancelled")}
                                  loading={updatingStatus === appt.id}
                                  className="font-semibold rounded-lg"
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {prescriptions.map((prescription, idx) => (
                  <div key={idx} className="flex gap-2.5 items-end">
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
                        className="mb-0.5 px-2.5"
                        onClick={() => {
                          setPrescriptions(prescriptions.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
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

      {/* Token Slip Printable Modal */}
      <UnifiedDocumentModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        document={unifiedDoc}
      />

      {/* Nurse Vitals Pre-Check Modal */}
      <NurseVitalsModal
        open={vitalsModalOpen}
        onClose={() => setVitalsModalOpen(false)}
        patientId={vitalsPatient?.id || ""}
        patientName={vitalsPatient?.name || "Patient"}
      />
    </div>
  );
}
