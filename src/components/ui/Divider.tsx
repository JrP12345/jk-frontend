"use client";

import { memo } from "react";
import { cn } from "./utils";

export interface DividerProps {
  label?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

const Divider = memo(function Divider({ label, orientation = "horizontal", className = "" }: DividerProps) {
  if (orientation === "vertical") {
    return <div role="separator" aria-orientation="vertical" className={cn("w-px bg-border self-stretch shrink-0", className)} />;
  }

  if (label) {
    return (
      <div role="separator" aria-orientation="horizontal" className={cn("flex items-center gap-3 w-full select-none", className)}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return <div role="separator" aria-orientation="horizontal" className={cn("h-px bg-border w-full shrink-0", className)} />;
});

export default Divider;


