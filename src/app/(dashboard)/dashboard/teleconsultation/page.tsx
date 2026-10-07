"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { externalServiceUrl } from "@/lib/externalServiceUrl";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { Alert, Card, CardContent, Button, Modal, Input, Select, useToast, Badge, StatCard, SkeletonCardGrid, cn } from "@/components/ui";
import { RotateCw, Plus, Video, Clock, Activity, CheckCircle2 } from "lucide-react";

export interface TeleconsultationAppointment {
  id: string;
  appointmentTime: string;
  appointmentType: "online" | "walk-in" | "reception" | "qr";
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show";
  patientId: {
    id: string;
    userId?: { name: string; email?: string; phone?: string };
    gender?: string;
    dob?: string;
  };
  doctorId: { id: string; name: string; specialization?: string };
  locationId?: { id: string; name: string };
  notes?: string;
}

export interface TeleSessionData {
  id?: string;
  _id?: string;
  sessionRoomId: string;
  appointmentId: string;
  meetingUrl: string;
  status: "scheduled" | "active" | "ended" | "missed";
  clinicalNotes?: string;
  vitalsRecorded?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
  };
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
}

export default function TeleconsultationPage() {
  const { user } = useAuthStore();
  const { activeLocationId } = useLocationStore();
  const { toast } = useToast();

  const [selectedLocationId, setSelectedLocationId] = useState(activeLocationId || "");
  const [appointments, setAppointments] = useState<TeleconsultationAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Video Call Modal State
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeApptForCall, setActiveApptForCall] = useState<TeleconsultationAppointment | null>(null);
  const [activeSession, setActiveSession] = useState<TeleSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [submittingEndCall, setSubmittingEndCall] = useState(false);


  // Clinical workspace tab & form states inside video call modal
  const [activeTab, setActiveTab] = useState<"ehr" | "notes" | "rx">("ehr");
  const [clinicalNotesInput, setClinicalNotesInput] = useState("");
  const [vitalsInput, setVitalsInput] = useState({ bp: "", pulse: "", temp: "", spo2: "" });
  const [savingNotes, setSavingNotes] = useState(false);

  // Quick Prescription form inside video call modal
  const [rxForm, setRxForm] = useState({ drugName: "", dosage: "", frequency: "1-0-1", durationDays: "5", instructions: "After meals" });
  const [savingRx, setSavingRx] = useState(false);

  // Launch Session Modal State
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState("");
  const [launchingSession, setLaunchingSession] = useState(false);

  useEffect(() => {
    setSelectedLocationId(activeLocationId || "");
  }, [activeLocationId]);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const apptsRes = await api.get(selectedLocationId ? `/appointments?locationId=${selectedLocationId}` : "/appointments");
      const list: TeleconsultationAppointment[] = apptsRes.data?.data || apptsRes.data || [];
      setAppointments(list);
    } catch (err: any) {
      setLoadError("Virtual appointments could not be loaded. Please try again.");
      toast({
        title: "Failed to Fetch Virtual Care Queue",
        description: err.response?.data?.message || "Could not retrieve telehealth sessions",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLocationId]);


  // Join or Create Video Session & Start Call
  const handleJoinVideoCall = async (appt: TeleconsultationAppointment) => {
    setActiveSession(null);
    setClinicalNotesInput("");
    setVitalsInput({ bp: "", pulse: "", temp: "", spo2: "" });
    setActiveApptForCall(appt);
    setIsVideoModalOpen(true);
    setLoadingSession(true);
    setActiveTab("ehr");

    try {
      let sessionData: TeleSessionData | null = null;
      try {
        const getRes = await api.get(`/teleconsultation/session/${appt.id}`);
        sessionData = getRes.data?.data;
      } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
        const createRes = await api.post("/teleconsultation/session", { appointmentId: appt.id });
        sessionData = createRes.data?.data;
      }

      if (sessionData) {
        const sId = sessionData.id || sessionData._id;
        if (sId && sessionData.status !== "ended") {
          try {
            const startRes = await api.put(`/teleconsultation/session/${sId}/start`);
            if (startRes.data?.data) {
              sessionData = startRes.data.data;
            }
          } catch (e) {
            console.warn("Could not mark session as active automatically:", e);
          }
        }

        if (sessionData) {
          setActiveSession(sessionData);
          setClinicalNotesInput(sessionData.clinicalNotes || appt.notes || "");
          if (sessionData.vitalsRecorded) {
            setVitalsInput({
              bp: sessionData.vitalsRecorded.bp || "",
              pulse: sessionData.vitalsRecorded.pulse || "",
              temp: sessionData.vitalsRecorded.temp || "",
              spo2: sessionData.vitalsRecorded.spo2 || "",
            });
          }
        }
      }
    } catch (err: any) {
      toast({
        title: "Failed to Join Room",
        description: err.response?.data?.message || "Could not initialize video room session",
        variant: "error",
      });
    } finally {
      setLoadingSession(false);
    }
  };

  // Save Clinical Notes & Vitals
  const handleSaveNotes = async () => {
    if (!activeSession) return;
    const sId = activeSession.id || activeSession._id;
    if (!sId) return;

    try {
      setSavingNotes(true);
      await api.put(`/teleconsultation/session/${sId}/notes`, {
        clinicalNotes: clinicalNotesInput,
        vitalsRecorded: vitalsInput,
      });

      toast({
        title: "Notes & Vitals Saved ✓",
        description: "Clinical documentation recorded for this teleconsultation.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Failed to Save Notes",
        description: err.response?.data?.message || "Could not save clinical notes",
        variant: "error",
      });
    } finally {
      setSavingNotes(false);
    }
  };

  // Save Prescription Draft
  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxForm.drugName) return;

    try {
      setSavingRx(true);
      const rxLine = `\n• Rx: ${rxForm.drugName} ${rxForm.dosage} | Frequency: ${rxForm.frequency} | Duration: ${rxForm.durationDays} days | Instructions: ${rxForm.instructions}`;
      const updatedNotes = clinicalNotesInput ? `${clinicalNotesInput}\n${rxLine}` : `Prescription Items:${rxLine}`;
      setClinicalNotesInput(updatedNotes);

      if (activeSession) {
        const sId = activeSession.id || activeSession._id;
        if (sId) {
          await api.put(`/teleconsultation/session/${sId}/notes`, {
            clinicalNotes: updatedNotes,
            vitalsRecorded: vitalsInput,
          });
        }
      }

      toast({
        title: "Prescription Added to Consultation Notes ✓",
        description: `Added ${rxForm.drugName} to the consultation notes.`,
        variant: "success",
      });

      setRxForm({ drugName: "", dosage: "", frequency: "1-0-1", durationDays: "5", instructions: "After meals" });
    } catch (err: any) {
      toast({
        title: "Prescription Save Failed",
        description: err.response?.data?.message || "Could not save prescription into notes",
        variant: "error",
      });
    } finally {
      setSavingRx(false);
    }
  };

  const meetingUrl = externalServiceUrl(activeSession?.meetingUrl);
  const handleCopyLink = async () => {
    if (!meetingUrl) return;
    try {
      await navigator.clipboard.writeText(meetingUrl);
      toast({ title: "Meeting link copied", description: "Share this link with the invited patient.", variant: "success" });
    } catch {
      toast({ title: "Could not copy link", description: "Open the meeting and copy its address instead.", variant: "error" });
    }
  };

  // Launch New Session Submit
  const handleLaunchSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptId) return;

    try {
      setLaunchingSession(true);
      await api.post("/teleconsultation/session", { appointmentId: selectedApptId });
      toast({
        title: "Consultation session created",
        description: "The clinical workspace is ready. Open its video meeting when the service is connected.",
        variant: "success",
      });
      setIsLaunchModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Provisioning Failed",
        description: err.response?.data?.message || "Could not create virtual room",
        variant: "error",
      });
    } finally {
      setLaunchingSession(false);
    }
  };

  // End Video Call
  const handleEndCall = async () => {
    if (!activeSession) return;
    const sId = activeSession.id || activeSession._id;

    try {
      setSubmittingEndCall(true);
      if (sId) {
        await api.put(`/teleconsultation/session/${sId}/end`);
      }


      toast({
        title: "Teleconsultation Call Ended 🔴",
        description: "Session completed. Video meeting controls remain in the meeting tab.",
        variant: "success",
      });

      setIsVideoModalOpen(false);
      setActiveApptForCall(null);
      setActiveSession(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Call End Failed",
        description: err.response?.data?.message || "Could not log call termination",
        variant: "error",
      });
    } finally {
      setSubmittingEndCall(false);
    }
  };

  // Filter List
  const filteredAppointments = appointments.filter((item) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "checked-in" && item.status === "checked-in") ||
      (statusFilter === "in-consultation" && item.status === "in-consultation") ||
      (statusFilter === "confirmed" && (item.status === "confirmed" || item.appointmentType === "online")) ||
      (statusFilter === "completed" && item.status === "completed");

    const pName = item.patientId?.userId?.name || "";
    const dName = item.doctorId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const totalVirtual = appointments.length;
  const waitingCount = appointments.filter((a) => a.status === "checked-in").length;
  const activeCallCount = appointments.filter((a) => a.status === "in-consultation").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-primary before: before: before:">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Video consultations
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Virtual care
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage video visits, review patient details, and write prescriptions.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
             loading={loading}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh Desk
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsLaunchModalOpen(true)}
              className="font-semibold rounded-xl shadow-xs flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create consultation session
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Telehealth Visits"
          value={totalVirtual.toString()}
          description="Registered online encounters"
          icon={<Video className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Virtual Waiting Room"
          value={waitingCount.toString()}
          description="Checked-in patients queue"
          icon={<Clock className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Active Video Calls"
          value={activeCallCount.toString()}
          description="Currently ongoing encounters"
          icon={<Activity className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Completed Visits"
          value={completedCount.toString()}
          description="Finished virtual consultations"
          icon={<CheckCircle2 className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FILTER TOOLBAR
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 bg-surface rounded-2xl border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto touch-manipulation scrollbar-none w-full md:w-fit max-w-full">
          {[
            { key: "all", label: "All Telehealth Visits", count: totalVirtual },
            { key: "checked-in", label: "Waiting Room", count: waitingCount },
            { key: "in-consultation", label: "In Active Call", count: activeCallCount },
            { key: "confirmed", label: "Scheduled", count: appointments.filter((a) => a.status === "confirmed").length },
            { key: "completed", label: "Completed", count: completedCount },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={statusFilter === s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
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
                    ? "bg-primary-500/10 text-accent dark:text-accent"
                    : "bg-surface-alt text-text-muted"
                )}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>

        <Input
          placeholder="Search patient, doctor, complaint..."
          aria-label="Search virtual appointments"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 text-xs h-10 sm:h-9"
        />
      </div>

      {/* Teleconsultation Cards Grid */}
      {loading ? (
        <SkeletonCardGrid count={6} columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
      ) : loadError ? (
        <Alert variant="error" title="Unable to load virtual appointments" action={<Button variant="outline" onClick={fetchData}>Try again</Button>}>{loadError}</Alert>
      ) : filteredAppointments.length === 0 ? (
        <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
          <CardContent>No virtual appointments currently in queue matching selected filter.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAppointments.map((item) => {
            const patientName = item.patientId?.userId?.name || "Patient Profile";
            const patientPhone = item.patientId?.userId?.phone || "";
            const rawDoctorName = item.doctorId?.name || "Attending Physician";
            const doctorName = rawDoctorName.startsWith("Dr.") ? rawDoctorName : `Dr. ${rawDoctorName}`;
            const timeStr = item.appointmentTime
              ? new Date(item.appointmentTime).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Scheduled Virtual Visit";

            const isInCall = item.status === "in-consultation";
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs relative overflow-hidden ${
                  isInCall
                    ? "bg-primary/10 border-accent/50 hover:border-accent ring-1 ring-accent/20"
                    : isCompleted
                    ? "bg-success/5 border-success/30 hover:border-success"
                    : "bg-surface border-border/80 hover:border-primary-500/40"
                }`}
              >
                {/* Header Badge & Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-accent bg-primary/10 px-2.5 py-1 rounded-lg border border-accent/20 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      <span>Virtual Visit</span>
                    </span>
                    <Badge
                      variant={isInCall ? "warning" : isCompleted ? "success" : "primary"}
                      className="capitalize font-bold text-xs"
                      pulse={isInCall}
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                      {patientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-text truncate">{patientName}</h3>
                      {patientPhone ? (
                        <a
                          href={`tel:${patientPhone}`}
                          className="text-[11px] text-text-muted hover:text-accent transition-colors flex items-center gap-1 truncate"
                        >
                          <span>📞</span> {patientPhone}
                        </a>
                      ) : (
                        <span className="text-[11px] text-text-muted">Phone: Unlisted</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Box */}
                <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-text-muted" />
                      <span>Slot:</span>
                    </span>
                    <span className="font-semibold text-text truncate">{timeStr}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">Doctor:</span>
                    <span className="font-bold text-text truncate">
                      {doctorName}
                      {item.doctorId?.specialization && (
                        <span className="text-text-muted font-normal text-[10px] ml-1">
                          ({item.doctorId.specialization})
                        </span>
                      )}
                    </span>
                  </div>
                  {item.notes && (
                    <div className="pt-1 border-t border-border/40 text-text">
                      <span className="text-text-muted block text-[10px]">Notes / Indication:</span>
                      <span className="font-medium italic text-text line-clamp-2">{item.notes}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-1 border-t border-border/60 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleJoinVideoCall(item)}
                    className="font-bold text-xs rounded-xl w-full gap-2 bg-primary hover:bg-primary text-brand-mist cursor-pointer min-h-[44px] justify-center shadow-xs"
                  >
                    <Video className="w-4 h-4" />
                    <span>{isInCall ? "Resume consultation" : "Open consultation"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TELECONSULTATION PURE NATIVE WEBRTC WORKSPACE MODAL */}
      {activeApptForCall && (
        <Modal
          isOpen={isVideoModalOpen}
          onClose={() => {
            if (!submittingEndCall) setIsVideoModalOpen(false);
          }}
          title={`Teleconsultation Clinical Workspace — ${activeApptForCall.patientId?.userId?.name || "Patient"}`}
          size="2xl"
          loading={loadingSession}
          loadingText="Loading consultation workspace..."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
              {/* Left Column: Pure Native WebRTC Video Call Theater */}
              <div className="lg:col-span-7 space-y-3">
                <div className="rounded-2xl border border-border bg-surface-alt p-5 sm:p-8 space-y-4">
                  <h2 className="text-lg font-bold text-text">Video meeting</h2>
                  {meetingUrl && activeSession?.status !== "ended" ? <>
                    <p className="text-sm text-text-secondary">Open the meeting in a separate tab. Camera, microphone and screen sharing are controlled there. Keep this workspace open for clinical notes.</p>
                    <div className="flex flex-wrap gap-3">
                      <a href={meetingUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 py-2 text-white font-semibold">Join video meeting</a>
                      <Button variant="outline" onClick={handleCopyLink}>Copy meeting link</Button>
                    </div>
                    <p className="text-xs text-text-muted">Opening this link does not confirm that the patient has joined.</p>
                  </> : <Alert title={activeSession?.status === "ended" ? "Session completed" : "Video meeting unavailable"}>
                    {activeSession?.status === "ended" ? "This consultation has ended." : "Your organization administrator needs to connect the video service. Clinical notes are available below."}
                  </Alert>}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="text-[11px] text-text-muted">
                    <span className="font-semibold text-text">Attending Physician:</span>{" "}
                    <span className="font-bold text-text">
                      {activeApptForCall.doctorId?.name
                        ? (activeApptForCall.doctorId.name.startsWith("Dr.")
                            ? activeApptForCall.doctorId.name
                            : `Dr. ${activeApptForCall.doctorId.name}`)
                        : "Attending Physician"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleEndCall}
                    loading={submittingEndCall}
                    className="bg-danger hover:bg-danger text-background font-bold rounded-xl text-xs gap-1.5 px-4 cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
                  >
                    <span>Complete consultation</span>
                  </Button>
                </div>
              </div>

              {/* Right Column: In-Call Clinical Workspace Side Drawer */}
              <div className="lg:col-span-5 bg-surface p-4 rounded-2xl border border-border space-y-3 flex flex-col justify-between shadow-xs">
                <div>
                  {/* Workspace Tab Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-xl border border-border/60 text-[11px] font-bold mb-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("ehr")}
                      className={`flex-1 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[38px] sm:min-h-[32px] flex items-center justify-center ${
                        activeTab === "ehr" ? "bg-surface text-accent shadow-xs" : "text-text-muted hover:text-text"
                      }`}
                    >
                      👤 EHR Context
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("notes")}
                      className={`flex-1 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[38px] sm:min-h-[32px] flex items-center justify-center ${
                        activeTab === "notes" ? "bg-surface text-accent shadow-xs" : "text-text-muted hover:text-text"
                      }`}
                    >
                      📝 Notes & Vitals
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("rx")}
                      className={`flex-1 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[38px] sm:min-h-[32px] flex items-center justify-center ${
                        activeTab === "rx" ? "bg-surface text-accent shadow-xs" : "text-text-muted hover:text-text"
                      }`}
                    >
                      💊 Quick Rx
                    </button>
                  </div>

                  {/* Tab 1: EHR Context */}
                  {activeTab === "ehr" && (
                    <div className="space-y-3 text-[11px]">
                      <div className="p-3 bg-surface-alt/60 rounded-xl border border-border/50 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Patient Name:</span>
                          <span className="font-bold text-text">{activeApptForCall.patientId?.userId?.name || "Patient"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Phone Number:</span>
                          <span className="font-mono text-text">{activeApptForCall.patientId?.userId?.phone || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Consultation Mode:</span>
                          <span className="font-bold text-accent uppercase">{activeApptForCall.appointmentType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Appointment Time:</span>
                          <span className="text-text font-medium">
                            {new Date(activeApptForCall.appointmentTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>

                      {activeApptForCall.notes && (
                        <div className="p-3 bg-primary/10 border border-accent/20 rounded-xl text-accent dark:text-accent">
                          <span className="font-bold block text-[11px] mb-0.5">Chief Complaint / Visit Reason:</span>
                          <p className="italic text-[11px] leading-relaxed">{activeApptForCall.notes}</p>
                        </div>
                      )}

                      <div className="p-3 bg-primary/10 border border-accent/20 rounded-xl text-accent dark:text-accent text-[11px]">
                        💡 Clinical Documentation recorded in this workspace will sync with the patient chart record upon completion.
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Live Notes & Vitals */}
                  {activeTab === "notes" && (
                    <div className="space-y-3 text-[11px]">
                      <div className="space-y-1">
                        <label className="font-bold text-text text-[11px]">In-Call Vitals Log</label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="BP (e.g. 120/80)"
                            value={vitalsInput.bp}
                            onChange={(e) => setVitalsInput({ ...vitalsInput, bp: e.target.value })}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Pulse (bpm)"
                            value={vitalsInput.pulse}
                            onChange={(e) => setVitalsInput({ ...vitalsInput, pulse: e.target.value })}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Temp (°F)"
                            value={vitalsInput.temp}
                            onChange={(e) => setVitalsInput({ ...vitalsInput, temp: e.target.value })}
                            className="text-xs"
                          />
                          <Input
                            placeholder="SpO2 (%)"
                            value={vitalsInput.spo2}
                            onChange={(e) => setVitalsInput({ ...vitalsInput, spo2: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text text-[11px]">Clinical Observations & Diagnosis Notes</label>
                        <textarea
                          rows={4}
                          placeholder="Type clinical consultation summary, symptoms, physical examination findings..."
                          value={clinicalNotesInput}
                          onChange={(e) => setClinicalNotesInput(e.target.value)}
                          className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs focus:ring-2 focus:ring-accent outline-none transition-all"
                        />
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveNotes}
                        loading={savingNotes}
                        className="w-full font-bold bg-primary hover:bg-primary text-brand-mist rounded-xl text-xs min-h-[44px] sm:min-h-[36px] cursor-pointer"
                      >
                        Save Notes & Vitals
                      </Button>
                    </div>
                  )}

                  {/* Tab 3: Quick Prescription */}
                  {activeTab === "rx" && (
                    <form onSubmit={handleSavePrescription} className="space-y-2.5 text-[11px]">
                      <Input
                        label="Medication / Drug Name *"
                        placeholder="e.g. Paracetamol 500mg, Amoxicillin 250mg"
                        value={rxForm.drugName}
                        onChange={(e) => setRxForm({ ...rxForm, drugName: e.target.value })}
                        required
                        className="text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Dosage"
                          placeholder="1 Tablet"
                          value={rxForm.dosage}
                          onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })}
                          className="text-xs"
                        />
                        <Select
                          label="Frequency"
                          value={rxForm.frequency}
                          onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                          options={[
                            { value: "1-0-1", label: "1-0-1 (Twice Daily)" },
                            { value: "1-1-1", label: "1-1-1 (Thrice Daily)" },
                            { value: "1-0-0", label: "1-0-0 (Morning)" },
                            { value: "0-0-1", label: "0-0-1 (Night)" },
                            { value: "SOS", label: "SOS (As needed)" },
                          ]}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Duration (Days)"
                          placeholder="5"
                          value={rxForm.durationDays}
                          onChange={(e) => setRxForm({ ...rxForm, durationDays: e.target.value })}
                          className="text-xs"
                        />
                        <Input
                          label="Instructions"
                          placeholder="After meals"
                          value={rxForm.instructions}
                          onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })}
                          className="text-xs"
                        />
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        loading={savingRx}
                        className="w-full font-bold bg-success hover:bg-success text-background rounded-xl text-xs mt-1 min-h-[44px] sm:min-h-[36px] cursor-pointer"
                      >
                        Add to consultation notes
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
        </Modal>
      )}

      {/* LAUNCH VIRTUAL SESSION MODAL */}
      <Modal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        title="Create consultation session"
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 w-full">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsLaunchModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button type="submit" form="launch-session-form" variant="primary" size="sm" loading={launchingSession} className="bg-primary hover:bg-primary text-brand-mist w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Create session
            </Button>
          </div>
        }
      >
        <form id="launch-session-form" onSubmit={handleLaunchSessionSubmit} className="space-y-4 text-xs">
          <Select
            label="Select Confirmed Appointment *"
            value={selectedApptId}
            onChange={(e) => setSelectedApptId(e.target.value)}
            options={[
              { value: "", label: "Select appointment..." },
              ...appointments.map((a) => ({
                value: a.id,
                label: `${a.patientId?.userId?.name || "Patient"} - ${a.doctorId?.name?.startsWith("Dr.") ? a.doctorId.name : `Dr. ${a.doctorId?.name}`} (${new Date(a.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
              })),
            ]}
            required
          />

          <div className="p-3 bg-primary/10 border border-accent/30 rounded-xl text-[11px] text-accent dark:text-accent">
            A consultation record is created for this appointment. The organization must connect its video service before a meeting can be opened.
          </div>
        </form>
      </Modal>
    </div>
  );
}
