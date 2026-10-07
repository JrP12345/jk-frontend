"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { useTrackerStore } from "@/store/trackerStore";
import { useAuthStore } from "@/store/authStore";

/** One contextual header entry restores a tracker after its ticket/tab closes. */
export function ResumeTrackerLink() {
  const { recent, hydrate } = useTrackerStore();
  const ownerId = useAuthStore(state => state.user?.id || null);
  const pathname = usePathname();
  useEffect(() => { hydrate(); }, [hydrate, pathname]);
  if (!recent?.token || recent.ownerId !== ownerId || recent.expiresAt <= Date.now() || pathname?.startsWith("/track/")) return null;
  return <Link href={`/track/${recent.appointmentId}#t=${encodeURIComponent(recent.token)}`} prefetch={false}
    aria-label="Reopen live appointment tracker" title="Reopen live tracker"
    className="flex items-center justify-center gap-2 h-11 w-11 md:w-auto md:px-3 shrink-0 rounded-xl border border-border bg-surface text-accent hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
    <Clock className="w-4 h-4" strokeWidth={1.75} />
    <span className="hidden md:inline text-sm font-medium">Live tracker</span>
  </Link>;
}
