import AuthPageShell from "./AuthPageShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

function FieldPlaceholder() {
  return <div className="space-y-1.5"><Skeleton width="55%" height="20px" /><Skeleton height="44px" rounded="xl" /></div>;
}

export default function AuthPageLoading({ registration = false }: { registration?: boolean }) {
  return <AuthPageShell loadingLabel={registration ? "Loading registration" : "Loading sign in"}>
    <Card padding="none">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-2 border-b border-border pb-4">
          <Skeleton width="65%" height="36px" /><Skeleton width="90%" className="h-10 sm:h-5" />
        </div>
        {registration ? <>
          <FieldPlaceholder />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><FieldPlaceholder /><FieldPlaceholder /></div>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2"><FieldPlaceholder /><FieldPlaceholder /></div>
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
