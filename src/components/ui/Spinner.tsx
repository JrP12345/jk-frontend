"use client";

import { memo } from "react";
import { cn } from "./utils";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  label?: string;
  className?: string;
}

const sizes: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const Spinner = memo(function Spinner({
  size = "md",
  color = "text-primary-600 dark:text-primary-400",
  label,
  className = "",
}: SpinnerProps) {
  return (
    <div className={cn("inline-flex flex-col items-center justify-center gap-2", className)} role="status">
      <svg
        className={cn("animate-spin-smooth origin-center shrink-0 transform-gpu", sizes[size], color)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
      </svg>
      {label ? (
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      ) : (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  );
});

export default Spinner;

export const PageSpinner = memo(function PageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-md animate-fade-in">
      <Spinner size="lg" label={label} />
    </div>
  );
});


