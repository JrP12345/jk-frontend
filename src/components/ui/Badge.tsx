"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";

export type BadgeVariant = "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "outline" | "neutral" | "error" | "info";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-alt/90 backdrop-blur-xs text-text-secondary border border-border/80",
  primary: "bg-primary-500/15 backdrop-blur-xs text-primary-600 dark:text-primary-400 border border-primary-500/30 shadow-2xs shadow-primary-500/10",
  secondary: "bg-surface-alt/90 backdrop-blur-xs text-text-secondary border border-border/80",
  success: "bg-emerald-500/15 backdrop-blur-xs text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs shadow-emerald-500/10",
  warning: "bg-amber-500/15 backdrop-blur-xs text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-2xs shadow-amber-500/10",
  danger:  "bg-rose-500/15 backdrop-blur-xs text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-2xs shadow-rose-500/10",
  outline: "bg-transparent text-text-secondary border border-border/80",
  neutral: "bg-surface-alt/90 backdrop-blur-xs text-text-secondary border border-border/80",
  error:   "bg-rose-500/15 backdrop-blur-xs text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-2xs shadow-rose-500/10",
  info:    "bg-sky-500/15 backdrop-blur-xs text-sky-600 dark:text-sky-400 border border-sky-500/30 shadow-2xs shadow-sky-500/10",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-text-muted",
  primary: "bg-primary-500",
  secondary: "bg-text-muted",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger:  "bg-danger-500",
  outline: "bg-text-muted",
  neutral: "bg-text-muted",
  error:   "bg-danger-500",
  info:    "bg-primary-500",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-0.5 text-xs gap-1.5 font-semibold",
  lg: "px-3 py-1 text-sm gap-2 font-semibold",
};

const Badge = memo(function Badge({
  variant = "default",
  size = "sm",
  dot = false,
  pulse = false,
  removable = false,
  onRemove,
  title,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center font-medium rounded-full whitespace-nowrap transition-colors duration-150 select-none",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                dotColors[variant]
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dotColors[variant])} />
        </span>
      )}
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
          aria-label="Remove badge"
        >
          <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
});

export default Badge;


