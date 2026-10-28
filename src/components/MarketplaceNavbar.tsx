"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { useState, useRef, type ReactNode } from "react";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import Link from "next/link";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { ResumeTrackerLink } from "@/components/clinical/ResumeTrackerLink";
import { useAuthStore } from "@/store/authStore";
import { usePathname, useRouter } from "next/navigation";
import { Button, Avatar, Dropdown, EkavyuLogo, ModeSwitcher, Modal, Input } from "@/components/ui";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { Menu, Search, X } from "lucide-react";
import { getAvatarInitials } from "@/components/ui/Avatar";
import marketplace from "./MarketplaceLayout.module.css";

export default function MarketplaceNavbar({ brand, showSearch = true, showSignUp = false, searchSlot }: { brand?: { name: string; logoUrl?: string | null; href: string }; showSearch?: boolean; showSignUp?: boolean; searchSlot?: ReactNode }) {
  const { user, logout, isAuthenticated, isLoading, isLoggingOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchForm = (className: string) => <form role="search" action="/browse" method="get" className={className}>
    <Input type="search" name="search" variant="flush" aria-label="Search clinics, doctors or locations" placeholder="Search clinics, doctors or locations…" maxLength={160} containerClassName="min-w-0 flex-1" className="min-h-11! rounded-full px-3 text-sm" />
    <button type="submit" aria-label="Search care" className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-accent hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"><Search className="h-5 w-5" aria-hidden="true" /></button>
  </form>;
  const menuGesture = useSwipeGesture({ axis: "y", direction: "up", enabled: isMobileMenuOpen, onSwipe: () => setIsMobileMenuOpen(false) });
  const menuRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(isMobileMenuOpen, menuRef, () => setIsMobileMenuOpen(false));
  const isRealUser = isAuthenticated && !!user && (user.role as string) !== "guest";

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    window.location.replace("/browse?logout=1");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header data-app-header className={`${searchSlot ? marketplace.directoryHeader : ""} fixed top-0 left-0 right-0 h-16 bg-header border-b border-border/70 shadow-xs z-50`}>
      <div className={`${marketplace.content} h-full flex items-center justify-between gap-2`}>
        {isLoading && !isLoggingOut && <span role="status" className="sr-only">Checking account…</span>}
        {/* Brand/Logo */}
        {brand ? <Link href={brand.href} prefetch={false} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:gap-3">
          <NavigationPending />
          {brand.logoUrl ? (
            <LoadingImage src={brand.logoUrl} alt="" fallback={brand.name.slice(0, 1)} className="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface object-contain sm:h-10 sm:w-10" />
          ) : <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-base font-bold text-accent sm:h-10 sm:w-10">{brand.name.slice(0, 1)}</span>}
          <span className="min-w-0"><span className="block max-w-[9rem] truncate text-sm font-bold text-text sm:max-w-[18rem]">{brand.name}</span><span className="block text-[10px] text-text-secondary">Appointments powered by Ekavyu</span></span>
        </Link> : <Link href="/browse" prefetch={false} className="shrink-0">
          <NavigationPending />
          <EkavyuLogo size={showSignUp ? "md" : "sm"} layout={showSignUp ? "horizontal" : "stacked"} className={searchSlot ? "[&>span>span]:normal-case [&>span>span]:tracking-tight" : showSignUp ? "[&>span>span]:normal-case [&>span>span]:tracking-tight [&>span]:hidden sm:[&>span]:flex" : ""} />
        </Link>}

        {searchSlot && <div className={marketplace.directorySearch}>{searchSlot}</div>}
        {showSearch && searchForm("mx-3 hidden min-w-0 max-w-xl flex-1 items-center rounded-full border border-border bg-surface focus-within:ring-2 focus-within:ring-focus-ring md:flex")}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          {showSearch && <button type="button" aria-label="Search clinics and doctors" onClick={() => setSearchOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover md:hidden"><Search className="h-5 w-5" aria-hidden="true" /></button>}
          <ResumeTrackerLink />
          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center"><ModeSwitcher variant="icon" /></div>
            {isLoading || isLoggingOut ? (
              <span aria-hidden="true" className={`${showSignUp ? "w-[74px]" : "w-24"} h-11 shrink-0 rounded-xl bg-surface-alt/60 animate-pulse border border-border/40`} />
            ) : isRealUser && user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  className="inline-flex items-center justify-center px-3.5 h-8 rounded-xl text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <NavigationPending />
                  {"Go to Dashboard"}
                </Link>
                <Dropdown
                  trigger={
                    <button type="button" aria-label={`Account menu: ${getAvatarInitials(user.name)} ${user.name}`} className="min-h-11 flex items-center gap-2 hover:bg-surface-hover p-1 pr-2 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                      <span aria-hidden="true"><Avatar name={user.name} size="sm" status="online" /></span>{" "}
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
                prefetch={false}
                className={`inline-flex items-center justify-center px-3.5 rounded-xl text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${showSignUp ? "min-h-11 min-w-[74px] border border-border bg-surface text-text hover:bg-surface-hover" : "h-8 bg-primary text-brand-mist hover:bg-primary-hover"}`}
              >
                <NavigationPending />
                {"Sign In"}
              </Link>
            )}
          </div>

          {/* Guests have one destination, so keep it visible without a menu. */}
          <div className="flex items-center gap-1.5 md:hidden">
            {!isMobileMenuOpen && <div role="group" aria-label="Mobile appearance" className="inline-flex h-11 w-11 shrink-0 items-center justify-center"><ModeSwitcher variant="icon" /></div>}
            {isLoggingOut ? <span role="status" className="text-xs text-text-secondary">Signing out…</span> : isLoading ? <span aria-hidden="true" className="h-11 w-[70px] shrink-0 animate-pulse rounded-xl border border-border/40 bg-surface-alt/60" /> : isRealUser ? <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className={`p-2.5 text-text-secondary hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer ${isMobileMenuOpen ? "invisible pointer-events-none" : ""}`}
              aria-label="Toggle Menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button> : <Link href="/login" prefetch={false} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${showSignUp ? "min-w-[70px] border border-border bg-surface text-text hover:bg-surface-hover" : "bg-primary text-brand-mist hover:bg-primary-hover"}`}><NavigationPending />Sign in</Link>}
          </div>
          {showSignUp && isLoading && !isLoggingOut && <span aria-hidden="true" className="hidden min-[400px]:block h-11 w-[78px] shrink-0 animate-pulse rounded-xl border border-border/40 bg-surface-alt/60" />}
          {showSignUp && !isRealUser && !isLoading && !isLoggingOut && <Link href="/register" prefetch={false} className="hidden min-[400px]:inline-flex min-h-11 min-w-[78px] items-center justify-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-brand-mist hover:bg-primary-hover"><NavigationPending />Sign Up</Link>}
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
          <div ref={menuRef} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} id="mobile-nav-drawer" style={{ translate: menuGesture.offset ? `0 ${menuGesture.offset}px` : undefined, transition: menuGesture.dragging ? "none" : "translate 180ms ease" }} className="md:hidden absolute top-[4.5rem] left-3 right-3 ml-auto max-w-sm rounded-container border border-border bg-surface-elevated shadow-lg z-40 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain animate-slide-down">
          <div {...menuGesture.handlers} className="flex items-center justify-between px-4 py-1.5 border-b border-border/70 [touch-action:pan-x_pinch-zoom]">
            <span className="text-sm font-semibold text-text">Account</span>
            <button type="button" aria-label="Close navigation" onClick={() => setIsMobileMenuOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center text-text-secondary rounded-xl hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-3 space-y-2 flex flex-col">
            {pathname !== "/browse" && <Link
              href="/browse"
              prefetch={false}
              onClick={() => setIsMobileMenuOpen(false)}
              className="min-h-11 px-3 rounded-xl flex items-center text-sm font-medium text-text hover:text-accent hover:bg-surface-hover transition-colors"
            >
              <NavigationPending />
              {"Browse Locations"}
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
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Find care" size="md" presentation="sheet">
        {searchForm("flex min-w-0 items-center rounded-full border border-border bg-surface focus-within:ring-2 focus-within:ring-focus-ring")}
      </Modal>
    </header>
  );
}
