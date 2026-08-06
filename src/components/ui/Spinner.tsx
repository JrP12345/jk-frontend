"use client";

import { useId, memo } from "react";
import { cn } from "./utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "orbital" | "pulse" | "minimal";

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  color?: string;
  label?: string;
  className?: string;
}

const sizes: Record<SpinnerSize, { size: string; stroke: number; dot: number }> = {
  xs: { size: "h-3.5 w-3.5", stroke: 2.5, dot: 1.5 },
  sm: { size: "h-4 w-4", stroke: 2.5, dot: 2 },
  md: { size: "h-6 w-6", stroke: 2.5, dot: 2.5 },
  lg: { size: "h-10 w-10", stroke: 2.5, dot: 3 },
  xl: { size: "h-14 w-14", stroke: 2.2, dot: 3.5 },
};

const Spinner = memo(function Spinner({
  size = "md",
  variant = "orbital",
  color = "text-primary-600 dark:text-primary-400",
  label,
  className = "",
}: SpinnerProps) {
  const gradientId = useId();
  const cfg = sizes[size];

  if (variant === "pulse") {
    return (
      <div className={cn("inline-flex flex-col items-center justify-center gap-2.5", className)} role="status">
        <div className={cn("relative flex items-center justify-center shrink-0", cfg.size)}>
          <span className="absolute inset-0 rounded-full bg-primary-500/25 animate-ping opacity-75" />
          <span className="absolute inset-1 rounded-full bg-primary-500/40 animate-pulse" />
          <span className="relative h-2 w-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(var(--p-500),0.8)]" />
        </div>
        {label ? (
          <span className="text-xs sm:text-sm font-medium text-text-secondary tracking-tight select-none animate-pulse">
            {label}
          </span>
        ) : (
          <span className="sr-only">Loading...</span>
        )}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={cn("inline-flex flex-col items-center justify-center gap-2", className)} role="status">
        <svg
          className={cn("animate-spin-smooth origin-center shrink-0 transform-gpu", cfg.size, color)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={cfg.stroke} className="opacity-15" />
          <path
            d="M12 2A10 10 0 0 1 22 12"
            stroke="currentColor"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
          />
        </svg>
        {label ? (
          <span className="text-xs sm:text-sm font-medium text-text-secondary select-none">{label}</span>
        ) : (
          <span className="sr-only">Loading...</span>
        )}
      </div>
    );
  }

  // Default: Orbital dual-ring counter-rotating spinner
  return (
    <div className={cn("inline-flex flex-col items-center justify-center gap-2.5", className)} role="status">
      <div className={cn("relative flex items-center justify-center shrink-0", cfg.size)}>
        {/* Outer Rotating Arc */}
        <svg
          className={cn("animate-spin-smooth origin-center shrink-0 transform-gpu w-full h-full", color)}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="60%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" className="opacity-10" />

          {/* Outer Gradient Arc */}
          <path
            d="M 16 3 A 13 13 0 0 1 29 16"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Luminous Leading Orb */}
          <circle cx="29" cy="16" r={cfg.dot} fill="currentColor" className="drop-shadow-[0_0_6px_currentColor]" />
        </svg>

        {/* Inner Reverse Counter-Rotating Ring */}
        <svg
          className="absolute inset-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] animate-spin-smooth origin-center shrink-0 transform-gpu opacity-60"
          style={{ animationDirection: "reverse", animationDuration: "1.2s" }}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 12 3 A 9 9 0 0 1 21 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className={color}
          />
        </svg>

        {/* Center Luminous Core Dot */}
        <span className="absolute h-1 w-1 rounded-full bg-primary-500 animate-pulse shadow-[0_0_6px_rgba(var(--p-500),0.9)]" />
      </div>

      {label && (
        <span className="text-xs sm:text-sm font-semibold tracking-tight text-text-secondary select-none animate-pulse">
          {label}
        </span>
      )}
      {!label && <span className="sr-only">Loading...</span>}
    </div>
  );
});

export default Spinner;

export const PageSpinner = memo(function PageSpinner({
  label = "Loading workspace...",
}: {
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
      <div className="relative bg-surface/90 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl shadow-black/40 p-6 sm:p-8 flex flex-col items-center justify-center max-w-xs w-full text-center transform-gpu before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/40 before:to-transparent overflow-hidden">
        <Spinner size="xl" label={label} />
      </div>
    </div>
  );
});



