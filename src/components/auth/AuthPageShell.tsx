"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { EkavyuLogo, ModeSwitcher, cn } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import { NavigationPending } from "@/components/ui/RouteProgress";
import styles from "./AuthPageShell.module.css";

/** Shared account-entry frame, including recovery, setup and loading states. */
export default function AuthPageShell({ children, loadingLabel, wide = false }: { children: ReactNode; loadingLabel?: string; wide?: boolean }) {
  return <main className={styles.shell} data-auth-page>
    <aside className={styles.brand} aria-label="About Ekavyu">
      <EkavyuLogo size="md" className={styles.brandLogo} />
      <div className={styles.brandContent}>
        <h2>One workspace for every part of the clinic.</h2>
        <p>Appointments, queues, consultations, billing and pharmacy, connected for patients and staff.</p>
        <ul>{["Appointments and live queues", "Consultations and patient records", "Billing and pharmacy in one workspace"].map(item => <li key={item}><span aria-hidden="true"><Check /></span>{item}</li>)}</ul>
      </div>
      <p className={styles.brandFooter}>Care that keeps moving</p>
    </aside>
    <div className={styles.main}>
      <header className={styles.top}>
        <Link href="/browse" aria-label="Browse locations" className={buttonClassName({ variant: "outline", size: "sm", className: cn(styles.backLink, "min-h-11!") })}>
          <NavigationPending /><ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" /><span className={styles.backText}>Browse locations</span>
        </Link>
        <div className={styles.mobileBrand} data-auth-brand><EkavyuLogo size="md" /></div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center"><ModeSwitcher variant="icon" className="min-h-11 min-w-11" /></div>
      </header>
      <div className={styles.stage}>
        <div className={cn(styles.frame, wide && styles.wide)} data-auth-frame>
          {loadingLabel ? <div role="status" aria-label={loadingLabel} aria-busy="true"><div aria-hidden="true">{children}</div><span className="sr-only">{loadingLabel}…</span></div> : children}
        </div>
      </div>
    </div>
  </main>;
}
