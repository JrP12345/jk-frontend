"use client";

import { useAuthStore } from "@/store/authStore";
import {
  Sidebar,
  Button,
  Spinner,
  Dropdown,
  ModeSwitcher,
  PaletteSwitcher,
  Avatar,
  useToast,
  AnantLogo,
  AnantIcon,
  Select,
  Badge,
  cn,
} from "@/components/ui";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { hasRoutePermission } from "@/lib/routePermissions";
import { getModuleKeyForRoute } from "@/lib/routeModules";
import { FloatingAICopilot } from "@/components/ai/FloatingAICopilot";
import { useModuleStore } from "@/store/moduleStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import { ClinicalScreenLock } from "@/components/auth/ClinicalScreenLock";
import { OfflineStatusBanner } from "@/components/clinical/OfflineStatusBanner";
import { MobileBottomNav } from "@/components/dashboard";
import { useTrafficTracker } from "@/hooks/useTrafficTracker";
import DashboardLoading from "./loading";
import {
  LayoutDashboard,
  Calendar,
  User,
  CreditCard,
  Bell,
  BarChart3,
  Building2,
  Users,
  FileText,
  Video,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  Receipt,
  ShieldCheck,
  ClipboardList,
  Clock,
  MessageSquare,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Lock,
} from "lucide-react";

interface NavItem {
  section: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  moduleKey?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, stopImpersonation, checkAuth, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { clinics: headerClinics, fetchClinics, activeClinicId, setActiveClinic } = useClinicStore();
  const { toast } = useToast();
  const { isLoaded: modulesLoaded, fetchModules, isModuleEnabled } = useModuleStore();

  const isImpersonating = Boolean(user?.impersonatedBy && user.impersonatedBy.id);
  const isRootAdmin = user?.role === "root" && !isImpersonating;

  // Track site traffic & clinic attribution asynchronously
  useTrafficTracker(activeClinicId || undefined, user?.organization_id);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Only fetch clinics if the user is operating within a clinic/tenant workspace
    if (user && user.role !== "patient" && (!isRootAdmin || isImpersonating)) {
      fetchClinics().then((list) => {
        if (list.length > 0 && (!activeClinicId || !list.some((c) => c.id === activeClinicId))) {
          setActiveClinic(list[0].id);
        }
      });
    }
  }, [user?.id, user?.organization_id, user?.role, user?.impersonatedBy, isRootAdmin, isImpersonating, fetchClinics, activeClinicId, setActiveClinic]);

  // Fetch module toggle states once user is loaded
  useEffect(() => {
    if (user && !modulesLoaded && user.role !== "patient") {
      fetchModules();
    }
  }, [user, modulesLoaded, fetchModules]);

  useEffect(() => {
    if (!isLoading && user && !hasRoutePermission(pathname, user.role, user.permissions)) {
      // If user is in an impersonation session and currently on a root-only admin route,
      // smoothly redirect to tenant dashboard without firing a false-positive "Access Denied" toast
      if (isImpersonating && (pathname === "/dashboard/organizations" || pathname.startsWith("/dashboard/admin/"))) {
        router.replace("/dashboard");
        return;
      }
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this page.",
        variant: "error"
      });
      router.push("/dashboard");
    }
  }, [pathname, user, isLoading, router, toast]);

  useEffect(() => {
    if (!user || user.role === "patient" || !modulesLoaded) return;

    const moduleKey = getModuleKeyForRoute(pathname);
    if (moduleKey && !isModuleEnabled(moduleKey)) {
      toast({
        title: "Module Disabled",
        description: "This module is not enabled for your organization.",
        variant: "error",
      });
      router.push("/dashboard");
    }
  }, [pathname, user, modulesLoaded, isModuleEnabled, router, toast]);

  useEffect(() => {
    const handleForbidden = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; error?: string }>).detail;
      const message = detail?.message || "Access forbidden";

      if (detail?.error === "Module disabled" || message.toLowerCase().includes("module is not enabled")) {
        toast({
          title: "Module Disabled",
          description: message,
          variant: "error",
        });
        router.push("/dashboard");
        return;
      }

      // Check if this is a quota or subscription limitation error handled locally
      const lower = message.toLowerCase();
      if (lower.includes("quota") || lower.includes("limit") || lower.includes("subscription") || lower.includes("upgrade")) {
        return;
      }

      toast({
        title: "Access Denied",
        description: message,
        variant: "error",
      });
    };

    window.addEventListener("auth-forbidden", handleForbidden);
    return () => window.removeEventListener("auth-forbidden", handleForbidden);
  }, [router, toast]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login?logout=1");
  };

  const handleExitImpersonation = async () => {
    try {
      setIsExiting(true);
      await stopImpersonation();
      toast({
        title: "Impersonation Ended",
        description: "Returned safely to Root Superadmin Console.",
        variant: "info",
      });
      router.push("/dashboard");
    } catch (err: any) {
      await checkAuth();
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === "root" || !(currentUser?.impersonatedBy && currentUser.impersonatedBy.id)) {
        toast({
          title: "Session Restored",
          description: "Active Root Superadmin session verified.",
          variant: "info",
        });
        router.push("/dashboard");
      } else {
        toast({
          title: "Exit Failed",
          description: err.response?.data?.message || "Failed to exit impersonation session",
          variant: "error",
        });
      }
    } finally {
      setIsExiting(false);
    }
  };

  const hasAccess = user ? hasRoutePermission(pathname, user.role, user.permissions) : true;

  // Dedicated Navigation sets: Patients vs Platform Root Superadmin vs Clinical Operations
  const allNavItems: NavItem[] = user?.role === "patient" ? [
    { section: "My Health Care", label: "Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { section: "My Health Care", label: "My Appointments", href: "/dashboard/appointments", icon: <Calendar className="w-5 h-5" /> },
    { section: "My Health Care", label: "Patient Portal & Records", href: "/dashboard/patient-portal", icon: <User className="w-5 h-5" /> },
    { section: "My Health Care", label: "My Bills & Invoices", href: "/dashboard/bills", icon: <CreditCard className="w-5 h-5" /> },
    { section: "My Health Care", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" /> },
  ] : isRootAdmin ? [
    // Platform Root Superadmin Navigation (Free of tenant clinical clutter)
    { section: "Platform Console", label: "Platform Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { section: "Tenant Management", label: "Organizations", href: "/dashboard/organizations", icon: <Building2 className="w-5 h-5" /> },
    { section: "Tenant Management", label: "Users & Impersonate", href: "/dashboard/admin/users", icon: <Users className="w-5 h-5" /> },
    { section: "Live Supervision", label: "Live Sessions & Traffic", href: "/dashboard/admin/monitor", icon: <Activity className="w-5 h-5" /> },
    { section: "Billing & Revenue", label: "SaaS Plans & Console", href: "/dashboard/admin/billing", icon: <CreditCard className="w-5 h-5" /> },
    { section: "Security & Auditing", label: "System Audit Logs", href: "/dashboard/audit", icon: <FileText className="w-5 h-5" /> },
    { section: "Security & Auditing", label: "Platform Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
  ] : [
    // 1. Core Workspace
    { section: "Core Workspace", label: "Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" />, moduleKey: "dashboard" },
    { section: "Core Workspace", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" />, moduleKey: "notifications" },
    { section: "Core Workspace", label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" />, moduleKey: "analytics" },

    // 2. Outpatient Care (OPD)
    { section: "Outpatient (OPD)", label: "Queue Desk", href: "/dashboard/queue", icon: <Users className="w-5 h-5" />, moduleKey: "queue" },
    { section: "Outpatient (OPD)", label: "Appointments", href: "/dashboard/appointments", icon: <Calendar className="w-5 h-5" />, moduleKey: "appointments" },
    { section: "Outpatient (OPD)", label: "Consultations", href: "/dashboard/consultations", icon: <FileText className="w-5 h-5" />, moduleKey: "consultations" },
    { section: "Outpatient (OPD)", label: "Teleconsultation", href: "/dashboard/teleconsultation", icon: <Video className="w-5 h-5" />, moduleKey: "teleconsultation" },
    { section: "Outpatient (OPD)", label: "Patients Directory", href: "/dashboard/patients", icon: <User className="w-5 h-5" />, moduleKey: "patients" },

    // 3. Diagnostics & Pharmacy
    { section: "Diagnostics & Pharmacy", label: "Laboratory & LIS", href: "/dashboard/laboratory", icon: <FlaskConical className="w-5 h-5" />, moduleKey: "laboratory" },
    { section: "Diagnostics & Pharmacy", label: "Radiology & PACS", href: "/dashboard/radiology", icon: <ImageIcon className="w-5 h-5" />, moduleKey: "radiology" },
    { section: "Diagnostics & Pharmacy", label: "Pharmacy Inventory", href: "/dashboard/pharmacy", icon: <Pill className="w-5 h-5" />, moduleKey: "pharmacy" },

    // 4. Billing & Finance
    { section: "Billing & Finance", label: "Patient Invoicing", href: "/dashboard/billing", icon: <Receipt className="w-5 h-5" />, moduleKey: "billing" },
    { section: "Billing & Finance", label: "Insurance & Claims", href: "/dashboard/insurance", icon: <ShieldCheck className="w-5 h-5" />, moduleKey: "insurance" },
    { section: "Billing & Finance", label: "Service Catalog", href: "/dashboard/billing/services", icon: <ClipboardList className="w-5 h-5" />, moduleKey: "service-catalog" },

    // 5. Administration & Facilities
    { section: "Administration & Facilities", label: "Locations", href: "/dashboard/clinics", icon: <Building2 className="w-5 h-5" />, moduleKey: "clinics" },
    { section: "Administration & Facilities", label: "Team", href: "/dashboard/staff", icon: <Users className="w-5 h-5" />, moduleKey: "staff" },
    { section: "Administration & Facilities", label: "Shift Roster", href: "/dashboard/shifts", icon: <Clock className="w-5 h-5" />, moduleKey: "shifts" },
    { section: "Administration & Facilities", label: "Patient Feedback", href: "/dashboard/feedback", icon: <MessageSquare className="w-5 h-5" />, moduleKey: "feedback" },
    { section: "Administration & Facilities", label: "System Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" />, moduleKey: "settings" }
  ];

  const filteredNavItems = (isLoading || !user)
    ? []
    : allNavItems.filter((item) => {
        // Overview and Notifications are always visible to authenticated users
        if (item.href === "/dashboard" || item.href === "/browse" || item.href === "/dashboard/notifications") return true;

        // Patient lab reports is allowed
        if (item.href === "/dashboard/laboratory" && user.role === "patient") return true;

        // Check route permission first
        const hasPermission = hasRoutePermission(item.href, user.role, user.permissions);
        if (!hasPermission) return false;

        // Module toggle filter: filter out disabled modules (applies to all roles except patient)
        if (user.role !== "patient" && item.moduleKey) {
          if (!isModuleEnabled(item.moduleKey)) return false;
        }

        return true;
      });

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt relative">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[45] md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container — Desktop flow + Mobile Off-Canvas Drawer */}
      <div
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 shrink-0 h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          mobileMenuOpen
            ? "translate-x-0 opacity-100 visible pointer-events-auto shadow-2xl"
            : "-translate-x-full opacity-0 invisible pointer-events-none md:translate-x-0 md:opacity-100 md:visible md:pointer-events-auto"
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          loading={isLoading || !user}
          brand={
            sidebarCollapsed ? (
              <AnantIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            ) : (
              <div className="flex items-center justify-between w-full">
                <AnantLogo size="md" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover md:hidden transition-colors cursor-pointer"
                  aria-label="Close menu drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )
          }
          items={filteredNavItems.map(item => ({
            ...item,
            active: pathname === item.href
          }))}
          footer={
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover border border-border/40 hover:border-border transition-all duration-200 cursor-pointer hidden md:flex"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {!sidebarCollapsed && <span className="tracking-tight">Collapse sidebar</span>}
              <span className={sidebarCollapsed ? "mx-auto" : ""}>
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </span>
            </button>
          }
        />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Active Impersonation Top Banner */}
        {isImpersonating && user?.impersonatedBy && (
          <div className="bg-surface/95 backdrop-blur-md border-b border-amber-500/30 dark:border-amber-500/20 px-3 sm:px-6 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xs z-50 shrink-0 text-xs sm:text-sm font-medium animate-fade-in relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-amber-500 before:via-amber-400 before:to-amber-500">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Badge variant="warning" size="sm" dot pulse className="font-bold tracking-wide uppercase text-[10px] shrink-0">
                Impersonation
              </Badge>
              <span className="text-text truncate text-xs">
                <strong className="font-bold text-text">{user.name}</strong> <span className="text-text-muted font-normal">({user.role.toUpperCase()})</span>
              </span>
              <span className="text-text-muted text-xs hidden lg:inline truncate">
                • Session authorized by Root Superadmin <span className="font-medium text-text-secondary">({user.impersonatedBy.name || user.impersonatedBy.email || "Console"})</span>
              </span>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={handleExitImpersonation}
              loading={isExiting}
              icon={<LogOut className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              className="rounded-xl border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-700 dark:text-amber-300 font-semibold text-xs shrink-0 cursor-pointer shadow-2xs min-h-[32px]"
            >
              Exit
            </Button>
          </div>
        )}

        {/* Offline Status & Sync Alert Banner */}
        <OfflineStatusBanner />

        {/* Top Navbar */}
        <header className="h-16 border-b border-border/80 bg-surface/90 backdrop-blur-xl flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 z-40 relative shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-1 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover md:hidden transition-colors cursor-pointer shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center active:scale-95"
              aria-label="Toggle Navigation Drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <AnantLogo size="sm" className="md:hidden shrink-0" />
            <h1 className="text-base md:text-lg font-semibold text-text capitalize hidden sm:block truncate">
              {user
                ? isRootAdmin
                  ? "Platform Superadmin Console"
                  : user.role === "admin"
                  ? "Organization Admin Dashboard"
                  : `${user.role} Dashboard`
                : "Clinical Workspace"}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            {/* Only show Clinic selector when in operational clinic/tenant workspace */}
            {user && user.role !== "patient" && !isRootAdmin && headerClinics.length > 0 && (
              <div className="w-24 xs:w-32 sm:w-56 md:w-64 shrink-0">
                <Select
                  size="sm"
                  options={[
                    ...(headerClinics.length > 1 || hasAnyPermission(user, "MANAGE_CLINICS", "VIEW_CLINICS")
                      ? [{ value: "all", label: "All Clinics" }]
                      : []),
                    ...headerClinics.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={activeClinicId || (headerClinics[0] ? headerClinics[0].id : "all")}
                  onChange={(e) => setActiveClinic(e.target.value)}
                />
              </div>
            )}
            <NotificationBell />
            <div className="hidden md:block">
              <PaletteSwitcher />
            </div>
            {/* ModeSwitcher: sleek icon on mobile, segmented on tablet/desktop */}
            <div className="block sm:hidden">
              <ModeSwitcher variant="icon" />
            </div>
            <div className="hidden sm:block">
              <ModeSwitcher variant="segmented" />
            </div>
            <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 md:mx-2 hidden xs:block" />
            {user ? (
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 hover:bg-surface-hover p-1 pr-1.5 sm:pr-2 rounded-full transition-colors shrink-0 cursor-pointer">
                    <Avatar name={user.name} size="sm" status="online" />
                    <div className="text-left hidden sm:block">
                      <p className="text-xs font-semibold text-text leading-tight truncate max-w-[120px]">{user.name}</p>
                      <p className="text-[10px] text-text-muted capitalize leading-tight">{user.role}</p>
                    </div>
                  </button>
                }
                items={[
                  { 
                    label: "Profile & Settings", 
                    onClick: () => router.push(user.role === "patient" ? "/dashboard/patient-portal" : "/dashboard/settings"),
                    icon: <User className="w-4 h-4" />
                  },
                  ...(user.role !== "patient" ? [
                    {
                      label: "Lock Workstation",
                      onClick: () => window.dispatchEvent(new CustomEvent("lock-workstation")),
                      icon: <Lock className="w-4 h-4 text-text-secondary" />
                    }
                  ] : []),
                  { divider: true, label: "" },
                  { 
                    label: "Sign out", 
                    onClick: handleLogout, 
                    danger: true,
                    icon: <LogOut className="w-4 h-4 text-danger" />
                  }
                ]}
                align="right"
              />
            ) : (
              <div className="flex items-center gap-2 p-1 rounded-full text-xs text-text-muted">
                <div className="w-7 h-7 rounded-full bg-surface-alt border border-border flex items-center justify-center font-medium">
                  <User className="w-3.5 h-3.5 text-text-muted" />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area — With bottom padding for persistent mobile bar */}
        <main
          role="main"
          id="main-content"
          className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 pb-32 sm:pb-32 lg:pb-8 scroll-smooth w-full touch-scroll [scrollbar-gutter:stable]"
        >
          <div className="w-full space-y-5 sm:space-y-6 max-w-7xl xl:max-w-[90rem] mx-auto">
            {isLoading || !user ? (
              <DashboardLoading />
            ) : !hasAccess ? (
              <div className="min-h-[400px] flex items-center justify-center bg-surface rounded-2xl border border-border p-6 text-center">
                <Spinner size="lg" label="Redirecting..." />
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        user={user}
        pathname={pathname}
        onOpenMenu={() => setMobileMenuOpen(true)}
        isMenuOpen={mobileMenuOpen}
      />

      {/* Global Floating AI Copilot Drawer Button */}
      <FloatingAICopilot />

      {/* Clinical Inactivity & Workstation Screen Lock */}
      <ClinicalScreenLock />
    </div>
  );
}
