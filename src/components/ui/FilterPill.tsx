"use client";

import { ReactNode } from "react";
import { cn } from "./utils";

export interface FilterPillProps {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export default function FilterPill({
  label,
  icon,
  active = false,
  count,
  onClick,
  className = "",
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ease-out flex items-center gap-1.5 shrink-0 whitespace-nowrap border outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 select-none",
        active
          ? "bg-primary-600 text-white border-primary-600 font-semibold shadow-xs hover:bg-primary-700"
          : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:text-text hover:border-border/80",
        className
      )}
    >
      {icon && <span className="text-xs shrink-0">{icon}</span>}
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full transition-colors",
            active
              ? "bg-white/20 text-white"
              : "bg-surface-alt text-text-muted border border-border/50"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
