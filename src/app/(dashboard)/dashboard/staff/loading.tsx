import { Skeleton } from "@/components/ui";
import styles from "@/components/organization/TeamManagement.module.css";

export default function TeamLoading() {
  return <div role="status" aria-label="Loading team" aria-busy="true" className={styles.workspace}>
    <div className="flex items-center justify-between gap-3"><Skeleton className="h-6 w-20" /><Skeleton className="h-11 w-32" /></div>
    <Skeleton className="h-9 w-40" />
    <Skeleton className="h-[54px] w-full rounded-xl" />
    <Skeleton className="h-16 w-full rounded-xl" />
    {[0, 1, 2].map(row => <div key={row} className="rounded-xl border border-border bg-surface p-3 flex gap-3 items-start"><Skeleton className="h-9 w-9 rounded-full shrink-0" /><div className="space-y-2 min-w-0 flex-1"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-52 max-w-full" /></div></div>)}
  </div>;
}
