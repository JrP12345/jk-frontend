import Card from "./Card";

export default function LocationCardSkeletons() {
  return <div aria-hidden="true" className="flex flex-col gap-3">
    {Array.from({ length: 4 }, (_, index) => <Card key={index} padding="sm" className="animate-pulse motion-reduce:animate-none" contentClassName="gap-5 md:flex-row">
      <div className="flex min-w-0 flex-1 gap-3.5">
        <div className="h-14 w-14 shrink-0 rounded-xl bg-surface-alt" />
        <div className="flex-1 space-y-2"><div className="h-5 w-2/3 rounded bg-surface-alt" /><div className="h-3 w-20 rounded bg-surface-alt" /><div className="h-3 w-1/2 rounded bg-surface-alt" /><div className="h-3 w-4/5 rounded bg-surface-alt" /></div>
      </div>
      <div className="flex flex-col gap-2 md:w-48"><div className="h-11 rounded-control bg-surface-alt" /><div className="h-11 rounded-control bg-surface-alt" /></div>
    </Card>)}
  </div>;
}
