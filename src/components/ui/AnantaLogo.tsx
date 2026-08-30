"use client";

import React from "react";
import { cn } from "./utils";

export interface AnantaLogoProps {
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
 * Anant Icon Component — loads logo-d.png (light mode) and logo-w.png (dark mode)
 * Uses data-mode="dark" attribute on <html> (not Tailwind dark class)
 */
export function AnantaIcon({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex items-center shrink-0 justify-center", className)}>
      {/* Light Mode Logo (dark ink on white) */}
      <img
        src="/logo-d.png"
        alt="Anant Logo"
        className="h-full w-auto object-contain [html[data-mode=dark]_&]:hidden transform-gpu transition-transform duration-200 ease-smooth"
      />
      {/* Dark Mode Logo (white ink on dark) */}
      <img
        src="/logo-w.png"
        alt="Anant Logo"
        className="h-full w-auto object-contain hidden [html[data-mode=dark]_&]:block transform-gpu transition-transform duration-200 ease-smooth"
      />
    </div>
  );
}

export const AnantIcon = AnantaIcon;

/**
 * Anant Official Brand Logo Component — auto-swaps light and dark assets from /public
 * Responds to data-mode="dark" on <html> element set by ThemeProvider
 */
export default function AnantaLogo({
  className = "",
  size = "md",
}: AnantaLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <div className={cn("inline-flex items-center select-none group cursor-pointer shrink-0 py-1", className)}>
      {/* Light Mode Logo Asset — hidden in dark mode */}
      <img
        src="/logo-d.png"
        alt="Anant Healthcare"
        className={cn(sizeClass, "object-contain [html[data-mode=dark]_&]:hidden transform-gpu transition-transform group-hover:scale-105 duration-200 ease-smooth")}
      />
      {/* Dark Mode Logo Asset — shown only in dark mode */}
      <img
        src="/logo-w.png"
        alt="Anant Healthcare"
        className={cn(sizeClass, "object-contain hidden [html[data-mode=dark]_&]:block transform-gpu transition-transform group-hover:scale-105 duration-200 ease-smooth")}
      />
    </div>
  );
}

export const AnantLogo = AnantaLogo;

