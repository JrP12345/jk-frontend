import Card from "./Card";
import care from "@/components/PublicCare.module.css";

export default function LocationCardSkeletons() {
  return <div aria-hidden="true" className="flex flex-col gap-4">
    {Array.from({ length: 4 }, (_, index) => <Card key={index} padding="none" className={care.card + " animate-pulse motion-reduce:animate-none"}>
      <div className="flex min-w-0 gap-3 p-4">
        <div className="h-11 w-11 shrink-0 rounded-control bg-surface-alt" />
        <div className="flex-1 space-y-2"><div className="h-5 w-2/3 rounded bg-surface-alt" /><div className="h-3 w-1/2 rounded bg-surface-alt" /><div className="h-3 w-4/5 rounded bg-surface-alt" /><div className="h-3 w-1/3 rounded bg-surface-alt" /></div>
      </div>
      <div className="mx-4 flex gap-2 border-t border-border py-3"><div className="h-11 flex-1 rounded-control bg-surface-alt" /><div className="h-11 w-11 rounded-control bg-surface-alt" /><div className="h-11 w-11 rounded-control bg-surface-alt" /></div>
    </Card>)}
  </div>;
}
