"use client";

import { memo, type ReactNode } from "react";
import { cn } from "./utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type SpinnerVariant = "ring" | "dots" | "bars";

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
  color = "text-accent dark:text-accent",
  label,
  secondaryText,
  className = "",
  trackClassName = "",
  center = false,
}: SpinnerProps) {
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


    // One clear ring for buttons, cards, dialogs and page content.
    return (
      <div className={cn("relative flex items-center justify-center shrink-0", cfg.container, color)} aria-hidden="true">
        <svg
          className="w-full h-full shrink-0 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
        >
          {/* Clean Subtle Background Track */}
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth={cfg.strokeWidth}
            className={cn("opacity-15 dark:opacity-20", trackClassName)}
          />

          {/* Rotating arc */}
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth={cfg.strokeWidth}
            strokeLinecap="round"
            strokeDasharray="16 47"
          />
        </svg>

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
        <div className="flex flex-col items-center text-center gap-0.5">
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

export interface InlineLoaderProps {
  label?: ReactNode;
  size?: SpinnerSize;
  className?: string;
  color?: string;
  /** Match the enclosing control's text and spacing instead of caption styles. */
  inheritTypography?: boolean;
}

export const InlineLoader = memo(function InlineLoader({
  label,
  size = "xs",
  className = "",
  color = "text-accent dark:text-accent",
  inheritTypography = false,
}: InlineLoaderProps) {
  return (
    <span className={cn(
      "inline-flex min-w-0 items-center justify-center align-middle select-none",
      inheritTypography ? "gap-[inherit]" : "gap-1.5 text-xs font-medium text-text-muted",
      className,
    )} role="status">
      <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
        <Spinner size={size} color={color} />
      </span>
      {label && <span className="min-w-0 text-center whitespace-normal wrap-anywhere [&_svg]:shrink-0">{label}</span>}
    </span>
  );
});
