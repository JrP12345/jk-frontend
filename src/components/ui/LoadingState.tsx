import Spinner from "./Spinner";
import { cn } from "./utils";

/** Use for unknown page geometry; known screens should use their own skeleton. */
export default function LoadingState({ label = "Loading…", fullPage = false, className }: {
  label?: string;
  fullPage?: boolean;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={cn(
      "flex flex-col items-center justify-center gap-3 p-6 text-center text-text-secondary",
      fullPage ? "min-h-dvh bg-surface-alt" : "min-h-48",
      className,
    )}>
      <div aria-hidden="true"><Spinner size="md" /></div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
