"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import PlatformOwnerDashboard from "@/components/dashboard/PlatformOwnerDashboard";
import { PharmacyHome } from "@/components/pharmacy/PharmacyHome";
import { isPharmacyWorkspace } from "@/lib/workspaceProfile";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import { localDateKey, todayRangeParams } from "@/lib/date";
import { Alert, Button, useToast } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { RotateCw, Plus, CalendarPlus } from "lucide-react";
import styles from "@/components/dashboard/DashboardOverview.module.css";
import { DashboardStatCards, DashboardAnalytics, DashboardAppointmentsQueue, DashboardQuickActions, DashboardFollowUpAlerts, DashboardLocations } from "@/components/dashboard";

export default function DashboardOverview() {
  const user = useAuthStore(state => state.user);
  if (!user) return null;
  if (user.role === "root" && !user.impersonatedBy?.id) return <PlatformOwnerDashboard />;
  if (isPharmacyWorkspace(user)) return <PharmacyHome />;
  return <OperationalDashboard key={authScopeKey(user)} />;
}

function OperationalDashboard() {
  const { user } = useAuthStore();
  const { locations: locationsList, fetchLocations } = useLocationStore();
  const router = useRouter();
  const { toast } = useToast();
  const isConsumer = user?.role === "patient" || user?.role === "family_member";
  const canReadStaff = hasAnyPermission(user, "VIEW_STAFF");
  const canReadLocations = hasAnyPermission(user, "VIEW_LOCATIONS");
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
          api.get(dailyPath, { signal: request.signal }), canReadLocations ? fetchLocations() : Promise.resolve(null),
        ]);
        if (!request.isCurrent()) return;
        if (dailyRes.status !== 'fulfilled') throw new Error('Daily summary unavailable');
        const daily = dailyRes.value.data.data;
        const staff = staffRes.status === 'fulfilled' ? staffRes.value?.data.data : null;
        const invoiceList = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data.data || [] : [];
        setAdminStats({ locations: daily.locationCount ?? (locationsRes.status === 'fulfilled' ? locationsRes.value?.length || 0 : 0),
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
  }, [beginRead, canReadAppointments, canReadBilling, canReadLocations, canReadStaff, canViewOpsDashboard, fetchLocations, isConsumer, trendRange, user]);

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
      ? "Today's appointments, collections and location activity."
      : user.role === "doctor"
      ? "Your patient queue and consultation schedule."
      : user.role === "receptionist"
      ? "Registration, check-ins and today's queue."
      : "Your appointments, care reminders and bills.";

  return (
    <div className={styles.workspace}>
      {loadError && <Alert variant="error" action={<Button variant="outline" onClick={fetchDashboardData}>Try again</Button>}>{loadError}</Alert>}
      <header className={styles.header}>
        <div><h1>Welcome back, {cleanUserName}</h1><p>{roleBadgeLabel} · {subtitleText}</p></div>
        <div className={styles.headerActions}>
          {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && <Button size="sm" aria-label="Book: New Booking" className={styles.primaryAction} onClick={() => router.push("/dashboard/appointments")}><Plus className="h-4 w-4" /><span className={styles.wideLabel}>New Booking</span><span className={styles.shortLabel}>Book</span></Button>}
          {isConsumer && <Button size="sm" aria-label="Book Consultation" className={styles.primaryAction} onClick={() => router.push("/browse")}><CalendarPlus className="h-4 w-4" /><span className={styles.wideLabel}>Book Consultation</span><span className={styles.shortLabel}>Book</span></Button>}
          <Button variant="outline" size="sm" aria-label="Refresh" className={styles.iconAction} onClick={fetchDashboardData} disabled={isRefreshing} loading={isRefreshing}><RotateCw className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* 1.5 FIRST-TIME SETUP CHECKLIST (shown only for fresh tenant practices, NEVER for Root) */}
      {canViewOpsDashboard && canManageOrg && canReadStaff && !loadError &&
        !loading &&
        adminStats.doctors + adminStats.receptionists === 0 &&
        !setupDismissed && (
          <section className={styles.setup}>
            <div className={styles.setupHeading}><div><h2>Welcome to your practice!</h2><p>Complete these steps to start seeing patients.</p></div><Button variant="ghost" size="sm" onClick={() => { setSetupDismissed(true); try { localStorage.setItem("anant_setup_dismissed", "1"); } catch {} }}>Dismiss</Button></div>
            <ol className="mt-4 grid gap-2 text-xs text-text-secondary"><li>1. Practice profile created</li><li>2. Add your first team member</li><li>3. Set up schedule &amp; availability</li><li>4. Book your first appointment</li></ol>
            <div className={styles.setupActions}><Button size="sm" onClick={() => router.push("/dashboard/staff")}><Plus className="h-4 w-4" />Add Team Member</Button><Button variant="outline" size="sm" onClick={() => router.push("/dashboard/settings")}>Configure Practice</Button></div>
          </section>
        )}

      {/* 2. PATIENT MEDICAL FOLLOW-UP ALERTS */}
      {user.role === "patient" && (
        <DashboardFollowUpAlerts alerts={recommendedFollowUps} />
      )}

      {/* 3. METRICS & KPI CARDS */}
      {!loadError && <h2 className="sr-only">Practice summary</h2>}
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

      {/* 5. MAIN SECTION (APPOINTMENTS QUEUE + QUICK ACTIONS) */}
      <div className={styles.operationsGrid}>
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

      {/* 4. PURPOSEFUL CLINICAL & OPERATIONAL ANALYTICS */}
      {!loadError && !isConsumer && <DashboardAnalytics
        role={user.role}
        showLocationActivity={canReadLocations}
        loading={loading}
        trendRange={trendRange}
        setTrendRange={setTrendRange}
        appointmentTrendData={appointmentTrendData}
        locationThroughputData={locationThroughputData}
      />}

      {/* 6. LOCATION LOCATIONS OVERVIEW GRID (FOR ROOT & ADMINS) */}
      <DashboardLocations
        canManageOrg={canManageOrg}
        locations={locationsList}
      />
    </div>
  );
}
