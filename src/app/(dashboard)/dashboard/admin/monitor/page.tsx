"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { Alert, Avatar, Card, Button, Badge, Table, Input, Select, Skeleton, Tabs, Modal, useToast } from "@/components/ui";
import styles from "./Monitor.module.css";
import { Radio, Globe, Shield, ShieldCheck, Smartphone, Laptop, Tablet, RotateCw, LogOut, Search, SlidersHorizontal, ChevronDown } from "lucide-react";

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

interface LocationAttribution {
  locationId: string | null;
  locationName: string;
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
  const [sessionsError, setSessionsError] = useState("");
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
  const [trafficError, setTrafficError] = useState("");
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary | null>(null);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [locationAttribution, setLocationAttribution] = useState<LocationAttribution[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [deviceStats, setDeviceStats] = useState<{ name: string; count: number }[]>([]);
  const [browserStats, setBrowserStats] = useState<{ name: string; count: number }[]>([]);

  // ── Fetch Sessions ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      setSessionsError("");
      const res = await api.get("/auth/admin/sessions");
      setSessions(res.data?.data || []);
    } catch (err: any) {
      setSessionsError(err.response?.data?.message || "Active sessions could not be loaded. Retry.");
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
      setTrafficError("");
      const res = await api.get(`/admin/analytics/traffic?days=${trafficDays}`);
      const data = res.data?.data;
      if (data) {
        setTrafficSummary(data.summary);
        setDailyTrends(data.dailyTrends || []);
        setLocationAttribution(data.locationAttribution || []);
        setTopPages(data.topPages || []);
        setDeviceStats(data.devices || []);
        setBrowserStats(data.browsers || []);
      }
    } catch (err: any) {
      setTrafficError(err.response?.data?.message || "Traffic data could not be loaded. Retry.");
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
          <Shield className="w-6 h-6 text-accent" />
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
          className="font-semibold"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const sessionAction = (session: ActiveSession) => <Button variant="outline" size="sm" className={styles.sessionAction} disabled={session.isCurrent} loading={revokingSessionId === session.id} title={session.isCurrent ? "Cannot terminate your current active session" : "Force logout this session"} onClick={() => handleTerminateSession(session)}><LogOut className="h-4 w-4 shrink-0" />{session.isCurrent ? "Current device" : "Terminate session"}</Button>;
  const summaryValue = (loading: boolean, unavailable: boolean, value: number | string) => loading ? <Skeleton height="1.5rem" width="3rem" /> : unavailable ? <span aria-label="Unavailable">—</span> : value;

  return <div className={styles.workspace}>
    <header className={styles.header}><div><h1>Live activity</h1><p>Review platform sessions and website traffic.</p></div><Button variant="outline" className={styles.iconAction} aria-label={activeTab === "sessions" ? "Refresh sessions" : "Refresh traffic"} title={activeTab === "sessions" ? "Refresh sessions" : "Refresh traffic"} loading={activeTab === "sessions" ? sessionsLoading : trafficLoading} onClick={() => { if (activeTab === "sessions") void fetchSessions(); else void fetchTraffic(); }}><RotateCw className="h-4 w-4" /></Button></header>
    <Tabs className={styles.tabs} variant="pills" activeTab={activeTab} scrollActiveIntoView={false} onChange={id => { if (id === "sessions" || id === "traffic") setActiveTab(id); }} tabs={[
      { id: "sessions", label: "Live sessions", icon: <Radio />, content: <div className={styles.content}>
        <dl className={styles.summary} aria-label="Session summary" aria-busy={sessionsLoading}>
          <div><dt>Active sessions</dt><dd>{summaryValue(sessionsLoading, !!sessionsError, sessionStats.totalSessions)}</dd></div>
          <div><dt>Distinct users</dt><dd>{summaryValue(sessionsLoading, !!sessionsError, sessionStats.distinctUsers)}</dd></div>
          <div><dt>Root sessions</dt><dd>{summaryValue(sessionsLoading, !!sessionsError, sessionStats.rootCount)}<small>One login per root account</small></dd></div>
          <div><dt>Desktop devices</dt><dd>{summaryValue(sessionsLoading, !!sessionsError, sessionStats.desktopCount)}<small>{sessionsError || sessionsLoading ? "Mobile device breakdown" : `${sessionStats.mobileCount} mobile devices`}</small></dd></div>
        </dl>
        <details className={styles.policy}><summary><span><ShieldCheck className="h-4 w-4 shrink-0 text-accent" />Root session policy</span><ChevronDown className="h-4 w-4 shrink-0" /></summary><p>Root accounts allow one concurrent active login. Signing in from another device or browser revokes the previous root session.</p></details>
        <section className={styles.panel} aria-label="Active session directory">
          <div className={styles.toolbar}><Input containerClassName={styles.search} icon={<Search />} type="search" aria-label="Search active sessions" placeholder="Search users, organizations or devices" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /><Select aria-label="Session role" compactOnMobile fullWidth={false} containerClassName={styles.roleFilter} icon={<SlidersHorizontal className="h-4 w-4" />} value={roleFilter} onChange={event => setRoleFilter(event.target.value)} options={[{ value: "all", label: "All roles" }, { value: "root", label: "Root Superadmin" }, { value: "admin", label: "Tenant Admin" }, { value: "doctor", label: "Physician / Doctor" }, { value: "receptionist", label: "Front Desk" }, { value: "pharmacist", label: "Pharmacist" }, { value: "lab_tech", label: "Lab Technician" }, { value: "nurse", label: "Nurse" }, { value: "cashier", label: "Billing Cashier" }, { value: "patient", label: "Patient" }]} /></div>
          {sessionsError ? <div className="p-4"><Alert variant="error" title="Sessions unavailable" action={<Button variant="outline" onClick={fetchSessions}>Retry sessions</Button>}>{sessionsError}</Alert></div> : <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-1"><h2 className="text-sm font-semibold">Active sessions</h2><span className="text-xs text-text-secondary">{sessionsLoading ? "Loading sessions..." : `${filteredSessions.length} of ${sessions.length} sessions`}</span></div>
          <Table<ActiveSession> className={styles.responsiveTable} caption="Active platform sessions" data={filteredSessions} loading={sessionsLoading} searchable={false} showColumnVisibility={false} fitContent emptyMessage="No active user sessions match the selected filter." columns={[
            { header: "User & role", accessor: session => <SessionIdentity session={session} /> },
            { header: "Organization", accessor: session => <div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{session.organizationName}</p>{session.organizationCity && <p className={styles.meta}>{session.organizationCity}</p>}</div> },
            { header: "Device & connection", accessor: session => <><SessionDevice session={session} /><p className={styles.meta}><span className="font-mono">{session.ipAddress || "Unavailable"}</span></p><p className={styles.meta}>Connected {new Date(session.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></> },
            { header: "Session action", align: "right", accessor: sessionAction },
          ]} renderMobileCard={session => <article className={styles.sessionCard} aria-label={`Session for ${session.userName}`}><SessionIdentity session={session} /><dl className={styles.sessionFacts}>
            <div className="col-span-2"><dt>Organization</dt><dd>{session.organizationName}{session.organizationCity && <span className="block mt-1 text-xs text-text-secondary">{session.organizationCity}</span>}</dd></div>
            <div className="col-span-2"><dt>Device & client</dt><dd><SessionDevice session={session} /></dd></div>
            <div><dt>IP address</dt><dd className="font-mono">{session.ipAddress || "Unavailable"}</dd></div><div><dt>Connected</dt><dd>{new Date(session.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div>
          </dl>{sessionAction(session)}</article>} />
          </>}
        </section>
      </div> },
      { id: "traffic", label: "Website traffic", icon: <Globe />, content: <div className={styles.content}>
        <div className={styles.sectionHeader}><div><h2 className="text-base font-semibold">Website traffic</h2><p>Pageviews, unique visitors and location attribution.</p></div><div className={styles.range} role="group" aria-label="Traffic period">{([14, 30] as const).map(days => <Button key={days} variant="ghost" size="sm" aria-pressed={trafficDays === days} onClick={() => setTrafficDays(days)}>Last {days} days</Button>)}</div></div>
        <dl className={styles.summary} aria-label="Traffic summary" aria-busy={trafficLoading}>
          <div><dt>Today's visits</dt><dd>{summaryValue(trafficLoading, !!trafficError || !trafficSummary, trafficSummary?.todayVisits ?? 0)}<small>{trafficSummary && !trafficError ? `${trafficSummary.todayVisitors} unique visitors` : "Unique visitors today"}</small></dd></div>
          <div><dt>Yesterday</dt><dd>{summaryValue(trafficLoading, !!trafficError || !trafficSummary, trafficSummary?.yesterdayVisits ?? 0)}<small>{trafficSummary && !trafficError ? `${trafficSummary.yesterdayVisitors} unique visitors` : "Previous calendar day"}</small></dd></div>
          <div><dt>7-day visits</dt><dd>{summaryValue(trafficLoading, !!trafficError || !trafficSummary, trafficSummary?.sevenDayVisits ?? 0)}<small>Rolling weekly total</small></dd></div>
          <div><dt>30-day visits</dt><dd>{summaryValue(trafficLoading, !!trafficError || !trafficSummary, trafficSummary?.thirtyDayVisits ?? 0)}<small>{trafficSummary && !trafficError ? `${trafficSummary.totalVisits} all-time visits` : "Rolling monthly total"}</small></dd></div>
        </dl>
        {trafficError ? <Alert variant="error" title="Traffic unavailable" action={<Button variant="outline" onClick={fetchTraffic}>Retry traffic</Button>}>{trafficError}</Alert> : <>
        <Card><div className="space-y-3"><div><h2 className="text-sm font-semibold">Daily traffic</h2><p className={styles.meta}>Pageviews and unique visitors over the past {trafficDays} days.</p><div className={styles.legend}><span><i className="h-2.5 w-2.5 rounded-sm bg-primary-500" aria-hidden="true" />Pageviews</span><span><i className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden="true" />Unique visitors</span></div></div>
          {trafficLoading ? <Skeleton height="13rem" /> : !dailyTrends.length ? <p className="py-10 text-center text-sm text-text-secondary">No telemetry recorded for this timeframe.</p> : <>
            <figure aria-label="Daily pageviews and unique visitors"><div className={styles.chartViewport}><div className={styles.chart} style={{ minWidth: `${dailyTrends.length * 36}px` }}>{dailyTrends.map(day => <div key={day.date} className={styles.barGroup} role="img" tabIndex={0} aria-label={`${day.date}: ${day.visits} visits, ${day.uniqueVisitors} unique visitors`} title={`${day.date}: ${day.visits} visits, ${day.uniqueVisitors} unique visitors`}><div className={styles.bars} aria-hidden="true"><div className="bg-primary-500/80" style={{ height: `${Math.round(day.visits / maxTrendVisits * 100)}%` }} /><div className="bg-success/80" style={{ height: `${Math.round(day.uniqueVisitors / maxTrendVisits * 100)}%` }} /></div><span className={styles.dayLabel} aria-hidden="true">{day.date.slice(5)}</span></div>)}</div></div><figcaption className={styles.meta}>Scroll the chart to view all days. Daily counts are available below.</figcaption></figure>
            <details className="text-sm"><summary className="cursor-pointer min-h-11 flex items-center font-medium text-accent">View daily counts</summary><div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Daily traffic counts</caption><thead><tr className="border-b border-border"><th className="py-2">Date</th><th>Pageviews</th><th>Unique visitors</th></tr></thead><tbody>{dailyTrends.map(day => <tr key={day.date} className="border-b border-border"><th scope="row" className="py-2 font-normal">{day.date}</th><td>{day.visits}</td><td>{day.uniqueVisitors}</td></tr>)}</tbody></table></div></details>
          </>}
        </div></Card>
        <section className={styles.panel} aria-label="Location traffic attribution"><div className="p-4"><h2 className="text-sm font-semibold">Traffic by location</h2><p className={styles.meta}>Patient discovery, appointment and portal visits by location.</p></div><Table<LocationAttribution> className={styles.responsiveTable} caption="Traffic by practice location" data={locationAttribution} loading={trafficLoading} searchable={false} showColumnVisibility={false} fitContent emptyMessage="No location-specific visits recorded yet." keyField="locationName" columns={[
          { header: "Location", accessor: location => <div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{location.locationName}</p><p className={styles.meta}>{location.city}</p></div> },
          { header: "Organization", accessor: location => <span className="text-sm [overflow-wrap:anywhere]">{location.organizationName}</span> },
          { header: "Visits", accessor: "visits" }, { header: "Unique visitors", accessor: "uniqueVisitors" }, { header: "Share", accessor: location => <span className="text-sm">{location.percentShare}%</span> },
        ]} renderMobileCard={location => <article className={styles.locationCard}><div><h3 className="text-sm font-semibold [overflow-wrap:anywhere]">{location.locationName}</h3><p className={styles.meta}>{location.organizationName}</p>{location.city && <p className={styles.meta}>{location.city}</p>}</div><dl className={styles.locationFacts}><div><dt>Visits</dt><dd>{location.visits}</dd></div><div><dt>Unique visitors</dt><dd>{location.uniqueVisitors}</dd></div><div><dt>Traffic share</dt><dd>{location.percentShare}%</dd></div></dl></article>} /></section>
        <div className={styles.reportGrid}><Card><h2 className="mb-3 text-sm font-semibold">Top visited pages</h2>{trafficLoading ? <Skeleton height="8rem" /> : !topPages.length ? <p className={styles.meta}>No route visits logged yet.</p> : <ol>{topPages.map(page => <li key={page.path} className={styles.route}><code>{page.path}</code><span>{page.visits} visits</span></li>)}</ol>}</Card>
        <Card><div className="space-y-4"><h2 className="text-sm font-semibold">Devices & browsers</h2>{[{ label: "Client devices", rows: deviceStats }, { label: "Web browsers", rows: browserStats }].map(group => <section key={group.label}><h3 className="mb-2 text-xs font-medium text-text-secondary">{group.label}</h3>{trafficLoading ? <Skeleton height="5rem" /> : !group.rows.length ? <p className={styles.meta}>No data recorded yet.</p> : <div className={styles.technology}>{group.rows.map(row => <div key={row.name}><span>{row.name}</span><strong>{row.count}</strong></div>)}</div>}</section>)}</div></Card></div>
        </>}
      </div> },
    ]} />
    <Modal open={confirmDialog.open} size="sm" busy={!!revokingSessionId} onClose={() => { if (!revokingSessionId) setConfirmDialog(prev => ({ ...prev, open: false })); }} title={confirmDialog.title} ariaDescribedBy="monitor-session-description" footer={<div className={styles.confirmActions}><Button variant="outline" disabled={!!revokingSessionId} onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancel</Button><Button variant="danger" loading={!!revokingSessionId} onClick={confirmDialog.action}>Confirm Terminate</Button></div>}><p id="monitor-session-description" className={styles.confirmDescription}>{confirmDialog.description}</p></Modal>
  </div>;
}

function SessionIdentity({ session }: { session: ActiveSession }) {
  return <div className={styles.identity}><Avatar name={session.userName} size="md" /><div><div className={styles.identityName}><span>{session.userName}</span>{session.isCurrent && <Badge variant="primary" size="sm">Current session</Badge>}{session.isGuest && <Badge variant="neutral" size="sm">Guest</Badge>}</div><p className={styles.meta}>{session.userEmail || "Phone OTP account"}</p><p className={styles.meta}><span className="capitalize">{session.userRole.replaceAll("_", " ")}</span></p></div></div>;
}

function SessionDevice({ session }: { session: ActiveSession }) {
  const Icon = session.deviceType === "Mobile" ? Smartphone : session.deviceType === "Tablet" ? Tablet : Laptop;
  return <div className="min-w-0"><p className={styles.deviceHeading}><Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{session.browser} on {session.os}</span></p><p className={styles.meta}>{session.deviceName}</p></div>;
}
