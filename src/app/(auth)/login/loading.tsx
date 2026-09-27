import EkavyuLogo from "@/components/ui/EkavyuLogo";
import Skeleton from "@/components/ui/Skeleton";

/** Match the login card so navigation does not flash a generic splash screen. */
export default function LoginLoading() {
  return (
    <main role="status" aria-label="Loading sign in" aria-busy="true" className="min-h-dvh flex flex-col items-center justify-center p-4 py-10 bg-surface-alt text-text relative">
      <div className="absolute inset-0 brand-wash pointer-events-none" />
      <div aria-hidden="true" className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-6 gap-4">
          <EkavyuLogo size="xl" />
          <Skeleton width="170px" height="24px" rounded="full" />
        </div>
        <div className="rounded-3xl border border-border/80 bg-surface shadow-lg p-6 sm:p-7 space-y-5">
          <div className="flex flex-col items-center gap-2">
            <Skeleton width="170px" height="28px" />
            <Skeleton width="80%" height="16px" />
          </div>
          <Skeleton height="56px" rounded="2xl" />
          <div className="space-y-2">
            <Skeleton width="150px" height="16px" />
            <Skeleton height="44px" rounded="xl" />
            <Skeleton width="85%" height="14px" />
          </div>
          <Skeleton height="46px" rounded="xl" />
          <div className="border-t border-border/60 pt-4 flex justify-center">
            <Skeleton width="75%" height="16px" />
          </div>
        </div>
        <div className="flex justify-center mt-6"><Skeleton width="240px" height="16px" /></div>
      </div>
      <span className="sr-only">Loading sign in…</span>
    </main>
  );
}
