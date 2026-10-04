"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-8 px-4", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt border border-border/70 text-accent">
        {icon ? (
          <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="6" y="10" width="36" height="28" rx="6" />
            <path d="M6 18h36" />
            <circle cx="24" cy="30" r="4" />
          </svg>
        )}
      </div>

      <h3 className="text-base font-semibold text-text tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-md leading-relaxed">{description}</p>}

      {(action || secondaryAction) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
});

export default EmptyState;

