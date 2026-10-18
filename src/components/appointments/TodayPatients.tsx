"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Button, ConfirmDialog, Input, Pagination, Select, Skeleton, Tabs } from "@/components/ui";
import { ArrowRight, Plus, RotateCw, Search, Stethoscope } from "lucide-react";
import { ConsultationVisitCard } from "@/components/clinical/ConsultationVisitCard";
import styles from "@/components/clinical/Consultations.module.css";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { locationTodayRange, patientName, patientPhone, recordId, validSingleChoice, type WorkflowPatient } from "@/lib/locationWorkflow";
import { PatientEntryModal, type LocationDoctorAssignment } from "./PatientEntryModal";
import { VisitInvoices } from "@/components/billing/VisitInvoices";
import { formatCurrency } from '@/lib/currency';

interface Visit { id: string; status: string; tokenNumber?: number; appointmentType: string; patientId: WorkflowPatient; doctorId: { id: string; name: string }; appointmentTime: string }
interface Summary { appointments: number; completed: number; byStatus: Record<string, number>; financialVisible?: boolean; moneyByCurrency?: Array<{ currency: string; collections: number; outstanding: number }> }
export function TodayPatients({ onDetailedView, essentialEntry = false }: { onDetailedView: () => void; essentialEntry?: boolean; currency?: string }) {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { locations, activeLocationId, fetchLocations, error: locationError } = useLocationStore();
  const [locationId, setLocationId] = useState(activeLocationId || "");
  const [doctors, setDoctors] = useState<LocationDoctorAssignment[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState(user?.role === "doctor" ? "checked-in" : "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState(false);
  const [loadedScope, setLoadedScope] = useState("");
  const [countsScope, setCountsScope] = useState("");
  const readScope = JSON.stringify([locationId, doctorId, status, search.trim(), page]);
  const scopeReady = readScope === loadedScope;
  const [busy, setBusy] = useState("");
  const [add, setAdd] = useState(false);
  const openEntry = () => { if (essentialEntry) setAdd(true); else router.push("/dashboard/appointments"); };
  const [paymentVisit, setPaymentVisit] = useState<Visit | null>(null);
  const [arrivalConfirmation, setArrivalConfirmation] = useState<{ id: string; tokenNumber?: number } | null>(null);
  const beginRead = useLatestRead();
  const beginAssignments = useLatestRead();
  const location = locations.find(value => value.id === locationId);
  const timezone = location?.effectiveTimezone || location?.timezone || "Asia/Kolkata";
  const summaryScope = JSON.stringify([locationId, doctorId, locationTodayRange(timezone)]);
  const countsReady = countsScope === summaryScope;
  const canBook = hasAnyPermission(user, "MANAGE_APPOINTMENTS", "CREATE_APPOINTMENTS");
  const canStart = hasAnyPermission(user, "MANAGE_CLINICAL_NOTES") && hasAnyPermission(user, "MANAGE_APPOINTMENTS");
  const canQueue = hasAnyPermission(user, "MANAGE_QUEUE");
  const canPay = hasAnyPermission(user, "MANAGE_BILLING");
  useEffect(() => {
    beginRead();
    setVisits([]); setSummary(null); setPage(1); setLoading(Boolean(locationId));
  }, [beginRead, locationId, doctorId]);
  useEffect(() => { void fetchLocations(); }, [fetchLocations]);
  useEffect(() => { setLocationId(current => validSingleChoice(locations, value => value.id, activeLocationId || current)); }, [locations, activeLocationId]);
  useEffect(() => {
    const request = beginAssignments(); setDoctors([]); setDoctorId("");
    if (!locationId) return;
    api.get(`/onboarding/doctors/assignments?locationId=${locationId}`, { signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const choices = (response.data?.data || []).filter((value: LocationDoctorAssignment) => value.isActive !== false);
      setDoctors(choices);
      setDoctorId(user?.role === "doctor" ? user.id : validSingleChoice(choices, (value: LocationDoctorAssignment) => recordId(value.doctorId)));
    }).catch(() => { if (request.isCurrent()) setError("Doctor assignments could not be loaded. Select the location again to retry."); });
  }, [beginAssignments, locationId, user?.id, user?.role]);
  const load = useCallback(async () => {
    const request = beginRead();
    if (!locationId || !locations.some(value => value.id === locationId)) { setLoading(false); setVisits([]); setSummary(null); return; }
    setLoading(true); setError("");
    const params = new URLSearchParams(locationTodayRange(timezone));
    params.set("locationId", locationId); if (doctorId) params.set("doctorId", doctorId);
    const listParams = new URLSearchParams(params);
    listParams.set("page", String(page)); listParams.set("limit", "25");
    if (status !== "all") listParams.set("status", status);
    if (search.trim()) listParams.set("search", search.trim());
    try {
      const [listResult, totalsResult] = await Promise.allSettled([api.get(`/appointments?${listParams}`, { signal: request.signal }), api.get(`/analytics/daily-summary?${params}&includeAppointments=false`, { signal: request.signal })]);
      if (!request.isCurrent()) return;
      const totals = totalsResult.status === "fulfilled" ? totalsResult.value : null;
      setSummary(totals?.data?.data || null); setCountsScope(summaryScope);
      setSummaryError(totalsResult.status === "rejected");
      if (listResult.status === "rejected") throw listResult.reason;
      const list = listResult.value;
      setVisits(list.data?.data || []); setPages(Number(list.headers?.["x-total-pages"]) || 1);
    } catch { if (request.isCurrent()) { setVisits([]); setError("Today's patients could not be loaded. Refresh to retry."); } }
    finally { if (request.isCurrent()) { setLoading(false); setLoadedScope(readScope); } }
  }, [beginRead, locationId, locations, doctorId, page, search, status, timezone, readScope, summaryScope]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 200); return () => { clearTimeout(timer); beginRead(); }; }, [load, beginRead]);
  useEffect(() => {
    let lastRefresh = Number.NEGATIVE_INFINITY;
    const focus = () => {
      if (document.visibilityState !== "visible") return;
      // Returning to a tab can emit both visibilitychange and focus.
      const now = performance.now();
      if (now - lastRefresh < 250) return;
      lastRefresh = now;
      void load();
    };
    const timer = setInterval(focus, 30000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [load]);
  async function arrive(visit: Visit, start = false) {
    if (busy) return; setBusy(visit.id); setError("");
    try {
      if (["confirmed", "pending"].includes(visit.status)) await api.put(`/appointments/${visit.id}/status`, { status: "checked-in" });
      if (start) {
        if (visit.status !== "in-consultation") await api.put(`/appointments/${visit.id}/status`, { status: "in-consultation" });
        router.push(`/dashboard/consultations/${visit.id}`);
      } else await load();
    } catch (failure: unknown) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The visit could not be updated. Refresh before retrying."); }
    finally { setBusy(""); }
  }
  async function next(confirmedAppointmentId?: string) {
    if (!doctorId || !locationId) return;
    setBusy("next"); setError("");
    try {
      const response = await api.post("/queue/call-next", { locationId, doctorId, requireArrivalConfirmation: true, ...(confirmedAppointmentId ? { confirmedAppointmentId } : {}) });
      const visit = response.data?.data;
      if (visit) { setArrivalConfirmation(null); router.push(`/dashboard/consultations/${recordId(visit)}`); }
      else setError("No waiting patients for this doctor today.");
    } catch (failure: unknown) {
      const response = (failure as { response?: { data?: { message?: string; details?: string; data?: { id: string; tokenNumber?: number } } } }).response?.data;
      if (response?.details === "ARRIVAL_CONFIRMATION_REQUIRED" && response.data) setArrivalConfirmation(response.data);
      else setError(response?.message || "The next patient could not be called.");
    } finally { setBusy(""); }
  }
  const counts = summary?.byStatus || {};
  const moneyTotals = summary?.moneyByCurrency || [];
  const filters = [{ id: "checked-in", label: "Waiting" }, { id: "in-consultation", label: "In visit" }, { id: "confirmed", label: "Scheduled" }, { id: "completed", label: "Completed" }, { id: "all", label: "All" }, { id: "pending", label: "Pending" }, { id: "pending_payment", label: "Payment due" }, { id: "cancelled", label: "Cancelled" }, { id: "no-show", label: "No-show" }];
  const actions = (visit: Visit) => <>
    {canBook && ["pending", "confirmed"].includes(visit.status) && <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => arrive(visit)}>Mark arrival</Button>}
    {canStart && ["checked-in", "in-consultation"].includes(visit.status) && <Button size="sm" disabled={Boolean(busy)} onClick={() => arrive(visit, true)}>{visit.status === "in-consultation" ? "Resume visit" : "Start consultation"}<ArrowRight size={15} /></Button>}
    {canStart && visit.status === "completed" && <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/consultations/${visit.id}`)}>Review visit</Button>}
    {canPay && <Button size="sm" variant="outline" onClick={() => setPaymentVisit(visit)}>Payments</Button>}
  </>;
  const initialLoading = !scopeReady && Boolean(locationId);
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>Consultations</h1><p>{location?.name || "Choose a location"}</p></div>
      <div className={styles.headerActions}>
        <Button variant="ghost" className={styles.iconButton} aria-label="Refresh consultations" onClick={load} disabled={loading || Boolean(busy)}><RotateCw size={17} className={loading ? "animate-spin" : ""} /></Button>
        {canQueue && canStart && <Button onClick={() => next()} disabled={!doctorId || !locationId || Boolean(busy) || initialLoading}>Next patient<ArrowRight size={15} /></Button>}
        {canBook && !(canQueue && canStart) && <Button onClick={openEntry} disabled={!locationId}><Plus size={16} />Add patient</Button>}
      </div>
    </header>
    {(error || locationError) && <Alert variant="error" action={<Button variant="outline" size="sm" onClick={load}>Try again</Button>}>{error || locationError}</Alert>}
    {scopeReady && summaryError && <Alert variant="warning" title="Counts unavailable">Patient visits are available. Refresh to retry the daily totals.</Alert>}
    <section className={styles.filters} aria-label="Consultation filters">
      {(locations.length > 1 || (user?.role !== "doctor" && doctors.length > 1)) && <details className={styles.scopeSelection}><summary>Location &amp; doctor</summary><div className={styles.selection}>
        {locations.length > 1 && <Select label="Location" value={locationId} onChange={event => { setLocationId(event.target.value); setPage(1); }} options={[{ value: "", label: "Select location" }, ...locations.map(value => ({ value: value.id, label: value.name }))]} />}
        {user?.role !== "doctor" && doctors.length > 1 && <Select label="Doctor" value={doctorId} onChange={event => { setDoctorId(event.target.value); setPage(1); }} options={[{ value: "", label: "All doctors" }, ...doctors.map(value => ({ value: recordId(value.doctorId), label: typeof value.doctorId === "object" ? value.doctorId.name || "Doctor" : "Doctor" }))]} />}
      </div></details>}
      <div className={styles.filtersRow}>
        <Tabs variant="pills" className={styles.tabs} activeTab={status} scrollActiveIntoView={false} onChange={id => { setStatus(id); setPage(1); }} tabs={filters.map(filter => ({ ...filter, badge: countsReady && summary ? filter.id === "all" ? summary.appointments : counts[filter.id] ?? 0 : "…" }))} />
        <div className={styles.search}><Input type="search" icon={<Search size={16} />} aria-label="Search patient or token" placeholder="Name, phone, MRN or token" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
      </div>
    </section>
    <section className={styles.list} aria-label="Patient consultations" aria-busy={loading || initialLoading}>
      {initialLoading || (loading && !visits.length) ? <div className={styles.loading} role="status" aria-label="Loading today's patients"><Skeleton height="100px" /><Skeleton height="100px" /><Skeleton height="100px" /></div> : scopeReady && visits.length ? visits.map(visit => <ConsultationVisitCard key={visit.id} name={patientName(visit.patientId)} phone={patientPhone(visit.patientId)} token={visit.tokenNumber} status={visit.status} context={[user?.role === "doctor" && visit.doctorId?.id === user.id ? "" : visit.doctorId?.name, visit.appointmentType === "reception" ? "Phone / desk" : (visit.appointmentType || "").replaceAll("_", " ").replaceAll("-", " ")].filter(Boolean).join(" · ")} actions={actions(visit)} />)
        : !error && !locationError && <div className={styles.empty}><Stethoscope size={25} className="text-accent" /><h2>{!locationId ? "Choose a location" : search ? "No matching patients" : status === "checked-in" ? "No patients waiting" : "No visits match this view."}</h2><p>{!locationId ? "Select a location to see today's patients." : "Switch tabs or adjust your search to find a visit."}</p>{locationId && (status !== "all" || search) && <Button variant="outline" onClick={() => { setStatus("all"); setSearch(""); setPage(1); }}>Show all visits</Button>}</div>}
    </section>
    {scopeReady && <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />}
    {scopeReady && summary?.financialVisible && <details className={styles.financial}><summary>Daily collections</summary>{moneyTotals.map(money => <p key={money.currency}>Collected: <strong>{formatCurrency(money.collections, money.currency, { minimumFractionDigits: money.currency === "JPY" ? 0 : 2 })}</strong> · Outstanding: <strong>{formatCurrency(money.outstanding, money.currency, { minimumFractionDigits: money.currency === "JPY" ? 0 : 2 })}</strong></p>)}</details>}
    <nav className={styles.links} aria-label="Related consultation tools">
      {canBook && canQueue && canStart && <Button variant="ghost" onClick={openEntry} disabled={!locationId}>Add patient</Button>}
      <Button variant="ghost" onClick={onDetailedView}>Detailed view</Button><Link href="/dashboard/queue">Queue desk</Link><Link href="/dashboard/appointments">Appointments</Link>{canPay && <Link href="/dashboard/billing">Billing</Link>}
    </nav>
    <ConfirmDialog open={Boolean(arrivalConfirmation)} title="Confirm patient arrival" description={arrivalConfirmation?.tokenNumber !== undefined ? "Token #" + arrivalConfirmation.tokenNumber + " has not checked in. Is this patient present and ready?" : "This patient has not checked in. Are they present and ready?"}
      confirmLabel="Mark arrival and start" loading={Boolean(busy)} onClose={() => { if (!busy) setArrivalConfirmation(null); }} onConfirm={() => { if (arrivalConfirmation && !busy) void next(arrivalConfirmation.id); }} />
    <PatientEntryModal open={add} onClose={() => setAdd(false)} locationId={locationId} onBooked={() => { setAdd(false); void load(); }} onFullRegistration={() => router.push("/dashboard/appointments")} />
    {paymentVisit && <VisitInvoices appointmentId={paymentVisit.id} patientName={patientName(paymentVisit.patientId)} locationId={locationId} onClose={() => setPaymentVisit(null)} onPaid={() => { void load(); }} />}
  </div>;
}
