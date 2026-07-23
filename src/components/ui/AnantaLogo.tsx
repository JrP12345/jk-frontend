"use client";

import React from "react";
import { cn } from "./utils";

interface AnantaLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "h-7 w-auto max-w-[130px]",
  md: "h-10 w-auto max-w-[170px]",
  lg: "h-14 w-auto max-w-[220px]",
  xl: "h-20 w-auto max-w-[280px]",
};

/**
 * Ananta Icon Component — loads logo-d.png (light mode) and logo-w.png (dark mode)
 * Uses data-mode="dark" attribute on <html> (not Tailwind dark class)
 */
export function AnantaIcon({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex items-center shrink-0 justify-center", className)}>
      {/* Light Mode Logo (dark ink on white) */}
      <img
        src="/logo-d.png"
        alt="Ananta Logo"
        className="h-full w-auto object-contain [html[data-mode=dark]_&]:hidden"
      />
      {/* Dark Mode Logo (white ink on dark) */}
      <img
        src="/logo-w.png"
        alt="Ananta Logo"
        className="h-full w-auto object-contain hidden [html[data-mode=dark]_&]:block"
      />
    </div>
  );
}

/**
 * Ananta Official Brand Logo Component — auto-swaps light and dark assets from /public
 * Responds to data-mode="dark" on <html> element set by ThemeProvider
 */
export default function AnantaLogo({
  className = "",
  iconOnly = false,
  size = "md",
}: AnantaLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <div className={cn("inline-flex items-center select-none group cursor-pointer shrink-0 py-1", className)}>
      {/* Light Mode Logo Asset — hidden in dark mode */}
      <img
        src="/logo-d.png"
        alt="Ananta Healthcare"
        className={cn(sizeClass, "object-contain [html[data-mode=dark]_&]:hidden transition-transform group-hover:scale-105 duration-200")}
      />
      {/* Dark Mode Logo Asset — shown only in dark mode */}
      <img
        src="/logo-w.png"
        alt="Ananta Healthcare"
        className={cn(sizeClass, "object-contain hidden [html[data-mode=dark]_&]:block transition-transform group-hover:scale-105 duration-200")}
      />
    </div>
  );
}
