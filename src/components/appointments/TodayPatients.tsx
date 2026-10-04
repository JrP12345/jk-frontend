"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Alert, Badge, Button, Card, Input, Pagination, Select, Spinner, Table } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { clinicTodayRange, patientName, patientPhone, recordId, validSingleChoice, type WorkflowPatient } from "@/lib/clinicWorkflow";
import { PatientEntryModal, type ClinicDoctorAssignment } from "./PatientEntryModal";
import { VisitInvoices } from "@/components/billing/VisitInvoices";

interface Visit { id: string; status: string; tokenNumber?: number; appointmentType: string; patientId: WorkflowPatient; doctorId: { id: string; name: string }; appointmentTime: string }
interface Summary { appointments: number; completed: number; byStatus: Record<string, number>; financialVisible?: boolean; moneyByCurrency?: Array<{ currency: string; collections: number; outstanding: number }> }
export function TodayPatients({ onDetailedView, essentialEntry = false, currency = "INR" }: { onDetailedView: () => void; essentialEntry?: boolean; currency?: string }) {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { clinics, activeClinicId, fetchClinics, error: clinicError } = useClinicStore();
  const [clinicId, setClinicId] = useState(activeClinicId || "");
  const [doctors, setDoctors] = useState<ClinicDoctorAssignment[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [add, setAdd] = useState(false);
  const openEntry = () => { if (essentialEntry) setAdd(true); else router.push("/dashboard/appointments"); };
  const [paymentVisit, setPaymentVisit] = useState<Visit | null>(null);
  const beginRead = useLatestRead();
  const beginAssignments = useLatestRead();
  const clinic = clinics.find(value => value.id === clinicId);
  const timezone = clinic?.effectiveTimezone || clinic?.timezone || "Asia/Kolkata";
  const canBook = hasAnyPermission(user, "MANAGE_APPOINTMENTS", "CREATE_APPOINTMENTS");
  const canStart = hasAnyPermission(user, "MANAGE_CLINICAL_NOTES") && hasAnyPermission(user, "MANAGE_APPOINTMENTS");
  const canQueue = hasAnyPermission(user, "MANAGE_QUEUE");
  const canPay = hasAnyPermission(user, "MANAGE_BILLING");
  useEffect(() => {
    beginRead();
    setVisits([]); setSummary(null); setPage(1); setLoading(Boolean(clinicId));
  }, [beginRead, clinicId, doctorId]);
  useEffect(() => { void fetchClinics(); }, [fetchClinics]);
  useEffect(() => { setClinicId(current => validSingleChoice(clinics, value => value.id, activeClinicId || current)); }, [clinics, activeClinicId]);
  useEffect(() => {
    const request = beginAssignments(); setDoctors([]); setDoctorId("");
    if (!clinicId) return;
    api.get(`/onboarding/doctors/assignments?clinicId=${clinicId}`, { signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const choices = (response.data?.data || []).filter((value: ClinicDoctorAssignment) => value.isActive !== false);
      setDoctors(choices);
      setDoctorId(user?.role === "doctor" ? user.id : validSingleChoice(choices, (value: ClinicDoctorAssignment) => recordId(value.doctorId)));
    }).catch(() => { if (request.isCurrent()) setError("Doctor assignments could not be loaded. Select the clinic again to retry."); });
  }, [beginAssignments, clinicId, user?.id, user?.role]);
  const load = useCallback(async () => {
    const request = beginRead();
    if (!clinicId || !clinics.some(value => value.id === clinicId)) { setLoading(false); setVisits([]); setSummary(null); return; }
    setLoading(true); setError("");
    const params = new URLSearchParams(clinicTodayRange(timezone));
    params.set("clinicId", clinicId); if (doctorId) params.set("doctorId", doctorId);
    const listParams = new URLSearchParams(params);
    listParams.set("page", String(page)); listParams.set("limit", "25");
    if (status !== "all") listParams.set("status", status);
    if (search.trim()) listParams.set("search", search.trim());
    try {
      const [list, totals] = await Promise.all([api.get(`/appointments?${listParams}`, { signal: request.signal }), api.get(`/analytics/daily-summary?${params}`, { signal: request.signal })]);
      if (!request.isCurrent()) return;
      setVisits(list.data?.data || []); setPages(Number(list.headers["x-total-pages"]) || 1); setSummary(totals.data?.data || null);
    } catch { if (request.isCurrent()) { setVisits([]); setSummary(null); setError("Today's patients could not be loaded. Refresh to retry."); } }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [beginRead, clinicId, clinics, doctorId, page, search, status, timezone]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 200); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { void load(); }, 30000);
    const focus = () => { void load(); };
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
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
    if (!doctorId || !clinicId) return;
    setBusy("next"); setError("");
    try {
      const response = await api.post("/queue/call-next", { clinicId, doctorId, requireArrivalConfirmation: true, ...(confirmedAppointmentId ? { confirmedAppointmentId } : {}) });
      const visit = response.data?.data;
      if (visit) router.push(`/dashboard/consultations/${recordId(visit)}`);
      else setError("No waiting patients for this doctor today.");
    } catch (failure: unknown) {
      const response = (failure as { response?: { data?: { message?: string; details?: string; data?: { id: string; tokenNumber?: number } } } }).response?.data;
      if (response?.details === "ARRIVAL_CONFIRMATION_REQUIRED" && response.data && window.confirm(`Token #${response.data.tokenNumber} has not checked in. Is this patient present and ready?`)) await next(response.data.id);
      else setError(response?.message || "The next patient could not be called.");
    } finally { setBusy(""); }
  }
  const counts = summary?.byStatus || {};
  const moneyTotals = summary?.moneyByCurrency?.length ? summary.moneyByCurrency : [{ currency, collections: 0, outstanding: 0 }];
  const filters = [{ value: "all", label: `All (${summary?.appointments || 0})` }, { value: "checked-in", label: `Waiting (${counts["checked-in"] || 0})` }, { value: "in-consultation", label: `With doctor (${counts["in-consultation"] || 0})` }, { value: "completed", label: `Completed (${counts.completed || 0})` }, { value: "confirmed", label: `Booked (${counts.confirmed || 0})` }, { value: "pending", label: `Pending (${counts.pending || 0})` }, { value: "pending_payment", label: `Payment pending (${counts.pending_payment || 0})` }, { value: "cancelled", label: `Cancelled (${counts.cancelled || 0})` }, { value: "no-show", label: `No-show (${counts["no-show"] || 0})` }];
  const actions = (visit: Visit) => <div className="flex flex-wrap gap-2">
    {canBook && ["pending", "confirmed"].includes(visit.status) && <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => arrive(visit)}>Mark arrival</Button>}
    {canStart && ["checked-in", "in-consultation"].includes(visit.status) && <Button size="sm" disabled={Boolean(busy)} onClick={() => arrive(visit, true)}>{visit.status === "in-consultation" ? "Open visit" : "Start consultation"}</Button>}
    {canStart && visit.status === "completed" && <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/consultations/${visit.id}`)}>Review visit</Button>}
    {canPay && <Button size="sm" variant="outline" onClick={() => setPaymentVisit(visit)}>Payments</Button>}
  </div>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Today's patients</h1><p className="text-sm text-text-muted">{clinic?.name || "Choose a clinic"} · {timezone}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load} disabled={Boolean(busy)}>Refresh</Button>{canQueue && canStart && <Button onClick={() => next()} disabled={!doctorId || Boolean(busy)}>Next patient</Button>}{canBook && <Button onClick={openEntry} disabled={!clinicId}>Add patient</Button>}</div></div>
    {(error || clinicError) && <Alert variant="error">{error || clinicError}</Alert>}
    <Card className="p-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>Seen today: <strong>{summary?.completed ?? "—"}</strong></span><span>Waiting: <strong>{counts["checked-in"] ?? "—"}</strong></span><span>With doctor: <strong>{counts["in-consultation"] ?? "—"}</strong></span>{summary?.financialVisible && moneyTotals.map(money => <span key={money.currency}>Collected: <strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: money.currency }).format(money.collections)}</strong> · Today's invoices outstanding: <strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: money.currency }).format(money.outstanding)}</strong></span>)}</Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {clinics.length > 1 && <Select label="Clinic" value={clinicId} onChange={e => { setClinicId(e.target.value); setPage(1); }} options={[{ value: "", label: "Select clinic" }, ...clinics.map(value => ({ value: value.id, label: value.name }))]} />}
      {user?.role !== "doctor" && doctors.length > 1 && <Select label="Doctor" value={doctorId} onChange={e => { setDoctorId(e.target.value); setPage(1); }} options={[{ value: "", label: "All doctors (choose one to call next)" }, ...doctors.map(value => ({ value: recordId(value.doctorId), label: typeof value.doctorId === "object" ? value.doctorId.name || "Doctor" : "Doctor" }))]} />}
      <Select label="Visit status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} options={filters} />
      <Input label="Search patient or token" placeholder="Name, phone, MRN or token" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    </div>
    {loading && visits.length === 0 ? <Spinner label="Loading today's patients" /> : <>
      <div className="hidden md:block"><Table<Visit> data={visits} density="compact" pagination={false} columns={[{ header: "Token", accessor: visit => visit.tokenNumber || "—" }, { header: "Patient", accessor: visit => <div><p className="font-medium">{patientName(visit.patientId)}</p><p className="text-xs text-text-muted">{patientPhone(visit.patientId)} · {visit.patientId?.mrn}</p></div> }, { header: "Doctor / source", accessor: visit => <div>{visit.doctorId?.name}<p className="text-xs text-text-muted">{visit.appointmentType === "reception" ? "Phone / desk" : visit.appointmentType}</p></div> }, { header: "Status", accessor: visit => <Badge variant={visit.status === "completed" ? "success" : "outline"}>{visit.status.replaceAll("-", " ").replaceAll("_", " ")}</Badge> }, { header: "Actions", accessor: actions }]} /></div>
      <div className="space-y-2 md:hidden">{visits.map(visit => <Card key={visit.id} className="p-3 space-y-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{visit.tokenNumber ? `#${visit.tokenNumber} · ` : ""}{patientName(visit.patientId)}</p><p className="text-xs text-text-muted">{patientPhone(visit.patientId)} · {visit.doctorId?.name}</p><p className="text-xs text-text-muted">{visit.appointmentType === "reception" ? "Phone / desk" : visit.appointmentType}</p></div><Badge variant="outline">{visit.status.replaceAll("-", " ").replaceAll("_", " ")}</Badge></div>{actions(visit)}</Card>)}</div>
      {!visits.length && <p className="py-6 text-center text-sm text-text-muted">No visits match this view.</p>}
      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
    </>}
    <div className="flex flex-wrap gap-4 text-sm"><Button variant="ghost" onClick={onDetailedView}>Detailed consultation list</Button><Link href="/dashboard/queue" className="inline-flex min-h-11 items-center text-accent">Full queue controls</Link><Link href="/dashboard/appointments" className="inline-flex min-h-11 items-center text-accent">Scheduling</Link>{canPay && <Link href="/dashboard/billing" className="inline-flex min-h-11 items-center text-accent">Billing and receipts</Link>}</div>
    <PatientEntryModal open={add} onClose={() => setAdd(false)} clinicId={clinicId} onBooked={() => { setAdd(false); void load(); }} onFullRegistration={() => router.push("/dashboard/appointments")} />
    {paymentVisit && <VisitInvoices appointmentId={paymentVisit.id} patientName={patientName(paymentVisit.patientId)} clinicId={clinicId} onClose={() => setPaymentVisit(null)} onPaid={() => { void load(); }} />}
  </div>;
}
