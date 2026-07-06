"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Select, Input, useToast, Spinner, Badge, StatCard, Modal, Textarea, Checkbox
} from "@/components/ui";

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
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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
  const [selectedClinic, setSelectedClinic] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Queue State
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Load initial dropdown values based on user role
  useEffect(() => {
    const initFilters = async () => {
      try {
        setLoadingFilters(true);
        if (user?.role === "doctor") {
          // Doctors can see assignments to find which clinics they work at
          const res = await api.get(`/onboarding/doctors/assignments?doctorId=${user.id}`);
          const assignments = res.data.data || [];
          const uniqueClinics = Array.from(new Set(assignments.map((a: any) => JSON.stringify(a.clinicId))))
            .map((str: any) => JSON.parse(str));
          
          setClinics(uniqueClinics);
          setDoctors([{ id: user.id, name: user.name }]);
          setSelectedDoctor(user.id);
          if (uniqueClinics.length > 0) {
            setSelectedClinic(uniqueClinics[0].id);
          }
        } else {
          // Admins and receptionists fetch all clinics and doctors
          const [clinicsRes, staffRes] = await Promise.all([
            api.get("/onboarding/clinics"),
            api.get("/onboarding/staff")
          ]);
          const loadedClinics = clinicsRes.data.data || [];
          const loadedDoctors = staffRes.data.data.doctors || [];
          
          setClinics(loadedClinics);
          setDoctors(loadedDoctors);

          if (loadedClinics.length > 0) {
            setSelectedClinic(loadedClinics[0].id);
          }
          if (loadedDoctors.length > 0) {
            setSelectedDoctor(loadedDoctors[0].id);
          }
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to initialize filters", variant: "error" });
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
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load queue", variant: "error" });
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [selectedClinic, selectedDoctor, selectedDate]);

  // Split appointments into Active and Finished categories
  const activeStatuses = ["pending", "confirmed", "checked-in", "in-consultation"];
  const activeQueue = appointments.filter(a => activeStatuses.includes(a.status));
  const finishedQueue = appointments.filter(a => !activeStatuses.includes(a.status));

  // Compute live statistics
  const stats = {
    waiting: activeQueue.filter(a => ["pending", "confirmed", "checked-in"].includes(a.status)).length,
    checkedIn: activeQueue.filter(a => a.status === "checked-in").length,
    activeConsultation: activeQueue.filter(a => a.status === "in-consultation").length,
    nextInLine: activeQueue.find(a => ["checked-in", "confirmed", "pending"].includes(a.status))?.tokenNumber || null
  };

  // Status transitions
  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      setUpdatingStatus(appointmentId);
      await api.put(`/appointments/${appointmentId}/status`, { status: newStatus });
      toast({ title: "Success", description: `Status updated to ${newStatus}`, variant: "success" });
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update status", variant: "error" });
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

    // Validate that if any prescription field is entered, all fields in that row must be filled
    const hasInvalidPrescriptions = prescriptions.some(p => 
      (p.name || p.dosage || p.duration) && !(p.name && p.dosage && p.duration)
    );

    if (hasInvalidPrescriptions) {
      toast({ 
        title: "Prescription Incomplete", 
        description: "Please fill in Name, Dosage, and Duration for all prescribed medicine rows.", 
        variant: "error" 
      });
      return;
    }

    // Filter out any blank prescription lines
    const activePrescriptions = prescriptions.filter(p => p.name && p.dosage && p.duration);

    try {
      setCompletingSubmitting(true);
      await api.put(`/appointments/${apptToComplete.id}/status`, {
        status: "completed",
        followUpRecommended: recommendFollowUp,
        followUpTimeline: recommendFollowUp ? followUpTimeline : undefined,
        followUpNotes: recommendFollowUp ? followUpNotes : undefined,
        symptoms: symptoms || undefined,
        diagnosis: diagnosis || undefined,
        prescriptions: activePrescriptions
      });
      toast({ title: "Success", description: "Consultation marked as completed", variant: "success" });
      setCompleteModalOpen(false);
      setApptToComplete(null);
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to complete consultation", variant: "error" });
    } finally {
      setCompletingSubmitting(false);
    }
  };

  // Reorder queue locally and update in backend (VIP Override)
  const moveQueueItem = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= activeQueue.length) return;

    // Shift in local array
    const updatedActive = [...activeQueue];
    const temp = updatedActive[index];
    updatedActive[index] = updatedActive[newIndex];
    updatedActive[newIndex] = temp;

    // Instantly update local state to feel snappy
    const reorderedAppointments = [
      ...updatedActive,
      ...finishedQueue
    ];
    setAppointments(reorderedAppointments);

    try {
      // Trigger API to persist reordering
      const orderedAppointmentIds = updatedActive.map(a => a.id);
      await api.put("/queue/reorder", {
        clinicId: selectedClinic,
        doctorId: selectedDoctor,
        date: selectedDate,
        orderedAppointmentIds
      });
      toast({ title: "Queue Updated", description: "VIP Override order saved", variant: "success" });
      // Fetch queue again to get correct estimated wait times recalculated by backend
      await fetchQueue();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to reorder queue", variant: "error" });
      await fetchQueue(); // Revert back to server state on failure
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

  const getWaitTimeLabel = (minutes?: number) => {
    if (minutes === undefined || minutes === 0) return "Next in Line";
    return `Est. Wait: ${minutes} mins`;
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Queue Dashboard</h2>
          <p className="text-sm text-text-secondary">Track doctor patient flows, check-in, call next, and override order rules.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue} loading={loadingQueue}>
          Refresh Queue
        </Button>
      </div>

      {/* Selector Filters (Compact bar, no labels) */}
      <Card className="border-border bg-surface-alt/50 shadow-sm">
        <CardContent className="py-3 px-4">
          {loadingFilters ? (
            <div className="w-full flex justify-center py-2"><Spinner size="sm" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              <Select
                size="sm"
                placeholder="Select Clinic"
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
                options={clinics.map(c => ({ value: c.id, label: c.name }))}
                disabled={user.role === "doctor" && clinics.length <= 1}
              />
              <Select
                size="sm"
                placeholder="Select Doctor"
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                options={doctors.map(d => ({ value: d.id, label: `Dr. ${d.name}` }))}
                disabled={user.role === "doctor"}
              />
              <Input
                size="sm"
                type="date"
                placeholder="Select Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* STATS OVERVIEW */}
      {selectedClinic && selectedDoctor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Waiting"
            value={stats.waiting.toString()}
            icon={
              <svg className="h-5 w-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            label="Checked-In"
            value={stats.checkedIn.toString()}
            icon={
              <svg className="h-5 w-5 text-info-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="In Consultation"
            value={stats.activeConsultation.toString()}
            icon={
              <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <StatCard
            label="Next Token"
            value={stats.nextInLine ? `#${stats.nextInLine}` : "-"}
            icon={
              <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            }
          />
        </div>
      )}

      {/* MAIN LAYOUT */}
      {!selectedClinic || !selectedDoctor ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-text">Select a Clinic and Doctor</h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">Please choose a clinic location and doctor practitioner from filters above to view and manage live queues.</p>
          </CardContent>
        </Card>
      ) : loadingQueue ? (
        <div className="flex justify-center p-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Queue Control Column */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-text flex items-center gap-2">
              Active Queue Waitlist
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                {activeQueue.length} Patients
              </span>
            </h3>

            {activeQueue.length === 0 ? (
              <Card className="py-12 text-center text-text-muted">
                <CardContent>No active patients waiting for today.</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeQueue.map((appt, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === activeQueue.length - 1;

                  return (
                    <Card key={appt.id} className={`border-l-4 overflow-hidden shadow-sm hover:shadow transition-shadow ${appt.status === "in-consultation" ? "border-l-success-500 bg-success-50/20" : appt.status === "checked-in" ? "border-l-info-500 bg-info-50/10" : "border-l-primary-500"}`}>
                      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        {/* Token & Patient details */}
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold shadow-sm shrink-0 ${appt.status === "in-consultation" ? "bg-success-600 text-white" : appt.status === "checked-in" ? "bg-info-600 text-white" : "bg-surface-alt border border-border text-text"}`}>
                            <span className="text-xs font-normal">Token</span>
                            <span className="text-lg leading-4">#{appt.tokenNumber}</span>
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text">{appt.patientId?.userId?.name || "Patient Profile"}</span>
                              <Badge variant={getStatusBadgeVariant(appt.status)} className="capitalize py-0.5">
                                {appt.status.replace("-", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-secondary">
                              {appt.patientId?.userId?.phone || "No phone"} • {appt.appointmentType.toUpperCase()}
                            </p>
                            {appt.notes && (
                              <p className="text-xs text-text-muted mt-1 italic">
                                Note: &ldquo;{appt.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Wait time & override controls */}
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          {/* Wait Time Indicator */}
                          {appt.status !== "in-consultation" && (
                            <span className="text-xs bg-surface-alt border border-border text-text-secondary px-2.5 py-1 rounded-md font-medium">
                              {getWaitTimeLabel(appt.estimatedWaitTime)}
                            </span>
                          )}

                          {/* VIP Queue Reorder Up/Down arrows */}
                          {(user.role === "admin" || user.role === "receptionist") && (
                            <div className="flex items-center bg-surface-alt border border-border rounded-lg p-0.5">
                              <button
                                onClick={() => moveQueueItem(idx, "up")}
                                disabled={isFirst}
                                className={`p-1.5 hover:bg-surface rounded transition-colors ${isFirst ? "text-text-muted cursor-not-allowed" : "text-text hover:text-primary-600"}`}
                                title="Move Up (VIP Shift)"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveQueueItem(idx, "down")}
                                disabled={isLast}
                                className={`p-1.5 hover:bg-surface rounded transition-colors ${isLast ? "text-text-muted cursor-not-allowed" : "text-text hover:text-primary-600"}`}
                                title="Move Down (VIP Shift)"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-1.5">
                            {appt.status === "pending" || appt.status === "confirmed" ? (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => updateStatus(appt.id, "checked-in")}
                                loading={updatingStatus === appt.id}
                              >
                                Check-In
                              </Button>
                            ) : null}

                            {appt.status === "checked-in" ? (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => updateStatus(appt.id, "in-consultation")}
                                loading={updatingStatus === appt.id}
                              >
                                Call Next
                              </Button>
                            ) : null}

                            {appt.status === "in-consultation" ? (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => openCompleteModal(appt)}
                                loading={updatingStatus === appt.id}
                              >
                                Complete
                              </Button>
                            ) : null}

                            {/* Options Dropdown or extra actions */}
                            {appt.status !== "in-consultation" && (
                              <>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="text-warning-600 border-warning-200 hover:bg-warning-50"
                                  onClick={() => updateStatus(appt.id, "no-show")}
                                  loading={updatingStatus === appt.id}
                                >
                                  No-Show
                                </Button>
                                <Button
                                  size="xs"
                                  variant="danger"
                                  onClick={() => updateStatus(appt.id, "cancelled")}
                                  loading={updatingStatus === appt.id}
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

          {/* Finished Queue Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-text flex items-center gap-2">
              Served & Inactive
              <span className="text-xs bg-surface-alt text-text-secondary px-2 py-0.5 rounded-full border border-border">
                {finishedQueue.length}
              </span>
            </h3>

            <Card>
              <CardContent className="p-0">
                {finishedQueue.length === 0 ? (
                  <div className="text-center py-12 text-text-muted text-sm">No recently processed patients.</div>
                ) : (
                  <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {finishedQueue.map((appt) => (
                      <div key={appt.id} className="p-4 flex justify-between items-center hover:bg-surface-hover transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-secondary">Token #{appt.tokenNumber}</span>
                            <Badge variant={getStatusBadgeVariant(appt.status)} className="capitalize py-0 text-[10px]">
                              {appt.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-text mt-0.5">
                            {appt.patientId?.userId?.name || "Patient Profile"}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            Time: {new Date(appt.appointmentTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        {appt.status === "completed" && (
                          <div className="w-6 h-6 rounded-full bg-success-100 text-success-700 flex items-center justify-center">
                            ✓
                          </div>
                        )}
                        {appt.status === "cancelled" && (
                          <div className="w-6 h-6 rounded-full bg-danger-100 text-danger-700 flex items-center justify-center text-xs font-bold">
                            ✕
                          </div>
                        )}
                        {appt.status === "no-show" && (
                          <div className="w-6 h-6 rounded-full bg-warning-100 text-warning-700 flex items-center justify-center text-xs font-bold">
                            !
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

      {/* Complete Consultation Modal */}
      <Modal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Consultation"
        size="lg"
      >
        <form onSubmit={handleCompleteConsultation} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              Mark consultation as completed for patient <strong className="text-text">{apptToComplete?.patientId?.userId?.name}</strong> (Token #{apptToComplete?.tokenNumber}).
            </p>
          </div>

          {/* Clinical Record Documentation */}
          <div className="space-y-4 border-t border-border pt-4 mt-2">
            <h3 className="text-sm font-bold text-text">Clinical EHR Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Chief Complaints / Symptoms"
                placeholder="e.g. Fever, dry cough, body ache for 3 days"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
              <Input
                label="Diagnosis"
                placeholder="e.g. Upper respiratory tract infection"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Prescriptions Dynamic Builder */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text">Rx - Prescribed Medications</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPrescriptions([...prescriptions, { name: "", dosage: "", duration: "" }])}
                >
                  + Add Medication
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
                    <div className="w-44">
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
                        className="mb-0.5"
                        onClick={() => {
                          setPrescriptions(prescriptions.filter((_, i) => i !== idx));
                        }}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="py-2.5 border-t border-b border-border my-2">
            <Checkbox
              id="recommendFollowUp"
              label="Recommend a follow-up appointment?"
              checked={recommendFollowUp}
              onChange={(e) => setRecommendFollowUp(e.target.checked)}
            />
          </div>

          {recommendFollowUp && (
            <div className="space-y-4 animate-fade-in">
              <Select
                label="Recommended Timeframe *"
                value={followUpTimeline}
                onChange={(e) => setFollowUpTimeline(e.target.value)}
                options={[
                  { value: "1 week", label: "1 Week" },
                  { value: "2 weeks", label: "2 Weeks" },
                  { value: "3 weeks", label: "3 Weeks" },
                  { value: "1 month", label: "1 Month" },
                  { value: "2 months", label: "2 Months" },
                  { value: "3 months", label: "3 Months" },
                ]}
                required
              />
              <Textarea
                label="Follow-Up Notes / Instructions"
                placeholder="e.g. Suture removal, check recovery progress, review blood reports..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCompleteModalOpen(false)}
              disabled={completingSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={completingSubmitting}>
              Complete Consultation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
