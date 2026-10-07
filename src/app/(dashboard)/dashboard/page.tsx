"use client";

import { useEffect, useState, useMemo } from "react";
import PlatformOwnerDashboard from "@/components/dashboard/PlatformOwnerDashboard";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import { localDateKey, todayRangeParams } from "@/lib/date";
import { Badge, Button, useToast } from "@/components/ui";
import { RotateCw, Plus, CalendarPlus } from "lucide-react";
import { DashboardStatCards, DashboardAnalytics, DashboardAppointmentsQueue, DashboardQuickActions, DashboardFollowUpAlerts, DashboardLocations } from "@/components/dashboard";

export default function DashboardOverview() {
  const user = useAuthStore(state => state.user);
  if (!user) return null;
  if (user.role === "root" && !user.impersonatedBy?.id) return <PlatformOwnerDashboard />;
  return <OperationalDashboard />;
}

function OperationalDashboard() {
  const { user } = useAuthStore();
  const { locations: locationsList, fetchLocations } = useLocationStore();
  const router = useRouter();
  const { toast } = useToast();

  const canViewOpsDashboard =
    user?.role !== "patient" &&
    user?.role !== "doctor" &&
    hasAnyPermission(
      user,
      "MANAGE_APPOINTMENTS",
      "VIEW_APPOINTMENTS",
      "MANAGE_BILLING",
      "VIEW_BILLING",
      "MANAGE_LOCATIONS",
      "VIEW_LOCATIONS"
    );
  const canManageOrg = hasAnyPermission(user, "MANAGE_ORGANIZATION");

  const [adminStats, setAdminStats] = useState({
    locations: 0,
    doctors: 0,
    receptionists: 0,
    appointments: 0,
    collections: 0,
    outstanding: 0,
  });
  const [doctorStats, setDoctorStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [patientStats, setPatientStats] = useState({ appointmentsCount: 0, unpaidBills: 0 });

  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trendRange, setTrendRange] = useState<string>("7D");
  const [setupDismissed, setSetupDismissed] = useState(() => {
    try {
      return localStorage.getItem("anant_setup_dismissed") === "1";
    } catch {
      return false;
    }
  });

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

  // Purposeful Analytics: Location branch throughput breakdown
  const locationThroughputData = useMemo(() => {
    if (locationsList.length === 0) return [];
    return locationsList.slice(0, 5).map((cl) => {
      const clAppts = appointments.filter(
        (a) => a.locationId?.id === cl.id || a.locationId === cl.id || a.locationId?._id === cl.id
      );
      const completed = clAppts.filter((a) => a.status === "completed").length;
      const waiting = clAppts.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
      return {
        label: cl.name.length > 14 ? cl.name.substring(0, 12) + "..." : cl.name,
        completed,
        waiting,
      };
    });
  }, [locationsList, appointments]);

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
        const [staffRes, apptsRes, invoicesRes, dailyRes] = await Promise.allSettled([
          api.get("/onboarding/staff"),
          api.get("/appointments"),
          api.get("/invoices"),
          api.get(`/analytics/daily-summary?${todayRangeParams()}`),
        ]);
        const clList = await fetchLocations();
        const staffData = staffRes.status === "fulfilled" ? staffRes.value.data.data || {} : {};
        const docList = staffData.doctors || [];
        const recList = staffData.receptionists || [];
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];
        const invList = invoicesRes.status === "fulfilled" ? invoicesRes.value.data.data || [] : [];

        const daily = dailyRes.status === "fulfilled" ? dailyRes.value.data.data : null;
        const todayStr = localDateKey();
        const todaysPaid = invList.reduce((acc: number, curr: any) => {
          if (curr.status !== "paid") return acc;
          const dateStr = localDateKey(curr.paymentDate || curr.createdAt || "");
          return dateStr === todayStr ? acc + curr.totalAmount : acc;
        }, 0);

        const unpaidBills = invList.reduce((acc: number, curr: any) => {
          if (localDateKey(curr.createdAt || "") !== todayStr || curr.status === "paid" || curr.status === "cancelled") return acc;
          return acc + (curr.totalAmount - (curr.amountPaid || 0));
        }, 0);

        setAdminStats({
          locations: clList?.length || 0,
          doctors: docList.length,
          receptionists: recList.length,
          appointments: daily?.appointments ?? apptList.filter((a: any) => localDateKey(a.appointmentTime) === todayStr).length,
          collections: daily?.collections ?? todaysPaid,
          outstanding: daily?.outstanding ?? unpaidBills,
        });

        setAppointments(apptList);
        setTodayAppointments(daily?.recentAppointments || apptList.filter((a: any) => localDateKey(a.appointmentTime) === todayStr));
        setInvoices(invList.filter((i: any) => ["unpaid", "partially_paid"].includes(i.status) && localDateKey(i.createdAt || "") === todayStr));
      } else if (user.role === "doctor") {
        const [res, dailyRes] = await Promise.all([api.get("/appointments"), api.get(`/analytics/daily-summary?${todayRangeParams()}`)]);
        const daily = dailyRes.data.data;
        const docAppts = res.data.data || [];
        const completed = docAppts.filter((a: any) => a.status === "completed").length;
        const pending = docAppts.filter(
          (a: any) => a.status === "confirmed" || a.status === "pending" || a.status === "scheduled"
        ).length;
        setDoctorStats({ total: daily.appointments, completed: daily.completed, pending: daily.pending });
        setAppointments(docAppts);
        setTodayAppointments(daily.recentAppointments || []);
      } else if (user.role === "patient") {
        const [apptsRes, invsRes] = await Promise.all([
          api.get("/appointments/patient/me").catch(() => api.get("/patient-portal/appointments").catch(() => ({ data: { data: [] } }))),
          api.get("/invoices/patient/me").catch(() => api.get("/invoices").catch(() => ({ data: { data: [] } }))),
        ]);
        const apptList = apptsRes.data.data || [];
        const invList = invsRes.data.data || [];
        const unpaidCount = invList.filter((i: any) => i.status === "unpaid").length;
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
  }, [user?.id, user?.role, user?.impersonatedBy]);

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
    user.role === "admin"
      ? "Org Admin"
      : user.role === "doctor"
      ? "Physician"
      : user.role === "receptionist"
      ? "Front Desk"
      : "Patient";

  const subtitleText =
    user.role === "admin"
      ? "Operational metrics, multi-branch activity, and clinical throughput."
      : user.role === "doctor"
      ? "Your daily patient queue, consultation schedule, and roster."
      : user.role === "receptionist"
      ? "Outpatient registration, patient check-ins, and daily queues."
      : "Your medical appointments, care recommendations, and invoices.";

  return (
    <div className="space-y-6 font-sans text-text antialiased animate-fade-up">
      {/* 1. HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="page-title">
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

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
             loading={isRefreshing}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary " />
              Refresh
            </Button>

            {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/dashboard/appointments")}
                className="rounded-xl text-xs font-semibold shadow-xs flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
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
                className="rounded-xl text-xs font-semibold shadow-xs flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                Book Consultation
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 FIRST-TIME SETUP CHECKLIST (shown only for fresh tenant practices, NEVER for Root) */}
      {canViewOpsDashboard &&
        !loading &&
        adminStats.doctors + adminStats.receptionists === 0 &&
        !setupDismissed && (
          <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5 sm:p-6 shadow-xs animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setSetupDismissed(true);
                try {
                  localStorage.setItem("anant_setup_dismissed", "1");
                } catch {}
              }}
              className="absolute top-3 right-3 text-text-muted hover:text-text text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>

            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  🎉 Welcome to your practice!
                </h2>
                <p className="text-xs text-text-muted">Complete these steps to start seeing patients.</p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full bg-success/15 text-success-text flex items-center justify-center text-[11px] font-bold shrink-0">
                    ✓
                  </span>
                  <span className="text-text-secondary line-through">Practice profile created</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full bg-surface-hover text-text-muted flex items-center justify-center text-[11px] font-bold shrink-0 border border-border/60">
                    2
                  </span>
                  <span className="text-text font-semibold">Add your first team member</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full bg-surface-hover text-text-muted flex items-center justify-center text-[11px] font-bold shrink-0 border border-border/60">
                    3
                  </span>
                  <span className="text-text-secondary">Set up schedule & availability</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full bg-surface-hover text-text-muted flex items-center justify-center text-[11px] font-bold shrink-0 border border-border/60">
                    4
                  </span>
                  <span className="text-text-secondary">Book your first appointment</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push("/dashboard/staff")}
                  className="rounded-xl text-xs font-semibold min-h-[36px] shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Team Member
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/settings")}
                  className="rounded-xl text-xs font-semibold min-h-[36px]"
                >
                  Configure Practice
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* 2. PATIENT MEDICAL FOLLOW-UP ALERTS */}
      {user.role === "patient" && (
        <DashboardFollowUpAlerts alerts={recommendedFollowUps} />
      )}

      {/* 3. METRICS & KPI CARDS */}
      <DashboardStatCards
        role={user.role}
        canViewOpsDashboard={canViewOpsDashboard}
        loading={loading}
        adminStats={adminStats}
        doctorStats={doctorStats}
        patientStats={patientStats}
      />

      {/* 4. PURPOSEFUL CLINICAL & OPERATIONAL ANALYTICS */}
      <DashboardAnalytics
        role={user.role}
        loading={loading}
        trendRange={trendRange}
        setTrendRange={setTrendRange}
        appointmentTrendData={appointmentTrendData}
        locationThroughputData={locationThroughputData}
      />

      {/* 5. MAIN SECTION (APPOINTMENTS QUEUE + QUICK ACTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <DashboardAppointmentsQueue
          appointments={user?.role === "patient" || user?.role === "family_member" ? appointments : todayAppointments}
          loading={loading}
          user={user}
          canViewOpsDashboard={canViewOpsDashboard}
          onUpdateStatus={handleUpdateStatus}
        />
        <DashboardQuickActions
          user={user}
          invoices={invoices}
          canViewOpsDashboard={canViewOpsDashboard}
        />
      </div>

      {/* 6. LOCATION LOCATIONS OVERVIEW GRID (FOR ROOT & ADMINS) */}
      <DashboardLocations
        canManageOrg={canManageOrg}
        locations={locationsList}
      />
    </div>
  );
}
