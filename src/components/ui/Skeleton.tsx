"use client";

import { cn } from "./utils";

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const roundedMap = { sm: "rounded", md: "rounded-md", lg: "rounded-lg", full: "rounded-full" };

export default function Skeleton({ width = "100%", height = "1rem", rounded = "md", className = "" }: SkeletonProps) {
  return (
    <div
      style={{ width, height }}
      className={cn("bg-gradient-to-r from-surface-alt via-surface-hover to-surface-alt animate-shimmer", roundedMap[rounded], className)}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.875rem" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={cn("p-5 bg-surface rounded-xl border border-border", className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width="2.5rem" height="2.5rem" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="0.875rem" width="40%" />
          <Skeleton height="0.75rem" width="25%" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

const COL_WIDTHS = ["70%", "55%", "80%", "65%"];

export function SkeletonTable({ rows = 5, cols = 4, className = "" }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("w-full rounded-xl border border-border overflow-hidden", className)}>
      <div className="flex gap-4 px-4 py-3 bg-surface-alt border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="0.75rem" width={COL_WIDTHS[i % COL_WIDTHS.length]} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="0.875rem" width={COL_WIDTHS[(c + r) % COL_WIDTHS.length]} />
          ))}
        </div>
      ))}
    </div>
  );
}
