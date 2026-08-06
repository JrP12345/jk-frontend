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

interface DoctorUser {
  id: string;
  name: string;
  specialization?: string;
}

export interface SurgicalBookingItem {
  id: string;
  clinicId?: { id: string; name: string };
  patientId: {
    id: string;
    userId?: { name: string; phone?: string };
  };
  theatreName: string;
  procedureName: string;
  leadSurgeonId: { id: string; name: string; specialization?: string };
  anesthesiologistId?: { id: string; name: string; specialization?: string };
  scrubNurseName?: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  safetyChecklistComplete?: boolean;
  notes?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt?: string;
}

export default function OTPage() {
  const { activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [bookings, setBookings] = useState<SurgicalBookingItem[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"schedule" | "who" | "registry">("schedule");

  // Filters
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Book Case Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [theatreName, setTheatreName] = useState("OT Room 1 — General Surgery");
  const [procedureName, setProcedureName] = useState("");
  const [leadSurgeonId, setLeadSurgeonId] = useState("");
  const [anesthesiologistId, setAnesthesiologistId] = useState("");
  const [scrubNurseName, setScrubNurseName] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingBook, setSubmittingBook] = useState(false);

  // WHO Safety Checklist Modal State
  const [isWhoModalOpen, setIsWhoModalOpen] = useState(false);
  const [activeBookingForWho, setActiveBookingForWho] = useState<SurgicalBookingItem | null>(null);

  // WHO Checklist Step Toggles
  const [whoStep1Consent, setWhoStep1Consent] = useState(true);
  const [whoStep1SiteMarked, setWhoStep1SiteMarked] = useState(true);
  const [whoStep1PulseOximeter, setWhoStep1PulseOximeter] = useState(true);
  const [whoStep2TeamIntro, setWhoStep2TeamIntro] = useState(true);
  const [whoStep2AntibioticProphylaxis, setWhoStep2AntibioticProphylaxis] = useState(true);
  const [whoStep3SpongeCount, setWhoStep3SpongeCount] = useState(true);
  const [whoStep3SpecimenLabel, setWhoStep3SpecimenLabel] = useState(true);
  const [submittingWho, setSubmittingWho] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, patientsRes, staffRes] = await Promise.all([
        api.get(selectedClinicId ? `/ot/bookings?clinicId=${selectedClinicId}` : "/ot/bookings"),
        api.get("/patients"),
        api.get(selectedClinicId ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
      ]);

      setBookings(bookingsRes.data?.data || []);
      setPatients(patientsRes.data?.data || []);
      setDoctors(staffRes.data?.data?.doctors || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch OT Data",
        description: err.response?.data?.message || "Could not retrieve OT surgical bookings",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Book Case Submit
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !procedureName.trim() || !leadSurgeonId || !scheduledStartTime || !scheduledEndTime) {
      toast({ title: "Validation Error", description: "Patient, procedure, surgeon, and schedule times are required", variant: "error" });
      return;
    }

    try {
      setSubmittingBook(true);
      await api.post("/ot/bookings", {
        clinicId: selectedClinicId,
        patientId,
        theatreName: theatreName.trim(),
        procedureName: procedureName.trim(),
        leadSurgeonId,
        anesthesiologistId: anesthesiologistId || undefined,
        scrubNurseName: scrubNurseName.trim() || undefined,
        scheduledStartTime: new Date(scheduledStartTime).toISOString(),
        scheduledEndTime: new Date(scheduledEndTime).toISOString(),
        notes: notes.trim(),
      });

      toast({
        title: "Surgical Case Scheduled 🔪",
        description: `Booked ${procedureName} in ${theatreName}.`,
        variant: "success",
      });

      setIsBookModalOpen(false);
      setPatientId("");
      setProcedureName("");
      setNotes("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Booking Failed",
        description: err.response?.data?.message || "Could not schedule surgical case",
        variant: "error",
      });
    } finally {
      setSubmittingBook(false);
    }
  };

  // Handle WHO Checklist Complete Submit
  const handleWhoChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBookingForWho) return;

    try {
      setSubmittingWho(true);
      await api.put(`/ot/bookings/${activeBookingForWho.id}/status`, {
        safetyChecklistComplete: true,
      });

      toast({
        title: "WHO Surgical Safety Checklist Verified ✅",
        description: "Perioperative safety checks recorded and attached to surgical case.",
        variant: "success",
      });

      setIsWhoModalOpen(false);
      setActiveBookingForWho(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Checklist Verification Failed",
        description: err.response?.data?.message || "Could not verify WHO safety checklist",
        variant: "error",
      });
    } finally {
      setSubmittingWho(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async (bookingId: string, nextStatus: string) => {
    try {
      await api.put(`/ot/bookings/${bookingId}/status`, { status: nextStatus });
      toast({
        title: "Surgical Case Status Updated",
        description: `Status changed to ${nextStatus.toUpperCase()}`,
        variant: "success",
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update booking status",
        variant: "error",
      });
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesRoom = selectedRoomFilter === "all" || b.theatreName.includes(selectedRoomFilter);
    const matchesStatus = selectedStatusFilter === "all" || b.status === selectedStatusFilter;
    const pName = b.patientId?.userId?.name || "";
    const sName = b.leadSurgeonId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.procedureName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.theatreName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesRoom && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalBookings = bookings.length;
  const inProgressCount = bookings.filter((b) => b.status === "in_progress").length;
  const scheduledCount = bookings.filter((b) => b.status === "scheduled").length;
  const checklistVerifiedCount = bookings.filter((b) => b.safetyChecklistComplete).length;

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-blue-500">🔪</span> Operation Theatre (OT) & Surgical Operations Desk
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Perioperative surgical case scheduling, theatre room allocation, and WHO Surgical Safety Checklist compliance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsBookModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <span>+ Book Surgical Case</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh Schedule</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Surgeries Today"
          value={totalBookings}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>}
        />
        <StatCard
          label="In Surgery (Active OT)"
          value={inProgressCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Scheduled Upcoming"
          value={scheduledCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="WHO Safety Verified"
          value={`${checklistVerifiedCount}/${totalBookings}`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Main Workspace Navigation Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "schedule" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🔪 Live Surgical Cases & OT Schedule ({filteredBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("who")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "who" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📋 WHO Surgical Safety Checklist Center
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("registry")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "registry" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🏛️ Operation Theatre Rooms Registry
        </button>
      </div>

      {/* TAB 1: LIVE SURGICAL CASES & OT SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* OT Room & Status Filter Toolbar */}
          <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Room Selector Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-text-muted mr-1">Theatre:</span>
                {[
                  { key: "all", label: "All OT Rooms" },
                  { key: "OT Room 1", label: "OT 1 (General/Lap)" },
                  { key: "OT Room 2", label: "OT 2 (Cardiac)" },
                  { key: "OT Room 3", label: "OT 3 (Ortho/Trauma)" },
                  { key: "OT Room 4", label: "OT 4 (Neuro)" },
                ].map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRoomFilter(r.key)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedRoomFilter === r.key
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <Input
                placeholder="Search patient, procedure, surgeon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-60 text-xs"
              />
            </div>

            {/* Status Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
              <span className="font-bold text-text-muted">Status Filter:</span>
              {[
                { key: "all", label: "All Cases" },
                { key: "scheduled", label: "Scheduled" },
                { key: "in_progress", label: "In Surgery (Active)" },
                { key: "completed", label: "Completed" },
                { key: "cancelled", label: "Cancelled" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(s.key)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    selectedStatusFilter === s.key
                      ? "bg-blue-500/10 text-blue-600 border-blue-500 font-bold"
                      : "bg-surface-alt/60 text-text-muted border-border/60 hover:text-text"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Surgical Case Cards Grid */}
          {loading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading Operation Theatre Surgical Schedule..." />
            </div>
          ) : filteredBookings.length === 0 ? (
            <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
              <CardContent>No surgical cases found matching current filters.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookings.map((booking) => {
                const patientName = booking.patientId?.userId?.name || "Patient";
                const patientPhone = booking.patientId?.userId?.phone || "";
                const surgeonName = booking.leadSurgeonId?.name || "Lead Surgeon";
                const anesthesiologistName = booking.anesthesiologistId?.name || "Unassigned";

                const isInProgress = booking.status === "in_progress";
                const isCompleted = booking.status === "completed";
                const isChecklistDone = booking.safetyChecklistComplete;

                const startTime = new Date(booking.scheduledStartTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                const endTime = new Date(booking.scheduledEndTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs ${
                      isInProgress
                        ? "bg-amber-500/10 border-amber-500/50 hover:border-amber-500"
                        : isCompleted
                        ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500"
                        : "bg-surface border-border hover:border-blue-500"
                    }`}
                  >
                    {/* Header Badge */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs font-mono text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                          🏛️ {booking.theatreName}
                        </span>
                        <Badge
                          variant={isInProgress ? "warning" : isCompleted ? "success" : "neutral"}
                          className="capitalize font-bold text-xs"
                        >
                          {booking.status.replace("_", " ")}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-base text-text pt-1">{booking.procedureName}</h3>
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>Patient: <b className="text-text">{patientName}</b> {patientPhone && `(${patientPhone})`}</span>
                        <span>Time: <b className="text-text font-mono">{startTime} - {endTime}</b></span>
                      </div>
                    </div>

                    {/* Surgical Team Badge Box */}
                    <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Lead Surgeon:</span>
                        <span className="font-bold text-text">Dr. {surgeonName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Anesthesiologist:</span>
                        <span className="font-semibold text-text">{anesthesiologistName}</span>
                      </div>
                      {booking.scrubNurseName && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Scrub Nurse:</span>
                          <span className="text-text">{booking.scrubNurseName}</span>
                        </div>
                      )}
                    </div>

                    {/* WHO Checklist Verification Indicator */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-text-muted">WHO Safety Checklist:</span>
                      <Badge variant={isChecklistDone ? "success" : "warning"} size="sm" className="font-bold">
                        {isChecklistDone ? "✅ Verified" : "⚠️ Pending"}
                      </Badge>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setActiveBookingForWho(booking);
                          setIsWhoModalOpen(true);
                        }}
                        className="font-bold text-[11px] rounded-lg"
                      >
                        📋 WHO Checklist
                      </Button>

                      {booking.status === "scheduled" && (
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() => handleUpdateStatus(booking.id, "in_progress")}
                          className="font-bold text-[11px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          ▶ Start Surgery
                        </Button>
                      )}

                      {isInProgress && (
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() => handleUpdateStatus(booking.id, "completed")}
                          className="font-bold text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          ✓ Complete Case
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHO SURGICAL SAFETY CHECKLIST CENTER */}
      {activeTab === "who" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface p-5 space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border/60">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>📋</span> WHO Surgical Safety Checklist Compliance Center
            </CardTitle>
            <p className="text-xs text-text-muted">
              World Health Organization (WHO) 3-phase perioperative safety checklist compliance tracking.
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">📋</div>
                <p className="text-xs font-semibold">No surgical cases registered for WHO safety checklist verification.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {bookings.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-text text-sm flex items-center gap-2">
                          {item.procedureName}
                          <Badge variant={item.safetyChecklistComplete ? "success" : "warning"} className="text-[10px]">
                            {item.safetyChecklistComplete ? "✅ VERIFIED" : "⚠️ CHECKLIST PENDING"}
                          </Badge>
                        </div>
                        <p className="text-text-muted text-[11px] mt-0.5">
                          Theatre: {item.theatreName} · Patient: <strong className="text-text font-semibold">{item.patientId?.userId?.name}</strong> · Surgeon: Dr. {item.leadSurgeonId?.name}
                        </p>
                      </div>

                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setActiveBookingForWho(item);
                          setIsWhoModalOpen(true);
                        }}
                        className="font-bold text-[11px] rounded-lg"
                      >
                        📋 Open WHO Safety Checklist
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: OPERATION THEATRE ROOMS REGISTRY */}
      {activeTab === "registry" && (
        <Card className="p-5 bg-surface border border-border rounded-2xl shadow-xs space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border/60">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>🏛️</span> Operation Theatre Suite Registry
            </CardTitle>
            <p className="text-xs text-text-muted">
              Specialized operating room suite allocations and active surgical case occupancy.
            </p>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: "OT Room 1 — General Surgery", type: "General & Laparoscopy" },
                { name: "OT Room 2 — Cardiac Suite", type: "Cardiac & Vascular" },
                { name: "OT Room 3 — Orthopedics", type: "Orthopedics & Joint Replacement" },
                { name: "OT Room 4 — Neurosurgery", type: "Neurosurgery & Spine" },
              ].map((room) => {
                const activeCase = bookings.find(
                  (b) => b.theatreName.includes(room.name.split(" — ")[0]) && b.status === "in_progress"
                );

                return (
                  <div
                    key={room.name}
                    className={`p-4 rounded-2xl border transition-all space-y-3 text-xs shadow-xs ${
                      activeCase
                        ? "bg-amber-500/10 border-amber-500/60"
                        : "bg-surface-alt/60 border-border/70"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="font-extrabold text-sm text-text">{room.name.split(" — ")[0]}</span>
                      {activeCase ? (
                        <Badge variant="warning" className="text-[10px] font-mono font-bold animate-pulse">
                          IN SURGERY
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] font-mono font-bold">
                          AVAILABLE
                        </Badge>
                      )}
                    </div>

                    <div className="text-[11px] text-text-muted">{room.type}</div>

                    {activeCase ? (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <div className="font-bold text-text text-xs">{activeCase.procedureName}</div>
                        <div className="text-text-muted text-[10px]">Patient: {activeCase.patientId?.userId?.name}</div>
                        <div className="text-text-muted text-[10px]">Surgeon: Dr. {activeCase.leadSurgeonId?.name}</div>
                      </div>
                    ) : (
                      <div className="py-3 text-center text-text-muted italic text-[11px]">
                        Ready for surgical case scheduling.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BOOK SURGICAL CASE MODAL */}
      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="🔪 Book Surgical Case in OT" size="lg">
        <form onSubmit={handleBookSubmit} className="space-y-4 text-xs">
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
            <Select
              label="Operation Theatre Room *"
              value={theatreName}
              onChange={(e) => setTheatreName(e.target.value)}
              options={[
                { value: "OT Room 1 — General Surgery", label: "OT Room 1 — General Surgery & Laparoscopy" },
                { value: "OT Room 2 — Cardiac Suite", label: "OT Room 2 — Cardiac & Vascular Surgery" },
                { value: "OT Room 3 — Orthopedics", label: "OT Room 3 — Orthopedics & Joint Replacement" },
                { value: "OT Room 4 — Neurosurgery", label: "OT Room 4 — Neurosurgery & Spine" },
              ]}
              required
            />

            <Input
              label="Surgical Procedure Name *"
              placeholder="e.g. Total Knee Arthroplasty Right Side..."
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="Lead Surgeon *"
              value={leadSurgeonId}
              onChange={(e) => setLeadSurgeonId(e.target.value)}
              options={[
                { value: "", label: "Select surgeon..." },
                ...doctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.name} (${d.specialization || "Surgery"})`,
                })),
              ]}
              required
            />

            <Select
              label="Anesthesiologist"
              value={anesthesiologistId}
              onChange={(e) => setAnesthesiologistId(e.target.value)}
              options={[
                { value: "", label: "Select anesthesiologist..." },
                ...doctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.name} (${d.specialization || "Anesthesia"})`,
                })),
              ]}
            />

            <Input
              label="Scrub Nurse Name"
              placeholder="e.g. Sister Mary"
              value={scrubNurseName}
              onChange={(e) => setScrubNurseName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Scheduled Start Time *"
              type="datetime-local"
              value={scheduledStartTime}
              onChange={(e) => setScheduledStartTime(e.target.value)}
              required
            />

            <Input
              label="Scheduled End Time *"
              type="datetime-local"
              value={scheduledEndTime}
              onChange={(e) => setScheduledEndTime(e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Pre-op Instructions & Notes"
            placeholder="e.g. Pre-op IV Antibiotic prophylaxis, blood cross-match 2 units standby..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingBook} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Schedule Surgical Case
            </Button>
          </div>
        </form>
      </Modal>

      {/* WHO SURGICAL SAFETY CHECKLIST MODAL */}
      {activeBookingForWho && (
        <Modal
          isOpen={isWhoModalOpen}
          onClose={() => setIsWhoModalOpen(false)}
          title={`📋 WHO Surgical Safety Checklist — ${activeBookingForWho.procedureName}`}
          size="lg"
        >
          <form onSubmit={handleWhoChecklistSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
              <span className="font-bold text-text block">
                {activeBookingForWho.theatreName} · Patient: {activeBookingForWho.patientId?.userId?.name}
              </span>
              <p className="text-text-muted">
                Lead Surgeon: <b>Dr. {activeBookingForWho.leadSurgeonId?.name}</b>
              </p>
            </div>

            {/* STAGE 1: SIGN IN */}
            <div className="p-3.5 bg-blue-500/5 rounded-2xl border border-blue-500/30 space-y-2">
              <span className="font-bold text-blue-600 text-xs block uppercase tracking-wider">
                Stage 1: SIGN IN (Before Induction of Anesthesia)
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep1Consent}
                    onChange={(e) => setWhoStep1Consent(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Patient confirmed identity, surgical site, procedure, and informed consent</span>
                </label>
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep1SiteMarked}
                    onChange={(e) => setWhoStep1SiteMarked(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Surgical site marked and verified</span>
                </label>
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep1PulseOximeter}
                    onChange={(e) => setWhoStep1PulseOximeter(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Pulse oximeter placed and functioning on patient</span>
                </label>
              </div>
            </div>

            {/* STAGE 2: TIME OUT */}
            <div className="p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/30 space-y-2">
              <span className="font-bold text-amber-600 text-xs block uppercase tracking-wider">
                Stage 2: TIME OUT (Before Skin Incision)
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep2TeamIntro}
                    onChange={(e) => setWhoStep2TeamIntro(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ All team members verbally introduced themselves by name and role</span>
                </label>
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep2AntibioticProphylaxis}
                    onChange={(e) => setWhoStep2AntibioticProphylaxis(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Antibiotic prophylaxis administered within past 60 minutes</span>
                </label>
              </div>
            </div>

            {/* STAGE 3: SIGN OUT */}
            <div className="p-3.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/30 space-y-2">
              <span className="font-bold text-emerald-600 text-xs block uppercase tracking-wider">
                Stage 3: SIGN OUT (Before Patient Leaves Operating Room)
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep3SpongeCount}
                    onChange={(e) => setWhoStep3SpongeCount(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Nurse verbally confirms instrument, sponge, and needle counts are correct</span>
                </label>
                <label className="flex items-center gap-2 text-text font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whoStep3SpecimenLabel}
                    onChange={(e) => setWhoStep3SpecimenLabel(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>✓ Surgical specimen labeled with patient name and study UID</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsWhoModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingWho} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Verify WHO Safety Checklist
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
