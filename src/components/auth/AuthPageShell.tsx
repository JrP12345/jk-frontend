"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { EkavyuLogo, ModeSwitcher, cn } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import { NavigationPending } from "@/components/ui/RouteProgress";
import styles from "./AuthPageShell.module.css";

const AuthShellContext = createContext(false);

/** Shared account-entry frame, including recovery, setup and loading states. */
export default function AuthPageShell({ children, loadingLabel, wide = false }: { children: ReactNode; loadingLabel?: string; wide?: boolean }) {
  const inheritedShell = useContext(AuthShellContext);
  const content = loadingLabel ? <div role="status" aria-label={loadingLabel} aria-busy="true"><div aria-hidden="true">{children}</div><span className="sr-only">{loadingLabel}…</span></div> : children;
  if (inheritedShell) return <div className={cn(styles.entryContent, !wide && styles.entryNarrow)} data-auth-content>{content}</div>;
  return <AuthShellContext.Provider value={true}><main className={styles.shell} data-auth-page>
    <aside className={styles.brand} aria-label="About Ekavyu">
      <Link href="/" aria-label="Ekavyu home" className={styles.homeLink}><EkavyuLogo size="lg" appearance="on-dark" /></Link>
      <div className={styles.brandContent}>
        <h2>Care, connected.</h2>
        <p>Your visits and your team’s workspace, in one place.</p>
        <ul>{["Patient appointments and visit updates", "Clinic and hospital workspaces", "Pharmacy inventory and sales"].map(item => <li key={item}><span aria-hidden="true"><Check /></span>{item}</li>)}</ul>
      </div>
      <p className={styles.brandFooter}>For patients and care teams.</p>
    </aside>
    <div className={styles.main}>
      <header className={styles.top}>
        <Link href="/browse" aria-label="Browse locations" className={buttonClassName({ variant: "outline", size: "sm", className: cn(styles.backLink, "min-h-11!") })}>
          <NavigationPending /><ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" /><span className={styles.backText}>Browse locations</span>
        </Link>
        <Link href="/" aria-label="Ekavyu home" className={styles.mobileBrand} data-auth-brand><EkavyuLogo size="md" /></Link>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center"><ModeSwitcher variant="icon" className="min-h-11 min-w-11" /></div>
      </header>
      <div className={styles.stage}>
        <div className={cn(styles.frame, wide && styles.wide)} data-auth-frame>
          {content}
        </div>
      </div>
    </div>
  </main></AuthShellContext.Provider>;
}
