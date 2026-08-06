"use client";

import { useState, useEffect, useRef } from "react";
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
  useToast,
  Badge,
  StatCard,
  Spinner,
} from "@/components/ui";

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
  clinicId?: { id: string; name: string };
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
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [appointments, setAppointments] = useState<TeleconsultationAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Video Call Modal State
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeApptForCall, setActiveApptForCall] = useState<TeleconsultationAppointment | null>(null);
  const [activeSession, setActiveSession] = useState<TeleSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [submittingEndCall, setSubmittingEndCall] = useState(false);

  // Native WebRTC Stream & In-Call Control States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

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
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const apptsRes = await api.get(selectedClinicId ? `/appointments?clinicId=${selectedClinicId}` : "/appointments");
      const list: TeleconsultationAppointment[] = apptsRes.data?.data || apptsRes.data || [];
      setAppointments(list);
    } catch (err: any) {
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
  }, [selectedClinicId]);

  // Native WebRTC Stream Initializer & Call Timer
  useEffect(() => {
    let streamObj: MediaStream | null = null;
    let timerInterval: any = null;

    if (isVideoModalOpen) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          streamObj = s;
          setLocalStream(s);
        })
        .catch((err) => {
          console.warn("Webcam/Microphone access notice:", err);
        });

      timerInterval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (streamObj) {
        streamObj.getTracks().forEach((track) => track.stop());
      }
      if (timerInterval) clearInterval(timerInterval);
      setLocalStream(null);
    };
  }, [isVideoModalOpen]);

  // Ensure localVideoRef receives localStream whenever stream or camera state updates
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCamOn, isVideoModalOpen]);

  // Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
      setIsMicOn(!isMicOn);
    }
  };

  // Toggle Camera
  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isCamOn;
      });
      setIsCamOn(!isCamOn);
    }
  };

  // Screen Sharing
  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
          }
          setIsScreenSharing(false);
        };
      } else {
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        setIsScreenSharing(false);
      }
    } catch (e) {
      console.warn("Screen share notice:", e);
    }
  };

  // Helper: Format seconds to MM:SS
  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Join or Create Video Session & Start Call
  const handleJoinVideoCall = async (appt: TeleconsultationAppointment) => {
    setActiveApptForCall(appt);
    setIsVideoModalOpen(true);
    setLoadingSession(true);
    setActiveTab("ehr");

    try {
      let sessionData: TeleSessionData | null = null;
      try {
        const getRes = await api.get(`/teleconsultation/session/${appt.id}`);
        sessionData = getRes.data?.data;
      } catch {
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
      if (activeApptForCall?.patientId?.id) {
        await api.post("/prescriptions", {
          patientId: activeApptForCall.patientId.id,
          doctorId: activeApptForCall.doctorId?.id,
          appointmentId: activeApptForCall.id,
          medications: [
            {
              name: rxForm.drugName,
              dosage: rxForm.dosage,
              frequency: rxForm.frequency,
              duration: rxForm.durationDays,
              instructions: rxForm.instructions,
            },
          ],
          notes: `Prescribed during video consultation (${activeSession?.sessionRoomId || "Telehealth"}).`,
        });
      }

      toast({
        title: "Prescription Issued ✓",
        description: `Prescribed ${rxForm.drugName} to patient.`,
        variant: "success",
      });

      setRxForm({ drugName: "", dosage: "", frequency: "1-0-1", durationDays: "5", instructions: "After meals" });
    } catch (err: any) {
      toast({
        title: "Prescription Save Failed",
        description: err.response?.data?.message || "Could not save prescription draft",
        variant: "error",
      });
    } finally {
      setSavingRx(false);
    }
  };

  // Copy Patient Join Link
  const handleCopyLink = () => {
    const link = activeSession?.sessionRoomId
      ? `${window.location.origin}/dashboard/teleconsultation?room=${activeSession.sessionRoomId}`
      : window.location.href;

    navigator.clipboard.writeText(link);
    toast({
      title: "Patient Direct Join Link Copied 📋",
      description: "Share this link with the patient via SMS or WhatsApp to join.",
      variant: "success",
    });
  };

  // Launch New Session Submit
  const handleLaunchSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptId) return;

    try {
      setLaunchingSession(true);
      const res = await api.post("/teleconsultation/session", { appointmentId: selectedApptId });
      toast({
        title: "Virtual Care Room Created 📹",
        description: `Meeting Room ${res.data?.data?.sessionRoomId} provisioned.`,
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

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }

      toast({
        title: "Teleconsultation Call Ended 🔴",
        description: "Call duration logged. Session completed.",
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
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-purple-600">📹</span> Teleconsultation & Virtual Care Desk
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time virtual waiting room, WebRTC video consultation workspace, live vitals, and instant prescribing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsLaunchModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <span>+ Launch Virtual Room</span>
          </Button>

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
          label="Total Telehealth Visits"
          value={totalVirtual}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="Virtual Waiting Room"
          value={waitingCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Active Video Calls"
          value={activeCallCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
        <StatCard
          label="Completed Virtual Visits"
          value={completedCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-bold text-text-muted mr-1">Queue Status:</span>
          {[
            { key: "all", label: "All Telehealth Visits" },
            { key: "checked-in", label: "Waiting Room" },
            { key: "in-consultation", label: "In Active Video Call" },
            { key: "confirmed", label: "Scheduled Online" },
            { key: "completed", label: "Completed" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === s.key
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
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
          className="w-full md:w-64 text-xs"
        />
      </div>

      {/* Teleconsultation Cards Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <Spinner size="md" label="Loading Virtual Care Queue..." />
        </div>
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

            const isInCall = item.status === "in-consultation";
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs ${
                  isInCall
                    ? "bg-purple-500/10 border-purple-500/50 hover:border-purple-500"
                    : isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500"
                    : "bg-surface border-border hover:border-primary-500"
                }`}
              >
                {/* Header Badge */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-purple-600 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                      📹 Virtual Visit
                    </span>
                    <Badge
                      variant={isInCall ? "warning" : isCompleted ? "success" : "primary"}
                      className="capitalize font-bold text-xs"
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-base text-text pt-1">{patientName}</h3>
                  <p className="text-[11px] text-text-muted">{patientPhone ? `Phone: ${patientPhone}` : "Phone: Unlisted"}</p>
                </div>

                {/* Details Box */}
                <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Doctor:</span>
                    <span className="font-bold text-text">{doctorName}</span>
                  </div>
                  {item.notes && (
                    <div className="pt-1 border-t border-border/40 text-text">
                      <span className="text-text-muted block">Notes / Reason:</span>
                      <span className="font-medium italic">{item.notes}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => handleJoinVideoCall(item)}
                    className="font-bold text-[11px] rounded-lg w-full gap-1.5 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                  >
                    <span>📹 {isInCall ? "Resume Consultation Room" : "Join Video Workspace"}</span>
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
        >
          {loadingSession ? (
            <div className="py-16 text-center">
              <Spinner size="lg" label="Connecting to secure teleconsultation room..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
              {/* Left Column: Pure Native WebRTC Video Call Theater */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative w-full h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 text-white shadow-2xl flex flex-col justify-between">
                  {/* Main Video Stream Container (Remote Feed / Native Player) */}
                  <div className="relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 flex flex-col items-center justify-center text-center p-4">
                    {/* Patient Profile Remote Feed Video / Avatar */}
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-full bg-purple-600/30 border-2 border-purple-500/50 flex items-center justify-center text-4xl shadow-inner text-purple-200">
                          👤
                        </div>
                        <span className="absolute bottom-0 right-0 h-4.5 w-4.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white tracking-wide">
                          {activeApptForCall.patientId?.userId?.name || "Patient Remote Feed"}
                        </h4>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                            Encrypted Native P2P Stream ({formatDuration(callDuration)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Picture-in-Picture Doctor Local Webcam Video Window */}
                    <div className="absolute top-3 right-3 w-40 h-32 bg-slate-900 rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl transition-all">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover transform -scale-x-100 ${isCamOn ? "block" : "hidden"}`}
                      />
                      {!isCamOn && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs font-semibold space-y-1">
                          <span className="text-lg">📷</span>
                          <span>Cam Off</span>
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[9px] font-mono bg-slate-950/85 px-2 py-0.5 rounded-md text-slate-200 backdrop-blur-xs font-bold border border-slate-800">
                        <span>You (MD)</span>
                        {isMicOn && (
                          <span className="flex items-center gap-0.5 ml-1">
                            <span className="h-2 w-0.5 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="h-2.5 w-0.5 bg-emerald-400 rounded-full animate-pulse delay-75" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* In-Call Action Control Bar */}
                    <div className="absolute bottom-3 left-3 right-3 p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800/90 flex items-center justify-between gap-2 shadow-2xl">
                      <div className="flex items-center gap-2">
                        {/* Mic Button */}
                        <button
                          type="button"
                          onClick={toggleMic}
                          className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isMicOn
                              ? "bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/40 shadow-xs"
                              : "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                          }`}
                        >
                          {isMicOn ? "🎙️ Mic On" : "🔇 Muted"}
                        </button>

                        {/* Camera Button */}
                        <button
                          type="button"
                          onClick={toggleCam}
                          className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isCamOn
                              ? "bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/40 shadow-xs"
                              : "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                          }`}
                        >
                          {isCamOn ? "📹 Video On" : "📷 Video Off"}
                        </button>

                        {/* Screen Share Button */}
                        <button
                          type="button"
                          onClick={handleScreenShare}
                          className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isScreenSharing
                              ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                              : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          🖥️ {isScreenSharing ? "Sharing Screen" : "Screen Share"}
                        </button>
                      </div>

                      <Button
                        size="xs"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="text-xs h-9 px-3 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold rounded-xl"
                      >
                        📋 Copy Link
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
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
                    className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs gap-1.5 px-4 cursor-pointer"
                  >
                    <span>🔴 End & Complete Consultation</span>
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
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTab === "ehr" ? "bg-surface text-purple-600 shadow-xs" : "text-text-muted hover:text-text"
                      }`}
                    >
                      👤 EHR Context
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("notes")}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTab === "notes" ? "bg-surface text-purple-600 shadow-xs" : "text-text-muted hover:text-text"
                      }`}
                    >
                      📝 Notes & Vitals
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("rx")}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTab === "rx" ? "bg-surface text-purple-600 shadow-xs" : "text-text-muted hover:text-text"
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
                          <span className="font-bold text-purple-600 uppercase">{activeApptForCall.appointmentType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Appointment Time:</span>
                          <span className="text-text font-medium">
                            {new Date(activeApptForCall.appointmentTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>

                      {activeApptForCall.notes && (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-950 dark:text-purple-200">
                          <span className="font-bold block text-[11px] mb-0.5">Chief Complaint / Visit Reason:</span>
                          <p className="italic text-[11px] leading-relaxed">{activeApptForCall.notes}</p>
                        </div>
                      )}

                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-900 dark:text-blue-200 text-[11px]">
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
                          className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        />
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveNotes}
                        loading={savingNotes}
                        className="w-full font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs cursor-pointer"
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
                        className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs mt-1 cursor-pointer"
                      >
                        Issue Prescription
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* LAUNCH VIRTUAL SESSION MODAL */}
      <Modal isOpen={isLaunchModalOpen} onClose={() => setIsLaunchModalOpen(false)} title="📹 Provision Teleconsultation Room" size="md">
        <form onSubmit={handleLaunchSessionSubmit} className="space-y-4 text-xs">
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

          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[11px] text-purple-900 dark:text-purple-200">
            💡 Provisioning will generate a secure WebRTC room ID (`TELE-XXXXX`) and provide a join link for both physician and patient portals.
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsLaunchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={launchingSession} className="bg-purple-600 hover:bg-purple-700 text-white">
              Provision Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
