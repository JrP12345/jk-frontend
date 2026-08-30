"use client";

import { useId, memo } from "react";
import { cn } from "./utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type SpinnerVariant = "ring" | "dots" | "bars" | "pulse" | "orbital" | "helix" | "quantum" | "minimal";

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  color?: string;
  label?: string;
  secondaryText?: string;
  className?: string;
  trackClassName?: string;
  center?: boolean;
}

const sizeConfig: Record<
  SpinnerSize,
  {
    container: string;
    strokeWidth: number;
    dotSize: number;
    barHeight: string;
    labelClass: string;
    secondaryClass: string;
    gap: string;
  }
> = {
  xs: {
    container: "h-3.5 w-3.5",
    strokeWidth: 3.5,
    dotSize: 1.5,
    barHeight: "h-2.5",
    labelClass: "text-[11px]",
    secondaryClass: "text-[9px]",
    gap: "gap-1.5",
  },
  sm: {
    container: "h-4 w-4",
    strokeWidth: 3.2,
    dotSize: 2,
    barHeight: "h-3",
    labelClass: "text-xs",
    secondaryClass: "text-[10px]",
    gap: "gap-1.5",
  },
  md: {
    container: "h-6 w-6",
    strokeWidth: 3,
    dotSize: 2.8,
    barHeight: "h-4",
    labelClass: "text-xs sm:text-sm",
    secondaryClass: "text-[11px]",
    gap: "gap-2.5",
  },
  lg: {
    container: "h-10 w-10",
    strokeWidth: 2.8,
    dotSize: 3.5,
    barHeight: "h-6",
    labelClass: "text-sm",
    secondaryClass: "text-xs",
    gap: "gap-3",
  },
  xl: {
    container: "h-14 w-14",
    strokeWidth: 2.6,
    dotSize: 4.5,
    barHeight: "h-8",
    labelClass: "text-sm sm:text-base font-semibold",
    secondaryClass: "text-xs sm:text-sm",
    gap: "gap-3.5",
  },
  "2xl": {
    container: "h-20 w-20",
    strokeWidth: 2.4,
    dotSize: 5.5,
    barHeight: "h-12",
    labelClass: "text-base sm:text-lg font-semibold",
    secondaryClass: "text-xs sm:text-sm",
    gap: "gap-4",
  },
};

const Spinner = memo(function Spinner({
  size = "md",
  variant = "ring",
  color = "text-primary-600 dark:text-primary-400",
  label,
  secondaryText,
  className = "",
  trackClassName = "",
  center = false,
}: SpinnerProps) {
  const uniqueId = useId().replace(/:/g, "_");
  const cfg = sizeConfig[size] || sizeConfig.md;

  const renderContent = () => {
    // ── Variant: 3 Harmonic Wave Dots ──
    if (variant === "dots") {
      return (
        <div className={cn("inline-flex items-center gap-1 shrink-0", color)} aria-hidden="true">
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className="rounded-full bg-current animate-dot-bounce"
              style={{
                width: `${cfg.dotSize * 1.5}px`,
                height: `${cfg.dotSize * 1.5}px`,
                animationDelay: `${idx * 0.16}s`,
              }}
            />
          ))}
        </div>
      );
    }

    // ── Variant: Harmonic Equalizer Wave Bars ──
    if (variant === "bars") {
      return (
        <div className={cn("inline-flex items-center gap-1 shrink-0", cfg.barHeight, color)} aria-hidden="true">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className="w-1 rounded-full bg-current animate-wave-bar"
              style={{
                height: "100%",
                animationDelay: `${idx * 0.15}s`,
              }}
            />
          ))}
        </div>
      );
    }

    // ── Variant: Concentric Cardiac Pulse Beacon ──
    if (variant === "pulse") {
      return (
        <div className={cn("relative flex items-center justify-center shrink-0", cfg.container, color)} aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-current opacity-25 animate-ping" />
          <span className="relative h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor] animate-pulse-beacon" />
        </div>
      );
    }

    // ── Signature Default Variant: Clean Anant Quantum Ring (Unique, Minimal & Fluid) ──
    const gradId = `spinner-grad-${uniqueId}`;

    return (
      <div className={cn("relative flex items-center justify-center shrink-0", cfg.container, color)} aria-hidden="true">
        <svg
          className="w-full h-full origin-center shrink-0 transform-gpu overflow-visible animate-spin-smooth"
          viewBox="0 0 44 44"
          fill="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="60%" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Clean Subtle Background Track */}
          <circle
            cx="22"
            cy="22"
            r="17"
            stroke="currentColor"
            strokeWidth={cfg.strokeWidth}
            className={cn("opacity-15 dark:opacity-20", trackClassName)}
          />

          {/* Fluid Tapered Arc */}
          <circle
            cx="22"
            cy="22"
            r="17"
            stroke={`url(#${gradId})`}
            strokeWidth={cfg.strokeWidth}
            strokeLinecap="round"
            className="animate-spinner-dash origin-center"
          />
        </svg>

        {/* Subtle Central Luminous Beacon Dot (on md sizes and above) */}
        {size !== "xs" && size !== "sm" && (
          <span className="absolute h-1 w-1 rounded-full bg-current animate-pulse-beacon shadow-[0_0_6px_currentColor] opacity-80" />
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center select-none",
        cfg.gap,
        center && "w-full py-6",
        className
      )}
      role="status"
    >
      {renderContent()}

      {label ? (
        <div className="flex flex-col items-center text-center gap-0.5 animate-fade-in">
          <span
            className={cn(
              "font-medium tracking-tight text-text-secondary dark:text-text-secondary select-none",
              cfg.labelClass
            )}
          >
            {label}
          </span>
          {secondaryText && (
            <span
              className={cn(
                "text-text-muted select-none leading-relaxed",
                cfg.secondaryClass
              )}
            >
              {secondaryText}
            </span>
          )}
        </div>
      ) : (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  );
});

export default Spinner;

export interface PageSpinnerProps {
  label?: string;
  description?: string;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  color?: string;
  className?: string;
}

export const PageSpinner = memo(function PageSpinner({
  label = "Loading workspace...",
  description,
  variant = "ring",
  size = "xl",
  color = "text-primary-600 dark:text-primary-400",
  className = "",
}: PageSpinnerProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/70 dark:bg-black/60 backdrop-blur-md animate-fade-in p-4",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="relative bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/60 p-6 sm:p-8 flex flex-col items-center justify-center max-w-xs sm:max-w-sm w-full text-center transform-gpu before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/50 before:to-transparent overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

        <Spinner
          size={size}
          variant={variant}
          color={color}
          label={label}
          secondaryText={description}
        />
      </div>
    </div>
  );
});

export const CardLoader = memo(function CardLoader({
  label = "Loading data...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full py-12 flex flex-col items-center justify-center text-center", className)}>
      <Spinner size="lg" label={label} />
    </div>
  );
});
