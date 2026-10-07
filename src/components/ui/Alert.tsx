"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";
import { userFacingError } from "@/lib/userFacingError";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: ReactNode }> = {
  info: {
    container: "bg-info-subtle border border-info/25 text-text",
    icon: (
      <svg className="h-5 w-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    ),
  },
  success: {
    container: "bg-success-subtle border border-success/25 text-text",
    icon: (
      <svg className="h-5 w-5 text-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  warning: {
    container: "bg-warning-subtle border border-warning/25 text-text",
    icon: (
      <svg className="h-5 w-5 text-warning-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
      </svg>
    ),
  },
  error: {
    container: "bg-error-subtle border border-danger/25 text-text",
    icon: (
      <svg className="h-5 w-5 text-danger-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
};

const Alert = memo(function Alert({
  variant = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  icon,
  action,
  className = "",
}: AlertProps) {
  const style = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-sm animate-fade-in",
        style.container,
        className
      )}
    >
      <span className="shrink-0 mt-0.5">{icon || style.icon}</span>
      <div className="flex-1 min-w-0 pr-1">
        {title && <p className="font-semibold mb-0.5 text-text tracking-tight">{title}</p>}
        <div className="leading-relaxed">{variant === "error" && typeof children === "string" ? userFacingError(children, "Please try again. If the problem continues, contact support.") : children}</div>
        {action && <div className="mt-2.5 flex items-center gap-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 touch-target -my-1 rounded-lg cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Dismiss alert"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default Alert;
