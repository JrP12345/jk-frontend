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
} from "@/components/ui";

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
  const [recentNotes, setRecentNotes] = useState<ClinicalNoteRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
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
        title: "Failed to Fetch OPD Consultation Data",
        description: err.response?.data?.message || "Could not retrieve appointments",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Start Walk-in Consultation Submit
  const handleStartWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId) {
      toast({ title: "Validation Error", description: "Patient and attending doctor are required", variant: "error" });
      return;
    }

    try {
      setStartingEncounter(true);
      // 1. Create a walk-in appointment
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
        title: "Encounter Initialized 🩺",
        description: "Redirecting to SOAP Clinical Workspace...",
        variant: "success",
      });

      setIsWalkInModalOpen(false);
      router.push(`/dashboard/consultations/${newApptId}`);
    } catch (err: any) {
      toast({
        title: "Failed to Start Consultation",
        description: err.response?.data?.message || "Could not initialize OPD encounter",
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
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span>🩺</span> Outpatient Consultation Desk & Doctor Queue
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time OPD patient queue, instant walk-in consultation launcher, and SOAP EHR clinical workspace.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canStartConsultation && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsWalkInModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            <span>+ Start Walk-in Consultation</span>
          </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5"
          >
            <span>Refresh Desk</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total OPD Appointments"
          value={totalToday}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="Waiting for Doctor"
          value={checkedInCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="In Consultation"
          value={inConsultationCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
        <StatCard
          label="Consultations Completed"
          value={completedCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-bold text-text-muted mr-1">Queue Filter:</span>
          {[
            { key: "checked-in", label: "Waiting (Checked-in)" },
            { key: "in-consultation", label: "In Consultation" },
            { key: "confirmed", label: "Scheduled" },
            { key: "completed", label: "Completed" },
            { key: "all", label: "All Patients" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === s.key
                  ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                  : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Input
          placeholder="Search patient, doctor, complaint..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-60 text-xs"
        />
      </div>

      {/* Doctor OPD Queue Cards */}
      {loading ? (
        <div className="py-12 text-center">
          <Spinner size="md" label="Loading Doctor Consultation Queue..." />
        </div>
      ) : filteredQueue.length === 0 ? (
        <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
          <CardContent>No patients currently waiting in consultation queue for selected filter.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQueue.map((item) => {
            const patientName = item.patientId?.userId?.name || "Patient";
            const patientPhone = item.patientId?.userId?.phone || "";
            const doctorName = item.doctorId?.name || "Attending Doctor";

            const isInConsultation = item.status === "in-consultation";
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs ${
                  isInConsultation
                    ? "bg-purple-500/5 border-purple-500/40 hover:border-purple-500"
                    : isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500"
                    : "bg-surface border-border hover:border-primary-500"
                }`}
              >
                {/* Header Badge */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-primary-600 bg-primary-500/10 px-2.5 py-0.5 rounded-lg border border-primary-500/20">
                      🎫 Token #{item.tokenNumber || item.queuePosition || 1}
                    </span>
                    <Badge
                      variant={isInConsultation ? "warning" : isCompleted ? "success" : "primary"}
                      className="capitalize font-bold text-xs"
                    >
                      {item.status.replace("-", " ")}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-base text-text pt-1">{patientName}</h3>
                  <p className="text-[11px] text-text-muted">{patientPhone && `Phone: ${patientPhone}`}</p>
                </div>

                {/* Clinical Notes & Doctor Info */}
                <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Attending Doctor:</span>
                    <span className="font-bold text-text">Dr. {doctorName}</span>
                  </div>
                  {item.chiefComplaint && (
                    <div className="pt-1 border-t border-border/40 text-text">
                      <span className="text-text-muted block">Chief Complaint:</span>
                      <span className="font-medium italic">{item.chiefComplaint}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push(`/dashboard/consultations/${item.id}`)}
                    className="font-bold text-[11px] rounded-lg w-full gap-1.5"
                  >
                    <span>🩺 {isInConsultation ? "Resume Consultation" : isCompleted ? "View Signed Note" : "Start Consultation"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* START WALK-IN CONSULTATION MODAL */}
      <Modal isOpen={isWalkInModalOpen} onClose={() => setIsWalkInModalOpen(false)} title="🩺 Start Walk-in OPD Consultation">
        <form onSubmit={handleStartWalkIn} className="space-y-4 text-xs">
          <Select
            label="Target Patient Profile *"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            options={[
              { value: "", label: "Select patient..." },
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
              { value: "", label: "Select doctor..." },
              ...doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.name} (${d.specialization || "General OPD"})`,
              })),
            ]}
            required
          />

          <Textarea
            label="Chief Complaint / Initial Symptoms"
            placeholder="e.g. Acute headache, fever, shortness of breath..."
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={3}
          />

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsWalkInModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={startingEncounter}>
              Initialize SOAP Workspace 🩺
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
