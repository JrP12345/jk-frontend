import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import marketplace from "@/components/MarketplaceLayout.module.css";
import styles from "@/app/browse/[slug]/FacilityProfile.module.css";

export default function BrowseDetailSkeleton() {
  return <div className={marketplace.page} role="status" aria-label="Loading location and doctor details">
    <MarketplaceNavbar showSignUp showSearch={false} />
    <main className={`${marketplace.content} ${styles.container}`}>
      <div className="flex h-14 items-center"><div className="h-5 w-52 animate-pulse rounded bg-surface-alt" /></div>
      <div className={`${styles.heroCard} border border-border`}>
        <div className={styles.hero}>
          <div className={styles.heroIdentity}><div className={`${styles.logo} animate-pulse`} /><div className="min-w-0 flex-1 space-y-3"><div className="h-8 w-48 max-w-full animate-pulse rounded bg-surface-alt" /><div className="h-5 w-36 max-w-full animate-pulse rounded bg-surface-alt" /></div></div>
          <div className={styles.heroActions}>{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-11 w-24 max-w-full animate-pulse rounded-xl bg-surface-alt" />)}</div>
        </div>
      </div>
      <div className={`${marketplace.detailsColumns} ${styles.layout}`}>
        <div className={`${styles.doctors} space-y-4`}><div className="h-7 w-32 animate-pulse rounded bg-surface-alt" /><div className="h-5 w-2/3 animate-pulse rounded bg-surface-alt" />{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-border bg-surface-elevated sm:h-44" />)}</div>
        <div className={`${styles.sidebar} ${styles.information} space-y-4 border border-border p-5`}>
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded border-b border-border bg-surface-alt" />)}
          <div className="h-48 animate-pulse rounded bg-surface-alt" />
        </div>
      </div>
    </main>
  </div>;
}
