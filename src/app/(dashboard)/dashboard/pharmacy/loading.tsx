import { Skeleton } from "@/components/ui";
import styles from "@/components/pharmacy/PharmacyWorkspace.module.css";

export default function PharmacyLoading() {
  return <div role="status" aria-label="Loading pharmacy" aria-busy="true" className={styles.workspace}>
    <div className="flex items-center justify-between gap-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-11 w-32" /></div>
    <Skeleton className="h-6 w-40" />
    <Skeleton className="h-[54px] w-full rounded-xl" />
    <Skeleton className="h-16 w-full rounded-xl" />
    {[0, 1, 2].map(row => <div key={row} className={styles.card}><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-28" /><Skeleton className="h-10 w-full" /></div>)}
  </div>;
}
