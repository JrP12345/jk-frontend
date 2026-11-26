"use client";

import { useSyncExternalStore } from "react";

const mobileQuery = "(max-width: 767px)";

function subscribeMobile(notify: () => void) {
  const media = typeof window !== "undefined" ? window.matchMedia?.(mobileQuery) : undefined;
  media?.addEventListener("change", notify);
  return () => media?.removeEventListener("change", notify);
}

const mobileSnapshot = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(mobileQuery).matches);
const serverSnapshot = () => false;

/** Subscribes to the 767px mobile breakpoint while keeping SSR/jsdom deterministic at desktop width. */
export function useMobileViewport(): boolean {
  return useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
}
