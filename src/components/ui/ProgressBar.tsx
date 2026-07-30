"use client";

import { memo } from "react";
import { cn } from "./utils";

export type ProgressBarColor = "primary" | "success" | "warning" | "danger";
export type ProgressBarSize = "sm" | "md" | "lg";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  size?: ProgressBarSize;
  color?: ProgressBarColor;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  indeterminate?: boolean;
  className?: string;
}

const colors: Record<ProgressBarColor, string> = {
  primary: "bg-primary-600",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

const sizes: Record<ProgressBarSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const ProgressBar = memo(function ProgressBar({
  value = 0,
  max = 100,
  size = "md",
  color = "primary",
  showLabel = false,
  label,
  animated = true,
  indeterminate = false,
  className = "",
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full select-none", className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5 text-xs sm:text-sm">
          {label && <span className="font-medium text-text">{label}</span>}
          {showLabel && (
            <span className="text-text-muted tabular-nums font-mono font-medium">
              {indeterminate ? "Processing..." : `${Math.round(pct)}%`}
            </span>
          )}
        </div>
      )}
      <div className={cn("w-full bg-surface-alt border border-border/40 rounded-full overflow-hidden", sizes[size])}>
        {indeterminate ? (
          <div
            className={cn("h-full w-full rounded-full skeleton-shimmer", colors[color])}
            role="progressbar"
            aria-label={label || "Loading"}
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-full transform-gpu",
              colors[color],
              animated && "transition-all duration-300 ease-smooth"
            )}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label || undefined}
          />
        )}
      </div>
    </div>
  );
});

export default ProgressBar;


