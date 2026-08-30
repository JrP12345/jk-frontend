"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";
import Card from "./Card";
import Skeleton from "./Skeleton";

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  description?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const StatCard = memo(function StatCard({
  label,
  title,
  value,
  change,
  description,
  icon,
  trend,
  loading = false,
  onClick,
  className = "",
}: StatCardProps) {
  const displayLabel = title || label || "";
  if (loading) {
    return (
      <Card padding="sm" className={className}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-7 w-32 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        </div>
      </Card>
    );
  }

  const effectiveTrend = trend || (change ? (change.positive ? "up" : "down") : "neutral");

  return (
    <Card hover padding="sm" onClick={onClick} className={cn("relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/20 before:to-transparent", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-text-secondary font-medium truncate select-none">{displayLabel}</p>
          <p className="text-lg sm:text-2xl font-bold text-text mt-1 tracking-tight truncate tabular-nums">
            {value}
          </p>

          {(change || description) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {change && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold select-none border tracking-tight",
                    change.positive
                      ? "bg-success-500/10 text-success-600 dark:text-success-400 border-success-500/20"
                      : "bg-danger-500/10 text-danger-600 dark:text-danger-400 border-danger-500/20"
                  )}
                >
                  {effectiveTrend === "up" && (
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M8 4l4 5H4l4-5z" />
                    </svg>
                  )}
                  {effectiveTrend === "down" && (
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M8 12l4-5H4l4 5z" />
                    </svg>
                  )}
                  <span className={change.positive ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"}>{change.value}</span>
                </div>
              )}
              {description && <span className="text-xs text-text-muted">{description}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="shrink-0 p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-primary-500/15 via-primary-500/10 to-transparent border border-primary-500/20 text-primary-500 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ml-2 sm:ml-4 shadow-xs transition-transform duration-200 group-hover:scale-105">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
});

export default StatCard;



