"use client";

import { useAuthStore } from "@/store/authStore";
import { Sidebar, Button, Spinner, Dropdown, Avatar, useToast, EkavyuLogo, EkavyuIcon, Select, Badge, cn, ModeSwitcher } from "@/components/ui";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { hasRoutePermission } from "@/lib/routePermissions";
import { orderNavigation } from "@/lib/navigationOrder";
import { getDisabledRouteModule, requiresTenantModules } from "@/lib/routeModules";
import dynamic from "next/dynamic";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { useModuleStore } from "@/store/moduleStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import { ClinicalScreenLock } from "@/components/auth/ClinicalScreenLock";
import { OfflineStatusBanner } from "@/components/clinical/OfflineStatusBanner";
import { MobileBottomNav } from "@/components/dashboard";
import { useTrafficTracker } from "@/hooks/useTrafficTracker";
import DashboardLoading from "./loading";
import { LayoutDashboard, Calendar, User, CreditCard, Bell, BarChart3, Building2, Users, FileText, Video, FlaskConical, Image as ImageIcon, Pill, Receipt, ShieldCheck, ClipboardList, Clock, MessageSquare, Settings, Activity, ChevronLeft, ChevronRight, Menu, X, LogOut, Lock } from "lucide-react";

const FloatingAICopilot = dynamic(() => import("@/components/ai/FloatingAICopilot").then((module) => module.FloatingAICopilot), { ssr: false });

interface NavItem {
  section: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  moduleKey?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, stopImpersonation, checkAuth, isLoading, isLoggingOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerGesture = useSwipeGesture({ axis: "x", direction: "left", enabled: mobileMenuOpen, mediaQuery: "(max-width: 1023px)", onSwipe: () => setMobileMenuOpen(false) });
  const [isExiting, setIsExiting] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(mobileMenuOpen, drawerRef, () => setMobileMenuOpen(false));
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
    if (requiresTenantModules(user) && !modulesLoaded) {
      fetchModules();
    }
  }, [user, modulesLoaded, fetchModules]);

  useEffect(() => {
    if (!isLoading && user && !hasRoutePermission(pathname, user.role, user.permissions)) {
      if ((user.role as string) === "guest") {
        router.replace("/login");
        return;
      }
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
    if (!modulesLoaded) return;

    if (getDisabledRouteModule(pathname, user, isModuleEnabled)) {
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
    if (!isLoading && !isLoggingOut && !user) {
      router.replace("/login");
    }
  }, [isLoading, isLoggingOut, user, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login?logout=1");
  };

  const handleExitImpersonation = async () => {
    try {
      setIsExiting(true);
      await stopImpersonation();
      toast({
        title: "Returned to platform account",
        description: "You are using your administrator account again.",
        variant: "info",
      });
      router.push("/dashboard");
    } catch (err: any) {
      await checkAuth();
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === "root" || !(currentUser?.impersonatedBy && currentUser.impersonatedBy.id)) {
        toast({
          title: "Platform account restored",
          description: "You are using your administrator account again.",
          variant: "info",
        });
        router.push("/dashboard");
      } else {
        toast({
          title: "Could not return to platform account",
          description: err.response?.data?.message || "Please try again.",
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
    { section: "Account & Settings", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" /> },
  ] : isRootAdmin ? [
    // Platform Root Superadmin Navigation (Free of tenant clinical clutter)
    { section: "Platform Console", label: "Platform Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { section: "Organization management", label: "Organizations", href: "/dashboard/organizations", icon: <Building2 className="w-5 h-5" /> },
    { section: "Organization management", label: "Users & access", href: "/dashboard/admin/users", icon: <Users className="w-5 h-5" /> },
    { section: "Live supervision", label: "Live activity", href: "/dashboard/admin/monitor", icon: <Activity className="w-5 h-5" /> },
    { section: "Billing & revenue", label: "Plans & subscriptions", href: "/dashboard/admin/billing", icon: <CreditCard className="w-5 h-5" /> },
    { section: "Security & auditing", label: "Audit log", href: "/dashboard/audit", icon: <FileText className="w-5 h-5" /> },
    { section: "Security & auditing", label: "Platform settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
    { section: "Utilities", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" /> },
  ] : [
    // 1. Core Workspace
    { section: "Core Workspace", label: "Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" />, moduleKey: "dashboard" },
    { section: "Reporting", label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" />, moduleKey: "analytics" },

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
    { section: "Account & Settings", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" />, moduleKey: "notifications" },
    { section: "Account & Settings", label: "System Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" />, moduleKey: "settings" }
  ];

  const filteredNavItems = (isLoading || !user)
    ? []
    : orderNavigation(allNavItems.filter((item) => {
        // Overview and Notifications are always visible to authenticated users
        if (item.href === "/dashboard" || item.href === "/browse" || item.href === "/dashboard/notifications") return true;

        // Patient lab reports is allowed
        if (item.href === "/dashboard/laboratory" && user.role === "patient") return true;

        // Check route permission first
        const hasPermission = hasRoutePermission(item.href, user.role, user.permissions);
        if (!hasPermission) return false;

        // Platform root and portal users do not use tenant module toggles.
        if (requiresTenantModules(user) && item.moduleKey) {
          if (!isModuleEnabled(item.moduleKey)) return false;
        }

        return true;
      }), user.role);

  const clinicSelector = user && user.role !== "patient" && !isRootAdmin && headerClinics.length > 0 ? <Select
    size="sm"
    aria-label="Active clinic"
    options={[
      ...(headerClinics.length > 1 || hasAnyPermission(user, "MANAGE_CLINICS", "VIEW_CLINICS") ? [{ value: "all", label: "All Clinics" }] : []),
      ...headerClinics.map((clinic) => ({ value: clinic.id, label: clinic.name })),
    ]}
    value={activeClinicId || headerClinics[0]?.id || "all"}
    onChange={(event) => setActiveClinic(event.target.value)}
  /> : null;

  if (isLoggingOut) return <div role="status" aria-live="polite" className="min-h-dvh flex items-center justify-center bg-background text-text-secondary text-sm">Signing out…</div>;

  return (
    <div className="flex h-dvh overflow-hidden bg-background relative">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="overlay-backdrop fixed inset-0 z-[45] lg:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container — Desktop flow + Mobile Off-Canvas Drawer */}
      <div
        ref={drawerRef}
        id="dashboard-navigation"
        {...drawerGesture.handlers}
        style={{ translate: drawerGesture.offset ? `${drawerGesture.offset}px 0` : undefined, transition: drawerGesture.dragging ? "none" : undefined, touchAction: "pan-y pinch-zoom" }}
        role={mobileMenuOpen ? "dialog" : undefined}
        aria-modal={mobileMenuOpen || undefined}
        aria-label="Workspace navigation"
        tabIndex={-1}
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 shrink-0 h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          mobileMenuOpen
            ? "translate-x-0 opacity-100 visible pointer-events-auto shadow-lg"
            : "-translate-x-full opacity-0 invisible pointer-events-none lg:translate-x-0 lg:opacity-100 lg:visible lg:pointer-events-auto"
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed && !mobileMenuOpen}
          loading={isLoading || !user}
          brand={
            sidebarCollapsed && !mobileMenuOpen ? (
              <EkavyuIcon className="h-8 w-8" />
            ) : (
              <div className="w-full">
              <div className="flex items-center justify-between w-full">
                <EkavyuLogo size="md" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover lg:hidden transition-colors cursor-pointer"
                  aria-label="Close menu drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {clinicSelector && <div className="lg:hidden mt-3">{clinicSelector}</div>}
              </div>
            )
          }
          items={filteredNavItems.map(item => ({
            ...item,
            active: pathname === item.href
          }))}
          footer={<div className="w-full">
            <div className="lg:hidden flex items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary"><span>Appearance</span><ModeSwitcher variant="icon" /></div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover border border-border/40 hover:border-border transition-all duration-200 cursor-pointer hidden lg:flex"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {!sidebarCollapsed && <span className="tracking-tight">Collapse sidebar</span>}
              <span className={sidebarCollapsed ? "mx-auto" : ""}>
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </span>
            </button>
          </div>}
        />
      </div>

      <div className="flex-1 flex flex-col h-dvh overflow-hidden min-w-0">
        {/* Active Impersonation Top Banner */}
        {isImpersonating && user?.impersonatedBy && (
          <div className="bg-surface/95  border-b border-warning/30 dark:border-warning/20 px-3 sm:px-6 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xs z-50 shrink-0 text-xs sm:text-sm font-medium animate-fade-in relative overflow-hidden ">
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
              icon={<LogOut className="w-3.5 h-3.5 text-warning-text dark:text-warning-text" />}
              className="rounded-xl border-warning/40 hover:bg-warning/10 hover:border-warning/60 text-warning-text dark:text-warning-text font-semibold text-xs shrink-0 cursor-pointer shadow-2xs min-h-[32px]"
            >
              Exit
            </Button>
          </div>
        )}

        {/* Offline Status & Sync Alert Banner */}
        <OfflineStatusBanner />

        {/* Top Navbar */}
        <header data-app-header className="h-[calc(4rem+env(safe-area-inset-top))] min-h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] gap-2 border-b border-border/80 bg-surface/90 flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 z-40 relative shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-1 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover lg:hidden transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              aria-label="Toggle Navigation Drawer"
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <EkavyuLogo size="sm" className="lg:hidden shrink-0" />
            <p className="text-base md:text-lg font-semibold text-text capitalize hidden xl:block truncate">
              {user
                ? isRootAdmin
                  ? "Platform Superadmin Console"
                  : user.role === "admin"
                  ? "Organization Admin Dashboard"
                  : `${user.role} Dashboard`
                : "Clinical Workspace"}
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 xl:gap-4 min-w-0 shrink-0">
            {/* Only show Clinic selector when in operational clinic/tenant workspace */}
            {clinicSelector && <div className="hidden lg:block lg:w-48 xl:w-64 shrink-0">{clinicSelector}</div>}
            <NotificationBell />
            <div className="hidden lg:block"><ModeSwitcher variant="icon" /></div>
            <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 md:mx-2 hidden xl:block" />
            {user ? (
              <Dropdown
                trigger={
                  <button type="button" aria-label="Account menu" className="min-h-11 min-w-11 flex items-center gap-2 hover:bg-surface-hover p-1 pr-1.5 sm:pr-2 rounded-full transition-colors shrink-0 cursor-pointer">
                    <Avatar src={user.image_url} name={user.name} size="sm" status="online" />
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
                  { label: "Account security", onClick: () => router.push("/dashboard/security"), icon: <Lock className="w-4 h-4" /> },
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
                width="w-64"
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
        availableItems={filteredNavItems}
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
