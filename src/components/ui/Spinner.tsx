"use client";

import { cn } from "./utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  label?: string;
  className?: string;
}

const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };

export default function Spinner({ size = "md", color = "text-primary-600", label, className = "" }: SpinnerProps) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)} role="status" aria-label={label || "Loading"}>
      <svg className={cn("animate-spin-slow", sizes[size], color)} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
      </svg>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </div>
  );
}

export function PageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
      <Spinner size="lg" label={label} />
    </div>
  );
}
