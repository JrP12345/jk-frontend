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
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-in select-none", className)}>
      <div className="mb-4 flex items-center justify-center p-3.5 rounded-2xl bg-surface-alt border border-border/80 text-text-muted shadow-xs transition-transform duration-200 hover:scale-105">
        {icon ? (
          <span className="[&>svg]:h-10 [&>svg]:w-10 text-primary-500">{icon}</span>
        ) : (
          <svg className="h-10 w-10 text-primary-500" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <rect x="6" y="10" width="36" height="28" rx="4" />
            <path d="M6 18h36" />
            <circle cx="24" cy="30" r="4" />
          </svg>
        )}
      </div>

      <h3 className="text-base font-semibold text-text tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-text-secondary max-w-md leading-relaxed">{description}</p>}

      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
});

export default EmptyState;


