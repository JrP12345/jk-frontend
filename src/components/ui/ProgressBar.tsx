"use client";

import { cn } from "./utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "success" | "warning" | "danger";
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const colors = { primary: "bg-primary-600", success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500" };
const sizes = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

export default function ProgressBar({ value, max = 100, size = "md", color = "primary", showLabel = false, label, animated = true, className = "" }: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-sm font-medium text-text">{label}</span>}
          {showLabel && <span className="text-xs text-text-muted">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={cn("w-full bg-surface-alt rounded-full overflow-hidden", sizes[size])}>
        <div
          className={cn("h-full rounded-full", colors[color], animated && "transition-all duration-500 ease-out")}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
