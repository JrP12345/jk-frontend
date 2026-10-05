"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import Button from "@/components/ui/Button";
import { ModeSwitcher } from "@/components/ui/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import styles from "./home.module.css";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-organizations", label: "For healthcare teams" },
  { href: "#plans", label: "Plans" },
];

export default function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { user, isAuthenticated } = useAuthStore();
  const signedIn = isAuthenticated && user && (user.role as string) !== "guest";

  return (
    <header className={styles.header} data-app-header>
      <div className={`${styles.container} ${styles.navBar}`}>
        <Link href="/" aria-label="Ekavyu home"><EkavyuLogo size="md" /></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <ModeSwitcher variant="icon" />
          <Link href={signedIn ? "/dashboard" : "/login"} className={styles.signIn} data-home-event="home_sign_in">
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
          <Link href="/browse" className={`${styles.signIn} ${styles.navPatientLink}`} data-home-event="home_find_care">Find care</Link>
          <Link href="/onboarding?mode=new_org" className={styles.navCta} data-home-event="home_organization_setup">Request setup <ArrowRight size={16} aria-hidden="true" /></Link>
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
        onKeyDown={event => {
          if (event.key === "Escape") {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight size={16} aria-hidden="true" /></a>)}
        <a href="#for-patients" onClick={() => setOpen(false)}>For patients <ArrowRight size={16} aria-hidden="true" /></a>
        <Link href="/browse" onClick={() => setOpen(false)}>Find care <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link href="/onboarding?mode=new_org" onClick={() => setOpen(false)}>Request setup <ArrowRight size={16} aria-hidden="true" /></Link>
      </nav>
    </header>
  );
}
