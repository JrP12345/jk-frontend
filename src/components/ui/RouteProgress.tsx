"use client";

import { memo, useEffect, useId, useState } from "react";
import { useLinkStatus } from "next/link";

const pendingEvent = "ekavyu:navigation-pending";

/** Place inside a Next Link so feedback follows actual navigation, including cancellation. */
export function NavigationPending() {
  const { pending } = useLinkStatus();
  const id = useId();
  useEffect(() => {
    if (!pending) return;
    window.dispatchEvent(new CustomEvent(pendingEvent, { detail: { id, pending: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent(pendingEvent, { detail: { id, pending: false } }));
    };
  }, [id, pending]);
  return null;
}

export const RouteProgress = memo(function RouteProgress() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const active = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handlePending = (event: Event) => {
      const { id, pending } = (event as CustomEvent<{ id: string; pending: boolean }>).detail;
      if (pending) active.add(id);
      else active.delete(id);
      if (active.size && !timer) {
        timer = setTimeout(() => setVisible(true), 150);
      } else if (!active.size) {
        clearTimeout(timer);
        timer = undefined;
        setVisible(false);
      }
    };
    window.addEventListener(pendingEvent, handlePending);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(pendingEvent, handlePending);
    };
  }, []);
  if (!visible) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="fixed top-0 inset-x-0 z-[99999] h-0.5 overflow-hidden pointer-events-none bg-surface-alt">
      <div className="h-full w-1/3 bg-accent animate-route-progress motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
});

export default RouteProgress;
