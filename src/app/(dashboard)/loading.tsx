"use client";

import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-6 animate-fade-in p-2">
      {/* Top Banner / Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/40">
        <div className="space-y-2">
          <Skeleton width="180px" height="1.5rem" rounded="md" />
          <Skeleton width="280px" height="0.875rem" rounded="sm" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width="100px" height="2.25rem" rounded="xl" />
          <Skeleton width="120px" height="2.25rem" rounded="xl" />
        </div>
      </div>

      {/* 4 Stat Cards Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="p-4 rounded-2xl bg-surface border border-border/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Skeleton width="100%" height="2.25rem" rounded="xl" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width="120px" height="2.25rem" rounded="xl" />
          <Skeleton width="120px" height="2.25rem" rounded="xl" />
        </div>
      </div>

      {/* Full Data Table Skeleton */}
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
