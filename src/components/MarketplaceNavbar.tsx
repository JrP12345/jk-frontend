"use client";

import { useState, useRef } from "react";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import Link from "next/link";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { ResumeTrackerLink } from "@/components/clinical/ResumeTrackerLink";
import { useAuthStore } from "@/store/authStore";
import { usePathname, useRouter } from "next/navigation";
import { Button, Avatar, Dropdown, EkavyuLogo, ModeSwitcher } from "@/components/ui";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { Menu, X } from "lucide-react";

export default function MarketplaceNavbar() {
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuGesture = useSwipeGesture({ axis: "y", direction: "up", enabled: isMobileMenuOpen, onSwipe: () => setIsMobileMenuOpen(false) });
  const menuRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(isMobileMenuOpen, menuRef, () => setIsMobileMenuOpen(false));
  const isRealUser = isAuthenticated && !!user && (user.role as string) !== "guest";

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header data-app-header className="fixed top-0 left-0 right-0 h-16 border-b border-border/70 shadow-xs z-50 transition-all duration-300">
      {/* Blur the background layer so fixed mobile overlays remain viewport-sized. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none bg-surface supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-2">
        {/* Brand/Logo */}
        <Link href="/browse" className="shrink-0">
          <NavigationPending />
          <EkavyuLogo size="md" />
        </Link>

        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          <ResumeTrackerLink />
          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-3">
            <ModeSwitcher variant="icon" />
            {isLoading ? (
              <div className="w-24 h-9 rounded-xl bg-surface-alt/60 animate-pulse border border-border/40" />
            ) : isRealUser && user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-3.5 h-8 rounded-xl text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <NavigationPending />
                  {"Go to Dashboard"}
                </Link>
                <Dropdown
                  trigger={
                    <button type="button" aria-label="Account menu" className="min-h-11 flex items-center gap-2 hover:bg-surface-hover p-1 pr-2 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                      <Avatar name={user.name} size="sm" status="online" />
                      <span className="text-sm font-medium text-text truncate max-w-[120px]">{user.name}</span>
                    </button>
                  }
                  items={[
                    { label: "Overview", onClick: () => router.push("/dashboard") },
                    { label: "My Appointments", onClick: () => router.push("/dashboard/appointments") },
                    { divider: true, label: "" },
                    { label: "Sign out", onClick: handleLogout, danger: true }
                  ]}
                  align="right"
                  width="w-64"
                />
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-3.5 h-8 rounded-xl text-sm font-medium bg-primary text-brand-mist hover:bg-primary-hover shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <NavigationPending />
                {"Sign In"}
              </Link>
            )}
          </div>

          {/* Guests have one destination, so keep it visible without a menu. */}
          <div className="flex items-center gap-1.5 md:hidden">
            {!isMobileMenuOpen && <div role="group" aria-label="Mobile appearance"><ModeSwitcher variant="icon" /></div>}
            {isLoading ? <div className="h-11 w-16 rounded-xl bg-surface-alt/60 animate-pulse" /> : isRealUser ? <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className={`p-2.5 text-text-secondary hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer ${isMobileMenuOpen ? "invisible pointer-events-none" : ""}`}
              aria-label="Toggle Menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button> : <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-brand-mist hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"><NavigationPending />Sign in</Link>}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Dropdown & Backdrop */}
      {isMobileMenuOpen && isRealUser && (
        <>
          <div
            className="overlay-backdrop md:hidden fixed inset-0 top-16 z-30"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div ref={menuRef} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} id="mobile-nav-drawer" style={{ translate: menuGesture.offset ? `0 ${menuGesture.offset}px` : undefined, transition: menuGesture.dragging ? "none" : "translate 180ms ease" }} className="md:hidden absolute top-[4.5rem] left-3 right-3 ml-auto max-w-sm rounded-2xl border border-border bg-surface shadow-xl z-40 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain animate-slide-down">
          <div {...menuGesture.handlers} className="flex items-center justify-between px-4 py-1.5 border-b border-border/70 [touch-action:pan-x_pinch-zoom]">
            <span className="text-sm font-semibold text-text">Account</span>
            <button type="button" aria-label="Close navigation" onClick={() => setIsMobileMenuOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center text-text-secondary rounded-xl hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-3 space-y-2 flex flex-col">
            {pathname !== "/browse" && <Link
              href="/browse"
              onClick={() => setIsMobileMenuOpen(false)}
              className="min-h-11 px-3 rounded-xl flex items-center text-sm font-medium text-text hover:text-accent hover:bg-surface-hover transition-colors"
            >
              <NavigationPending />
              {"Browse Clinics"}
            </Link>}

            {isRealUser && user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={user.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{user.name}</p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 border-t border-border/70 pt-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm min-h-[44px] flex items-center"
                    onClick={() => { setIsMobileMenuOpen(false); router.push("/dashboard"); }}
                  >
                    {"Go to Dashboard"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm min-h-[44px] flex items-center"
                    onClick={() => { setIsMobileMenuOpen(false); router.push("/dashboard/appointments"); }}
                  >
                    {"My Appointments"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm text-left text-danger-text min-h-[44px] flex items-center"
                    onClick={handleLogout}
                  >
                    {"Sign out"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        </>
      )}
    </header>
  );
}
