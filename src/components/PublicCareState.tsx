"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Card } from "@/components/ui";
import marketplace from "@/components/MarketplaceLayout.module.css";
import { buttonClassName } from "@/components/ui/Button";

/** Keep unavailable public profiles connected to the same care navigation. */
export default function PublicCareState({ title, description, children, role }: {
  title: string;
  description: string;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  return <div className={marketplace.page}>
    <MarketplaceNavbar showSignUp showSearch={false} />
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-8 sm:py-16">
      <Card padding="lg"><section role={role} className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
        <p className="text-sm leading-7 text-text-secondary">{description}</p>
        {children ?? <Link href="/browse" className={buttonClassName({ size: "lg" })}>Browse locations</Link>}
      </section></Card>
    </main>
  </div>;
}
