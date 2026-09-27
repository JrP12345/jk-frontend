"use client";

import React from "react";
import Link from "next/link";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { LayoutDashboard, Calendar, Clock, Users, FileText, Receipt, Building2, Menu, Bell, Settings } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface MobileBottomNavProps {
  user: any;
  pathname: string;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
  availableItems?: Array<{ href: string; label: string }>;
}

interface NavTab {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
}

export function MobileBottomNav({
  user,
  pathname,
  onOpenMenu,
  isMenuOpen,
  availableItems,
}: MobileBottomNavProps) {
  if (!user) return null;

  // Determine top 4 tabs based on user role + 5th tab is always "More" (drawer)
  const getTabsForRole = (): NavTab[] => {
    switch (user.role) {
      case "doctor":
        return [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Queue", href: "/dashboard/queue", icon: Clock },
          { label: "Visits", href: "/dashboard/appointments", icon: Calendar },
          { label: "Patients", href: "/dashboard/patients", icon: Users },
        ];
      case "receptionist":
        return [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Queue", href: "/dashboard/queue", icon: Clock },
          { label: "Bookings", href: "/dashboard/appointments", icon: Calendar },
          { label: "Billing", href: "/dashboard/billing", icon: Receipt },
        ];
      case "patient":
        return [
          { label: "Home", href: "/dashboard", icon: LayoutDashboard },
          { label: "Bookings", href: "/dashboard/appointments", icon: Calendar },
          { label: "Records", href: "/dashboard/patient-portal", icon: FileText },
          { label: "Bills", href: "/dashboard/bills", icon: Receipt },
        ];
      case "root":
        return [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Tenants", href: "/dashboard/organizations", icon: Building2 },
          { label: "Users", href: "/dashboard/admin/users", icon: Users },
          { label: "Billing", href: "/dashboard/admin/billing", icon: Receipt },
        ];
      case "admin":
        return [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Schedule", href: "/dashboard/appointments", icon: Calendar },
          { label: "Clinicians", href: "/dashboard/staff", icon: Users },
          { label: "Branches", href: "/dashboard/clinics", icon: Building2 },
        ];
      default:
        return [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          { label: "Schedule", href: "/dashboard/appointments", icon: Calendar },
          { label: "Alerts", href: "/dashboard/notifications", icon: Bell },
          { label: "Settings", href: "/dashboard/settings", icon: Settings },
        ];
    }
  };

  const preferred = getTabsForRole().filter((tab) => !availableItems || availableItems.some((item) => item.href === tab.href));
  const remaining: NavTab[] = (availableItems || []).filter((item) => !preferred.some((tab) => tab.href === item.href)).map((item) => ({ ...item, icon: FileText }));
  const tabs: NavTab[] = [
    ...[...preferred, ...remaining].slice(0, 4),
    { label: "More", icon: Menu, isAction: true },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95  border-t border-border/80 shadow-lg px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
    >
      <div style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        className="grid items-center justify-items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            const isActive = isMenuOpen;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={onOpenMenu}
                className={cn(
                  "flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-xl transition-all duration-150 cursor-pointer min-h-[44px]",
                  isActive
                    ? "text-accent dark:text-accent font-bold"
                    : "text-text-muted hover:text-text hover:bg-surface-hover/50"
                )}
                aria-label="Open Full Navigation Menu"
                aria-expanded={isMenuOpen}
                aria-controls="dashboard-navigation"
              >
                <div className={cn("relative flex items-center justify-center rounded-lg transition-all duration-150", isActive && "bg-primary-500/10 px-3 py-1")}>
                  <Icon className={cn("w-5 h-5 transition-transform duration-150", isActive && "scale-110")} />
                </div>
                <span className="text-[11px] tracking-tight mt-0.5 font-medium truncate max-w-full">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-4 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400 mt-0.5" />
                )}
              </button>
            );
          }

          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href || "___");

          return (
            <Link
              key={tab.label}
              href={tab.href!}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-xl transition-all duration-150 cursor-pointer min-h-[44px]",
                isActive
                  ? "text-accent dark:text-accent font-bold"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/50"
              )}
            >
              <div className={cn("relative flex items-center justify-center rounded-lg transition-all duration-150", isActive && "bg-primary-500/10 px-3 py-1")}>
                <Icon className={cn("w-5 h-5 transition-transform duration-150", isActive && "scale-110")} />
              </div>
              <NavigationPending />
              <span className="text-[11px] tracking-tight mt-0.5 font-medium truncate max-w-full">
                {tab.label}
              </span>
              {isActive && (
                <span className="w-4 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
