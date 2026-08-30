"use client";

import { useAuthStore } from "@/store/authStore";
import { Sidebar, Button, Spinner, Dropdown, ModeSwitcher, PaletteSwitcher, Avatar, useToast, AnantLogo, AnantIcon, AnantaLogo, AnantaIcon, Select, PageTransition } from "@/components/ui";
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
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  SlidersHorizontal,
  Lock,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading, activeClinicId, setActiveClinic } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { clinics: headerClinics, fetchClinics } = useClinicStore();
  const { toast } = useToast();
  const { isLoaded: modulesLoaded, fetchModules, isModuleEnabled } = useModuleStore();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user && user.role !== "patient") {
      fetchClinics().then((list) => {
        if (list.length > 0 && (!activeClinicId || !list.some((c) => c.id === activeClinicId))) {
          setActiveClinic(list[0].id);
        }
      });
    }
  }, [user?.id, user?.organization_id, fetchClinics, activeClinicId, setActiveClinic]);

  // Fetch module toggle states once user is loaded
  useEffect(() => {
    if (user && !modulesLoaded && user.role !== "patient") {
      fetchModules();
    }
  }, [user, modulesLoaded, fetchModules]);

  useEffect(() => {
    if (!isLoading && user && !hasRoutePermission(pathname, user.role, user.permissions)) {
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

      toast({
        title: "Access Denied",
        description: message,
        variant: "error",
      });
    };

    window.addEventListener("auth-forbidden", handleForbidden);
    return () => window.removeEventListener("auth-forbidden", handleForbidden);
  }, [router, toast]);

  if (isLoading || (user && user.role !== "patient" && !modulesLoaded)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-alt animate-fade-in p-6">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <AnantLogo size="lg" />
          <Spinner size="md" label="Initializing workspace & permissions..." />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Proxy will handle redirect, but just in case
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const hasAccess = hasRoutePermission(pathname, user.role, user.permissions);
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" label="Redirecting..." />
      </div>
    );
  }

  // Navigation items logically organized for Patients vs Staff/Admin using clean Lucide icons
  const allNavItems = user.role === "patient" ? [
    { section: "My Health Care", label: "Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { section: "My Health Care", label: "My Appointments", href: "/dashboard/appointments", icon: <Calendar className="w-5 h-5" /> },
    { section: "My Health Care", label: "Patient Portal & Records", href: "/dashboard/patient-portal", icon: <User className="w-5 h-5" /> },
    { section: "My Health Care", label: "My Bills & Invoices", href: "/dashboard/bills", icon: <CreditCard className="w-5 h-5" /> },
    { section: "My Health Care", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" /> },
  ] : [
    // 1. Core Workspace
    { section: "Core Workspace", label: "Overview", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" />, moduleKey: "dashboard" },
    { section: "Core Workspace", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="w-5 h-5" />, moduleKey: "notifications" },
    { section: "Core Workspace", label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" />, moduleKey: "analytics" },
    ...(user.role === "root" ? [
      {
        section: "Core Workspace",
        label: "Organizations",
        href: "/dashboard/organizations",
        icon: <Building2 className="w-5 h-5" />
      },
      {
        section: "Core Workspace",
        label: "SaaS Plan Console",
        href: "/dashboard/admin/billing",
        icon: <CreditCard className="w-5 h-5" />
      }
    ] : []),

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
    { section: "Administration & Facilities", label: "Clinic Branches", href: "/dashboard/clinics", icon: <Building2 className="w-5 h-5" />, moduleKey: "clinics" },
    { section: "Administration & Facilities", label: "Staff Accounts", href: "/dashboard/staff", icon: <Users className="w-5 h-5" />, moduleKey: "staff" },
    { section: "Administration & Facilities", label: "Shift Roster", href: "/dashboard/shifts", icon: <Clock className="w-5 h-5" />, moduleKey: "shifts" },
    { section: "Administration & Facilities", label: "Audit Logs", href: "/dashboard/audit", icon: <FileText className="w-5 h-5" />, moduleKey: "audit" },
    { section: "Administration & Facilities", label: "Patient Feedback", href: "/dashboard/feedback", icon: <MessageSquare className="w-5 h-5" />, moduleKey: "feedback" },
    { section: "Administration & Facilities", label: "System Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" />, moduleKey: "settings" }
  ];

  const filteredNavItems = allNavItems.filter(item => {
    // Overview and Browse Clinics are public
    if (item.href === "/dashboard" || item.href === "/browse" || item.href === "/dashboard/notifications") return true;

    // Patient lab reports is allowed
    if (item.href === "/dashboard/laboratory" && user.role === "patient") return true;

    // Check route permission first
    const hasPermission = hasRoutePermission(item.href, user.role, user.permissions);
    if (!hasPermission) return false;

    // Module toggle filter: filter out disabled modules (applies to all roles except patient)
    if (user.role !== "patient" && (item as any).moduleKey) {
      if (!isModuleEnabled((item as any).moduleKey)) return false;
    }

    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt relative">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container — Desktop flow + Mobile Off-Canvas Drawer */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 transform ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out shrink-0 h-full flex flex-col`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          brand={
            sidebarCollapsed ? (
              <AnantIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            ) : (
              <AnantLogo size="md" />
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
        {/* Top Navbar */}
        <header className="h-16 border-b border-border/80 bg-surface/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 z-40 relative shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover md:hidden transition-colors cursor-pointer"
              aria-label="Toggle Navigation Drawer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <AnantLogo size="sm" className="md:hidden" />
            <h1 className="text-base md:text-lg font-semibold text-text capitalize hidden sm:block">
              {user.role === "root" ? "Root Super-Admin" : user.role === "admin" ? "Organization Admin" : user.role} Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {user.role !== "patient" && headerClinics.length > 0 && (
              <div className="w-44 sm:w-56 md:w-64">
                <Select
                  size="sm"
                  options={[
                    ...(headerClinics.length > 1 || hasAnyPermission(user, "MANAGE_CLINICS", "VIEW_CLINICS")
                      ? [{ value: "all", label: "All Clinics & Branches" }]
                      : []),
                    ...headerClinics.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={activeClinicId || (headerClinics[0] ? headerClinics[0].id : "all")}
                  onChange={(e) => setActiveClinic(e.target.value)}
                />
              </div>
            )}
            <NotificationBell />
            <div className="hidden sm:block">
              <PaletteSwitcher />
            </div>
            <ModeSwitcher />
            <div className="w-px h-6 bg-border mx-1 md:mx-2" />
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 hover:bg-surface-hover p-1 pr-2 rounded-full transition-colors">
                  <Avatar name={user.name} size="sm" status="online" />
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-text leading-tight">{user.name}</p>
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
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth w-full">
          <div className="w-full space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Global Floating AI Copilot Drawer Button */}
      <FloatingAICopilot />

      {/* Clinical Inactivity & Workstation Screen Lock */}
      <ClinicalScreenLock />
    </div>
  );
}
