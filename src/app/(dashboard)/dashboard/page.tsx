"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  Table,
  Button,
  Dropdown,
  useToast,
  SkeletonCard,
  ChartContainer,
  AreaChart,
  BarChart,
} from "@/components/ui";
import { useModuleStore } from "@/store/moduleStore";
import {
  RotateCw,
  Plus,
  ArrowRight,
  ArrowUpRight,
  IndianRupee,
  AlertCircle,
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  XCircle,
  FileText,
  Receipt,
  ShieldCheck,
  CalendarPlus,
  Stethoscope,
  ChevronRight,
  UserCheck,
  CalendarClock,
  ListOrdered,
  MapPin,
  CalendarX2,
  MoreHorizontal,
} from "lucide-react";

export default function DashboardOverview() {
  const { user } = useAuthStore();
  const { clinics: clinicsList, fetchClinics } = useClinicStore();
  const { isModuleEnabled } = useModuleStore();
  const router = useRouter();
  const { toast } = useToast();

  const canViewOpsDashboard = hasAnyPermission(
    user,
    "MANAGE_APPOINTMENTS",
    "VIEW_APPOINTMENTS",
    "MANAGE_BILLING",
    "VIEW_BILLING",
    "MANAGE_CLINICS",
    "VIEW_CLINICS"
  );
  const canManageOrg = hasAnyPermission(user, "MANAGE_ORGANIZATION");

  const [adminStats, setAdminStats] = useState({
    clinics: 0,
    doctors: 0,
    receptionists: 0,
    appointments: 0,
    collections: 0,
    outstanding: 0,
  });
  const [doctorStats, setDoctorStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [patientStats, setPatientStats] = useState({ appointmentsCount: 0, unpaidBills: 0 });

  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trendRange, setTrendRange] = useState<string>("7D");

  // Purposeful Analytics: Patient volume trajectory over 7D/30D
  const appointmentTrendData = useMemo(() => {
    if (appointments.length === 0) return [];
    const daysCount = trendRange === "30D" ? 30 : 7;
    const now = new Date();
    const result = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: daysCount > 7 ? "numeric" : undefined,
        day: "numeric",
      });

      const dayAppts = appointments.filter((a) => {
        const aDate = (a.appointmentTime || a.createdAt || "").split("T")[0];
        return aDate === dateKey;
      });

      const completed = dayAppts.filter((a) => a.status === "completed").length;
      const scheduled = dayAppts.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
      const cancelled = dayAppts.filter((a) => a.status === "cancelled").length;

      result.push({
        label,
        completed,
        scheduled,
        cancelled,
      });
    }
    return result;
  }, [appointments, trendRange]);

  // Purposeful Analytics: Clinic branch throughput breakdown
  const clinicThroughputData = useMemo(() => {
    if (clinicsList.length === 0) return [];
    return clinicsList.slice(0, 5).map((cl) => {
      const clAppts = appointments.filter(
        (a) => a.clinicId?.id === cl.id || a.clinicId === cl.id || a.clinicId?._id === cl.id
      );
      const completed = clAppts.filter((a) => a.status === "completed").length;
      const waiting = clAppts.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
      return {
        label: cl.name.length > 14 ? cl.name.substring(0, 12) + "..." : cl.name,
        completed,
        waiting,
      };
    });
  }, [clinicsList, appointments]);

  // Update appointment status inline
  const handleUpdateStatus = async (apptId: string, status: string) => {
    try {
      await api.put(`/appointments/${apptId}/status`, { status });
      toast({
        title: "Status Updated",
        description: `Appointment status set to ${status.replace("-", " ")}.`,
        variant: "success",
      });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update appointment status.",
        variant: "error",
      });
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setIsRefreshing(true);
      if (canViewOpsDashboard) {
        const [staffRes, apptsRes, invoicesRes] = await Promise.allSettled([
          api.get("/onboarding/staff"),
          api.get("/appointments"),
          api.get("/invoices"),
        ]);
        const clList = await fetchClinics();
        const staffData = staffRes.status === "fulfilled" ? staffRes.value.data.data || {} : {};
        const docList = staffData.doctors || [];
        const recList = staffData.receptionists || [];
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];
        const invList = invoicesRes.status === "fulfilled" ? invoicesRes.value.data.data || [] : [];

        const todayStr = new Date().toISOString().split("T")[0];
        const todaysPaid = invList.reduce((acc: number, curr: any) => {
          if (curr.status !== "paid") return acc;
          const dateStr = (curr.paymentDate || curr.createdAt || "").split("T")[0];
          return dateStr === todayStr ? acc + curr.totalAmount : acc;
        }, 0);

        const unpaid = invList.reduce((acc: number, curr: any) => {
          return curr.status === "unpaid" ? acc + curr.totalAmount : acc;
        }, 0);

        setAdminStats({
          clinics: clList.length,
          doctors: docList.length,
          receptionists: recList.length,
          appointments: apptList.length,
          collections: todaysPaid,
          outstanding: unpaid,
        });

        setAppointments(apptList);
        setInvoices(invList);
      } else if (user.role === "doctor") {
        const [apptsRes] = await Promise.allSettled([api.get("/appointments")]);
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];

        const total = apptList.length;
        const completed = apptList.filter((a: any) => a.status === "completed").length;
        const pending = apptList.filter((a: any) => a.status !== "completed" && a.status !== "cancelled").length;

        setDoctorStats({ total, completed, pending });
        setAppointments(apptList);
      } else if (user.role === "patient") {
        const [apptsRes, invoicesRes] = await Promise.allSettled([
          api.get("/appointments"),
          api.get("/invoices"),
        ]);
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];
        const invList = invoicesRes.status === "fulfilled" ? invoicesRes.value.data.data || [] : [];

        const unpaidCount = invList
          .filter((i: any) => i.status === "unpaid")
          .reduce((acc: number, c: any) => acc + c.totalAmount, 0);

        setPatientStats({
          appointmentsCount: apptList.filter((a: any) => a.status !== "cancelled").length,
          unpaidBills: unpaidCount,
        });
        setAppointments(apptList);
        setInvoices(invList.filter((i: any) => i.status === "unpaid"));
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user?.id, user?.role]);

  const recommendedFollowUps = useMemo(() => {
    return appointments.filter((appt) => {
      if (appt.status !== "completed" || !appt.followUpRecommended) return false;
      const isAlreadyBooked = appointments.some(
        (a) => a.followUpForAppointmentId === appt.id && a.status !== "cancelled"
      );
      return !isAlreadyBooked;
    });
  }, [appointments]);

  if (!user) return null;

  // Clean user display name
  const cleanUserName = user.name.replace(/\s*\([^)]*\)/g, "");

  const roleBadgeLabel =
    user.role === "root"
      ? "Super-Admin"
      : user.role === "admin"
      ? "Org Admin"
      : user.role === "doctor"
      ? "Physician"
      : user.role === "receptionist"
      ? "Front Desk"
      : "Patient";

  const subtitleText =
    user.role === "root" || user.role === "admin"
      ? "Operational metrics, multi-branch activity, and clinical throughput."
      : user.role === "doctor"
      ? "Your daily patient queue, consultation schedule, and roster."
      : user.role === "receptionist"
      ? "Outpatient registration, patient check-ins, and daily queues."
      : "Your medical appointments, care recommendations, and invoices.";

  return (
    <div className="space-y-6 font-sans text-text antialiased animate-fade-up">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Welcome back, {cleanUserName}
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                {roleBadgeLabel}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              {subtitleText}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/dashboard/appointments")}
                className="rounded-xl text-xs font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Booking
              </Button>
            )}

            {user.role === "patient" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/browse")}
                className="rounded-xl text-xs font-semibold shadow-xs"
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                Book Consultation
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          1.5 PATIENT MEDICAL FOLLOW-UP ALERTS
         ────────────────────────────────────────────────────────────────────────── */}
      {user.role === "patient" && recommendedFollowUps.length > 0 && (
        <div className="space-y-3">
          {recommendedFollowUps.map((appt) => (
            <div
              key={appt.id}
              className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.06] p-4 sm:p-5 shadow-xs"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="warning" size="sm" className="font-bold uppercase tracking-wider text-[10px]">
                        Clinical Recommendation
                      </Badge>
                      <span className="text-xs text-text-muted font-medium">
                        Due within {appt.followUpTimeline || "2 weeks"}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-text">
                      Follow-Up Consultation with Dr. {appt.doctorId?.name || "Specialist"}
                    </h3>
                    <p className="text-xs text-text-secondary">
                      Recommended at <span className="font-semibold text-text">{appt.clinicId?.name || "Clinic"}</span> following your consultation on{" "}
                      {new Date(appt.appointmentTime).toLocaleDateString(undefined, { dateStyle: "medium" })}.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const clinicId = appt.clinicId?.id || appt.clinicId;
                    const doctorId = appt.doctorId?.id || appt.doctorId;
                    router.push(
                      `/browse/${clinicId}?doctorId=${doctorId}&followUp=true&prevAppointmentId=${appt.id}`
                    );
                  }}
                  className="rounded-xl font-semibold text-xs shrink-0 self-start md:self-center"
                >
                  Schedule Now
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          2. METRICS & KPI CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      {canViewOpsDashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Today's Collections"
                value={`₹${adminStats.collections.toLocaleString("en-IN")}`}
                description="Settled invoices today"
                icon={<IndianRupee className="w-5 h-5" />}
              />
              <StatCard
                label="Outstanding Balances"
                value={`₹${adminStats.outstanding.toLocaleString("en-IN")}`}
                description="Unpaid pending bills"
                icon={<AlertCircle className="w-5 h-5" />}
              />
              <StatCard
                label="Active Clinics"
                value={adminStats.clinics.toString()}
                description="Operational branches"
                icon={<Building2 className="w-5 h-5" />}
              />
              <StatCard
                label="Active Doctors"
                value={adminStats.doctors.toString()}
                description="On-duty specialists"
                icon={<Stethoscope className="w-5 h-5" />}
              />
            </>
          )}
        </div>
      )}

      {/* DOCTOR CLINICAL METRICS */}
      {user.role === "doctor" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Total Consultations"
                value={doctorStats.total.toString()}
                description="Scheduled visits recorded"
                icon={<Calendar className="w-5 h-5" />}
              />
              <StatCard
                label="Pending Queue"
                value={doctorStats.pending.toString()}
                description="Awaiting consultation"
                icon={<Clock className="w-5 h-5" />}
              />
              <StatCard
                label="Completed Visits"
                value={doctorStats.completed.toString()}
                description="Concluded consultations"
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
            </>
          )}
        </div>
      )}

      {/* PATIENT CARE METRICS */}
      {user.role === "patient" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Scheduled Visits"
                value={patientStats.appointmentsCount.toString()}
                description="Active upcoming bookings"
                icon={<Calendar className="w-5 h-5" />}
              />
              <StatCard
                label="Unpaid Balance"
                value={`₹${patientStats.unpaidBills.toLocaleString("en-IN")}`}
                description="Pending invoices due"
                icon={<Receipt className="w-5 h-5" />}
              />
            </>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. PURPOSEFUL CLINICAL & OPERATIONAL ANALYTICS
         ────────────────────────────────────────────────────────────────────────── */}
      {user.role !== "patient" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartContainer
            title="Patient Volume Trajectory"
            description="Daily completed and scheduled consultations"
            className="lg:col-span-2"
            timeRanges={[
              { label: "Last 7 Days", value: "7D" },
              { label: "Last 30 Days", value: "30D" },
            ]}
            activeRange={trendRange}
            onRangeChange={setTrendRange}
            loading={loading}
            empty={
              appointmentTrendData.length === 0 ||
              appointmentTrendData.every((d) => d.completed === 0 && d.scheduled === 0 && d.cancelled === 0)
            }
            emptyMessage="No patient consultations recorded for this period."
          >
            <AreaChart
              data={appointmentTrendData}
              series={[
                { key: "completed", name: "Completed Visits", color: "var(--s-chart-2, #10b981)" },
                { key: "scheduled", name: "Scheduled", color: "var(--s-chart-1, #3b82f6)" },
                { key: "cancelled", name: "Cancelled", color: "var(--s-chart-5, #f43f5e)" },
              ]}
              height={220}
              valueFormatter={(v) => `${v} visits`}
            />
          </ChartContainer>

          <ChartContainer
            title="Clinic Branch Throughput"
            description="Visits distributed by clinic branch"
            className="lg:col-span-1"
            loading={loading}
            empty={
              clinicThroughputData.length === 0 ||
              clinicThroughputData.every((d) => d.completed === 0 && d.waiting === 0)
            }
            emptyMessage="No branch throughput records."
          >
            <BarChart
              data={clinicThroughputData}
              series={[
                { key: "completed", name: "Completed", color: "var(--s-chart-2, #10b981)" },
                { key: "waiting", name: "Scheduled", color: "var(--s-chart-1, #3b82f6)" },
              ]}
              layout="stacked"
              height={220}
              valueFormatter={(v) => `${v}`}
            />
          </ChartContainer>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. MAIN SECTION (APPOINTMENTS QUEUE + QUICK ACTIONS)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left 2 Columns: Live Appointments Queue Table */}
        <Card className="lg:col-span-2 rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-sm sm:text-base font-bold text-text">
                {canViewOpsDashboard
                  ? "Live Appointments Queue"
                  : user.role === "doctor"
                  ? "Today's Patient Roster"
                  : "My Scheduled Appointments"}
              </CardTitle>
              {appointments.length > 0 && (
                <Badge variant="neutral" size="sm" className="font-semibold">
                  {appointments.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => router.push("/dashboard/appointments")}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 p-0 hover:bg-transparent"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-text-muted">
                <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mb-3 border border-border/70 text-text-secondary">
                  <CalendarX2 className="w-6 h-6" />
                </div>
                <p className="font-semibold text-text text-sm">No Active Bookings</p>
                <p className="text-xs text-text-muted mt-1 max-w-sm">
                  There are no scheduled consultations or queue entries recorded at this moment.
                </p>
                {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/appointments")}
                    className="mt-4 rounded-xl text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create First Appointment
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table
                  loading={loading}
                  columns={
                    user.role === "doctor"
                      ? [
                          {
                            key: "tokenNumber",
                            header: "Token",
                            width: "80px",
                            render: (row: any) => (
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                                #{String(row.tokenNumber || "—").padStart(2, "0")}
                              </span>
                            ),
                          },
                          {
                            key: "patient",
                            header: "Patient",
                            render: (row: any) => (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-surface-alt border border-border flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0">
                                  {(row.patientId?.userId?.name || "P")[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-text text-xs sm:text-sm">
                                  {row.patientId?.userId?.name || "Patient Profile"}
                                </span>
                              </div>
                            ),
                          },
                          {
                            key: "time",
                            header: "Time Slot",
                            render: (row: any) => (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span>
                                  {new Date(row.appointmentTime).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            ),
                          },
                          {
                            key: "status",
                            header: "Status",
                            render: (row: any) => (
                              <Badge
                                variant={
                                  row.status === "completed"
                                    ? "success"
                                    : row.status === "in-consultation"
                                    ? "primary"
                                    : row.status === "cancelled"
                                    ? "danger"
                                    : "warning"
                                }
                                size="sm"
                                dot
                                className="capitalize text-[11px] font-semibold"
                              >
                                {row.status.replace("-", " ")}
                              </Badge>
                            ),
                          },
                          {
                            key: "actions",
                            header: "Actions",
                            width: "90px",
                            render: (row: any) => (
                              <Dropdown
                                align="right"
                                width="w-44"
                                trigger={
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="h-7 px-2 text-xs font-semibold rounded-lg"
                                  >
                                    Update
                                    <MoreHorizontal className="w-3.5 h-3.5 ml-1" />
                                  </Button>
                                }
                                items={[
                                  {
                                    label: "Check-In",
                                    icon: <UserCheck className="w-4 h-4 text-primary-500" />,
                                    onClick: () => handleUpdateStatus(row.id, "checked-in"),
                                  },
                                  {
                                    label: "In Consultation",
                                    icon: <PlayCircle className="w-4 h-4 text-sky-500" />,
                                    onClick: () => handleUpdateStatus(row.id, "in-consultation"),
                                  },
                                  {
                                    label: "Complete Visit",
                                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                                    onClick: () => handleUpdateStatus(row.id, "completed"),
                                  },
                                  { divider: true, label: "" },
                                  {
                                    label: "Cancel Visit",
                                    icon: <XCircle className="w-4 h-4 text-danger" />,
                                    onClick: () => handleUpdateStatus(row.id, "cancelled"),
                                    danger: true,
                                  },
                                ]}
                              />
                            ),
                          },
                        ]
                      : [
                          {
                            key: "tokenNumber",
                            header: "Token",
                            width: "80px",
                            render: (row: any) => (
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                                #{String(row.tokenNumber || "—").padStart(2, "0")}
                              </span>
                            ),
                          },
                          {
                            key: "patient",
                            header: "Patient",
                            render: (row: any) => (
                              <span className="font-semibold text-text text-xs sm:text-sm">
                                {row.patientId?.userId?.name || "Self"}
                              </span>
                            ),
                          },
                          {
                            key: "doctor",
                            header: "Doctor",
                            render: (row: any) => (
                              <div className="flex items-center gap-1 text-xs text-text-secondary">
                                <Stethoscope className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span>Dr. {row.doctorId?.name || "Physician"}</span>
                              </div>
                            ),
                          },
                          {
                            key: "time",
                            header: "Date & Time",
                            render: (row: any) => (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span>
                                  {new Date(row.appointmentTime).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                  ,{" "}
                                  {new Date(row.appointmentTime).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            ),
                          },
                          {
                            key: "status",
                            header: "Status",
                            render: (row: any) => (
                              <Badge
                                variant={
                                  row.status === "completed"
                                    ? "success"
                                    : row.status === "in-consultation"
                                    ? "primary"
                                    : row.status === "cancelled"
                                    ? "danger"
                                    : "warning"
                                }
                                size="sm"
                                dot
                                className="capitalize text-[11px] font-semibold"
                              >
                                {row.status.replace("-", " ")}
                              </Badge>
                            ),
                          },
                        ]
                  }
                  data={appointments.slice(0, 5)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Role Quick Operations / Unpaid Bills */}
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm sm:text-base font-bold text-text">
              {user.role === "patient" ? "Unpaid Invoices" : "Quick Operations"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {user.role === "patient" ? (
              invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted">
                  <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center mb-2 border border-border/70 text-emerald-500">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-text text-xs">All Invoices Settled</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Zero outstanding medical balance.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border border-border/80 bg-surface-alt rounded-xl hover:border-primary-500/30 transition-all gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-text truncate">
                          Invoice #{inv.invoiceNumber || inv.id?.substring(0, 8)}
                        </p>
                        <p className="text-sm font-bold text-text tabular-nums">
                          ₹{inv.totalAmount?.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => router.push("/dashboard/bills")}
                        className="rounded-lg font-semibold text-xs shrink-0"
                      >
                        Pay Online
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2">
                {canViewOpsDashboard && (
                  <>
                    {user.role === "root" && (
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/organizations")}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                              Platform Organizations
                            </span>
                            <span className="text-[10px] text-text-muted block truncate">
                              Manage SaaS tenants & accounts
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/staff")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Staff & Clinicians
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Manage doctors, nurses, and staff
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/clinics")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Clinic Branches
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Multi-facility branch locations
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/audit")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            System Audit Logs
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            HIPAA compliance & activity trail
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  </>
                )}

                {user.role === "receptionist" && (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/queue")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <ListOrdered className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Outpatient Queue Desk
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Live tokens & patient check-ins
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/appointments")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <CalendarPlus className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Schedule Appointment
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Register new visit booking
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  </>
                )}

                {user.role === "doctor" && (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/queue")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <ListOrdered className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Consultation Queue
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Next patients in waiting line
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/patients")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                            Patient Medical Records
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            EMR histories & clinical summaries
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. CLINIC LOCATIONS OVERVIEW GRID (FOR ROOT & ADMINS)
         ────────────────────────────────────────────────────────────────────────── */}
      {canManageOrg && clinicsList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text">Active Clinic Facilities</h2>
              <p className="text-xs text-text-muted">Connected healthcare centers and branch network</p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => router.push("/dashboard/clinics")}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 p-0 hover:bg-transparent"
            >
              Manage Clinics
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {clinicsList.map((cl) => (
              <Card
                key={cl.id}
                onClick={() => router.push("/dashboard/clinics")}
                className="group cursor-pointer hover:shadow-md hover:border-primary-500/40 transition-all duration-200 p-4 rounded-2xl border border-border/80 bg-surface flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 dark:text-primary-400 group-hover:bg-primary-500/15 transition-colors">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                        {cl.name}
                      </h3>
                      <p className="text-xs text-text-muted truncate">{cl.city || "Main Facility"}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors shrink-0" />
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary pt-2.5 border-t border-border/60">
                  <span className="truncate text-text-muted">{cl.address || "Main Branch Location"}</span>
                  <Badge variant="success" size="sm" dot className="font-semibold shrink-0">
                    Active
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
