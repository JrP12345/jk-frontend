"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Badge — Status label / tag
   ──────────────────────────────────────────────── */

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "outline" | "neutral" | "error" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-alt text-text-secondary border border-border",
  primary: "bg-primary-50 text-primary-700 border border-primary-200",
  success: "bg-success-50 text-success-600 border border-success-500/20",
  warning: "bg-warning-50 text-warning-600 border border-warning-500/20",
  danger:  "bg-danger-50 text-danger-600 border border-danger-500/20",
  outline: "bg-transparent text-text-secondary border border-border",
  neutral: "bg-surface-alt text-text-secondary border border-border",
  error:   "bg-danger-50 text-danger-600 border border-danger-500/20",
  info:    "bg-primary-50 text-primary-700 border border-primary-200",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-text-muted",
  primary: "bg-primary-500",
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
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export default function Badge({
  variant = "default",
  size = "sm",
  dot = false,
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
        "inline-flex items-center font-medium rounded-full whitespace-nowrap transition-colors duration-150",
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors[variant])} />}
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors duration-150"
          aria-label="Remove"
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}
