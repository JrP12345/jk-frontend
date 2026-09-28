export default function ClinicCardSkeletons() {
  return <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
    {Array.from({ length: 6 }, (_, index) => <div key={index} className="min-h-[340px] p-4 sm:p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between animate-pulse motion-reduce:animate-none">
      <div className="space-y-3">
        <div className="flex gap-3"><div className="w-12 h-12 rounded-xl bg-surface-alt shrink-0" /><div className="flex-1 space-y-2 pt-1"><div className="h-4 w-3/4 rounded bg-surface-alt" /><div className="h-3 w-1/2 rounded bg-surface-alt" /></div></div>
        <div className="flex gap-2"><div className="h-6 w-24 rounded-lg bg-surface-alt" /><div className="h-6 w-20 rounded-lg bg-surface-alt" /></div>
        <div className="h-20 rounded-xl bg-surface-alt" />
      </div>
      <div className="border-t border-border/60 pt-3 space-y-3"><div className="h-3 w-2/3 rounded bg-surface-alt" /><div className="h-11 rounded-xl bg-surface-alt" /></div>
    </div>)}
  </div>;
}
