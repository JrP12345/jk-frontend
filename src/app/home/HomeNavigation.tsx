"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import Button, { buttonClassName } from "@/components/ui/Button";
import { ModeSwitcher } from "@/components/ui/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import styles from "./home.module.css";

const links = [
  { href: "#for-patients", label: "Patients" },
  { href: "#for-organizations", label: "Clinics & hospitals" },
  { href: "#for-pharmacies", label: "Pharmacies" },
  { href: "#plans", label: "Plans" },
];

export default function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { user, isAuthenticated } = useAuthStore();
  const signedIn = isAuthenticated && user && (user.role as string) !== "guest";

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnDesktop = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("resize", dismissOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("resize", dismissOnDesktop);
    };
  }, [open]);

  return (
    <header ref={header} className={styles.header} data-app-header onKeyDown={event => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <div className={`${styles.container} ${styles.navBar}`}>
        <Link href="/" className={styles.brand} aria-label="Ekavyu home"><EkavyuLogo size="sm" /></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <div className={styles.navAppearance}><ModeSwitcher variant="icon" /></div>
          <Link href={signedIn ? "/dashboard" : "/login"} prefetch={false} className={buttonClassName({ variant: "outline", size: "lg" })} data-home-event="home_sign_in">
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
          <Button
            ref={menuButton}
            variant="outline"
            className={styles.menuButton}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="home-mobile-navigation"
            onClick={() => setOpen(value => !value)}
          >
            {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <nav
        id="home-mobile-navigation"
        className={styles.mobileNav}
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight size={16} aria-hidden="true" /></a>)}
        <Link href="/browse" prefetch={false} onClick={() => setOpen(false)}>Browse care <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link href="/onboarding?mode=new_org" prefetch={false} onClick={() => setOpen(false)}>Request setup <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link href="/pharmacy-start" prefetch={false} onClick={() => setOpen(false)}>Start pharmacy onboarding <ArrowRight size={16} aria-hidden="true" /></Link>
        <div className={styles.mobileAppearance}><span>Appearance</span><ModeSwitcher variant="icon" /></div>
      </nav>
    </header>
  );
}
