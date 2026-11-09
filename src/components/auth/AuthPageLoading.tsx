import AuthPageShell from "./AuthPageShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./AuthPageShell.module.css";

function FieldPlaceholder() {
  return <div className="space-y-1.5"><Skeleton width="55%" height="20px" /><Skeleton height="44px" rounded="xl" /></div>;
}

export default function AuthPageLoading({ registration = false, label }: { registration?: boolean; label?: string }) {
  return <AuthPageShell wide={registration} loadingLabel={label || (registration ? "Loading registration" : "Loading sign in")}>
    <Card padding="none" className={styles.card}>
      <div className="space-y-5">
        <div className="flex flex-col items-start gap-2 pb-4">
          <Skeleton width="65%" height="36px" /><Skeleton width="90%" className="h-10 sm:h-5" />
        </div>
        {registration ? <>
          <FieldPlaceholder />
          <div className={styles.fields}><FieldPlaceholder /><FieldPlaceholder /></div>
          <div className={styles.pairedFields}><FieldPlaceholder /><FieldPlaceholder /></div>
        </> : <>
          <Skeleton height="52px" rounded="xl" />
          <FieldPlaceholder />
          <div className="flex justify-center"><Skeleton width="85%" height="16px" /></div>
        </>}
        <Skeleton height="48px" rounded="xl" />
        <div className="flex justify-center border-t border-border pt-4"><Skeleton width="75%" height="44px" /></div>
      </div>
    </Card>
  </AuthPageShell>;
}
