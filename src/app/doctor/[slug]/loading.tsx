import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Card, LoadingState, Skeleton, SkeletonForm, cn } from "@/components/ui";
import marketplace from "@/components/MarketplaceLayout.module.css";
import styles from "./doctor.module.css";

export default function DoctorLoading() {
  return <div className={marketplace.page}>
    <MarketplaceNavbar showSignUp showSearch={false} />
    <main className={cn(marketplace.content, styles.content)}>
      <LoadingState label="Loading doctor profile">
        <div className={styles.breadcrumbs}><Skeleton width="220px" height="16px" /></div>
        <div className={styles.layout}>
          <div className={styles.profile}>
            <div className={styles.identity}><Skeleton width="80px" height="80px" rounded="full" /><div className="min-w-0 flex-1 space-y-3"><Skeleton width="70%" height="32px" /><Skeleton width="50%" height="16px" /><Skeleton width="65%" height="16px" /></div></div>
            <Card padding="md"><div className="grid grid-cols-3 gap-4">{[0, 1, 2].map(index => <div key={index} className="space-y-2"><Skeleton height="14px" /><Skeleton width="70%" height="20px" /></div>)}</div></Card>
            <div className="space-y-3"><Skeleton width="100px" height="24px" /><Skeleton height="16px" /><Skeleton height="16px" /><Skeleton width="70%" height="16px" /></div>
          </div>
          <aside className={styles.booking}><Card padding="lg"><SkeletonForm fields={3} /></Card></aside>
        </div>
      </LoadingState>
    </main>
  </div>;
}
