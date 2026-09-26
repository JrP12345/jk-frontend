import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Skeleton, SkeletonCardGrid } from "@/components/ui";

export default function BrowseLoading() {
  return <div className="min-h-screen bg-surface-alt text-text">
    <MarketplaceNavbar />
    <main role="status" aria-label="Loading clinics" className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12 space-y-6">
      <Skeleton className="h-10 w-3/4 max-w-lg mx-auto" />
      <Skeleton className="h-12 w-full max-w-3xl mx-auto" />
      <SkeletonCardGrid count={6} />
    </main>
  </div>;
}
