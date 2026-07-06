"use client";

import { cn } from "./utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblings?: number;
  className?: string;
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function Pagination({ currentPage, totalPages, onPageChange, siblings = 1, className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = (() => {
    const totalSlots = siblings * 2 + 5;
    if (totalPages <= totalSlots) return range(1, totalPages);
    const left = Math.max(currentPage - siblings, 1);
    const right = Math.min(currentPage + siblings, totalPages);
    const leftDots = left > 2;
    const rightDots = right < totalPages - 1;

    if (!leftDots && rightDots) return [...range(1, 3 + 2 * siblings), "...", totalPages];
    if (leftDots && !rightDots) return [1, "...", ...range(totalPages - (2 + 2 * siblings), totalPages)];
    return [1, "...", ...range(left, right), "...", totalPages];
  })();

  const base = "h-8 min-w-8 px-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ease-out inline-flex items-center justify-center active:scale-95";

  return (
    <nav aria-label="Pagination" className={cn("flex items-center gap-1", className)}>
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className={cn(base, "text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none")} aria-label="Previous">
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4l-4 4 4 4" /></svg>
      </button>
      {pages.map((p, i) => p === "..." ? (
        <span key={`d${i}`} className={cn(base, "text-text-muted cursor-default")}>…</span>
      ) : (
        <button key={p} type="button" onClick={() => onPageChange(p)} className={cn(base, p === currentPage ? "bg-primary-600 text-white shadow-sm" : "text-text-secondary hover:bg-surface-hover")} aria-current={p === currentPage ? "page" : undefined}>{p}</button>
      ))}
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className={cn(base, "text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none")} aria-label="Next">
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" /></svg>
      </button>
    </nav>
  );
}
