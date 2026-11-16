import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Card, Skeleton, cn } from "@/components/ui";
import marketplace from "@/components/MarketplaceLayout.module.css";
import styles from "@/app/browse/[slug]/FacilityProfile.module.css";
import care from "@/components/PublicCare.module.css";

export default function BrowseDetailSkeleton() {
  return <div className={marketplace.page} role="status" aria-label="Loading location and doctor details" aria-busy="true">
    <MarketplaceNavbar showSignUp showSearch={false} />
    <div className={cn(marketplace.content, styles.container)} aria-hidden="true">
      <div className={styles.heroBand}><div className={styles.breadcrumbs}><Skeleton width="220px" height="16px" /></div><div className={styles.hero}>
        <div className={styles.heroIdentity}><div className={styles.logo} /><div className="w-full space-y-3"><Skeleton width="70%" height="32px" /><Skeleton width="45%" height="24px" /></div></div>
        <div className={styles.heroActions}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} width="80px" height="44px" />)}</div>
      </div></div>
      <Card padding="none" className={cn(care.card, styles.summaryCard)}><div className={cn(care.summary, styles.summary)}>{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-2"><Skeleton width="60%" height="14px" /><Skeleton width="85%" height="20px" /></div>)}</div></Card>
      <div className={styles.jumpNav}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} width="70px" height="44px" />)}</div>
      <div className={styles.layout}>
        <div className={cn(styles.doctors, "space-y-4")}><Skeleton width="160px" height="28px" />{Array.from({ length: 3 }, (_, index) => <Card key={index} padding="none" className={care.card}><div className={styles.doctorRow}><div className={styles.doctorIdentity}><Skeleton width="56px" height="56px" rounded="full" /><div className="flex-1 space-y-2"><Skeleton width="65%" height="20px" /><Skeleton width="50%" height="16px" /><Skeleton width="80%" height="16px" /></div></div><div className={styles.doctorFee}><Skeleton width="80px" height="36px" /></div><div className={styles.doctorBooking}><Skeleton width="40%" height="16px" /><Skeleton width="140px" height="44px" /></div></div></Card>)}</div>
        <div className={styles.sidebar}><Card padding="md" className={care.card}><Skeleton width="65%" height="24px" /><div className="mt-4 space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height="44px" />)}</div></Card></div>
      </div>
    </div>
  </div>;
}
