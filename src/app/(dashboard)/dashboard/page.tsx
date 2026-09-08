"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import { Badge, Button, useToast } from "@/components/ui";
import { useModuleStore } from "@/store/moduleStore";
import {
  RotateCw,
  Plus,
  CalendarPlus,
} from "lucide-react";
import {
  DashboardStatCards,
  DashboardAnalytics,
  DashboardAppointmentsQueue,
  DashboardQuickActions,
  DashboardFollowUpAlerts,
  DashboardClinicFacilities,
} from "@/components/dashboard";

export default function DashboardOverview() {
  const { user } = useAuthStore();
  const { clinics: clinicsList, fetchClinics } = useClinicStore();
  const { isModuleEnabled } = useModuleStore();
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
      {/* 1. HEADER BANNER */}
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
        clinicThroughputData={clinicThroughputData}
      />

      {/* 5. MAIN SECTION (APPOINTMENTS QUEUE + QUICK ACTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <DashboardAppointmentsQueue
          appointments={appointments}
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

      {/* 6. CLINIC LOCATIONS OVERVIEW GRID (FOR ROOT & ADMINS) */}
      <DashboardClinicFacilities
        canManageOrg={canManageOrg}
        clinics={clinicsList}
      />
    </div>
  );
}
