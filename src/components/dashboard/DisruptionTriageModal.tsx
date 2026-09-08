"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Modal,
  Button,
  Select,
  Input,
  Badge,
  Checkbox,
  Spinner,
  useToast,
  cn,
} from "@/components/ui";
import {
  AlertTriangle,
  UserCheck,
  Clock,
  ArrowRight,
  RotateCw,
  Calendar,
  XCircle,
  CheckCircle2,
  Users,
  Phone,
  Stethoscope,
  Zap,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

export interface TriageAppointment {
  id: string;
  clinicId: string;
  doctorId: {
    _id?: string;
    id?: string;
    name: string;
    email?: string;
    specialization?: string;
  } | string;
  patientId: {
    id: string;
    dob?: string;
    gender?: string;
    userId: { name: string; email?: string; phone?: string };
  };
  appointmentTime: string;
  appointmentType: string;
  status: string;
  tokenNumber: number;
  queuePosition: number;
  notes?: string;
  disruptionResponseDeadline?: string;
  triageAction?: string;
}

export interface EligibleDoctor {
  doctorId: string;
  name: string;
  email?: string;
  specialization?: string;
  fees: number;
  appointmentDuration: number;
  currentBookingsCount: number;
  overrideStatus: string;
}

interface DisruptionTriageModalProps {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  date: string;
  triageAppointments: TriageAppointment[];
  onActionComplete: () => Promise<void>;
}

export default function DisruptionTriageModal({
  open,
  onClose,
  clinicId,
  date,
  triageAppointments,
  onActionComplete,
}: DisruptionTriageModalProps) {
  const { toast } = useToast();

  const [selectedTab, setSelectedTab] = useState<"all" | "waiting" | "remote">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [eligibleReplacements, setEligibleReplacements] = useState<EligibleDoctor[]>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);

  // Batch action state
  const [batchActionType, setBatchActionType] = useState<"transfer" | "reschedule" | "cancel">("transfer");
  const [batchDoctorId, setBatchDoctorId] = useState("");
  const [batchRescheduleDate, setBatchRescheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [batchReason, setBatchReason] = useState("");
  const [processingBatch, setProcessingBatch] = useState(false);

  // Single action inline states: appointmentId -> target state
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [activeTransferDocId, setActiveTransferDocId] = useState<string>("");
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [activeRescheduleDate, setActiveRescheduleDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [activeRescheduleDocId, setActiveRescheduleDocId] = useState<string>("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fetch eligible replacement doctors whenever modal opens or clinic/date changes
  useEffect(() => {
    if (!open || !clinicId) return;

    const fetchReplacements = async () => {
      try {
        setLoadingReplacements(true);
        // Gather unique doctorIds from stranded appointments
        const affectedDoctorIds = Array.from(
          new Set(
            triageAppointments
              .map((a) => {
                if (typeof a.doctorId === "object" && a.doctorId !== null) {
                  return a.doctorId.id || a.doctorId._id;
                }
                return a.doctorId;
              })
              .filter(Boolean)
          )
        );

        const primaryDoctorId = affectedDoctorIds[0] || "none";
        const res = await api.get(
          `/doctor-overrides/eligible-replacements?clinicId=${clinicId}&doctorId=${primaryDoctorId}&date=${date}`
        );
        const docs: EligibleDoctor[] = res.data?.data || [];
        setEligibleReplacements(docs);
        if (docs.length > 0) {
          setBatchDoctorId(docs[0].doctorId);
        }
      } catch (err) {
        console.error("fetchReplacements error:", err);
      } finally {
        setLoadingReplacements(false);
      }
    };

    fetchReplacements();
  }, [open, clinicId, date, triageAppointments]);

  // Derived filtered lists
  const waitingPatients = triageAppointments.filter((a) => a.status === "checked-in" || a.notes?.includes("checked-in"));
  const remotePatients = triageAppointments.filter((a) => a.status !== "checked-in" && !a.notes?.includes("checked-in"));

  const displayedAppointments =
    selectedTab === "waiting"
      ? waitingPatients
      : selectedTab === "remote"
      ? remotePatients
      : triageAppointments;

  const toggleSelectAll = () => {
    if (selectedIds.length === displayedAppointments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedAppointments.map((a) => a.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Helper to get doctor name from appointment
  const getDoctorName = (doc: any) => {
    if (typeof doc === "object" && doc?.name) return doc.name;
    return "Unavailable Doctor";
  };

  // Helper to format remaining time
  const formatTimeRemaining = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    const diff = new Date(deadlineStr).getTime() - Date.now();
    if (diff <= 0) return "Expired (Auto-refund pending)";
    const mins = Math.ceil(diff / (60 * 1000));
    return `${mins} min${mins === 1 ? "" : "s"} remaining`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Single Actions
  // ──────────────────────────────────────────────────────────────────────────
  const handleSingleTransfer = async (apptId: string) => {
    const targetDocId = activeTransferDocId || eligibleReplacements[0]?.doctorId;
    if (!targetDocId) {
      toast({
        title: "No Replacement Doctor Selected",
        description: "Please select an available doctor to transfer this patient to.",
        variant: "warning",
      });
      return;
    }

    try {
      setSubmittingAction(true);
      await api.post("/doctor-overrides/triage/transfer", {
        appointmentId: apptId,
        replacementDoctorId: targetDocId,
        reason: "OPD Disruption Reassignment",
      });

      toast({
        title: "Patient Transferred Successfully",
        description: "Patient assigned next-up priority with the replacement doctor.",
        variant: "success",
      });

      setTransferringId(null);
      await onActionComplete();
    } catch (err: any) {
      toast({
        title: "Transfer Failed",
        description: err.response?.data?.message || "Could not transfer patient.",
        variant: "error",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSingleReschedule = async (apptId: string) => {
    if (!activeRescheduleDate) {
      toast({ title: "Select Date", description: "Target reschedule date is required.", variant: "warning" });
      return;
    }

    try {
      setSubmittingAction(true);
      await api.post("/doctor-overrides/triage/reschedule", {
        appointmentId: apptId,
        targetDate: activeRescheduleDate,
        targetDoctorId: activeRescheduleDocId || undefined,
        reason: "OPD Schedule Disruption",
      });

      toast({
        title: "Patient Rescheduled",
        description: `Appointment moved to ${activeRescheduleDate} with priority status.`,
        variant: "success",
      });

      setReschedulingId(null);
      await onActionComplete();
    } catch (err: any) {
      toast({
        title: "Reschedule Failed",
        description: err.response?.data?.message || "Could not reschedule appointment.",
        variant: "error",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSingleCancel = async (apptId: string) => {
    try {
      setSubmittingAction(true);
      await api.post("/doctor-overrides/triage/cancel", {
        appointmentId: apptId,
        reason: "Disruption cancellation requested by reception",
      });

      toast({
        title: "Appointment Cancelled & Refunded",
        description: "Full refund processed and patient notified.",
        variant: "success",
      });

      setCancellingId(null);
      await onActionComplete();
    } catch (err: any) {
      toast({
        title: "Cancellation Failed",
        description: err.response?.data?.message || "Could not cancel appointment.",
        variant: "error",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Batch Actions
  // ──────────────────────────────────────────────────────────────────────────
  const handleBatchExecute = async () => {
    if (selectedIds.length === 0) return;

    if (batchActionType === "transfer" && !batchDoctorId) {
      toast({ title: "Select Doctor", description: "Please pick an available replacement doctor.", variant: "warning" });
      return;
    }

    if (batchActionType === "reschedule" && !batchRescheduleDate) {
      toast({ title: "Select Date", description: "Please specify target reschedule date.", variant: "warning" });
      return;
    }

    try {
      setProcessingBatch(true);
      const payload: any = {
        action: batchActionType,
        appointmentIds: selectedIds,
        reason: batchReason || "Batch disruption triage by reception",
      };

      if (batchActionType === "transfer") {
        payload.replacementDoctorId = batchDoctorId;
      } else if (batchActionType === "reschedule") {
        payload.targetDate = batchRescheduleDate;
        if (batchDoctorId) payload.replacementDoctorId = batchDoctorId;
      }

      const res = await api.post("/doctor-overrides/triage/batch", payload);
      const result = res.data?.data;

      toast({
        title: "Batch Action Completed",
        description: `Successfully processed ${result?.successfulCount || selectedIds.length} patient(s).`,
        variant: "success",
      });

      setSelectedIds([]);
      await onActionComplete();
    } catch (err: any) {
      toast({
        title: "Batch Action Failed",
        description: err.response?.data?.message || "Error processing batch triage.",
        variant: "error",
      });
    } finally {
      setProcessingBatch(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🚨 Emergency Disruption & Patient Triage Cockpit"
      size="xl"
    >
      <div className="space-y-5 pt-1 font-sans">
        {/* Banner Explainer */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Doctor Availability Disruption Active</p>
            <p>
              Due to doctor absence or early departure, affected appointments are in triage.
              <strong> Waiting patients</strong> physically at the clinic should be transferred to an available colleague (placed as Next Up) or rescheduled.
              <strong> Remote patients</strong> have a 60-minute window to choose their preference via SMS/WhatsApp before automated refund.
            </p>
          </div>
        </div>

        {/* Tab & Stats Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer",
                selectedTab === "all"
                  ? "bg-surface text-text shadow-xs border border-border/60"
                  : "text-text-muted hover:text-text"
              )}
            >
              All Affected ({triageAppointments.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("waiting")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                selectedTab === "waiting"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-rose-600 dark:text-rose-400 hover:text-rose-700"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Waiting in Clinic ({waitingPatients.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("remote")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                selectedTab === "remote"
                  ? "bg-primary-500 text-white shadow-xs"
                  : "text-text-muted hover:text-text"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              Remote / Pending ({remotePatients.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => onActionComplete()}
              disabled={submittingAction || processingBatch}
              className="rounded-lg font-semibold text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Batch Operations Bar */}
        {displayedAppointments.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-surface-alt border border-border/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.length === displayedAppointments.length && displayedAppointments.length > 0}
                  onChange={toggleSelectAll}
                  label={`Select All (${selectedIds.length} of ${displayedAppointments.length} selected)`}
                />
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-secondary">Batch Action:</span>
                  <select
                    value={batchActionType}
                    onChange={(e) => setBatchActionType(e.target.value as any)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-semibold text-text"
                  >
                    <option value="transfer">Transfer to Available Doctor</option>
                    <option value="reschedule">Priority Reschedule</option>
                    <option value="cancel">Cancel & Full Refund</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sub-inputs when batch items selected */}
            {selectedIds.length > 0 && (
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-3">
                {batchActionType === "transfer" && (
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <select
                      value={batchDoctorId}
                      onChange={(e) => setBatchDoctorId(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-text"
                    >
                      <option value="" disabled>Select Replacement Doctor</option>
                      {eligibleReplacements.map((doc) => (
                        <option key={doc.doctorId} value={doc.doctorId}>
                          {doc.name} ({doc.specialization || "General"}) — {doc.currentBookingsCount} queued — Fee: ₹{doc.fees} (Courtesy Absorbed)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {batchActionType === "reschedule" && (
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Input
                      type="date"
                      value={batchRescheduleDate}
                      onChange={(e) => setBatchRescheduleDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                )}

                <Button
                  variant={batchActionType === "cancel" ? "danger" : "primary"}
                  size="sm"
                  onClick={handleBatchExecute}
                  loading={processingBatch}
                  className="rounded-xl font-bold text-xs"
                >
                  Apply to {selectedIds.length} Patient{selectedIds.length === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Patient Cards List */}
        {displayedAppointments.length === 0 ? (
          <div className="py-12 text-center text-text-muted space-y-2 border border-dashed border-border rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-sm text-text">No Patients Require Triage</p>
            <p className="text-xs">All disrupted patients in this category have been safely triaged or reassigned.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {displayedAppointments.map((appt) => {
              const isCheckedIn = appt.status === "checked-in" || appt.notes?.includes("checked-in");
              const isSelected = selectedIds.includes(appt.id);
              const doctorName = getDoctorName(appt.doctorId);
              const timeRemaining = formatTimeRemaining(appt.disruptionResponseDeadline);

              return (
                <div
                  key={appt.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all space-y-3",
                    isCheckedIn
                      ? "bg-rose-500/[0.04] border-rose-500/30"
                      : "bg-surface border-border/80"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Checkbox, Token, Patient Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectOne(appt.id)}
                      />

                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-mono font-bold shrink-0 text-white shadow-xs",
                          isCheckedIn ? "bg-rose-500" : "bg-primary-500"
                        )}
                      >
                        <span className="text-[8px] uppercase font-bold tracking-wider opacity-80">
                          Tkn
                        </span>
                        <span className="text-xs leading-none">#{appt.tokenNumber}</span>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-text text-sm">
                            {appt.patientId?.userId?.name || "Patient"}
                          </span>
                          {isCheckedIn ? (
                            <Badge variant="danger" size="sm" className="font-bold text-[10px]">
                              Waiting at Clinic
                            </Badge>
                          ) : (
                            <Badge variant="primary" size="sm" className="font-semibold text-[10px]">
                              Remote / Confirmed
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                          {appt.patientId?.userId?.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {appt.patientId?.userId?.phone}
                            </span>
                          )}
                          <span>&bull;</span>
                          <span>Dr. {doctorName}</span>
                          {timeRemaining && (
                            <>
                              <span>&bull;</span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {timeRemaining}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Single Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => {
                          setTransferringId(transferringId === appt.id ? null : appt.id);
                          setReschedulingId(null);
                          setCancellingId(null);
                        }}
                        disabled={submittingAction}
                        className="rounded-lg font-semibold text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Stethoscope className="w-3 h-3" />
                        Transfer
                      </Button>

                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setReschedulingId(reschedulingId === appt.id ? null : appt.id);
                          setTransferringId(null);
                          setCancellingId(null);
                        }}
                        disabled={submittingAction}
                        className="rounded-lg font-semibold text-xs flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3" />
                        Reschedule
                      </Button>

                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setCancellingId(cancellingId === appt.id ? null : appt.id);
                          setTransferringId(null);
                          setReschedulingId(null);
                        }}
                        disabled={submittingAction}
                        className="rounded-lg font-semibold text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Refund
                      </Button>
                    </div>
                  </div>

                  {/* Inline Drawer: Transfer Doctor */}
                  {transferringId === appt.id && (
                    <div className="p-3 bg-surface rounded-xl border border-emerald-500/30 space-y-3 animate-fade-in text-xs">
                      <div className="flex items-center justify-between font-semibold text-text">
                        <span>Transfer Patient #{appt.tokenNumber} to Available Doctor:</span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ⚡ Priority: Next Up (Pos #1)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={activeTransferDocId || eligibleReplacements[0]?.doctorId || ""}
                          onChange={(e) => setActiveTransferDocId(e.target.value)}
                          className="flex-1 bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-text"
                        >
                          {eligibleReplacements.length === 0 && (
                            <option value="">No other doctors available today</option>
                          )}
                          {eligibleReplacements.map((doc) => (
                            <option key={doc.doctorId} value={doc.doctorId}>
                              {doc.name} ({doc.specialization || "General Practice"}) — {doc.currentBookingsCount} active patient(s) — Fee: ₹{doc.fees} (Courtesy Absorbed)
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => handleSingleTransfer(appt.id)}
                          loading={submittingAction}
                          disabled={eligibleReplacements.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                        >
                          Confirm Transfer
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setTransferringId(null)}
                          className="rounded-lg text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Inline Drawer: Reschedule */}
                  {reschedulingId === appt.id && (
                    <div className="p-3 bg-surface rounded-xl border border-primary-500/30 space-y-3 animate-fade-in text-xs">
                      <div className="font-semibold text-text">
                        Priority Reschedule for Patient #{appt.tokenNumber}:
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          value={activeRescheduleDate}
                          onChange={(e) => setActiveRescheduleDate(e.target.value)}
                          className="w-40 text-xs"
                        />
                        <select
                          value={activeRescheduleDocId}
                          onChange={(e) => setActiveRescheduleDocId(e.target.value)}
                          className="flex-1 min-w-[180px] bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-text"
                        >
                          <option value="">Same Doctor (Next Available)</option>
                          {eligibleReplacements.map((doc) => (
                            <option key={doc.doctorId} value={doc.doctorId}>
                              Dr. {doc.name} ({doc.specialization || "General"})
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => handleSingleReschedule(appt.id)}
                          loading={submittingAction}
                          className="font-bold rounded-lg"
                        >
                          Confirm Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setReschedulingId(null)}
                          className="rounded-lg text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Inline Drawer: Cancel & Refund */}
                  {cancellingId === appt.id && (
                    <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/30 space-y-3 animate-fade-in text-xs text-rose-900 dark:text-rose-200">
                      <div className="font-semibold">
                        Confirm Cancellation & Full Refund for Patient #{appt.tokenNumber}?
                      </div>
                      <p className="text-[11px] opacity-90">
                        This will issue a 100% full refund through the original payment gateway, release the token, and send a WhatsApp notification to the patient.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => handleSingleCancel(appt.id)}
                          loading={submittingAction}
                          className="font-bold rounded-lg"
                        >
                          Yes, Cancel & Refund
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCancellingId(null)}
                          className="rounded-lg text-xs"
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-between items-center border-t border-border/60 pt-3 text-xs text-text-muted">
          <span>
            {triageAppointments.length} total patient(s) flagged for disruption triage.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl font-semibold"
          >
            Close Cockpit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
