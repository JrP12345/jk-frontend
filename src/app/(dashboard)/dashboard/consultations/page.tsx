"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { todayRangeParams } from "@/lib/date";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import { Alert, Button, Pagination, useToast, Skeleton, Tabs, Input, ConfirmDialog } from "@/components/ui";
import { RotateCw, Plus, Stethoscope, Search, ArrowRight } from "lucide-react";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { TodayPatients } from "@/components/appointments/TodayPatients";
import { PatientEntryModal } from "@/components/appointments/PatientEntryModal";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { ConsultationVisitCard } from "@/components/clinical/ConsultationVisitCard";
import styles from "@/components/clinical/Consultations.module.css";

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
  if (loading) return <div className={styles.loading} role="status" aria-label="Loading consultations"><Skeleton height="44px" /><Skeleton height="96px" /><Skeleton height="128px" /></div>;
  if (!detailed && !["patient", "family_member"].includes(user?.role || "") && (preferences.registration === "essential" || preferences.consultation === "focused")) return <TodayPatients key={authScopeKey(user)} currency={preferences.currency} essentialEntry={preferences.registration === "essential"} onDetailedView={() => setDetailed(true)} />;
  return <DetailedConsultationsPage key={authScopeKey(user)} />;
}

function DetailedConsultationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeLocationId, locations = [] } = useLocationStore();
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
  const [summaryError, setSummaryError] = useState(false);
  const [countsScope, setCountsScope] = useState("");
  const summaryScope = JSON.stringify([selectedLocationId, todayRangeParams()]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(isConsumer ? "all" : "checked-in");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadedScope, setLoadedScope] = useState("");
  const readScope = JSON.stringify([selectedLocationId, statusFilter, searchQuery.trim(), page]);
  const scopeReady = loadedScope === readScope;
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
      const [listResult, summaryResult] = await Promise.allSettled([
        api.get(`/appointments?${params}`, { signal: request.signal }),
        isConsumer ? Promise.resolve(null) : api.get(`/analytics/daily-summary?${todayRangeParams()}${selectedLocationId ? `&locationId=${selectedLocationId}` : ""}&includeAppointments=false`, { signal: request.signal }),
      ]);
      if (!request.isCurrent()) return;
      const summaryRes = summaryResult.status === "fulfilled" ? summaryResult.value : null;
      setDailyCounts(summaryRes?.data?.data || null);
      setCountsScope(summaryScope);
      setSummaryError(!isConsumer && summaryResult.status === "rejected");
      if (listResult.status === "rejected") throw listResult.reason;
      const apptsRes = listResult.value;
      setQueueList(apptsRes.data?.data || []);
      setPages(Number(apptsRes.headers?.["x-total-pages"]) || 1);
    } catch {
      if (!request.isCurrent()) return;
      setQueueList([]);
      setLoadError("Consultations could not be loaded. Check your connection and try again.");
    } finally {
      if (request.isCurrent()) { setLoadedScope(readScope); setLoading(false); setIsRefreshing(false); }
    }
  }, [beginRead, isConsumer, page, searchQuery, selectedLocationId, statusFilter, readScope, summaryScope]);

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

  const count = (status: string) => countsScope === summaryScope && dailyCounts ? status === "all" ? dailyCounts.appointments : dailyCounts.byStatus[status] ?? 0 : "…";
  const selectedLocation = locations.find(location => location.id === selectedLocationId);
  const tabs = [
    { id: "checked-in", label: "Waiting" }, { id: "in-consultation", label: "In visit" },
    { id: "confirmed", label: "Scheduled" }, { id: "completed", label: "Completed" }, { id: "all", label: "All" },
  ];
  const initialLoading = loading || !scopeReady;
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>Consultations</h1><p>{isConsumer ? "Your visits and care records" : selectedLocation ? "Today · " + selectedLocation.name : "Today's patients"}</p></div>
      <div className={styles.headerActions}>
        <Button variant="ghost" className={styles.iconButton} aria-label="Refresh consultations" disabled={isRefreshing} onClick={fetchData}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>
        {canBook && <Button onClick={() => { setBookingNotice(""); setIsWalkInModalOpen(true); }}><Plus size={16} />Walk-in</Button>}
      </div>
    </header>
    <ConfirmDialog open={Boolean(arrivalConfirmation)} title="Confirm patient arrival"
      description="Is this patient present and ready? Mark arrival and start the consultation?"
      confirmLabel="Mark arrival and start" loading={openingConsultation}
      onClose={() => { if (!openingConsultation) setArrivalConfirmation(null); }}
      onConfirm={() => { if (arrivalConfirmation) void openConsultation(arrivalConfirmation, true); }}>
      <strong>{arrivalConfirmation?.patientId?.userId?.name || arrivalConfirmation?.patientId?.name}</strong>
    </ConfirmDialog>
    {scopeReady && loadError && <Alert variant="error" title="Unable to load consultations" action={<Button variant="outline" size="sm" onClick={fetchData}>Try again</Button>}>{loadError}</Alert>}
    {scopeReady && summaryError && !loadError && <Alert variant="warning" title="Counts unavailable">Patient visits are available. Refresh to retry the daily totals.</Alert>}
    {bookingNotice && <Alert variant="warning" action={<Button variant="outline" onClick={() => router.push("/dashboard/appointments")}>View appointments</Button>}>{bookingNotice}</Alert>}
    <section className={styles.filters} aria-label="Consultation filters">
      <div className={styles.filtersRow}>
        <Tabs variant="pills" className={styles.tabs} activeTab={statusFilter} scrollActiveIntoView={false}
          onChange={id => { setStatusFilter(id); setPage(1); }} tabs={tabs.map(tab => ({ ...tab, badge: isConsumer ? undefined : count(tab.id) }))} />
        <div className={styles.search}><Input icon={<Search size={16} />} type="search" placeholder="Name, phone or token" aria-label="Search consultations" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setPage(1); }} /></div>
      </div>
    </section>
    <section className={styles.list} aria-label="Patient consultations" aria-busy={isRefreshing || initialLoading}>
      {initialLoading ? <div className={styles.loading} role="status" aria-label="Loading patient visits"><Skeleton height="100px" /><Skeleton height="100px" /><Skeleton height="100px" /></div>
        : loadError ? null : filteredQueue.length === 0 ? <div className={styles.empty}>
          <Stethoscope size={25} className="text-accent" /><h2>{searchQuery ? "No matching patients" : statusFilter === "checked-in" ? "No patients waiting" : "No visits in this view"}</h2>
          <p>{searchQuery ? "Try a different name, phone number or token." : "Switch tabs to review scheduled or completed visits."}</p>
          {(searchQuery || statusFilter !== "all") && <Button variant="outline" onClick={() => { setStatusFilter("all"); setSearchQuery(""); setPage(1); }}>Show all visits</Button>}
        </div> : filteredQueue.map(item => {
          const inProgress = item.status === "in-consultation", completed = item.status === "completed";
          const context = [item.doctorId?.name && !(user?.role === "doctor" && item.doctorId.id === user.id) ? "Dr. " + item.doctorId.name.replace(/^dr\.?\s+/i, "") : "", item.locationId?.id !== selectedLocationId ? item.locationId?.name : "",
            isConsumer && item.appointmentTime ? new Date(item.appointmentTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ");
          return <ConsultationVisitCard key={item.id} name={item.patientId?.userId?.name || item.patientId?.name || "Patient"}
            phone={item.patientId?.userId?.phone || item.patientId?.phone} token={item.tokenNumber ?? item.queuePosition}
            status={item.status} context={context} complaint={item.chiefComplaint}
            actions={<Button size="sm" variant={completed ? "outline" : "primary"}
              disabled={!isConsumer && (openingConsultation || !canStartConsultation || ["cancelled", "no-show", "pending_payment"].includes(item.status))}
              onClick={() => isConsumer ? router.push("/dashboard/patient-portal") : void openConsultation(item)}>
              {isConsumer ? "Care records" : inProgress ? "Resume visit" : completed ? "Review visit" : "Start consultation"}<ArrowRight size={15} />
            </Button>} />;
        })}
    </section>
    {scopeReady && !loadError && <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />}
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
  </div>;
}
