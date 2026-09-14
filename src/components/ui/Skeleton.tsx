"use client";

import { memo } from "react";
import { cn } from "./utils";

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  style?: React.CSSProperties;
}

const roundedMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const Skeleton = memo(function Skeleton({
  width = "100%",
  height = "1rem",
  rounded = "lg",
  className = "",
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, ...style }}
      className={cn(
        "skeleton-shimmer border border-border/20 shrink-0 select-none",
        roundedMap[rounded],
        className
      )}
    />
  );
});

export default Skeleton;

export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          width={i === lines - 1 ? "55%" : i === 0 ? "90%" : "100%"}
          rounded="md"
        />
      ))}
    </div>
  );
});

export const SkeletonCard = memo(function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("p-5 bg-surface border border-border/80 rounded-2xl shadow-xs space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton width="2.5rem" height="2.5rem" rounded="full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton height="0.875rem" width="45%" rounded="md" />
            <Skeleton height="0.75rem" width="30%" rounded="sm" />
          </div>
        </div>
        <Skeleton width="4rem" height="1.5rem" rounded="full" />
      </div>
      <SkeletonText lines={2} />
    </div>
  );
});

const COL_WIDTHS = ["65%", "50%", "75%", "60%", "40%"];

export const SkeletonTable = memo(function SkeletonTable({
  rows = 5,
  cols,
  columns = 4,
  className = "",
}: {
  rows?: number;
  cols?: number;
  columns?: number;
  className?: string;
}) {
  const effectiveCols = cols ?? columns;
  return (
    <div aria-hidden="true" className={cn("w-full rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-xs", className)}>
      {/* Table Header Placeholder */}
      <div className="flex gap-4 px-5 py-3.5 bg-surface-alt/60 border-b border-border/80 items-center">
        <Skeleton width="1.25rem" height="1.25rem" rounded="md" />
        {Array.from({ length: effectiveCols }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton height="0.75rem" width={COL_WIDTHS[i % COL_WIDTHS.length]} rounded="md" />
          </div>
        ))}
      </div>
      {/* Table Rows Placeholders */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-4 border-b border-border/40 last:border-0 items-center">
          <Skeleton width="1.25rem" height="1.25rem" rounded="md" />
          {Array.from({ length: effectiveCols }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton
                height="0.875rem"
                width={COL_WIDTHS[(c + r) % COL_WIDTHS.length]}
                rounded="md"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

export const SkeletonStats = memo(function SkeletonStats({
  count = 4,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 sm:p-5 bg-surface border border-border/80 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2 flex-1">
              <Skeleton height="0.75rem" width="55%" rounded="md" />
              <Skeleton height="1.5rem" width="70%" rounded="lg" />
              <Skeleton height="0.65rem" width="40%" rounded="sm" />
            </div>
            <Skeleton width="2.25rem" height="2.25rem" rounded="xl" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const SkeletonForm = memo(function SkeletonForm({
  fields,
  rows = 4,
  className = "",
}: {
  fields?: number;
  rows?: number;
  className?: string;
}) {
  const effectiveCount = fields ?? rows;
  return (
    <div aria-hidden="true" className={cn("bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6", className)}>
      <div className="space-y-2 pb-4 border-b border-border/60">
        <Skeleton height="1.25rem" width="35%" rounded="md" />
        <Skeleton height="0.75rem" width="55%" rounded="sm" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: effectiveCount }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton height="0.75rem" width="25%" rounded="sm" />
            <Skeleton height="2.25rem" width="100%" rounded="xl" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2.5 pt-4 border-t border-border/60">
        <Skeleton height="2.25rem" width="5rem" rounded="xl" />
        <Skeleton height="2.25rem" width="7rem" rounded="xl" />
      </div>
    </div>
  );
});

export const SkeletonCardGrid = memo(function SkeletonCardGrid({
  count = 6,
  columns = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  className = "",
}: {
  count?: number;
  columns?: string | number;
  className?: string;
}) {
  const colClass = typeof columns === "number"
    ? columns === 1 ? "grid-cols-1"
      : columns === 2 ? "grid-cols-1 md:grid-cols-2"
      : columns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    : columns;

  return (
    <div aria-hidden="true" className={cn("grid gap-4", colClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-surface border border-border/80 rounded-2xl shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1">
              <Skeleton width="2.25rem" height="2.25rem" rounded="full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton height="0.875rem" width="60%" rounded="md" />
                <Skeleton height="0.65rem" width="40%" rounded="sm" />
              </div>
            </div>
            <Skeleton width="4.5rem" height="1.25rem" rounded="full" />
          </div>
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Skeleton height="0.75rem" width="85%" rounded="sm" />
            <Skeleton height="0.75rem" width="65%" rounded="sm" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton height="1.5rem" width="30%" rounded="md" />
            <Skeleton height="1.75rem" width="25%" rounded="lg" />
          </div>
        </div>
      ))}
    </div>
  );
});


