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
    <Card hover className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-secondary font-medium truncate">{label}</p>
          <p className="text-2xl font-bold text-text mt-1.5 tracking-tight">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
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
                "text-xs font-semibold", 
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
          <div className="shrink-0 p-2.5 rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 [&>svg]:h-5 [&>svg]:w-5 ml-4">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

