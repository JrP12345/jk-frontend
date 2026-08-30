"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  useToast,
  Badge,
  StatCard,
  Spinner,
  cn,
} from "@/components/ui";
import {
  RotateCw,
  Plus,
  Calendar,
  Clock,
  Stethoscope,
  CheckCircle2,
  Search,
  Ticket,
  Phone,
  ArrowRight,
  User,
  AlertCircle,
  FileText,
} from "lucide-react";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
  gender?: string;
  dob?: string;
}

interface DoctorUser {
  id: string;
  name: string;
  specialization?: string;
}

export interface OPDQueueAppointment {
  id: string;
  tokenNumber?: number;
  queuePosition?: number;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show";
  appointmentTime: string;
  patientId: {
    id: string;
    userId?: { name: string; email?: string; phone?: string };
    gender?: string;
    dob?: string;
  };
  doctorId: { id: string; name: string; specialization?: string };
  clinicId?: { id: string; name: string };
  chiefComplaint?: string;
  notes?: string;
}

export interface ClinicalNoteRecord {
  id: string;
  _id?: string;
  patientId: { id: string; userId?: { name: string } };
  doctorId: { id: string; name: string };
  version: number;
  status: "draft" | "signed" | "amended";
  subjective?: { chiefComplaint?: string };
  assessment?: { diagnoses?: string[] };
  plan?: { followUpDate?: string; treatmentPlan?: string };
  createdAt?: string;
  signature?: { signedAt?: string; signerName?: string };
}

export default function ConsultationsPage() {
  const router = useRouter();
  const { user, activeClinicId } = useAuthStore();
  const canStartConsultation = hasAnyPermission(user, "MANAGE_CLINICAL_NOTES", "MANAGE_APPOINTMENTS");
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [queueList, setQueueList] = useState<OPDQueueAppointment[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("checked-in");

  // Walk-in Consultation Modal State
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [startingEncounter, setStartingEncounter] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      if (user?.role === "patient") {
        const apptsRes = await api.get("/appointments");
        setQueueList(apptsRes.data?.data || apptsRes.data || []);
      } else {
        const [apptsRes, patientsRes, staffRes] = await Promise.all([
          api.get(selectedClinicId ? `/appointments?clinicId=${selectedClinicId}` : "/appointments"),
          api.get("/patients"),
          api.get(selectedClinicId ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
        ]);

        const rawAppts = apptsRes.data?.data || apptsRes.data || [];
        setQueueList(rawAppts);
        setPatients(patientsRes.data?.data || []);
        setDoctors(staffRes.data?.data?.doctors || []);
      }
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Consultation Queue",
        description: err.response?.data?.message || "Could not retrieve appointments.",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Start Walk-in Consultation Submit
  const handleStartWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId) {
      toast({
        title: "Validation Error",
        description: "Patient and attending practitioner are required.",
        variant: "warning",
      });
      return;
    }

    try {
      setStartingEncounter(true);
      const apptRes = await api.post("/appointments", {
        clinicId: selectedClinicId,
        patientId,
        doctorId,
        appointmentTime: new Date().toISOString(),
        appointmentType: "walk-in",
        status: "checked-in",
        notes: chiefComplaint.trim() || "Walk-in OPD consultation",
      });

      const newApptId = apptRes.data?.data?.id || apptRes.data?.data?._id || apptRes.data?.id;

      toast({
        title: "Encounter Initialized",
        description: "Opening Clinical Consultation Workspace...",
        variant: "success",
      });

      setIsWalkInModalOpen(false);
      router.push(`/dashboard/consultations/${newApptId}`);
    } catch (err: any) {
      toast({
        title: "Unable to Start Consultation",
        description:
          err.response?.data?.message ||
          "Could not initialize OPD encounter. Please verify physician availability.",
        variant: "error",
      });
    } finally {
      setStartingEncounter(false);
    }
  };

  // Filter Queue
  const filteredQueue = queueList.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const pName = item.patientId?.userId?.name || "";
    const dName = item.doctorId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.chiefComplaint && item.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalToday = queueList.length;
  const checkedInCount = queueList.filter((a) => a.status === "checked-in").length;
  const inConsultationCount = queueList.filter((a) => a.status === "in-consultation").length;
  const completedCount = queueList.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Doctor Consultations & OPD Queue
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Clinical Desk
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Real-time outpatient patient queue, walk-in consultation launcher, and SOAP clinical documentation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canStartConsultation && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWalkInModalOpen(true)}
                className="font-semibold rounded-xl shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Start Walk-in Consultation
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total OPD Appointments"
          value={totalToday.toString()}
          description="Scheduled outpatient visits"
          icon={<Calendar className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Waiting for Doctor"
          value={checkedInCount.toString()}
          description="Checked-in waiting line"
          icon={<Clock className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="In Consultation"
          value={inConsultationCount.toString()}
          description="Active physician encounters"
          icon={<Stethoscope className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Completed Today"
          value={completedCount.toString()}
          description="Concluded patient visits"
          icon={<CheckCircle2 className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FILTER TOOLBAR & SEARCH
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
            {[
              { key: "checked-in", label: "Waiting (Checked-in)", count: checkedInCount },
              { key: "in-consultation", label: "In Consultation", count: inConsultationCount },
              { key: "confirmed", label: "Scheduled", count: queueList.filter((a) => a.status === "confirmed").length },
              { key: "completed", label: "Completed", count: completedCount },
              { key: "all", label: "All Patients", count: totalToday },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatusFilter(s.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0",
                  statusFilter === s.key
                    ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                    : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                )}
              >
                <span>{s.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    statusFilter === s.key
                      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                      : "bg-surface-alt text-text-muted"
                  )}
                >
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search patient, doctor, complaint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-border/80 rounded-xl text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. DOCTOR OPD QUEUE CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center">
          <Spinner size="lg" label="Loading Doctor Consultation Queue..." />
        </div>
      ) : filteredQueue.length === 0 ? (
        <Card className="py-16 text-center text-text-muted rounded-2xl border border-border/80 bg-surface shadow-xs">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-primary-500">
              <Stethoscope className="w-6 h-6" />
            </div>
            <p className="font-bold text-text text-sm">No Patients in Selected Queue Filter</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              No patient records currently match this filter state. Try resetting the status filter above.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="rounded-xl font-semibold text-xs"
            >
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQueue.map((item) => {
            const patientName = item.patientId?.userId?.name || "Patient Profile";
            const patientPhone = item.patientId?.userId?.phone || "";
            const doctorName = item.doctorId?.name || "Attending Doctor";
            const isInConsultation = item.status === "in-consultation";
            const isCompleted = item.status === "completed";

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col justify-between text-xs shadow-xs space-y-3.5 overflow-hidden",
                  isInConsultation
                    ? "border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06]"
                    : isCompleted
                    ? "border-emerald-500/20 bg-surface"
                    : "border-border/80 bg-surface hover:border-primary-500/40"
                )}
              >
                {/* Header Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-xl border border-primary-500/20 inline-flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5 opacity-70" />
                      Token #{item.tokenNumber || item.queuePosition || 1}
                    </span>
                    <Badge
                      variant={isInConsultation ? "warning" : isCompleted ? "success" : "primary"}
                      size="sm"
                      dot={isInConsultation}
                      pulse={isInConsultation}
                      className="capitalize font-bold text-[10px]"
                    >
                      {item.status.replace("-", " ")}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-text pt-1">{patientName}</h3>
                  {patientPhone && (
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <Phone className="w-3 h-3 text-text-muted shrink-0" />
                      {patientPhone}
                    </p>
                  )}
                </div>

                {/* Clinical Notes & Doctor Info */}
                <div className="p-3 bg-surface-alt rounded-xl border border-border/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Physician:</span>
                    <span className="font-bold text-text flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                      Dr. {doctorName.replace(/^dr\.?\s+/i, "")}
                    </span>
                  </div>
                  {item.chiefComplaint && (
                    <div className="pt-1.5 border-t border-border/60 text-text">
                      <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                        Chief Complaint:
                      </span>
                      <span className="font-medium italic text-xs text-text-secondary">{item.chiefComplaint}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-2 border-t border-border/60">
                  <Button
                    size="sm"
                    variant={isInConsultation ? "primary" : isCompleted ? "secondary" : "primary"}
                    onClick={() => router.push(`/dashboard/consultations/${item.id}`)}
                    className="font-semibold text-xs rounded-xl w-full shadow-xs justify-between"
                  >
                    <span>
                      {isInConsultation
                        ? "Resume Clinical Encounter"
                        : isCompleted
                        ? "View Signed Consultation Note"
                        : "Start Consultation Workspace"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          5. START WALK-IN CONSULTATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        title="Start Walk-in Consultation"
        description="Initialize an immediate outpatient encounter workspace for a walk-in patient."
      >
        <form onSubmit={handleStartWalkIn} className="space-y-4 pt-1">
          <Select
            label="Target Patient Profile *"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            options={[
              { value: "", label: "Select patient profile..." },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.userId?.name || "Patient"} (${p.userId?.phone || "No phone"})`,
              })),
            ]}
            required
          />

          <Select
            label="Attending Doctor *"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            options={[
              { value: "", label: "Select attending physician..." },
              ...doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${(d.name || "").replace(/^dr\.?\s+/i, "")} (${d.specialization || "General OPD"})`,
              })),
            ]}
            required
          />

          <Textarea
            label="Chief Complaint / Initial Symptoms"
            placeholder="e.g. Acute migraine, fever for 2 days, chest congestion..."
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={3}
          />

          <div className="pt-3 border-t border-border/60 flex justify-end gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsWalkInModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={startingEncounter}
              className="font-semibold rounded-xl shadow-xs"
            >
              Start Clinical Encounter
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
