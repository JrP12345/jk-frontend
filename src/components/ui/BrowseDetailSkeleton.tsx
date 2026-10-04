import MarketplaceNavbar from "@/components/MarketplaceNavbar";

export default function BrowseDetailSkeleton() {
  return <div className="min-h-screen bg-surface-alt pt-16 text-text" role="status" aria-label="Loading clinic and doctor details">
    <MarketplaceNavbar />
    <div className="border-b border-border/40 bg-surface px-4 py-3 sm:px-6">
      <div className="mx-auto h-4 w-44 max-w-6xl animate-pulse rounded bg-surface-alt" />
    </div>
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex animate-pulse items-start gap-4">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-surface-alt sm:h-20 sm:w-20" />
          <div className="flex-1 space-y-3 pt-1"><div className="h-5 w-2/3 rounded bg-surface-alt" /><div className="h-4 w-1/2 rounded bg-surface-alt" /><div className="h-4 w-1/3 rounded bg-surface-alt" /></div>
        </div>
        <div className="mt-5 h-16 animate-pulse rounded-xl bg-surface-alt" />
      </div>
      <div className="h-44 animate-pulse rounded-2xl border border-border bg-surface sm:h-52" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-56 animate-pulse rounded-2xl border border-border bg-surface lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    </main>
  </div>;
}
