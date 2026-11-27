"use client";

import { memo } from "react";
import { cn } from "./utils";

/**
 * LogoLoader — Ekavyu brand animation for page-level loading states.
 *
 * Uses the two-blade SVG logo with a CSS keyframe animation matching the
 * Lottie sequence (Logo_Loader.json): blades fade in from offset positions,
 * converge to centre, hold, then separate again on loop.
 *
 * Usage:
 *   <LogoLoader />               — standard page loader, light/dark aware
 *   <LogoLoader size="sm" />     — compact, e.g. inside cards
 *   <LogoLoader label="..." />   — adds accessible caption below
 *   <LogoLoader fullPage />      — centred over the full viewport height
 */
export interface LogoLoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  fullPage?: boolean;
}

const sizeMap: Record<"sm" | "md" | "lg", { svg: string; gap: string; text: string }> = {
  sm: { svg: "w-10 h-10", gap: "gap-2",   text: "text-xs" },
  md: { svg: "w-16 h-16", gap: "gap-3",   text: "text-sm font-medium" },
  lg: { svg: "w-24 h-24", gap: "gap-3.5", text: "text-base font-semibold" },
};

const LogoLoader = memo(function LogoLoader({
  size = "md",
  label,
  className,
  fullPage = false,
}: LogoLoaderProps) {
  const cfg = sizeMap[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading…"}
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center select-none",
        cfg.gap,
        fullPage && "min-h-dvh w-full bg-surface-alt",
        !fullPage && !className?.includes("min-h") && "py-8",
        className,
      )}
    >
      {/* SVG logo animation — paths extracted from Logo_Loader.json */}
      <div aria-hidden="true" className={cn(cfg.svg, "relative shrink-0")}>
        <svg
          viewBox="0 0 300 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Top blade — fades in from top-left, slides to centre, then retreats */}
          <path
            className="logo-loader-top-blade"
            fill="currentColor"
            d="M30,209.73 C31.6,207.62 33.2,205.51 34.63,203.21
               C38.15,198.39 41.76,193.71 45.94,189.27
               C61,174.22 74.5,161.34 87.39,152.73
               C100.9,143.2 115.9,133.77 129.7,130.23
               C136.42,128.4 143.09,127.73 149.76,127.47
               L156.11,127.47 L191.33,126.9 L205.76,126.03
               C219.88,125.48 231.76,118.9 243.26,107.91
               C249.37,100.44 254.45,94.08 258.68,87.45
               C262.37,80.98 265.1,74.72 267.16,69.59
               C268.13,67.29 269.09,64.53 270,61.77
               L257.53,61.52 L227.45,61.52 L165.08,61.52
               L151.14,61.52 L141.36,61.73
               C131.38,62.02 122.04,65.37 112.99,70.66
               C101.11,78.73 91.46,90.46 83.55,99.35
               C79.56,105.19 76.43,110.51 76.96,108.89
               C72.66,117.33 67.1,127.69 63.45,135.05
               C61.47,139.26 59.08,144.45 57.69,147.53
               C53.69,156.37 49.57,165.33 46.64,172.47
               C45.73,174.67 44.21,176.88 43.68,179.08
               C41.07,185.49 36.98,194.69 34.88,198.89
               Z"
          />
          {/* Bottom blade — fades in slightly after, from top-left, converges */}
          <path
            className="logo-loader-bottom-blade"
            fill="currentColor"
            d="M239.59,163.67 L232.5,163.75 L218.8,163.75
               L174.29,163.75 L153.51,163.75
               C145.01,163.75 139.48,164.19 136.88,164.22
               C127.27,165.21 118.15,168.26 108.75,171.42
               C95.1,178.19 83.6,189.34 73.55,198.48
               C61.45,212.6 53.5,223.69 49.26,236.63
               L48.81,237.85 L48.91,238.59
               C51.5,238.3 54.08,238.01 56.74,237.82
               C58.37,237.7 60.01,237.59 61.63,237.48
               C65.43,237.1 69.28,236.78 73.12,236.47
               C79.32,236.12 85.5,235.86 91.71,235.57
               C94.24,235.44 96.77,235.3 99.29,235.16
               C111.1,234.59 122.93,234.3 134.76,234.59
               L156.52,234.59 L172.66,234.37
               C181.61,233.81 190.63,231.52 199.57,225.73
               C213.69,217.22 224.95,203.5 230.95,189.92
               C232.35,186.07 233.55,183.69 234.74,181.36
               C236.78,174.73 238.54,169.07 240.3,164.25
               Z"
          />
        </svg>
      </div>

      {label ? (
        <p className={cn("text-text-secondary tracking-tight text-center", cfg.text)}>
          {label}
        </p>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
});

export default LogoLoader;
