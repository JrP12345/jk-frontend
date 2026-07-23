"use client";

import { useAuthStore } from "@/store/authStore";
import { Sidebar, Button, Spinner, Dropdown, ModeSwitcher, PaletteSwitcher, Avatar, useToast, AnantaLogo, AnantaIcon } from "@/components/ui";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { hasRoutePermission } from "@/lib/routePermissions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" label="Loading workspace..." />
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

  // Navigation logic based on role
  const allNavItems = [
    { label: "Overview", href: "/dashboard", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { label: "Appointments", href: "/dashboard/appointments", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },

    // Staff-only clinical features
    ...(user.role !== "patient" ? [
      {
        label: "Queue",
        href: "/dashboard/queue",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      },
      {
        label: "Admissions",
        href: "/dashboard/admissions",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      },
      {
        label: "Pharmacy",
        href: "/dashboard/pharmacy",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.13a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
      }
    ] : []),

    {
      label: "Laboratory",
      href: "/dashboard/laboratory",
      icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    },

    // Staff Billing
    ...(user.role !== "patient" ? [
      {
        label: "Billing",
        href: "/dashboard/billing",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      }
    ] : []),

    // Patient Bills
    ...(user.role === "patient" ? [
      {
        label: "My Invoices",
        href: "/dashboard/bills",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      }
    ] : []),

    { label: "Clinics", href: "/dashboard/clinics", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { label: "Staff", href: "/dashboard/staff", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    {
      label: "Analytics",
      href: "/dashboard/analytics",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      label: "Audit Logs",
      href: "/dashboard/audit",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { label: "Settings", href: "/dashboard/settings", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
  ];

  const filteredNavItems = allNavItems.filter(item => {
    // Overview and Browse Clinics are public
    if (item.href === "/dashboard" || item.href === "/browse") return true;

    // Patient lab reports is allowed
    if (item.href === "/dashboard/laboratory" && user.role === "patient") return true;

    // Otherwise, check route permission
    return hasRoutePermission(item.href, user.role, user.permissions);
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
        } md:translate-x-0 transition-transform duration-300 ease-in-out shrink-0 h-full`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          brand={
            sidebarCollapsed ? (
              <AnantaIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            ) : (
              <AnantaLogo size="md" />
            )
          }
          items={filteredNavItems.map(item => ({
            ...item,
            active: pathname === item.href
          }))}
          footer={
            <Button variant="ghost" size="sm" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="w-full flex justify-center text-text-muted hover:text-text hidden md:flex">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
              </svg>
            </Button>
          }
        />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover md:hidden transition-colors cursor-pointer"
              aria-label="Toggle Navigation Drawer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <AnantaLogo size="sm" className="md:hidden" />
            <h1 className="text-base md:text-lg font-semibold text-text capitalize hidden sm:block">{user.role} Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:block">
              <PaletteSwitcher />
            </div>
            <ModeSwitcher />
            <div className="w-px h-6 bg-border mx-1 md:mx-2" />
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 hover:bg-surface-hover p-1 pr-2 rounded-full transition-colors">
                  <Avatar name={user.name} size="sm" status="online" />
                  <span className="text-sm font-medium text-text hidden sm:block">{user.name}</span>
                </button>
              }
              items={[
                { label: "Profile", onClick: () => router.push("/dashboard/settings") },
                { label: "Settings", onClick: () => router.push("/dashboard/settings") },
                { divider: true, label: "" },
                { label: "Sign out", onClick: handleLogout, danger: true }
              ]}
              align="right"
            />
          </div>
        </header>

        {/* Main Content Area (Uniform 100% Symmetrical Padding on Top, Left, Right & Bottom) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth w-full">
          <div className="w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
