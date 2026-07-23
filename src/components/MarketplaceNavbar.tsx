"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button, Avatar, Dropdown, ModeSwitcher, AnantaLogo } from "@/components/ui";

export default function MarketplaceNavbar() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navigateTo = (path: string) => {
    setIsMobileMenuOpen(false);
    router.push(path);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b border-border bg-surface/85 backdrop-blur-md z-50 transition-all duration-300">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        
        {/* Brand/Logo */}
        <Link href="/browse">
          <AnantaLogo size="md" />
        </Link>

        {/* Desktop Navigation Items */}
        <div className="hidden md:flex items-center gap-4">
          <ModeSwitcher />
          
          <div className="w-px h-6 bg-border mx-1" />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="text-text-secondary hover:text-text"
              >
                Go to Dashboard
              </Button>
              
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 hover:bg-surface-hover p-1 pr-2 rounded-full transition-colors cursor-pointer focus:outline-none">
                    <Avatar name={user.name} size="sm" status="online" />
                    <span className="text-sm font-medium text-text truncate max-w-[120px]">
                      {user.name}
                    </span>
                  </button>
                }
                items={[
                  { label: "Overview", onClick: () => router.push("/dashboard") },
                  { label: "My Appointments", onClick: () => router.push("/dashboard/appointments") },
                  { divider: true, label: "" },
                  { label: "Sign out", onClick: handleLogout, danger: true }
                ]}
                align="right"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/login")}
                className="text-text-secondary hover:text-text"
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/onboarding")}
                className="shadow-sm"
              >
                Register Clinic
              </Button>
            </div>
          )}
        </div>

        {/* Mobile menu toggle (hamburger) */}
        <div className="flex items-center gap-3 md:hidden">
          <ModeSwitcher />
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-text-secondary hover:text-text focus:outline-none rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Toggle Menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 border-b border-border bg-surface shadow-lg z-40 overflow-hidden">
          <div className="p-5 space-y-4 flex flex-col">
            <Link 
              href="/browse"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-text hover:text-primary-600 py-1 transition-colors border-b border-border/40 pb-2"
            >
              Browse Clinics
            </Link>

            {isAuthenticated && user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-surface-alt p-3 rounded-lg border border-border/60">
                  <Avatar name={user.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{user.name}</p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    <span className="inline-block bg-primary-50 text-primary-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border border-primary-200 capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-sm"
                    onClick={() => navigateTo("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-sm"
                    onClick={() => navigateTo("/dashboard/appointments")}
                  >
                    My Appointments
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full justify-start text-sm text-left font-semibold mt-2"
                    onClick={handleLogout}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="outline"
                  className="w-full text-center"
                  onClick={() => navigateTo("/login")}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  className="w-full text-center shadow-sm"
                  onClick={() => navigateTo("/onboarding")}
                >
                  Register Clinic
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
