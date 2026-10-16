"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { todayRangeParams } from "@/lib/date";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import { Alert, Card, CardContent, Button, Pagination, useToast, Badge, SkeletonCardGrid, cn, LoadingState, Input, ConfirmDialog } from "@/components/ui";
import { RotateCw, Plus, Stethoscope, Search, Ticket, Phone, ArrowRight } from "lucide-react";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { TodayPatients } from "@/components/appointments/TodayPatients";
import { PatientEntryModal } from "@/components/appointments/PatientEntryModal";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";

export interface OPDQueueAppointment {
  id: string;
  tokenNumber?: number;
  queuePosition?: number;
  status: "pending_payment" | "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show";
  appointmentTime: string;
  patientId: {
    id: string;
    name?: string;
    phone?: string;
    userId?: { name: string; email?: string; phone?: string };
    gender?: string;
    dob?: string;
  };
  doctorId: { id: string; name: string; specialization?: string };
  locationId?: { id: string; name: string };
  chiefComplaint?: string;
  notes?: string;
}

export default function ConsultationsPage() {
  const { user } = useAuthStore();
  const { preferences, loading } = useWorkflowPreferences();
  const [detailed, setDetailed] = useState(false);
  if (loading) return <LoadingState label="Loading consultations"><SkeletonCardGrid count={2} columns="grid-cols-1" /></LoadingState>;
  if (!detailed && (preferences.registration === "essential" || preferences.consultation === "focused")) return <TodayPatients currency={preferences.currency} essentialEntry={preferences.registration === "essential"} onDetailedView={() => setDetailed(true)} />;
  return <DetailedConsultationsPage key={authScopeKey(user)} />;
}

function DetailedConsultationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeLocationId } = useLocationStore();
  const isConsumer = ["patient", "family_member"].includes(user?.role || "");
  const canStartConsultation = !isConsumer && hasAnyPermission(user, "MANAGE_CLINICAL_NOTES") && hasAnyPermission(user, "MANAGE_APPOINTMENTS");
  const canBook = canStartConsultation && hasAnyPermission(user, "VIEW_PATIENTS", "MANAGE_PATIENTS") && hasAnyPermission(user, "VIEW_LOCATIONS");
  const { toast } = useToast();

  const [selectedLocationId, setSelectedLocationId] = useState(activeLocationId || "");
  const [queueList, setQueueList] = useState<OPDQueueAppointment[]>([]);
  const [arrivalConfirmation, setArrivalConfirmation] = useState<OPDQueueAppointment | null>(null);
  const [openingConsultation, setOpeningConsultation] = useState(false);
  const [dailyCounts, setDailyCounts] = useState<{ appointments: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(isConsumer ? "all" : "checked-in");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const beginRead = useLatestRead();
  const [bookingNotice, setBookingNotice] = useState("");

  // Walk-in Consultation Modal State
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  useEffect(() => {
    setSelectedLocationId(activeLocationId || "");
    setPage(1);
  }, [activeLocationId]);

  const fetchData = useCallback(async () => {
    const request = beginRead();
    try {
      setLoadError(null);
      setIsRefreshing(true);
      const params = new URLSearchParams(isConsumer ? "" : todayRangeParams());
      params.set("page", String(page)); params.set("limit", "25");
      if (!isConsumer && selectedLocationId) params.set("locationId", selectedLocationId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const [apptsRes, summaryRes] = await Promise.all([
        api.get(`/appointments?${params}`, { signal: request.signal }),
        isConsumer ? Promise.resolve(null) : api.get(`/analytics/daily-summary?${todayRangeParams()}${selectedLocationId ? `&locationId=${selectedLocationId}` : ""}&includeAppointments=false`, { signal: request.signal }),
      ]);
      if (!request.isCurrent()) return;
      setQueueList(apptsRes.data?.data || []);
      setPages(Number(apptsRes.headers?.["x-total-pages"]) || 1);
      setDailyCounts(summaryRes?.data?.data || null);
    } catch {
      if (!request.isCurrent()) return;
      setQueueList([]); setDailyCounts(null);
      setLoadError("Consultations could not be loaded. Check your connection and try again.");
    } finally {
      if (request.isCurrent()) { setLoading(false); setIsRefreshing(false); }
    }
  }, [beginRead, isConsumer, page, searchQuery, selectedLocationId, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchData(); }, 200);
    return () => { clearTimeout(timer); beginRead(); };
  }, [fetchData, beginRead]);

  // Filter Queue
  async function openConsultation(item: OPDQueueAppointment, arrivalConfirmed = false) {
    if (openingConsultation) return;
    if (["pending", "confirmed"].includes(item.status) && !arrivalConfirmed) {
      setArrivalConfirmation(item);
      return;
    }
    setOpeningConsultation(true);
    try {
      if (["pending", "confirmed"].includes(item.status)) {
        await api.put(`/appointments/${item.id}/status`, { status: "checked-in" });
      }
      if (["pending", "confirmed", "checked-in"].includes(item.status)) await api.put(`/appointments/${item.id}/status`, { status: "in-consultation" });
      setArrivalConfirmation(null);
      router.push(`/dashboard/consultations/${item.id}`);
    } catch (error: any) { toast({ title: "Consultation could not be opened", description: error.response?.data?.message || "Refresh the list before retrying.", variant: "error" }); }
    finally { setOpeningConsultation(false); }
  }
  const filteredQueue = queueList; // Server filtering applies to every page, including phone/token matches.

  // KPI Calculations
  const totalToday = dailyCounts?.appointments ?? queueList.length;
  const checkedInCount = dailyCounts?.byStatus["checked-in"] ?? queueList.filter((a) => a.status === "checked-in").length;
  const inConsultationCount = dailyCounts?.byStatus["in-consultation"] ?? queueList.filter((a) => a.status === "in-consultation").length;
  const completedCount = dailyCounts?.byStatus.completed ?? queueList.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-4 sm:space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-4 sm:pb-12">
      <ConfirmDialog open={Boolean(arrivalConfirmation)} title="Confirm patient arrival"
        description="Is this patient present and ready? Mark arrival and start the consultation?"
        confirmLabel="Mark arrival and start" loading={openingConsultation}
        onClose={() => { if (!openingConsultation) setArrivalConfirmation(null); }}
        onConfirm={() => { if (arrivalConfirmation) void openConsultation(arrivalConfirmation, true); }} />
      {loadError && <Alert variant="error" title="Unable to load consultations" action={<Button variant="outline" size="sm" onClick={fetchData}>Try again</Button>}>{loadError}</Alert>}
      {bookingNotice && <Alert variant="warning" action={<Button variant="outline" onClick={() => router.push("/dashboard/appointments")}>View appointments</Button>}>{bookingNotice}</Alert>}
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                {isConsumer ? "Consultations" : "Consultations & queue"}
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Clinical Desk
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              {isConsumer ? "Your visits and shared care records." : "Manage waiting patients, start consultations, and record clinical notes."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isRefreshing}
              className="text-xs font-semibold transition-colors min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none justify-center"
             loading={isRefreshing}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh
            </Button>

            {canBook && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setBookingNotice(""); setIsWalkInModalOpen(true); }}
                className="font-semibold min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-none justify-center"
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
      {!isConsumer && <Card className="p-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4" aria-label="Today's consultation counts">
          {[['Visits today', totalToday], ['Waiting', checkedInCount], ['With doctor', inConsultationCount], ['Seen today', completedCount]].map(([label, count]) => <div key={label} className="flex items-baseline justify-between gap-2 text-sm">
            <dt className="text-text-muted">{label}</dt><dd className="font-semibold tabular-nums">{loading || loadError ? '?' : count}</dd>
          </div>)}
        </dl>
      </Card>}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FILTER TOOLBAR & SEARCH
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-full sm:w-fit max-w-full touch-scroll scroll-snap-x">
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
                aria-pressed={statusFilter === s.key}
                onClick={() => { setStatusFilter(s.key); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
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

          {/* Search Input */}
          <div className="relative w-full sm:w-72 shrink-0">

            <Input icon={<Search />} type="search" placeholder="Search patient, phone or token" aria-label="Search consultations" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} size="sm" variant="filled" />
          </div>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. DOCTOR OPD QUEUE CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonCardGrid count={6} columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
      ) : filteredQueue.length === 0 ? (
        <Card className="py-16 text-center text-text-muted rounded-2xl border border-border/80 bg-surface shadow-xs">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-accent">
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
                setPage(1);
              }}
              className="font-semibold text-xs"
            >
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQueue.map((item) => {
            const patientName = item.patientId?.userId?.name || item.patientId?.name || "Patient";
            const patientPhone = item.patientId?.userId?.phone || item.patientId?.phone || "";
            const doctorName = item.doctorId?.name || "Attending Doctor";
            const isInConsultation = item.status === "in-consultation";
            const isCompleted = item.status === "completed";

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col justify-between text-xs shadow-xs space-y-3.5 overflow-hidden",
                  isInConsultation
                    ? "border-success/40 bg-success/[0.03] dark:bg-success/[0.06]"
                    : isCompleted
                    ? "border-success/20 bg-surface"
                    : "border-border/80 bg-surface hover:border-primary-500/40"
                )}
              >
                {/* Header Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-accent dark:text-accent bg-primary-500/10 px-2.5 py-1 rounded-xl border border-primary-500/20 inline-flex items-center gap-1">
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
                    <a
                      href={`tel:${patientPhone}`}
                      className="text-xs text-text-muted hover:text-accent transition-colors flex items-center gap-1 w-fit"
                    >
                      <Phone className="w-3 h-3 text-text-muted shrink-0" />
                      {patientPhone}
                    </a>
                  )}
                </div>

                {/* Clinical Notes & Doctor Info */}
                <div className="p-3 bg-surface-alt rounded-xl border border-border/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Physician:</span>
                    <span className="font-bold text-text flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-accent shrink-0" />
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
                    onClick={() => isConsumer ? router.push("/dashboard/patient-portal") : openConsultation(item)}
                    disabled={!isConsumer && (!canStartConsultation || ["cancelled", "no-show", "pending_payment"].includes(item.status))}
                    className="font-semibold text-xs rounded-xl w-full shadow-xs justify-between min-h-[44px]"
                  >
                    <span>
                      {isConsumer ? "View care records" : isInConsultation
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
      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
      {isWalkInModalOpen && <PatientEntryModal open onClose={() => setIsWalkInModalOpen(false)} locationId={selectedLocationId}
        onBooked={id => {
          setIsWalkInModalOpen(false);
          void api.get('/appointments/' + id).then(response => {
            const visit = response.data.data as OPDQueueAppointment;
            if (visit.status === 'pending_payment') {
              setBookingNotice('Visit booked. Collect the required payment in Appointments before starting the consultation.');
              void fetchData();
            } else { void openConsultation(visit); }
          }).catch(() => { setBookingNotice('The visit is booked. Refresh Appointments before starting; do not book it again.'); });
        }} />}
    </div>
  );
}
