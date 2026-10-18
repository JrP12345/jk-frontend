import { Skeleton } from "@/components/ui";
import styles from "./EncounterWorkspace.module.css";

export function ConsultationWorkspaceSkeleton() {
  return <div className={styles.workspace} role="status" aria-label="Loading consultation" aria-busy="true">
    <Skeleton height="72px" />
    <Skeleton height="52px" />
    <div className={styles.skeletonEditor}>
      <Skeleton height="44px" width="160px" />
      <div className={styles.skeletonFields}>{[0, 1, 2, 3].map(key => <Skeleton key={key} height="180px" />)}</div>
    </div>
  </div>;
}
