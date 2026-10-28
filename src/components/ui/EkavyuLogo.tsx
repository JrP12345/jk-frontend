"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { cn } from "./utils";

export interface EkavyuLogoProps {
  className?: string;
  /** Use the square application mark in dense UI. */
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Include the tagline only where the brand has room, such as auth screens. */
  showTagline?: boolean;
  /** Place a small, quiet wordmark beneath the symbol. */
  layout?: "horizontal" | "stacked";
}

const wordmarkSizeMap = {
  sm: "text-base max-w-[130px]",
  md: "text-xl max-w-[170px]",
  lg: "text-2xl max-w-[220px]",
  xl: "text-3xl max-w-[280px]",
};

const iconSizeMap = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

/** Transparent path-based vector supplied in the brand handoff. */
export function EkavyuIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <LoadingImage
        src="/brand/ekavyu-mark.svg?v=brand-5"
        alt="Ekavyu"
        width={512}
        height={512}
        loading="eager"
        fetchPriority="high"
        loadingEffect={false}
        className="block h-full w-full object-contain"
      />
    </div>
  );
}


/**
 * Full Ekavyu wordmark for headers and spacious authentication/marketing views.
 * Compact headers omit the tagline; spacious views can opt in.
 */
export default function EkavyuLogo({
  className = "",
  iconOnly = false,
  size = "md",
  showTagline = false,
  layout = "horizontal",
}: EkavyuLogoProps) {
  if (iconOnly) {
    return <EkavyuIcon className={cn(iconSizeMap[size], className)} />;
  }

  const sizeClass = wordmarkSizeMap[size];
  const stacked = layout === "stacked";

  return (
    <div className={cn("inline-flex shrink-0 select-none items-center py-1 text-text", stacked ? "flex-col gap-0.5" : cn("gap-2 font-bold tracking-tight", sizeClass), className)}>
      <EkavyuIcon className={iconSizeMap[size]} />
      <span className={cn("flex min-w-0 flex-col", stacked && "items-center text-center")}>
        <span aria-hidden="true" className={stacked ? cn("font-semibold tracking-[.035em] leading-none", size === "xl" ? "text-base" : size === "lg" ? "text-sm" : "text-[11px]") : "uppercase tracking-[.16em]"}>Ekavyu</span>
        {showTagline && <span className="text-[10px] sm:text-xs font-medium tracking-normal text-text-secondary">Care That Keeps Moving</span>}
      </span>
    </div>
  );
}
