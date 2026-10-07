"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/api";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let vid = localStorage.getItem("ekavyu_vid");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
      localStorage.setItem("ekavyu_vid", vid);
    }
    return vid;
  } catch {
    return "";
  }
}

export function useTrafficTracker(locationId?: string, organizationId?: string) {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastTrackedPath.current) return;

    // Small timeout to allow page title & referrer to settle
    const timeout = setTimeout(() => {
      try {
        lastTrackedPath.current = pathname;
        const visitorId = getOrCreateVisitorId();
        const routePath = pathname.split(/[?#]/, 1)[0].replace(/\/(?:[a-f\d]{24}|[a-f\d-]{36}|[A-Za-z\d_-]{32,})(?=\/|$)/gi, '/:id');
        let referrer = '';
        try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch { /* Invalid referrer is omitted. */ }
        api
          .post("/public/track-visit", {
            path: routePath,
            locationId,
            organizationId,
            visitorId,
            referrer,
          })
          .catch(() => {
            // Ignore analytics tracking failures silently
          });
      } catch {
        // Silently catch
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [pathname, locationId, organizationId]);
}
