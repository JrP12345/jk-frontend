"use client";

import { cn } from "./utils";

interface DividerProps {
  label?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export default function Divider({ label, orientation = "horizontal", className = "" }: DividerProps) {
  if (orientation === "vertical") return <div className={cn("w-px bg-border self-stretch", className)} />;
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }
  return <div className={cn("h-px bg-border w-full", className)} />;
}
