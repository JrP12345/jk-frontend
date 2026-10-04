import MarketplaceNavbar from "@/components/MarketplaceNavbar";

export default function DoctorLoading() {
  return <div className="min-h-screen bg-surface-alt text-text" role="status" aria-label="Loading doctor and appointment details">
    <MarketplaceNavbar />
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
      <div className="mb-5 h-4 w-52 animate-pulse rounded bg-surface" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex animate-pulse gap-4">
            <div className="h-20 w-20 shrink-0 rounded-xl bg-surface-alt" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-6 w-1/2 rounded bg-surface-alt" />
              <div className="h-4 w-2/3 rounded bg-surface-alt" />
              <div className="h-4 w-1/3 rounded bg-surface-alt" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-1/2 rounded bg-surface-alt" />
            <div className="h-4 w-3/4 rounded bg-surface-alt" />
            <div className="h-40 rounded-xl bg-surface-alt" />
          </div>
        </div>
      </div>
    </main>
  </div>;
}
