"use client";

import { cn } from "./utils";

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const roundedMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

export default function Skeleton({
  width = "100%",
  height = "1rem",
  rounded = "lg",
  className = "",
}: SkeletonProps) {
  return (
    <div
      style={{ width, height }}
      className={cn(
        "skeleton-shimmer border border-border/20 shrink-0",
        roundedMap[rounded],
        className
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
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
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={cn("p-5 bg-surface border border-border/80 rounded-2xl shadow-xs space-y-4", className)}>
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
}

const COL_WIDTHS = ["65%", "50%", "75%", "60%", "40%"];

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-xs", className)}>
      {/* Table Header Placeholder */}
      <div className="flex gap-4 px-5 py-3.5 bg-surface-alt/60 border-b border-border/80 items-center">
        <Skeleton width="1.25rem" height="1.25rem" rounded="md" />
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton height="0.75rem" width={COL_WIDTHS[i % COL_WIDTHS.length]} rounded="md" />
          </div>
        ))}
      </div>
      {/* Table Rows Placeholders */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-4 border-b border-border/40 last:border-0 items-center">
          <Skeleton width="1.25rem" height="1.25rem" rounded="md" />
          {Array.from({ length: cols }).map((_, c) => (
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
}
