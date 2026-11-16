import { Card, Skeleton } from "@/components/ui";
import pos from "./PharmacyCounter.module.css";

/** Uses the counter's real panel geometry throughout access checks and device restoration. */
export function PharmacyCounterSkeleton({ label }: { label?: string }) {
  return <section className={pos.counter} data-counter-ready="true" role={label ? "status" : undefined} aria-label={label} aria-busy="true">
    {label && <span className="sr-only">{label}</span>}
    <div className={pos.bills} aria-hidden="true"><Skeleton className="h-9 w-48" /><Skeleton className="h-8 w-24" /><Skeleton className="ml-auto h-5 w-24" /></div>
    <div className={pos.panels} data-mobile-panel="products" aria-hidden="true">
      <section className={pos.products}>
        <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
          <div className={pos.productTools}>
            <Skeleton className="h-11 w-full" />
            <div className={pos.filters}>{[66, 32, 51, 63, 52, 49, 120].map((width, index) => <Skeleton key={index} className="h-6" width={`${width}px`} rounded="full" />)}</div>
          </div>
          <div className={pos.productResults}>{[0, 1, 2].map(row => <div key={row} className={pos.loadingProduct}><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/5" /></div>)}</div>
        </Card>
      </section>
      <section className={pos.cart}>
        <Card padding="none" className={pos.panel} contentClassName={pos.panelContent}>
          <div className={pos.cartHeader}><div className="grid gap-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-32" /></div><Skeleton className="h-8 w-24" /></div>
          <div className={pos.columnHead}>{[0, 1, 2, 3, 4, 5, 6].map(column => <Skeleton key={column} className="h-4 w-full" />)}</div>
          <div className={pos.cartLines}><div className={pos.loadingLine}><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /><Skeleton className="h-11 w-36" /></div></div>
          <div className={pos.cartSummary}><Skeleton className="h-4 w-3/5" /></div>
          <div className={pos.recentBills}><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-52" /></div>
          <div className={pos.draftStatus}><Skeleton className="h-4 w-40" /></div>
        </Card>
      </section>
      <aside className={pos.checkout}>
        <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
          <div className={pos.customerFields}><div className={pos.customerScroll}><Skeleton className="h-12 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-10 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-10 w-full" /></div>
            <div className={pos.checkoutBottom}><Skeleton className="h-9 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-8 w-full" /></div>
          </div>
        </Card>
      </aside>
    </div>
    <div className={pos.shortcutBar} aria-hidden="true"><Skeleton className="h-[17px] w-3/5" /></div>
    <div className={pos.mobileNav} aria-hidden="true"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
  </section>;
}
