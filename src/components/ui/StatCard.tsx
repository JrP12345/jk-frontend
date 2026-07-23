"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";
import Card from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export default function StatCard({ label, value, change, icon, trend, className = "" }: StatCardProps) {
  return (
    <Card hover padding="sm" className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-text-secondary font-medium truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-text mt-1 tracking-tight truncate">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend === "up" && (
                <svg className="h-3.5 w-3.5 text-success-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4l4 5H4l4-5z" />
                </svg>
              )}
              {trend === "down" && (
                <svg className="h-3.5 w-3.5 text-danger-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12l4-5H4l4 5z" />
                </svg>
              )}
              <span className={cn(
                "text-[11px] sm:text-xs font-semibold", 
                change.positive 
                  ? "text-success-600 dark:text-success-400" 
                  : "text-danger-600 dark:text-danger-400"
              )}>
                {change.value}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="shrink-0 p-1.5 sm:p-2.5 rounded-xl bg-surface-alt border border-border/60 text-text-secondary [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ml-2 sm:ml-4 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

