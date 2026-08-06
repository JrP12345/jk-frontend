"use client";

import { useAuthStore } from "@/store/authStore";
import { Sidebar, Button, Spinner, Dropdown, ModeSwitcher, PaletteSwitcher, Avatar, useToast, AnantaLogo, AnantaIcon, Select } from "@/components/ui";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { hasRoutePermission } from "@/lib/routePermissions";
import { FloatingAICopilot } from "@/components/ai/FloatingAICopilot";
import { useModuleStore } from "@/store/moduleStore";
import api from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading, activeClinicId, setActiveClinic } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerClinics, setHeaderClinics] = useState<Array<{ id: string; name: string; city: string }>>([]);
  const { toast } = useToast();
  const { isLoaded: modulesLoaded, fetchModules, isModuleEnabled } = useModuleStore();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user && user.role !== "patient") {
      api.get("/onboarding/clinics")
        .then((res) => {
          const list = res.data.data || [];
          setHeaderClinics(list);
          if (list.length > 0 && (!activeClinicId || !list.some((c: any) => c.id === activeClinicId))) {
            setActiveClinic(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.organization_id]);

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

  // Navigation items logically organized: Core -> Clinical Care -> Diagnostics/Pharmacy -> Management -> System Governance
  const allNavItems = [
    // 1. Core Workspace
    { section: "Core Workspace", label: "Overview", href: "/dashboard", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, moduleKey: "dashboard" },
    { section: "Core Workspace", label: "Notifications", href: "/dashboard/notifications", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>, moduleKey: "notifications" },
    { section: "Core Workspace", label: "Analytics", href: "/dashboard/analytics", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, moduleKey: "analytics" },
    ...(user.role === "root" ? [
      {
        section: "Core Workspace",
        label: "Organizations",
        href: "/dashboard/organizations",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      },
      {
        section: "Core Workspace",
        label: "SaaS Plan Console",
        href: "/dashboard/admin/billing",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      }
    ] : []),

    // 2. Outpatient Care (OPD)
    ...(user.role !== "patient" ? [
      { section: "Outpatient (OPD)", label: "Queue Desk", href: "/dashboard/queue", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, moduleKey: "queue" }
    ] : []),
    { section: "Outpatient (OPD)", label: "Appointments", href: "/dashboard/appointments", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, moduleKey: "appointments" },
    { section: "Outpatient (OPD)", label: "Consultations", href: "/dashboard/consultations", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, moduleKey: "consultations" },
    { section: "Outpatient (OPD)", label: "Teleconsultation", href: "/dashboard/teleconsultation", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>, moduleKey: "teleconsultation" },
    ...(user.role !== "patient" ? [
      {
        section: "Outpatient (OPD)",
        label: "Patients Directory",
        href: "/dashboard/patients",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        moduleKey: "patients"
      },
      {
        section: "Outpatient (OPD)",
        label: "CDS Engine",
        href: "/dashboard/cds",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        moduleKey: "cds"
      },
      {
        section: "Outpatient (OPD)",
        label: "Ambulance Dispatch",
        href: "/dashboard/ambulance-dispatch",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM3 9h11v7H3V9zm11 2h4l3 3v2h-7v-5z" /></svg>,
        moduleKey: "ambulance-dispatch"
      },
      {
        section: "Outpatient (OPD)",
        label: "Home RPM",
        href: "/dashboard/home-rpm",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        moduleKey: "home-rpm"
      }
    ] : []),

    // 3. Inpatient & Emergency (IPD)
    ...(user.role !== "patient" ? [
      {
        section: "Inpatient & Emergency",
        label: "Emergency Triage",
        href: "/dashboard/emergency",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        moduleKey: "emergency"
      },
      {
        section: "Inpatient & Emergency",
        label: "Ward Admissions",
        href: "/dashboard/admissions",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
        moduleKey: "admissions"
      },
      {
        section: "Inpatient & Emergency",
        label: "Operating Theatre (OT)",
        href: "/dashboard/ot",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        moduleKey: "ot"
      },
      {
        section: "Inpatient & Emergency",
        label: "Dietary & Nutrition",
        href: "/dashboard/dietary",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
        moduleKey: "dietary"
      },
      {
        section: "Inpatient & Emergency",
        label: "Transplant Management",
        href: "/dashboard/transplant",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
        moduleKey: "transplant"
      }
    ] : []),

    // 4. Diagnostics & Pharmacy
    {
      section: "Diagnostics & Pharmacy",
      label: "Laboratory & LIS",
      href: "/dashboard/laboratory",
      icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      moduleKey: "laboratory"
    },
    {
      section: "Diagnostics & Pharmacy",
      label: "Radiology & PACS",
      href: "/dashboard/radiology",
      icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      moduleKey: "radiology"
    },
    ...(user.role !== "patient" ? [
      {
        section: "Diagnostics & Pharmacy",
        label: "Pharmacy Inventory",
        href: "/dashboard/pharmacy",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.13a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
        moduleKey: "pharmacy"
      },
      {
        section: "Diagnostics & Pharmacy",
        label: "Blood Bank",
        href: "/dashboard/blood-bank",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.13a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
        moduleKey: "blood-bank"
      },
      {
        section: "Diagnostics & Pharmacy",
        label: "Genetics & Molecular",
        href: "/dashboard/genetics",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
        moduleKey: "genetics"
      },
      {
        section: "Diagnostics & Pharmacy",
        label: "HBOT Therapy",
        href: "/dashboard/hbot",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        moduleKey: "hbot"
      },
      {
        section: "Diagnostics & Pharmacy",
        label: "FHIR Gateway",
        href: "/dashboard/fhir",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-4 4h4m-8 0H4a1 1 0 01-1-1V5a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1h-4" /></svg>,
        moduleKey: "fhir"
      }
    ] : []),

    // 5. Billing & Finance
    ...(user.role !== "patient" ? [
      {
        section: "Billing & Finance",
        label: "Patient Invoicing",
        href: "/dashboard/billing",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
        moduleKey: "billing"
      },
      {
        section: "Billing & Finance",
        label: "Insurance & Claims",
        href: "/dashboard/insurance",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        moduleKey: "insurance"
      },
      {
        section: "Billing & Finance",
        label: "Service Catalog",
        href: "/dashboard/billing/services",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        moduleKey: "service-catalog"
      }
    ] : []),

    ...(user.role === "patient" ? [
      {
        section: "Billing & Finance",
        label: "Patient Portal",
        href: "/dashboard/patient-portal",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      },
      {
        section: "Billing & Finance",
        label: "My Invoices",
        href: "/dashboard/bills",
        icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      }
    ] : []),

    // 6. Administration & Facilities
    ...(user.role !== "patient" ? [
      { section: "Administration & Facilities", label: "Clinic Branches", href: "/dashboard/clinics", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>, moduleKey: "clinics" },
      { section: "Administration & Facilities", label: "Staff Accounts", href: "/dashboard/staff", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, moduleKey: "staff" },
      { section: "Administration & Facilities", label: "Shift Roster", href: "/dashboard/shifts", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, moduleKey: "shifts" },
      { section: "Administration & Facilities", label: "Biomedical Assets", href: "/dashboard/biomedical", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, moduleKey: "biomedical" },
      { section: "Administration & Facilities", label: "CSSD Sterilization", href: "/dashboard/cssd", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, moduleKey: "cssd" },
      { section: "Administration & Facilities", label: "Biohazard Waste", href: "/dashboard/biohazard", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, moduleKey: "biohazard" },
      { section: "Administration & Facilities", label: "Infection Control", href: "/dashboard/infection-control", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>, moduleKey: "infection-control" },
      { section: "Administration & Facilities", label: "Occupational Health", href: "/dashboard/occupational-health", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, moduleKey: "occupational-health" },
      { section: "Administration & Facilities", label: "Mortuary Desk", href: "/dashboard/mortuary", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, moduleKey: "mortuary" },
      { section: "Administration & Facilities", label: "Audit Logs", href: "/dashboard/audit", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, moduleKey: "audit" },
      { section: "Administration & Facilities", label: "Patient Feedback", href: "/dashboard/feedback", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>, moduleKey: "feedback" }
    ] : []),
    { section: "Administration & Facilities", label: "System Settings", href: "/dashboard/settings", icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>, moduleKey: "settings" }
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
        <header className="h-16 border-b border-border/80 bg-surface/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 z-40 relative shadow-2xs">
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
            <h1 className="text-base md:text-lg font-semibold text-text capitalize hidden sm:block">
              {user.role === "root" ? "Root Super-Admin" : user.role === "admin" ? "Organization Admin" : user.role} Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {user.role !== "patient" && headerClinics.length > 0 && (
              <div className="hidden md:block w-48 sm:w-56">
                <Select
                  size="sm"
                  options={headerClinics.map((c) => ({ value: c.id, label: `📍 ${c.name}` }))}
                  value={activeClinicId || (headerClinics[0] ? headerClinics[0].id : "")}
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
                  onClick: () => router.push("/dashboard/settings"),
                  icon: (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )
                },
                { divider: true, label: "" },
                { 
                  label: "Sign out", 
                  onClick: handleLogout, 
                  danger: true,
                  icon: (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  )
                }
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

      {/* Global Floating AI Copilot Drawer Button */}
      <FloatingAICopilot />
    </div>
  );
}
