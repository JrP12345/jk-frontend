"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  useToast,
  Badge,
  StatCard,
  Spinner,
  SkeletonTable,
} from "@/components/ui";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
}

export interface EmergencyTriageItem {
  id: string;
  patientId: {
    id: string;
    userId?: { name: string; phone?: string; email?: string };
  };
  clinicId?: { id: string; name: string };
  esiLevel: 1 | 2 | 3 | 4 | 5;
  chiefComplaint: string;
  triageCategory: "trauma" | "cardiac" | "respiratory" | "stroke" | "pediatric" | "general";
  vitals?: {
    heartRate?: number;
    bpSys?: number;
    bpDia?: number;
    respRate?: number;
    spo2?: number;
    temperature?: number;
    gcsScore?: number;
  };
  assignedBay?: string;
  attendingDoctorId?: { id: string; name: string; specialization?: string };
  notes?: string;
  status: "triaged" | "under_treatment" | "admitted" | "discharged" | "transferred";
  createdAt?: string;
}

export default function EmergencyPage() {
  const { activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [triages, setTriages] = useState<EmergencyTriageItem[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Workspace Tabs
  const [activeTab, setActiveTab] = useState<"queue" | "bays" | "history">("queue");

  // Filters
  const [selectedEsiFilter, setSelectedEsiFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Triage Intake Modal State
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [triageCategory, setTriageCategory] = useState<any>("general");
  const [assignedBay, setAssignedBay] = useState("Trauma Bay 1");
  const [notes, setNotes] = useState("");

  // Vitals State
  const [hr, setHr] = useState<number | "">("");
  const [bpSys, setBpSys] = useState<number | "">("");
  const [bpDia, setBpDia] = useState<number | "">("");
  const [rr, setRr] = useState<number | "">("");
  const [spo2, setSpo2] = useState<number | "">("");
  const [temp, setTemp] = useState<number | "">("");
  const [gcs, setGcs] = useState<number | "">(15);

  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Status & Vitals Update Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activeTriage, setActiveTriage] = useState<EmergencyTriageItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState<any>("under_treatment");
  const [updateBay, setUpdateBay] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [triageRes, patientsRes] = await Promise.all([
        api.get(selectedClinicId ? `/emergency/triage?clinicId=${selectedClinicId}` : "/emergency/triage"),
        api.get("/patients"),
      ]);

      setTriages(triageRes.data?.data || []);
      setPatients(patientsRes.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch ED Data",
        description: err.response?.data?.message || "Could not retrieve emergency triage records",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Live ESI Score Calculator helper for intake modal
  const calculateLiveESI = (): { level: 1 | 2 | 3 | 4 | 5; label: string; color: string } => {
    const cLower = chiefComplaint.toLowerCase();
    const numericSpo2 = typeof spo2 === "number" ? spo2 : 100;
    const numericGcs = typeof gcs === "number" ? gcs : 15;
    const numericHr = typeof hr === "number" ? hr : 75;
    const numericBp = typeof bpSys === "number" ? bpSys : 120;

    if (numericGcs < 9 || numericSpo2 < 88 || numericHr > 150 || cLower.includes("cardiac arrest") || cLower.includes("unresponsive")) {
      return { level: 1, label: "🔴 ESI Level 1: Resuscitation (Immediate Life-Saving)", color: "bg-red-500/15 text-red-600 border-red-500" };
    }
    if (numericSpo2 < 92 || numericHr > 120 || numericBp < 90 || numericBp > 180 || numericGcs < 14 || cLower.includes("chest pain") || cLower.includes("stroke") || cLower.includes("severe bleed")) {
      return { level: 2, label: "🟠 ESI Level 2: Emergent (High Risk / Severe Pain)", color: "bg-amber-500/15 text-amber-600 border-amber-500" };
    }
    if ((typeof temp === "number" && temp > 38.5) || cLower.includes("abdominal pain") || cLower.includes("fracture") || cLower.includes("fever")) {
      return { level: 3, label: "🟡 ESI Level 3: Urgent (Multiple Resources Required)", color: "bg-amber-500/15 text-amber-600 border-amber-500" };
    }
    if (cLower.includes("suture") || cLower.includes("sprain") || cLower.includes("rash")) {
      return { level: 4, label: "🟢 ESI Level 4: Less Urgent (1 Resource Needed)", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500" };
    }
    return { level: 5, label: "🔵 ESI Level 5: Non-Urgent (No Resources Needed)", color: "bg-blue-500/15 text-blue-600 border-blue-500" };
  };

  const recommendedEsi = calculateLiveESI();

  // Handle Intake Submit
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !chiefComplaint.trim()) {
      toast({ title: "Validation Error", description: "Patient profile and chief complaint are required", variant: "error" });
      return;
    }

    try {
      setSubmittingIntake(true);
      await api.post("/emergency/triage", {
        clinicId: selectedClinicId,
        patientId,
        chiefComplaint: chiefComplaint.trim(),
        triageCategory,
        esiLevel: recommendedEsi.level,
        assignedBay: assignedBay.trim() || "ED Holding",
        notes: notes.trim(),
        vitals: {
          heartRate: hr !== "" ? Number(hr) : undefined,
          bpSys: bpSys !== "" ? Number(bpSys) : undefined,
          bpDia: bpDia !== "" ? Number(bpDia) : undefined,
          respRate: rr !== "" ? Number(rr) : undefined,
          spo2: spo2 !== "" ? Number(spo2) : undefined,
          temperature: temp !== "" ? Number(temp) : undefined,
          gcsScore: gcs !== "" ? Number(gcs) : undefined,
        },
      });

      toast({
        title: "Emergency Triage Registered 🚨",
        description: `Patient assigned to ${recommendedEsi.label}`,
        variant: "success",
      });

      setIsIntakeModalOpen(false);
      setPatientId("");
      setChiefComplaint("");
      setHr(""); setBpSys(""); setBpDia(""); setRr(""); setSpo2(""); setTemp(""); setGcs(15);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Triage Intake Failed",
        description: err.response?.data?.message || "Could not register emergency intake",
        variant: "error",
      });
    } finally {
      setSubmittingIntake(false);
    }
  };

  // Handle Status Update Submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTriage) return;

    try {
      setSubmittingUpdate(true);
      await api.put(`/emergency/triage/${activeTriage.id}`, {
        status: updateStatus,
        assignedBay: updateBay,
        notes: updateNotes,
      });

      toast({
        title: "ED Status Updated",
        description: `Updated status to ${updateStatus.toUpperCase()}`,
        variant: "success",
      });

      setIsUpdateModalOpen(false);
      setActiveTriage(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update triage record",
        variant: "error",
      });
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Filter ED Queue
  const filteredTriages = triages.filter((t) => {
    const matchesEsi = selectedEsiFilter === "all" || t.esiLevel.toString() === selectedEsiFilter;
    const isCompleted = t.status === "discharged" || t.status === "admitted" || t.status === "transferred";
    const matchesStatus =
      selectedStatusFilter === "all" ||
      (selectedStatusFilter === "active" && !isCompleted) ||
      (selectedStatusFilter === "completed" && isCompleted);

    const patientName = t.patientId?.userId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignedBay && t.assignedBay.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesEsi && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalEd = triages.length;
  const activeEd = triages.filter((t) => t.status === "triaged" || t.status === "under_treatment").length;
  const level1Count = triages.filter((t) => t.esiLevel === 1 && (t.status === "triaged" || t.status === "under_treatment")).length;
  const level2Count = triages.filter((t) => t.esiLevel === 2 && (t.status === "triaged" || t.status === "under_treatment")).length;

  // Trauma Bay List for Grid Tab
  const BAYS_LIST = [
    "Trauma Bay 1", "Trauma Bay 2", "Resus Room 1", "Resus Room 2", "ED Bed 1", "ED Bed 2", "ED Bed 3", "ED Bed 4"
  ];

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-red-500">🚨</span> Emergency Department (ED) Triage & Resuscitation
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Rapid patient intake, ESI 5-level acuity scoring, vital signs stabilization, and trauma bay management.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsIntakeModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <span>+ Emergency Intake</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh ED</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Active ED Queue"
          value={activeEd}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          label="🔴 Resuscitation (ESI 1)"
          value={level1Count}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          label="🟠 Emergent (ESI 2)"
          value={level2Count}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Total ED Cases Today"
          value={totalEd}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
      </div>

      {/* Workspace Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "queue" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🚨 Live ED Acuity Queue & Rapid Triage ({filteredTriages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bays")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "bays" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🏥 Trauma Resuscitation Bay Occupancy Grid
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "history" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📋 ED Intake History & Audit Register ({triages.length})
        </button>
      </div>

      {/* TAB 1: LIVE ED ACUITY QUEUE & RAPID TRIAGE */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* ESI Acuity Filter Toolbar */}
          <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* ESI Level Selector Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-text-muted mr-1">ESI Acuity:</span>
                {[
                  { key: "all", label: "All Levels" },
                  { key: "1", label: "🔴 ESI 1 (Resus)" },
                  { key: "2", label: "🟠 ESI 2 (Emergent)" },
                  { key: "3", label: "🟡 ESI 3 (Urgent)" },
                  { key: "4", label: "🟢 ESI 4 (Less Urgent)" },
                  { key: "5", label: "🔵 ESI 5 (Non-Urgent)" },
                ].map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => setSelectedEsiFilter(e.key)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedEsiFilter === e.key
                        ? "bg-red-600 text-white border-red-600 shadow-xs"
                        : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>

              <Input
                placeholder="Search patient, complaint, bay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-60 text-xs"
              />
            </div>

            {/* Status Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
              <span className="font-bold text-text-muted">Queue Status:</span>
              {[
                { key: "active", label: "Active ED Queue Only" },
                { key: "completed", label: "Admitted / Discharged" },
                { key: "all", label: "All History" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(s.key)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    selectedStatusFilter === s.key
                      ? "bg-red-500/10 text-red-600 border-red-500 font-bold"
                      : "bg-surface-alt/60 text-text-muted border-border/60 hover:text-text"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ED Patient Cards Grid */}
          {loading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading Emergency Department Triage Queue..." />
            </div>
          ) : filteredTriages.length === 0 ? (
            <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
              <CardContent>No emergency triage cases found matching current filters.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTriages.map((triage) => {
                const patientName = triage.patientId?.userId?.name || "Patient";
                const patientPhone = triage.patientId?.userId?.phone || "";

                const isLevel1 = triage.esiLevel === 1;
                const isLevel2 = triage.esiLevel === 2;
                const isLevel3 = triage.esiLevel === 3;

                return (
                  <div
                    key={triage.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3.5 flex flex-col justify-between text-xs shadow-xs ${
                      isLevel1
                        ? "bg-red-500/10 border-red-500/50 hover:border-red-500"
                        : isLevel2
                        ? "bg-orange-500/10 border-orange-500/50 hover:border-orange-500"
                        : isLevel3
                        ? "bg-amber-500/10 border-amber-500/50 hover:border-amber-500"
                        : "bg-surface border-border hover:border-red-500"
                    }`}
                  >
                    {/* Header Badge */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={isLevel1 ? "danger" : isLevel2 ? "warning" : "neutral"}
                          className="font-bold text-xs px-2.5 py-0.5 uppercase tracking-wider"
                        >
                          {isLevel1 ? "🔴 ESI 1: RESUS" : isLevel2 ? "🟠 ESI 2: EMERGENT" : isLevel3 ? "🟡 ESI 3: URGENT" : `ESI ${triage.esiLevel}`}
                        </Badge>
                        <span className="font-bold font-mono text-red-600 text-xs bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                          {triage.assignedBay || "ED Holding"}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        <h3 className="font-bold text-base text-text">{patientName}</h3>
                        {patientPhone && <p className="text-[11px] text-text-muted">{patientPhone}</p>}
                      </div>
                    </div>

                    {/* Chief Complaint */}
                    <div className="p-2.5 bg-surface/80 rounded-xl border border-border/60">
                      <span className="font-bold text-text-muted text-[10px] uppercase block tracking-wider">Chief Complaint:</span>
                      <p className="font-semibold text-text text-xs mt-0.5 line-clamp-2">{triage.chiefComplaint}</p>
                    </div>

                    {/* Vitals Grid */}
                    {triage.vitals && (
                      <div className="grid grid-cols-3 gap-1.5 p-2 bg-surface/60 rounded-xl border border-border/40 text-[10px] text-center">
                        <div>
                          <span className="text-text-muted block">SpO2</span>
                          <span className={`font-bold font-mono text-xs ${triage.vitals.spo2 && triage.vitals.spo2 < 92 ? "text-red-600 font-extrabold" : "text-text"}`}>
                            {triage.vitals.spo2 ? `${triage.vitals.spo2}%` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Heart Rate</span>
                          <span className="font-bold font-mono text-xs text-text">
                            {triage.vitals.heartRate ? `${triage.vitals.heartRate} bpm` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">BP</span>
                          <span className="font-bold font-mono text-xs text-text">
                            {triage.vitals.bpSys ? `${triage.vitals.bpSys}/${triage.vitals.bpDia || "—"}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Resp Rate</span>
                          <span className="font-bold font-mono text-xs text-text">
                            {triage.vitals.respRate ? `${triage.vitals.respRate}/min` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Temp</span>
                          <span className="font-bold font-mono text-xs text-text">
                            {triage.vitals.temperature ? `${triage.vitals.temperature}°C` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">GCS</span>
                          <span className={`font-bold font-mono text-xs ${triage.vitals.gcsScore && triage.vitals.gcsScore < 13 ? "text-amber-600 font-extrabold" : "text-text"}`}>
                            {triage.vitals.gcsScore ? `${triage.vitals.gcsScore}/15` : "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Status Footer & Actions */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <span className="capitalize font-bold text-[11px] text-text-muted">
                        Status: <b className="text-red-600">{triage.status.replace(/_/g, " ")}</b>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {triage.status === "admitted" && (
                          <a
                            href="/dashboard/admissions"
                            className="font-bold text-[10px] px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg inline-flex items-center gap-1"
                          >
                            🏥 IPD Ward Admission
                          </a>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setActiveTriage(triage);
                            setUpdateStatus(triage.status);
                            setUpdateBay(triage.assignedBay || "");
                            setUpdateNotes(triage.notes || "");
                            setIsUpdateModalOpen(true);
                          }}
                          className="font-bold text-[11px] rounded-lg"
                        >
                          ⚡ Update Bay/Status
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAUMA RESUSCITATION BAY OCCUPANCY GRID */}
      {activeTab === "bays" && (
        <Card className="p-5 bg-surface border border-border rounded-2xl shadow-xs space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border/60">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>🏥</span> Emergency Trauma Resuscitation Bay Occupancy Grid
            </CardTitle>
            <p className="text-xs text-text-muted">
              Real-time monitoring of ED resus rooms, trauma bays, and holding beds.
            </p>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {BAYS_LIST.map((bayName) => {
                const occupant = triages.find(
                  (t) => t.assignedBay?.toLowerCase() === bayName.toLowerCase() && t.status !== "discharged" && t.status !== "admitted"
                );

                return (
                  <div
                    key={bayName}
                    className={`p-4 rounded-2xl border transition-all space-y-3 text-xs shadow-xs ${
                      occupant
                        ? occupant.esiLevel === 1
                          ? "bg-red-500/10 border-red-500/60"
                          : "bg-amber-500/10 border-amber-500/50"
                        : "bg-surface-alt/60 border-border/70"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="font-extrabold text-sm text-text">{bayName}</span>
                      {occupant ? (
                        <Badge variant="danger" className="text-[10px] font-mono font-bold">
                          OCCUPIED
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] font-mono font-bold">
                          AVAILABLE
                        </Badge>
                      )}
                    </div>

                    {occupant ? (
                      <div className="space-y-1.5">
                        <div className="font-bold text-text text-sm">{occupant.patientId?.userId?.name || "Patient"}</div>
                        <p className="text-text-muted text-[11px] line-clamp-2">{occupant.chiefComplaint}</p>
                        <div className="pt-2 flex justify-between items-center text-[11px] font-mono">
                          <span className="text-red-600 font-bold">ESI Level {occupant.esiLevel}</span>
                          <span className="text-text-muted">{occupant.status.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-text-muted italic text-[11px]">
                        Bay ready for immediate trauma intake.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: EMERGENCY INTAKE HISTORY & AUDIT REGISTER */}
      {activeTab === "history" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-base font-bold text-text">
              Emergency Department Audit Register & History
            </CardTitle>
            <p className="text-xs text-text-muted">
              Complete historical record of emergency department intakes, acuity scores, and disposition outcomes.
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : triages.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🚨</div>
                <p className="text-xs font-semibold">No emergency triage records found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {triages.map((t) => (
                  <div key={t.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-text text-sm flex items-center gap-2">
                          {t.patientId?.userId?.name || "Patient"}
                          <Badge variant={t.esiLevel === 1 ? "danger" : "neutral"} className="text-[10px]">
                            ESI {t.esiLevel}
                          </Badge>
                          <Badge variant="neutral" className="text-[10px]">
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-text-muted text-[11px] mt-0.5">
                          Complaint: {t.chiefComplaint} · Assigned: {t.assignedBay || "ED Holding"}
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-text-muted font-mono">
                        {t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AUTOMATED ESI TRIAGE INTAKE MODAL */}
      <Modal isOpen={isIntakeModalOpen} onClose={() => setIsIntakeModalOpen(false)} title="🚨 Emergency Department Intake & ESI Triage" size="lg">
        <form onSubmit={handleIntakeSubmit} className="space-y-4 text-xs">
          {/* Live ESI Recommendation Banner */}
          <div className={`p-3.5 rounded-2xl border ${recommendedEsi.color} flex items-center justify-between`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block">Live Acuity Recommendation Engine:</span>
              <span className="font-black text-sm block mt-0.5">{recommendedEsi.label}</span>
            </div>
            <span className="text-2xl font-bold font-mono">ESI #{recommendedEsi.level}</span>
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Textarea
              label="Chief Complaint & Acute Symptoms *"
              placeholder="e.g. Sudden onset crushing substernal chest pain radiating to left arm..."
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={3}
              required
            />

            <div className="space-y-3">
              <Select
                label="Triage Clinical Category"
                value={triageCategory}
                onChange={(e) => setTriageCategory(e.target.value as any)}
                options={[
                  { value: "general", label: "General Medical Emergency" },
                  { value: "cardiac", label: "Cardiac / Chest Pain" },
                  { value: "trauma", label: "Trauma / Severe Injury" },
                  { value: "stroke", label: "Stroke / Neurological" },
                  { value: "respiratory", label: "Respiratory Distress" },
                  { value: "pediatric", label: "Pediatric Emergency" },
                ]}
              />

              <Input
                label="Assigned ED Bay / Room"
                placeholder="e.g. Trauma Bay 1, Resus Room 2, ED Bed 5"
                value={assignedBay}
                onChange={(e) => setAssignedBay(e.target.value)}
              />
            </div>
          </div>

          {/* Vitals Input Grid */}
          <div className="p-3 bg-surface-alt rounded-2xl border border-border space-y-2">
            <span className="font-bold text-text block">Patient Vital Signs (Auto-evaluates ESI score):</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input label="SpO2 (%)" type="number" value={spo2} onChange={(e) => setSpo2(e.target.value === "" ? "" : Number(e.target.value))} placeholder="98" />
              <Input label="Heart Rate (BPM)" type="number" value={hr} onChange={(e) => setHr(e.target.value === "" ? "" : Number(e.target.value))} placeholder="75" />
              <Input label="BP Systolic" type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value === "" ? "" : Number(e.target.value))} placeholder="120" />
              <Input label="GCS Score (3-15)" type="number" value={gcs} onChange={(e) => setGcs(e.target.value === "" ? "" : Number(e.target.value))} placeholder="15" />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsIntakeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingIntake} className="bg-red-600 hover:bg-red-700 text-white border-red-600">
              Confirm ED Intake & Triage
            </Button>
          </div>
        </form>
      </Modal>

      {/* UPDATE STATUS & BAY MODAL */}
      {activeTriage && (
        <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`⚡ Update ED Status — ${activeTriage.patientId?.userId?.name}`}>
          <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
            <Select
              label="Update Triage Status *"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as any)}
              options={[
                { value: "triaged", label: "Triaged (Waiting for Treatment)" },
                { value: "under_treatment", label: "Under Active Treatment" },
                { value: "admitted", label: "Admitted to Inpatient Ward / ICU" },
                { value: "discharged", label: "Discharged from ED" },
                { value: "transferred", label: "Transferred to Tertiary Hospital" },
              ]}
            />

            <Input
              label="Assigned ED Bay / Bed"
              value={updateBay}
              onChange={(e) => setUpdateBay(e.target.value)}
            />

            <Textarea
              label="Clinical Progress Notes"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              rows={3}
            />

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsUpdateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingUpdate} className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Save Updates
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
