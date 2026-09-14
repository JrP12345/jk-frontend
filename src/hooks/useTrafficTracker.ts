"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/api";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let vid = localStorage.getItem("ananta_vid");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
      localStorage.setItem("ananta_vid", vid);
    }
    return vid;
  } catch {
    return "";
  }
}

export function useTrafficTracker(clinicId?: string, organizationId?: string) {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastTrackedPath.current) return;
    lastTrackedPath.current = pathname;

    // Small timeout to allow page title & referrer to settle
    const timeout = setTimeout(() => {
      try {
        const visitorId = getOrCreateVisitorId();
        api
          .post("/public/track-visit", {
            path: pathname,
            clinicId,
            organizationId,
            visitorId,
            referrer: typeof document !== "undefined" ? document.referrer : "",
          })
          .catch(() => {
            // Ignore analytics tracking failures silently
          });
      } catch {
        // Silently catch
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [pathname, clinicId, organizationId]);
}
