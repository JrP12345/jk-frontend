"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-up", className)}>
      {icon ? (
        <div className="mb-4 text-text-muted [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      ) : (
        <div className="mb-4">
          <svg className="h-12 w-12 text-text-muted" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
            <rect x="6" y="10" width="36" height="28" rx="4" />
            <path d="M6 18h36" />
            <circle cx="24" cy="30" r="4" />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-text-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
