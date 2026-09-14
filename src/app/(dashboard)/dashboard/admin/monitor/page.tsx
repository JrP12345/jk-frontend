"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Table,
  Column,
  Input,
  Select,
  StatCard,
  useToast,
  ConfirmDialog,
  Spinner,
  cn,
} from "@/components/ui";
import {
  Activity,
  Radio,
  Globe,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Laptop,
  Tablet,
  RotateCw,
  LogOut,
  Search,
  Building2,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Eye,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  organizationId: string | null;
  organizationName: string;
  organizationCity: string | null;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  deviceType: "Desktop" | "Mobile" | "Tablet";
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
  isGuest: boolean;
  impersonatedBy?: any;
}

interface TrafficSummary {
  todayVisits: number;
  todayVisitors: number;
  yesterdayVisits: number;
  yesterdayVisitors: number;
  sevenDayVisits: number;
  thirtyDayVisits: number;
  totalVisits: number;
}

interface DailyTrend {
  date: string;
  visits: number;
  uniqueVisitors: number;
}

interface ClinicAttribution {
  clinicId: string | null;
  clinicName: string;
  organizationName: string;
  city: string;
  visits: number;
  uniqueVisitors: number;
  percentShare: number;
}

interface TopPage {
  path: string;
  visits: number;
}

export default function RootAdminMonitorPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"sessions" | "traffic">("sessions");

  // Sessions state
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  });

  // Traffic Analytics state
  const [trafficDays, setTrafficDays] = useState<14 | 30>(14);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary | null>(null);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [clinicAttribution, setClinicAttribution] = useState<ClinicAttribution[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [deviceStats, setDeviceStats] = useState<{ name: string; count: number }[]>([]);
  const [browserStats, setBrowserStats] = useState<{ name: string; count: number }[]>([]);

  // ── Fetch Sessions ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await api.get("/auth/admin/sessions");
      setSessions(res.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Failed to load sessions",
        description: err.response?.data?.message || "Could not retrieve active platform sessions",
        variant: "error",
      });
    } finally {
      setSessionsLoading(false);
    }
  }, [toast]);

  // ── Fetch Traffic Analytics ───────────────────────────────────────────────
  const fetchTraffic = useCallback(async () => {
    try {
      setTrafficLoading(true);
      const res = await api.get(`/admin/analytics/traffic?days=${trafficDays}`);
      const data = res.data?.data;
      if (data) {
        setTrafficSummary(data.summary);
        setDailyTrends(data.dailyTrends || []);
        setClinicAttribution(data.clinicAttribution || []);
        setTopPages(data.topPages || []);
        setDeviceStats(data.devices || []);
        setBrowserStats(data.browsers || []);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load traffic",
        description: err.response?.data?.message || "Could not retrieve website visit analytics",
        variant: "error",
      });
    } finally {
      setTrafficLoading(false);
    }
  }, [trafficDays, toast]);

  useEffect(() => {
    if (user?.role === "root") {
      fetchSessions();
      fetchTraffic();
    }
  }, [user?.role, fetchSessions, fetchTraffic]);

  // ── Terminate Specific Session ────────────────────────────────────────────
  const handleTerminateSession = (session: ActiveSession) => {
    setConfirmDialog({
      open: true,
      title: `Terminate ${session.userName}'s Session?`,
      description: `This will immediately invalidate the session token on ${session.deviceName} (${session.ipAddress}). The user will be required to log in again.`,
      action: async () => {
        try {
          setRevokingSessionId(session.id);
          await api.delete(`/auth/admin/sessions/${session.id}`);
          toast({
            title: "Session Terminated",
            description: `Session on ${session.deviceName} was successfully logged out.`,
            variant: "success",
          });
          setSessions((prev) => prev.filter((s) => s.id !== session.id));
        } catch (err: any) {
          toast({
            title: "Termination Failed",
            description: err.response?.data?.message || "Could not terminate session",
            variant: "error",
          });
        } finally {
          setRevokingSessionId(null);
        }
      },
    });
  };

  // ── Terminate All Sessions for a Target User ──────────────────────────────
  const handleTerminateUser = (targetUserId: string, targetName: string) => {
    setConfirmDialog({
      open: true,
      title: `Force Logout ${targetName}?`,
      description: `This will terminate ALL active devices and sessions for ${targetName}.`,
      action: async () => {
        try {
          await api.post(`/auth/admin/sessions/revoke-user/${targetUserId}`);
          toast({
            title: "User Logged Out",
            description: `All active sessions for ${targetName} have been revoked.`,
            variant: "success",
          });
          setSessions((prev) => prev.filter((s) => s.userId !== targetUserId));
        } catch (err: any) {
          toast({
            title: "Revocation Failed",
            description: err.response?.data?.message || "Could not revoke user sessions",
            variant: "error",
          });
        }
      },
    });
  };

  // ── Filtered Sessions ─────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (roleFilter !== "all" && s.userRole !== roleFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.userName.toLowerCase().includes(q) ||
        s.userEmail.toLowerCase().includes(q) ||
        s.userRole.toLowerCase().includes(q) ||
        s.organizationName.toLowerCase().includes(q) ||
        s.ipAddress.includes(q) ||
        s.deviceName.toLowerCase().includes(q)
      );
    });
  }, [sessions, roleFilter, searchQuery]);

  // ── Computed Session Stats ────────────────────────────────────────────────
  const sessionStats = useMemo(() => {
    const totalSessions = sessions.length;
    const distinctUsers = new Set(sessions.map((s) => s.userId)).size;
    const rootCount = sessions.filter((s) => s.userRole === "root").length;
    const mobileCount = sessions.filter((s) => s.deviceType === "Mobile").length;
    const desktopCount = sessions.filter((s) => s.deviceType === "Desktop").length;

    return { totalSessions, distinctUsers, rootCount, mobileCount, desktopCount };
  }, [sessions]);

  // Max visits for scaling chart
  const maxTrendVisits = useMemo(() => {
    const max = Math.max(...dailyTrends.map((d) => d.visits), 1);
    return max;
  }, [dailyTrends]);

  if (user?.role !== "root") {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-text-secondary">
          <Shield className="w-6 h-6 text-primary-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">Root Super-Admin Access Required</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Only platform super-administrators can view and supervise active platform sessions and traffic telemetry.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="rounded-xl font-semibold"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text">
                  Live Supervision & Traffic
                </h1>
                <Badge variant="primary" size="sm" dot pulse className="text-[10px] font-bold uppercase tracking-wider">
                  Real-Time
                </Badge>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Monitor active user logins, enforce single-session root security, and inspect daily traffic across clinics.
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setActiveTab("sessions")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "sessions"
                  ? "bg-surface text-primary-600 dark:text-primary-400 shadow-xs border border-border/60"
                  : "text-text-muted hover:text-text"
              )}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Live Sessions ({sessionStats.totalSessions})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("traffic")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "traffic"
                  ? "bg-surface text-primary-600 dark:text-primary-400 shadow-xs border border-border/60"
                  : "text-text-muted hover:text-text"
              )}
            >
              <Globe className="w-3.5 h-3.5 text-primary-500" />
              Website Traffic & Clinics
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "sessions") fetchSessions();
              else fetchTraffic();
            }}
            loading={activeTab === "sessions" ? sessionsLoading : trafficLoading}
            className="rounded-xl shrink-0 min-h-[36px]"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: LIVE USER SESSIONS & FORCE-LOGOUT
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Sessions"
              value={sessionStats.totalSessions.toString()}
              description="Open browser & device tokens"
              icon={<Radio className="w-5 h-5 text-emerald-500" />}
            />
            <StatCard
              label="Distinct Users"
              value={sessionStats.distinctUsers.toString()}
              description="Users currently online"
              icon={<Users className="w-5 h-5 text-primary-500" />}
            />
            <StatCard
              label="Root Concurrency"
              value={`${sessionStats.rootCount} / 1`}
              description="Strict Single-Session Active"
              icon={<ShieldCheck className="w-5 h-5 text-indigo-500" />}
            />
            <StatCard
              label="Device Balance"
              value={`${sessionStats.desktopCount} Desktop · ${sessionStats.mobileCount} Mobile`}
              description="Client screen breakdown"
              icon={<Laptop className="w-5 h-5 text-amber-500" />}
            />
          </div>

          {/* Root Policy Notice */}
          <Card className="border border-indigo-500/30 bg-indigo-500/5 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-text">Root Single-Session Concurrency Active</p>
                <p className="text-text-muted leading-relaxed">
                  As requested by platform security policy, Root Superadmin accounts are restricted to <strong>1 concurrent active login</strong>.
                  If you or an admin log in to the Root account from another device or browser, any prior sessions are immediately revoked and logged out.
                </p>
              </div>
            </div>
          </Card>

          {/* Filters & Search */}
          <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search active users by name, email, role, IP address, or device..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-xs w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Roles" },
                    { value: "root", label: "Root Superadmin" },
                    { value: "admin", label: "Tenant Admin" },
                    { value: "doctor", label: "Physician / Doctor" },
                    { value: "receptionist", label: "Front Desk" },
                    { value: "pharmacist", label: "Pharmacist" },
                    { value: "lab_tech", label: "Lab Technician" },
                    { value: "nurse", label: "Nurse" },
                    { value: "cashier", label: "Billing Cashier" },
                    { value: "patient", label: "Patient" },
                  ]}
                  className="w-44 text-xs h-10"
                />
              </div>
            </div>
          </Card>

          {/* Active Sessions Table */}
          <Table<ActiveSession>
            data={filteredSessions}
            loading={sessionsLoading}
            searchable={false}
            emptyMessage="No active user sessions match the selected filter."
            columns={[
              {
                header: "User & Role",
                accessor: (s) => (
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-xs shrink-0 border border-primary-500/20">
                      {s.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text text-xs sm:text-sm">{s.userName}</span>
                        {s.isCurrent && (
                          <Badge variant="primary" size="sm" className="text-[9px] font-bold">
                            Current Session
                          </Badge>
                        )}
                        {s.isGuest && (
                          <Badge variant="secondary" size="sm" className="text-[9px]">
                            Guest
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{s.userEmail || "Phone OTP Account"}</p>
                    </div>
                  </div>
                ),
              },
              {
                header: "Role",
                accessor: (s) => {
                  const variant =
                    s.userRole === "root"
                      ? "primary"
                      : s.userRole === "admin"
                      ? "info"
                      : s.userRole === "doctor"
                      ? "success"
                      : "secondary";
                  return (
                    <Badge variant={variant as any} size="sm" className="uppercase font-bold text-[10px]">
                      {s.userRole}
                    </Badge>
                  );
                },
              },
              {
                header: "Tenant Practice",
                accessor: (s) => (
                  <div className="space-y-0.5 min-w-[150px]">
                    <div className="flex items-center gap-1 text-xs font-semibold text-text">
                      <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="truncate">{s.organizationName}</span>
                    </div>
                    {s.organizationCity && (
                      <p className="text-[10px] text-text-muted pl-4.5">{s.organizationCity}</p>
                    )}
                  </div>
                ),
              },
              {
                header: "Device & Client",
                accessor: (s) => (
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <div className="p-1.5 rounded-lg bg-surface-alt text-text-muted border border-border/60">
                      {s.deviceType === "Mobile" ? (
                        <Smartphone className="w-4 h-4 text-emerald-500" />
                      ) : s.deviceType === "Tablet" ? (
                        <Tablet className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Laptop className="w-4 h-4 text-primary-500" />
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-semibold text-text">
                        {s.browser} on {s.os}
                      </p>
                      <p className="text-[10px] text-text-muted truncate max-w-[150px]">{s.deviceName}</p>
                    </div>
                  </div>
                ),
              },
              {
                header: "IP Address",
                accessor: (s) => (
                  <span className="font-mono text-xs text-text-secondary px-2 py-0.5 rounded bg-surface-alt border border-border/60">
                    {s.ipAddress || "127.0.0.1"}
                  </span>
                ),
              },
              {
                header: "Connected At",
                accessor: (s) => (
                  <div className="space-y-0.5 text-xs min-w-[130px]">
                    <div className="flex items-center gap-1 text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {new Date(s.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </p>
                  </div>
                ),
              },
              {
                header: "Actions",
                align: "right",
                accessor: (s) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="danger"
                      size="xs"
                      loading={revokingSessionId === s.id}
                      onClick={() => handleTerminateSession(s)}
                      disabled={s.isCurrent}
                      title={s.isCurrent ? "Cannot terminate your current active session" : "Force logout this session"}
                      className="rounded-lg font-semibold gap-1 min-h-[34px]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Terminate</span>
                    </Button>
                  </div>
                ),
              },
            ]}
            renderMobileCard={(s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-xs shrink-0 border border-primary-500/20">
                      {s.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text text-sm">{s.userName}</span>
                        {s.isCurrent && (
                          <Badge variant="primary" size="sm" className="text-[9px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{s.userEmail}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      s.userRole === "root"
                        ? "primary"
                        : s.userRole === "admin"
                        ? "info"
                        : s.userRole === "doctor"
                        ? "success"
                        : "secondary"
                    }
                    size="sm"
                    className="uppercase font-bold text-[9px]"
                  >
                    {s.userRole}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                  <div>
                    <span className="text-text-muted text-[10px] block">Facility</span>
                    <span className="font-medium text-text truncate block">{s.organizationName}</span>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">Client & OS</span>
                    <span className="font-medium text-text block">
                      {s.browser} &bull; {s.os}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">IP Address</span>
                    <span className="font-mono text-text block">{s.ipAddress}</span>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">Connected</span>
                    <span className="text-text block">
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={s.isCurrent}
                    loading={revokingSessionId === s.id}
                    onClick={() => handleTerminateSession(s)}
                    className="w-full justify-center min-h-[38px] font-semibold gap-1.5 rounded-xl"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {s.isCurrent ? "Current Active Device" : "Terminate Session"}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: WEBSITE TRAFFIC & CLINIC ATTRIBUTION
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "traffic" && (
        <div className="space-y-6">
          {/* Traffic Window Switcher & Headline KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text">Platform Visit Telemetry</h2>
              <p className="text-xs text-text-muted">
                Daily visitor traffic, unique audience counts, and clinic-by-clinic attribution breakdown.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 w-fit">
              <button
                type="button"
                onClick={() => setTrafficDays(14)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  trafficDays === 14 ? "bg-surface text-primary-600 shadow-xs" : "text-text-muted hover:text-text"
                )}
              >
                Last 14 Days
              </button>
              <button
                type="button"
                onClick={() => setTrafficDays(30)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  trafficDays === 30 ? "bg-surface text-primary-600 shadow-xs" : "text-text-muted hover:text-text"
                )}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Headline Traffic Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Today's Visits"
              value={trafficSummary ? trafficSummary.todayVisits.toString() : "0"}
              description={`${trafficSummary?.todayVisitors || 0} unique visitors today`}
              icon={<Eye className="w-5 h-5 text-primary-500" />}
            />
            <StatCard
              label="Yesterday"
              value={trafficSummary ? trafficSummary.yesterdayVisits.toString() : "0"}
              description={`${trafficSummary?.yesterdayVisitors || 0} unique visitors`}
              icon={<Calendar className="w-5 h-5 text-indigo-500" />}
            />
            <StatCard
              label="7-Day Traffic"
              value={trafficSummary ? trafficSummary.sevenDayVisits.toString() : "0"}
              description="Rolling weekly platform hits"
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            />
            <StatCard
              label="30-Day Total"
              value={trafficSummary ? trafficSummary.thirtyDayVisits.toString() : "0"}
              description={`All-time cumulative: ${trafficSummary?.totalVisits || 0}`}
              icon={<Globe className="w-5 h-5 text-amber-500" />}
            />
          </div>

          {/* Daily Trend Chart (Responsive SVG Bar Visualization) */}
          <Card className="p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-text">Daily Visitor Trajectory</CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Daily pageviews (bars) and unique visitors over the past {trafficDays} days
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-primary-500 inline-block" />
                  <span className="text-text-muted">Total Visits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                  <span className="text-text-muted">Unique Visitors</span>
                </div>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-4 pb-2">
              {dailyTrends.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-text-muted">
                  No telemetry recorded for this timeframe.
                </div>
              ) : (
                <div className="h-48 flex items-end gap-1.5 sm:gap-2.5 w-full border-b border-border/60 pb-2">
                  {dailyTrends.map((d) => {
                    const heightPercent = Math.max(Math.round((d.visits / maxTrendVisits) * 100), 4);
                    const uniquePercent = Math.max(Math.round((d.uniqueVisitors / maxTrendVisits) * 100), 2);
                    const dayLabel = d.date.slice(5); // "MM-DD"

                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-black/90 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-lg">
                          <span className="font-bold">{d.date}</span>
                          <span>
                            {d.visits} visits · {d.uniqueVisitors} unique
                          </span>
                        </div>

                        {/* Dual Bar (Visits & Unique) */}
                        <div className="w-full flex items-end justify-center gap-0.5 h-full max-w-[28px]">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-1/2 rounded-t bg-primary-500/80 group-hover:bg-primary-500 transition-all duration-300"
                          />
                          <div
                            style={{ height: `${uniquePercent}%` }}
                            className="w-1/2 rounded-t bg-emerald-500/80 group-hover:bg-emerald-500 transition-all duration-300"
                          />
                        </div>

                        <span className="text-[9px] text-text-muted font-mono tracking-tighter truncate max-w-full">
                          {dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* ──────────────────────────────────────────────────────────────────────
              CLINIC ATTRIBUTION TABLE ("Whose clinic and all")
             ────────────────────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text">Clinic Traffic Attribution</h3>
                <p className="text-xs text-text-muted">
                  Breakdown of patient discovery, appointments, and portal traffic by clinic branch
                </p>
              </div>
              <Badge variant="secondary" size="sm">
                {clinicAttribution.length} Clinic Targets
              </Badge>
            </div>

            <Table<ClinicAttribution>
              data={clinicAttribution}
              loading={trafficLoading}
              searchable={false}
              emptyMessage="No clinic-specific visits recorded yet."
              columns={[
                {
                  header: "Clinic Location",
                  accessor: (c) => (
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 border border-primary-500/20">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-text text-xs sm:text-sm">{c.clinicName}</span>
                        <div className="flex items-center gap-1 text-[11px] text-text-muted">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{c.city}</span>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "Organization / Tenant",
                  accessor: (c) => (
                    <span className="text-xs font-semibold text-text-secondary">{c.organizationName}</span>
                  ),
                },
                {
                  header: "Total Visits",
                  accessor: (c) => (
                    <span className="font-bold text-text text-xs sm:text-sm">{c.visits.toLocaleString()}</span>
                  ),
                },
                {
                  header: "Unique Visitors",
                  accessor: (c) => (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {c.uniqueVisitors.toLocaleString()}
                    </span>
                  ),
                },
                {
                  header: "Traffic Share",
                  align: "right",
                  accessor: (c) => (
                    <div className="flex items-center justify-end gap-2 min-w-[120px]">
                      <div className="w-20 bg-surface-alt rounded-full h-2 overflow-hidden border border-border/60">
                        <div
                          className="bg-primary-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(c.percentShare, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-text w-10 text-right">{c.percentShare}%</span>
                    </div>
                  ),
                },
              ]}
              renderMobileCard={(c) => (
                <div
                  key={c.clinicId || "global"}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-text text-sm">{c.clinicName}</span>
                      <p className="text-xs text-text-muted">{c.organizationName}</p>
                    </div>
                    <Badge variant="primary" size="sm" className="font-bold text-[10px]">
                      {c.percentShare}% Share
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                    <div>
                      <span className="text-text-muted text-[10px] block">Visits</span>
                      <span className="font-bold text-text block">{c.visits}</span>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px] block">Unique Visitors</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                        {c.uniqueVisitors}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* ──────────────────────────────────────────────────────────────────────
              POPULAR PAGES & TECH ENVIRONMENT
             ────────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Landing Pages */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
              <CardTitle className="text-sm font-bold text-text">Top Visited Pages & Routes</CardTitle>
              <div className="space-y-2 pt-1">
                {topPages.length === 0 ? (
                  <p className="text-xs text-text-muted py-4 text-center">No route visits logged yet.</p>
                ) : (
                  topPages.map((page, idx) => (
                    <div
                      key={page.path}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-alt/50 border border-border/60 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold w-4 text-text-muted">#{idx + 1}</span>
                        <span className="font-mono text-text truncate">{page.path}</span>
                      </div>
                      <Badge variant="secondary" size="sm" className="font-bold">
                        {page.visits} hits
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Devices & Browsers */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-4">
              <CardTitle className="text-sm font-bold text-text">Visitor Technology Profile</CardTitle>
              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Client Devices
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {deviceStats.map((d) => (
                      <div
                        key={d.name}
                        className="p-2.5 rounded-xl bg-surface-alt/50 border border-border/60 text-center space-y-1"
                      >
                        <span className="text-xs text-text-muted block">{d.name}</span>
                        <span className="text-sm font-bold text-text block">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Web Browsers
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {browserStats.map((b) => (
                      <div
                        key={b.name}
                        className="p-2.5 rounded-xl bg-surface-alt/50 border border-border/60 text-center space-y-1"
                      >
                        <span className="text-xs text-text-muted block">{b.name}</span>
                        <span className="text-sm font-bold text-text block">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Confirm Terminate"
        variant="danger"
      />
    </div>
  );
}
