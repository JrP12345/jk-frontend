"use client";

import React, { type ReactNode, memo } from "react";
import { cn } from "../utils";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../Card";
import Spinner from "../Spinner";

export interface TimeRangeOption {
  label: string;
  value: string;
}

export interface ChartContainerProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  headerAction?: ReactNode;
  timeRanges?: TimeRangeOption[];
  activeRange?: string;
  onRangeChange?: (range: string) => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
  height?: number | string;
}

export const ChartContainer = memo(function ChartContainer({
  title,
  description,
  badge,
  headerAction,
  timeRanges,
  activeRange,
  onRangeChange,
  loading = false,
  empty = false,
  emptyMessage = "No data points recorded for this period.",
  className = "",
  children,
  height = 240,
}: ChartContainerProps) {
  return (
    <Card className={cn("overflow-hidden relative flex flex-col justify-between select-none border border-border/80 bg-surface/95 dark:bg-surface/85 backdrop-blur-xl shadow-xs group hover:border-border transition-all duration-300", className)}>
      {/* Top Ambient Subtle Glow Accent */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary-500/35 dark:via-primary-400/40 to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />

      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 px-4 sm:px-5 pt-4 border-b border-border/40 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm sm:text-base font-bold text-text tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0 shadow-xs" />
              {title}
            </CardTitle>
            {badge}
          </div>
          {description && (
            <CardDescription className="text-xs text-text-muted mt-0.5 truncate">{description}</CardDescription>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {timeRanges && timeRanges.length > 0 && (
            <div className="flex items-center p-0.5 bg-surface-alt/90 dark:bg-surface-alt/70 rounded-xl border border-border/60 text-[11px] font-semibold">
              {timeRanges.map((tr) => {
                const isActive = activeRange === tr.value;
                return (
                  <button
                    key={tr.value}
                    type="button"
                    onClick={() => onRangeChange && onRangeChange(tr.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer active:scale-95",
                      isActive
                        ? "bg-surface text-primary-600 dark:text-primary-400 font-bold shadow-xs border border-border/70"
                        : "text-text-muted hover:text-text hover:bg-surface/50"
                    )}
                  >
                    {tr.label}
                  </button>
                );
              })}
            </div>
          )}
          {headerAction}
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-center min-h-0">
        {loading ? (
          <div
            style={{ height: typeof height === "number" ? `${height}px` : height }}
            className="w-full flex flex-col items-center justify-center gap-3 animate-fade-in"
          >
            <Spinner size="md" label="Loading analytics..." />
          </div>
        ) : empty ? (
          <div
            style={{ height: typeof height === "number" ? `${height}px` : height }}
            className="w-full flex flex-col items-center justify-center text-center p-6 text-text-muted animate-fade-in"
          >
            <div className="p-3 rounded-2xl bg-surface-alt border border-border/60 mb-2 shadow-inner">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-xs font-medium max-w-xs">{emptyMessage}</p>
          </div>
        ) : (
          <div
            style={{ height: typeof height === "number" ? `${height}px` : height }}
            className="w-full relative flex flex-col justify-center"
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default ChartContainer;
