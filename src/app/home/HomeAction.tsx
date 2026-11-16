"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/Button";

/** Shared button appearance with link semantics for the public entry points. */
export default function HomeAction({ href, secondary = false, event, children }: {
  href: string; secondary?: boolean; event?: string; children: ReactNode;
}) {
  return <Link href={href} prefetch={false} data-home-event={event} className={buttonClassName({
    variant: secondary ? "outline" : "primary", size: "lg",
  })}>{children}</Link>;
}
