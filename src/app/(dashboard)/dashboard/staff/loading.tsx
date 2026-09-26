import { Skeleton, SkeletonTable } from "@/components/ui";

export default function TeamLoading() {
  return <div role="status" aria-label="Loading team" className="space-y-6 w-full min-w-0">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-4 w-full max-w-sm" />
    <SkeletonTable rows={6} cols={5} />
  </div>;
}
