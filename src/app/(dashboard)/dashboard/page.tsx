"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import PlatformOwnerDashboard from "@/components/dashboard/PlatformOwnerDashboard";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import { localDateKey, todayRangeParams } from "@/lib/date";
import { Alert, Badge, Button, useToast } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { RotateCw, Plus, CalendarPlus } from "lucide-react";
import { DashboardStatCards, DashboardAnalytics, DashboardAppointmentsQueue, DashboardQuickActions, DashboardFollowUpAlerts, DashboardLocations } from "@/components/dashboard";

export default function DashboardOverview() {
  const user = useAuthStore(state => state.user);
  if (!user) return null;
  if (user.role === "root" && !user.impersonatedBy?.id) return <PlatformOwnerDashboard />;
  return <OperationalDashboard key={authScopeKey(user)} />;
}

function OperationalDashboard() {
  const { user } = useAuthStore();
  const { locations: locationsList, fetchLocations } = useLocationStore();
  const router = useRouter();
  const { toast } = useToast();
  const isConsumer = user?.role === "patient" || user?.role === "family_member";
  const canReadStaff = hasAnyPermission(user, "VIEW_STAFF");
  const canReadAppointments = hasAnyPermission(user, "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS");
  const canReadBilling = hasAnyPermission(user, "VIEW_BILLING", "MANAGE_BILLING");
  const beginRead = useLatestRead();
  const [loadError, setLoadError] = useState("");
  const [financialVisible, setFinancialVisible] = useState(false);
  const [moneyByCurrency, setMoneyByCurrency] = useState<Array<{ currency: string; collections: number; outstanding: number }>>([]);
  const [trends, setTrends] = useState<{ days: Array<{ day: string; status: string; count: number }>; locations: Array<{ locationId: string; status: string; count: number }> } | null>(null);

  const canViewOpsDashboard =
    !isConsumer &&
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
    if (!trends) return [];
    const daysCount = trendRange === "30D" ? 30 : 7;
    const now = new Date();
    const result = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = localDateKey(d);
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: daysCount > 7 ? "numeric" : undefined,
        day: "numeric",
      });

      const rows = trends.days.filter(row => row.day === dateKey);
      const completed = rows.filter(row => row.status === "completed").reduce((sum, row) => sum + row.count, 0);
      const scheduled = rows.filter(row => !["completed", "cancelled", "no-show"].includes(row.status)).reduce((sum, row) => sum + row.count, 0);
      const cancelled = rows.filter(row => row.status === "cancelled").reduce((sum, row) => sum + row.count, 0);

      result.push({
        label,
        completed,
        scheduled,
        cancelled,
      });
    }
    return result;
  }, [trends, trendRange]);

  // Purposeful Analytics: Location branch throughput breakdown
  const locationThroughputData = useMemo(() => {
    if (locationsList.length === 0) return [];
    return locationsList.slice(0, 5).map((cl) => {
      const rows = trends?.locations.filter(row => row.locationId === cl.id) || [];
      const completed = rows.filter(row => row.status === "completed").reduce((sum, row) => sum + row.count, 0);
      const waiting = rows.filter(row => !["completed", "cancelled", "no-show"].includes(row.status)).reduce((sum, row) => sum + row.count, 0);
      return {
        label: cl.name.length > 14 ? cl.name.substring(0, 12) + "..." : cl.name,
        completed,
        waiting,
      };
    });
  }, [locationsList, trends]);

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

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    const request = beginRead();
    setIsRefreshing(true); setLoadError('');
    try {
      if (canViewOpsDashboard || user.role === 'doctor') {
        const dailyPath = '/analytics/daily-summary?' + todayRangeParams() + '&trendDays=' + (trendRange === '30D' ? '30' : '7') + '&timezone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
        const [staffRes, invoicesRes, dailyRes, locationsRes] = await Promise.allSettled([
          canReadStaff && canViewOpsDashboard ? api.get('/onboarding/staff', { signal: request.signal }) : Promise.resolve(null),
          canReadBilling && canViewOpsDashboard ? api.get('/invoices?limit=5', { signal: request.signal }) : Promise.resolve(null),
          api.get(dailyPath, { signal: request.signal }), fetchLocations(),
        ]);
        if (!request.isCurrent()) return;
        if (dailyRes.status !== 'fulfilled') throw new Error('Daily summary unavailable');
        const daily = dailyRes.value.data.data;
        const staff = staffRes.status === 'fulfilled' ? staffRes.value?.data.data : null;
        const invoiceList = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data.data || [] : [];
        setAdminStats({ locations: locationsRes.status === 'fulfilled' ? locationsRes.value?.length || 0 : 0,
          doctors: staff?.doctors?.length || 0, receptionists: staff?.receptionists?.length || 0,
          appointments: daily.appointments, collections: daily.collections, outstanding: daily.outstanding });
        setFinancialVisible(Boolean(daily.financialVisible && canReadBilling));
        setMoneyByCurrency(daily.moneyByCurrency || []);
        setTrends(daily.trends || null);
        setDoctorStats({ total: daily.appointments, completed: daily.completed, pending: daily.pending });
        setTodayAppointments(canReadAppointments ? daily.recentAppointments || [] : []);
        setAppointments([]);
        setInvoices(invoiceList.filter((invoice: any) => ['unpaid', 'partially_paid'].includes(invoice.status)));
        if ([staffRes, invoicesRes, locationsRes].some(result => result.status === 'rejected')) setLoadError('Some dashboard details could not be loaded. Refresh to retry.');
      } else if (isConsumer) {
        const [visits, unpaid, partial] = await Promise.all([
          api.get('/appointments/patient/me?limit=5', { signal: request.signal }),
          api.get('/invoices/patient/me?status=unpaid&limit=5', { signal: request.signal }),
          api.get('/invoices/patient/me?status=partially_paid&limit=5', { signal: request.signal }),
        ]);
        if (!request.isCurrent()) return;
        setPatientStats({ appointmentsCount: Number(visits.headers?.['x-total-count']) || visits.data.data?.length || 0,
          unpaidBills: (Number(unpaid.headers?.['x-total-count']) || unpaid.data.data?.length || 0) + (Number(partial.headers?.['x-total-count']) || partial.data.data?.length || 0) });
        setAppointments(visits.data.data || []);
        setInvoices([...(unpaid.data.data || []), ...(partial.data.data || [])]);
      }
    } catch {
      if (!request.isCurrent()) return;
      setLoadError('Dashboard information could not be loaded. Refresh to retry.');
      setAppointments([]); setTodayAppointments([]); setInvoices([]); setTrends(null); setFinancialVisible(false);
    } finally { if (request.isCurrent()) { setLoading(false); setIsRefreshing(false); } }
  }, [beginRead, canReadAppointments, canReadBilling, canReadStaff, canViewOpsDashboard, fetchLocations, isConsumer, trendRange, user]);

  useEffect(() => {
    void fetchDashboardData();
    return () => { beginRead(); };
  }, [fetchDashboardData, beginRead]);

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
      : isConsumer ? (user.role === "family_member" ? "Family member" : "Patient") : user.role.replaceAll("_", " ");

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
      {loadError && <Alert variant="error" action={<Button variant="outline" onClick={fetchDashboardData}>Try again</Button>}>{loadError}</Alert>}
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
              className="text-xs font-semibold transition-colors flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
             loading={isRefreshing}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary " />
              Refresh
            </Button>

            {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/dashboard/appointments")}
                className="text-xs font-semibold flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Booking
              </Button>
            )}

            {isConsumer && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/browse")}
                className="text-xs font-semibold flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                Book Consultation
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 FIRST-TIME SETUP CHECKLIST (shown only for fresh tenant practices, NEVER for Root) */}
      {canViewOpsDashboard && canManageOrg && canReadStaff && !loadError &&
        !loading &&
        adminStats.doctors + adminStats.receptionists === 0 &&
        !setupDismissed && (
          <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5 sm:p-6 shadow-xs animate-fade-in">
            <Button type="button" onClick={() => {
                setSetupDismissed(true);
                try {
                  localStorage.setItem("anant_setup_dismissed", "1");
                } catch {}
              }} variant="ghost" size="xs" className="absolute top-3 right-3">
              Dismiss
            </Button>

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
                  className="text-xs font-semibold min-h-[36px]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Team Member
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/settings")}
                  className="text-xs font-semibold min-h-[36px]"
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
      {!loadError && <DashboardStatCards
        role={user.role}
        canViewOpsDashboard={canViewOpsDashboard}
        loading={loading}
        adminStats={adminStats}
        doctorStats={doctorStats}
        patientStats={patientStats}
        financialVisible={financialVisible}
        moneyByCurrency={moneyByCurrency}
        showStaffCounts={canReadStaff}
      />}

      {/* 4. PURPOSEFUL CLINICAL & OPERATIONAL ANALYTICS */}
      {!loadError && !isConsumer && <DashboardAnalytics
        role={user.role}
        loading={loading}
        trendRange={trendRange}
        setTrendRange={setTrendRange}
        appointmentTrendData={appointmentTrendData}
        locationThroughputData={locationThroughputData}
      />}

      {/* 5. MAIN SECTION (APPOINTMENTS QUEUE + QUICK ACTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {!loadError && (canReadAppointments || isConsumer) && <DashboardAppointmentsQueue
          appointments={user?.role === "patient" || user?.role === "family_member" ? appointments : todayAppointments}
          loading={loading}
          user={user}
          canViewOpsDashboard={canViewOpsDashboard}
          onUpdateStatus={handleUpdateStatus}
        />}
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
