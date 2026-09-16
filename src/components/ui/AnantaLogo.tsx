"use client";

import { cn } from "./utils";

export interface AnantaLogoProps {
  className?: string;
  /** Use the square application mark in dense UI. */
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const wordmarkSizeMap = {
  sm: "h-7 w-auto max-w-[130px]",
  md: "h-10 w-auto max-w-[170px]",
  lg: "h-14 w-auto max-w-[220px]",
  xl: "h-20 w-auto max-w-[280px]",
};

const iconSizeMap = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

/**
 * Square brand mark for compact controls such as a collapsed navigation rail.
 * This uses the dedicated square asset so the wide wordmark is never squeezed.
 */
export function AnantaIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%]", className)}>
      <img
        src="/app-icon-light-192.png"
        alt="ANANTA"
        width={192}
        height={192}
        className="block h-full w-full object-contain [html[data-mode=dark]_&]:hidden"
      />
      <img
        src="/app-icon-dark-192.png"
        alt="ANANTA"
        width={192}
        height={192}
        className="hidden h-full w-full object-contain [html[data-mode=dark]_&]:block"
      />
    </div>
  );
}

export const AnantIcon = AnantaIcon;

/**
 * Full ANANTA wordmark for headers and spacious authentication/marketing views.
 * The appropriate asset is selected from the application's light/dark mode.
 */
export default function AnantaLogo({
  className = "",
  iconOnly = false,
  size = "md",
}: AnantaLogoProps) {
  if (iconOnly) {
    return <AnantaIcon className={cn(iconSizeMap[size], className)} />;
  }

  const sizeClass = wordmarkSizeMap[size];

  return (
    <div className={cn("inline-flex shrink-0 select-none items-center py-1", className)}>
      <img
        src="/logo-d.png"
        alt="ANANTA Healthcare"
        width={1536}
        height={1024}
        className={cn(sizeClass, "block object-contain [html[data-mode=dark]_&]:hidden")}
      />
      <img
        src="/logo-w.png"
        alt="ANANTA Healthcare"
        width={1536}
        height={1024}
        className={cn(sizeClass, "hidden object-contain [html[data-mode=dark]_&]:block")}
      />
    </div>
  );
}

export const AnantLogo = AnantaLogo;
