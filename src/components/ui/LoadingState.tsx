import type { ReactNode } from "react";
import LogoLoader from "./LogoLoader";
import Spinner from "./Spinner";
import { cn } from "./utils";

/**
 * A single accessible loading region.
 * - fullPage / no children → LogoLoader (brand animation)
 * - children provided      → shimmer skeleton layout + sr-only label
 * - compact (not fullPage, no children, children=spinner) → Spinner
 */
export default function LoadingState({ label = "Loading…", fullPage = false, className, children, compact = false }: {
  label?: string;
  fullPage?: boolean;
  className?: string;
  children?: ReactNode;
  /** Force the small ring Spinner instead of the logo animation */
  compact?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label} aria-busy="true" className={cn(
      "w-full min-w-0 text-text-secondary",
      children ? "space-y-5" : "flex flex-col items-center justify-center gap-3 p-6 text-center",
      fullPage ? "min-h-dvh bg-surface-alt" : !children && "min-h-48",
      className,
    )}>
      {children ? (
        <><div aria-hidden="true" className="w-full min-w-0">{children}</div><span className="sr-only">{label}</span></>
      ) : compact ? (
        <><div aria-hidden="true"><Spinner size="md" /></div><p className="text-sm font-medium">{label}</p></>
      ) : (
        <LogoLoader
          size={fullPage ? "lg" : "md"}
          label={label}
          className={fullPage ? undefined : "py-2"}
        />
      )}
    </div>
  );
}
