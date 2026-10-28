"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EkavyuLogo, ModeSwitcher } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import { NavigationPending } from "@/components/ui/RouteProgress";

/** A stable frame for sign-in and registration, including their loading states. */
export default function AuthPageShell({ children, loadingLabel }: { children: ReactNode; loadingLabel?: string }) {
  return <main className="relative min-h-dvh bg-surface text-text" data-auth-page>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 brand-wash" />
    <header className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <Link href="/browse" className={buttonClassName({ variant: "outline", className: "min-h-11!" })}>
        <NavigationPending /><ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />Browse locations
      </Link>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center"><ModeSwitcher variant="icon" /></div>
    </header>
    <div className="relative z-10 mx-auto w-full max-w-lg px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 sm:px-0 sm:pt-6" data-auth-frame>
      <div className="mb-6 flex flex-col items-center text-center" data-auth-brand>
        <EkavyuLogo size="xl" layout="stacked" showTagline />
      </div>
      {loadingLabel ? <div role="status" aria-label={loadingLabel} aria-busy="true"><div aria-hidden="true">{children}</div><span className="sr-only">{loadingLabel}…</span></div> : children}
    </div>
  </main>;
}
