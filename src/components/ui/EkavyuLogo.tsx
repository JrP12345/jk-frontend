"use client";

import { cn } from "./utils";

export interface EkavyuLogoProps {
  className?: string;
  /** Use the square application mark in dense UI. */
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Include the tagline only where the brand has room, such as auth screens. */
  showTagline?: boolean;
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

/** Supplied transparent leaf mark, shared by both display modes. */
export function EkavyuIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <img
        src="/ekavyu-leaf.png?v=website-1"
        alt="Ekavyu"
        width={512}
        height={512}
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
}: EkavyuLogoProps) {
  if (iconOnly) {
    return <EkavyuIcon className={cn(iconSizeMap[size], className)} />;
  }

  const sizeClass = wordmarkSizeMap[size];

  return (
    <div className={cn("inline-flex shrink-0 select-none items-center gap-2 py-1 font-bold tracking-tight text-text", sizeClass, className)}>
      <EkavyuIcon className={iconSizeMap[size]} />
      <span className="flex min-w-0 flex-col">
        <span aria-hidden="true">Ekavyu</span>
        {showTagline && <span className="text-[10px] sm:text-xs font-medium tracking-normal text-text-secondary">Care That Keeps Moving</span>}
      </span>
    </div>
  );
}
