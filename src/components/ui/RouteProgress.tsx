"use client";

import { useEffect, useState, useRef, memo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * RouteProgress
 * A subtle, sleek top-of-viewport loading bar that activates during client-side navigation.
 * Provides immediate, calm visual feedback without placing disruptive spinners in the center of the screen.
 */
export const RouteProgress = memo(function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Complete the progress on path or query change
  useEffect(() => {
    if (loading) {
      setProgress(100);
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setLoading(false);
        setProgress(0);
      }, 250);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [pathname, searchParams]);

  // Intercept internal link clicks to trigger progress bar immediately
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      // Only handle internal relative links or same-origin navigation
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || targetAttr === "_blank") {
        return;
      }

      // If linking to the exact same pathname + hash, ignore
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && (url.pathname !== window.location.pathname || url.search !== window.location.search)) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);

          setVisible(true);
          setLoading(true);
          setProgress(15);

          // Incrementally crawl progress to simulate network request
          progressTimerRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 85) {
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                return prev;
              }
              const step = Math.max(1, (85 - prev) * 0.2);
              return Math.min(85, prev + step);
            });
          }, 120);
        }
      } catch {
        // Safe fallback for invalid URL parsing
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Navigation progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="fixed top-0 left-0 right-0 z-[99999] h-[2.5px] pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-primary-600 via-primary-400 to-indigo-400 dark:from-primary-500 dark:via-primary-300 dark:to-cyan-400 shadow-[0_0_8px_rgba(37,99,235,0.6)] dark:shadow-[0_0_8px_rgba(56,189,248,0.7)] transform-gpu transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-in" : "width 200ms ease-out",
        }}
      />
    </div>
  );
});

export default RouteProgress;
