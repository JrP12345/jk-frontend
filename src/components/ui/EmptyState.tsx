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
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in select-none", className)}>
      <div className="relative mb-5 flex items-center justify-center p-4 rounded-3xl bg-surface-alt/90 border border-border/80 text-text-muted shadow-sm transition-all duration-250 hover:scale-105 hover:border-primary-500/30 group before:absolute before:inset-0 before:rounded-3xl before:bg-primary-500/5 before:pointer-events-none">
        {icon ? (
          <span className="[&>svg]:h-10 [&>svg]:w-10 text-primary-500 transition-transform duration-250 group-hover:scale-110">{icon}</span>
        ) : (
          <svg className="h-10 w-10 text-primary-500 transition-transform duration-250 group-hover:scale-110" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <rect x="6" y="10" width="36" height="28" rx="6" />
            <path d="M6 18h36" />
            <circle cx="24" cy="30" r="4" />
          </svg>
        )}
      </div>

      <h3 className="text-base font-semibold text-text tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-md leading-relaxed">{description}</p>}

      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3 flex-wrap justify-center animate-fade-in">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
});

export default EmptyState;


