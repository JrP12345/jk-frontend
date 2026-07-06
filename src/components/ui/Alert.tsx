"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: ReactNode }> = {
  info: {
    container: "bg-primary-50/60 border-primary-200 text-primary-800 dark:bg-primary-950/20 dark:border-primary-900/30 dark:text-primary-300",
    icon: (
      <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    ),
  },
  success: {
    container: "bg-success-50/60 border-success-500/20 text-success-700 dark:bg-success-950/20 dark:border-success-900/30 dark:text-success-300",
    icon: (
      <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  warning: {
    container: "bg-warning-50/60 border-warning-500/20 text-warning-700 dark:bg-warning-950/20 dark:border-warning-900/30 dark:text-warning-300",
    icon: (
      <svg className="h-5 w-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
      </svg>
    ),
  },
  error: {
    container: "bg-danger-50/60 border-danger-500/20 text-danger-700 dark:bg-danger-950/20 dark:border-danger-900/30 dark:text-danger-300",
    icon: (
      <svg className="h-5 w-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
};

export default function Alert({ variant = "info", title, children, dismissible = false, onDismiss, icon, className = "" }: AlertProps) {
  const style = variantStyles[variant];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-xl border px-4 py-3.5 text-sm animate-fade-up", style.container, className)}>
      <span className="shrink-0 mt-0.5">{icon || style.icon}</span>
      <div className="flex-1 min-w-0 pr-1">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="opacity-90 leading-relaxed">{children}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg cursor-pointer text-text-muted hover:text-text hover:bg-surface-hover/30 transition-all duration-200 active:scale-75"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}

