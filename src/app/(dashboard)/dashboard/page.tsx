"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import api from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Table,
  Column,
  useToast,
  Spinner,
} from "@/components/ui";
import { useModuleStore } from "@/store/moduleStore";
import {
  RotateCw,
  Building2,
  Users,
  Layers,
  Shield,
  KeyRound,
  ArrowRight,
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
  const { user, switchOrg, impersonate } = useAuthStore();
  const { clinics: clinicsList, fetchClinics } = useClinicStore();
  const { isModuleEnabled } = useModuleStore();
  const router = useRouter();
  const { toast } = useToast();

  const isRootPlatformAdmin = user?.role === "root" && !(user?.impersonatedBy && user.impersonatedBy.id);

  // Platform Superadmin Hierarchy & KPI state
  const [platformHierarchy, setPlatformHierarchy] = useState<any>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [impersonatingOrgId, setImpersonatingOrgId] = useState<string | null>(null);

  const canViewOpsDashboard =
    !isRootPlatformAdmin &&
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
  const [setupDismissed, setSetupDismissed] = useState(() => {
    try {
      return localStorage.getItem("anant_setup_dismissed") === "1";
    } catch {
      return false;
    }
  });

  // Fetch Root Platform Superadmin Data
  const fetchPlatformOverview = async () => {
    try {
      setLoadingHierarchy(true);
      const res = await api.get("/admin/hierarchy");
      setPlatformHierarchy(res.data?.data || null);
    } catch (err: any) {
      console.error("Failed to load platform hierarchy", err);
      toast({
        title: "Error Loading Platform Data",
        description: err.response?.data?.message || "Could not fetch platform hierarchy.",
        variant: "error",
      });
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const handleLoginAsOrgAdmin = async (orgId: string, orgName: string) => {
    try {
      setImpersonatingOrgId(orgId);
      await impersonate({ organizationId: orgId, role: "admin" });
      toast({
        title: "Workspace Entered as Admin",
        description: `Now logged in as Administrator for ${orgName}.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Impersonation Failed",
        description: err.response?.data?.message || "Could not login as organization administrator.",
        variant: "error",
      });
    } finally {
      setImpersonatingOrgId(null);
    }
  };

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
    if (isRootPlatformAdmin) {
      fetchPlatformOverview();
      return;
    }
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

        const unpaidBills = invList.reduce((acc: number, curr: any) => {
          if (curr.status === "paid" || curr.status === "cancelled") return acc;
          return acc + (curr.totalAmount - (curr.amountPaid || 0));
        }, 0);

        setAdminStats({
          clinics: clList?.length || 0,
          doctors: docList.length,
          receptionists: recList.length,
          appointments: apptList.length,
          collections: todaysPaid,
          outstanding: unpaidBills,
        });

        setAppointments(apptList);
        setInvoices(invList.filter((i: any) => i.status === "unpaid"));
      } else if (user.role === "doctor") {
        const res = await api.get("/appointments");
        const docAppts = res.data.data || [];
        const completed = docAppts.filter((a: any) => a.status === "completed").length;
        const pending = docAppts.filter(
          (a: any) => a.status === "confirmed" || a.status === "pending" || a.status === "scheduled"
        ).length;
        setDoctorStats({ total: docAppts.length, completed, pending });
        setAppointments(docAppts);
      } else if (user.role === "patient") {
        const [apptsRes, invsRes] = await Promise.all([
          api.get("/appointments/patient/me"),
          api.get("/invoices/patient/me"),
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

  // ──────────────────────────────────────────────────────────────────────────
  // A. PLATFORM ROOT SUPERADMIN VIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (isRootPlatformAdmin) {
    const summary = platformHierarchy?.summary || {
      totalOrganizations: 0,
      totalBranches: 0,
      totalMembers: 0,
      totalPlatformAdmins: 1,
    };
    const orgList = platformHierarchy?.organizations || [];

    const columns: Column<any>[] = [
      {
        header: "Tenant Organization",
        accessor: (org) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 font-bold flex items-center justify-center text-xs shrink-0 border border-primary-500/20">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-text text-xs sm:text-sm">{org.name}</p>
              <p className="text-[11px] text-text-muted">{org.city || "Multi-Branch"}</p>
            </div>
          </div>
        ),
      },
      {
        header: "SaaS Plan",
        accessor: (org) => (
          <Badge
            variant={
              org.plan === "enterprise"
                ? "primary"
                : org.plan === "pro"
                ? "info"
                : "secondary"
            }
            size="sm"
            className="uppercase text-[10px] font-bold"
          >
            {org.plan}
          </Badge>
        ),
      },
      {
        header: "Branches & Staff",
        accessor: (org) => (
          <div className="text-xs text-text-secondary">
            <span className="font-semibold text-text">{org.counts.branches}</span> Clinics &bull;{" "}
            <span className="font-semibold text-text">{org.counts.totalMembers}</span> Users
          </div>
        ),
      },
      {
        header: "Status",
        accessor: (org) => (
          <Badge
            variant={org.status === "active" ? "success" : "neutral"}
            size="sm"
            dot
            pulse={org.status === "active"}
            className="text-[10px] font-semibold"
          >
            {org.status === "active" ? "Active" : "Suspended"}
          </Badge>
        ),
      },
      {
        header: "Actions",
        align: "right",
        accessor: (org) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="xs"
              variant="primary"
              loading={impersonatingOrgId === org.id}
              onClick={() => handleLoginAsOrgAdmin(org.id, org.name)}
              className="font-semibold text-xs rounded-xl flex items-center gap-1.5 min-h-[34px]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Login as Admin
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => router.push("/dashboard/organizations")}
              className="text-xs rounded-xl min-h-[34px]"
            >
              Details
            </Button>
          </div>
        ),
      },
    ];

    return (
      <div className="space-y-6 font-sans text-text antialiased animate-fade-up">
        {/* 1. ROOT BANNER */}
        <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-surface p-5 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-primary-600 before:via-primary-500 before:to-indigo-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                  Platform Superadmin Console
                </h1>
                <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                  Root Operator
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-text-muted max-w-2xl">
                Multi-tenant health metrics, SaaS subscriptions, and zero-password user impersonation hub.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-initial">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlatformOverview}
                disabled={loadingHierarchy}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors min-h-[40px] sm:min-h-[36px] justify-center"
              >
                <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${loadingHierarchy ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/dashboard/admin/users")}
                className="rounded-xl text-xs font-semibold shadow-xs min-h-[40px] sm:min-h-[36px] justify-center"
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                Users & Impersonate
              </Button>
            </div>
          </div>
        </div>

        {/* 2. PLATFORM STATCARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Tenant Organizations"
            value={summary.totalOrganizations}
            icon={<Building2 className="w-5 h-5 text-primary-500" />}
            description="Registered medical institutions"
            onClick={() => router.push("/dashboard/organizations")}
          />
          <StatCard
            title="Clinic Branches"
            value={summary.totalBranches}
            icon={<Layers className="w-5 h-5 text-emerald-500" />}
            description="Active multi-branch facilities"
          />
          <StatCard
            title="Registered Users"
            value={summary.totalMembers}
            icon={<Users className="w-5 h-5 text-blue-500" />}
            description="Doctors, staff & admins"
            onClick={() => router.push("/dashboard/admin/users")}
          />
          <StatCard
            title="Security & Isolation"
            value="100%"
            icon={<Shield className="w-5 h-5 text-purple-500" />}
            description="Tenant data isolation active"
          />
        </div>

        {/* 3. TENANT ORGANIZATIONS HUB */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text">Tenant Organizations</h2>
              <p className="text-xs text-text-muted">
                Explore platform tenants, inspect branch capacity, and directly login as any organization owner.
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => router.push("/dashboard/organizations")}
              className="text-xs rounded-xl"
            >
              View All Tenants <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-2xs">
            <Table
              columns={columns}
              data={orgList}
              loading={loadingHierarchy}
              mobileCardView
              renderMobileCard={(org: any) => (
                <div
                  key={org.id}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 font-bold flex items-center justify-center text-sm shrink-0 border border-primary-500/20">
                        {org.name?.charAt(0).toUpperCase() || "T"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-text text-sm truncate">{org.name}</p>
                        <p className="text-xs text-text-muted">{org.city || "Multi-Branch Practice"}</p>
                      </div>
                    </div>
                    <Badge
                      variant={org.plan === "enterprise" ? "primary" : org.plan === "pro" ? "info" : "secondary"}
                      size="sm"
                      className="uppercase text-[10px] font-bold shrink-0"
                    >
                      {org.plan}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50 text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-text-muted" />
                      <span><strong className="text-text">{org.counts?.branches || 0}</strong> Clinics</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-text-muted" />
                      <span><strong className="text-text">{org.counts?.totalMembers || 0}</strong> Users</span>
                    </div>
                    <Badge
                      variant={org.status === "active" ? "success" : "neutral"}
                      size="sm"
                      dot
                      pulse={org.status === "active"}
                      className="text-[10px] font-semibold"
                    >
                      {org.status === "active" ? "Active" : "Suspended"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={impersonatingOrgId === org.id}
                      onClick={() => handleLoginAsOrgAdmin(org.id, org.name)}
                      className="flex-1 font-semibold text-xs rounded-xl min-h-[42px] justify-center"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      Login as Admin
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push("/dashboard/organizations")}
                      className="font-semibold text-xs rounded-xl min-h-[42px] px-3.5"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              )}
              emptyMessage="No tenant organizations registered on the platform yet."
            />
          </div>
        </div>

        {/* 4. PLATFORM QUICK ACCESS TILES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="p-4 cursor-pointer hover:border-primary-500/40 transition-all group"
            onClick={() => router.push("/dashboard/admin/users")}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-600 group-hover:scale-105 transition-transform">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text group-hover:text-primary-500 transition-colors">
                  Users Directory & Impersonate
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Log in as any doctor, receptionist, or staff member in 1 click without needing their credentials.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:border-primary-500/40 transition-all group"
            onClick={() => router.push("/dashboard/plans")}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text group-hover:text-emerald-500 transition-colors">
                  SaaS Plans & Capacity Limits
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Configure subscription pricing, clinic branch quotas, and doctor limits for Starter, Pro, and Enterprise.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:border-primary-500/40 transition-all group"
            onClick={() => router.push("/dashboard/audit")}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text group-hover:text-purple-500 transition-colors">
                  System Audit Logs
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Inspect cryptographic audit records, impersonation access sessions, and administrative actions.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. TENANT OPERATIONAL WORKSPACE (DOCTOR, ADMIN, RECEPTIONIST, PATIENT)
  // ──────────────────────────────────────────────────────────────────────────
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

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors flex-1 sm:flex-initial justify-center min-h-[44px] sm:min-h-[36px]"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 text-text-secondary ${isRefreshing ? "animate-spin" : ""}`} />
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
        !isRootPlatformAdmin &&
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
                  <span className="w-5 h-5 rounded-full bg-success-500/15 text-success-500 flex items-center justify-center text-[11px] font-bold shrink-0">
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
