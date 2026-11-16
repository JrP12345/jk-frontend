import { Skeleton } from "@/components/ui";
import styles from "./PharmacyWorkspace.module.css";
import { PharmacyCounterSkeleton } from "./PharmacyCounterSkeleton";

export function PharmacySkeleton({ counter = true }: { counter?: boolean }) {
  if (counter) return <div role="status" aria-label="Loading pharmacy" aria-busy="true" className={styles.workspace} data-counter-layout="true">
    <span className="sr-only">Loading pharmacy workspace...</span>
    <div className={styles.counterNavigation}>
      <div className={styles.counterToolbar} aria-hidden="true">
        <div className={styles.toolbarContext}><Skeleton className="h-5 w-40" /></div>
        <div className={styles.toolbarTabs}><div className="flex h-11 items-center gap-3 md:h-10"><Skeleton className="h-9 w-24" /><Skeleton className="h-5 w-28" /></div></div>
        <div className="hidden md:flex"><Skeleton className="h-8 w-40" /></div>
        <div className={`${styles.mobileMore} md:hidden`}><Skeleton className="h-8 w-16" /></div>
        <div className={styles.toolbarRefresh}><Skeleton className="h-9 w-9" /></div>
      </div>
      <PharmacyCounterSkeleton />
    </div>
  </div>;
  return <div role="status" aria-label="Loading pharmacy" aria-busy="true" className={styles.workspace}>
    <span className="sr-only">Loading pharmacy workspace...</span>
    <div className="flex items-center justify-between gap-3"><Skeleton className="h-6 w-28" /><Skeleton className="h-11 w-11" /></div>
    <Skeleton className="h-5 w-44" />
    <Skeleton className="h-14 w-full rounded-2xl" />
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5"><Skeleton className="h-11 w-full" />{[0, 1, 2].map(row => <div key={row} className="space-y-3 border-t border-border pt-5"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-64" /></div>)}</div>
  </div>;
}
