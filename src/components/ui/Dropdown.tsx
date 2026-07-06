"use client";

import { type ReactNode, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Dropdown — Click-triggered menu with keyboard navigation
   ──────────────────────────────────────────────── */

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  active?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  width?: string;
  className?: string;
}

export default function Dropdown({ trigger, items, align = "left", width = "w-48", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Filter list of elements that can be focused/selected via keyboard
  const focusableItems = items
    .map((item, idx) => ({ item, originalIndex: idx }))
    .filter(({ item }) => !item.divider && !item.disabled);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;

    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        setOpen(true);
        // Focus first or last item depending on direction key
        setFocusedIndex(e.key === "ArrowUp" ? focusableItems.length - 1 : 0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      setFocusedIndex(prev => (focusableItems.length > 0 ? (prev + 1) % focusableItems.length : -1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setFocusedIndex(prev =>
        focusableItems.length > 0
          ? (prev - 1 + focusableItems.length) % focusableItems.length
          : -1
      );
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      if (focusedIndex >= 0 && focusedIndex < focusableItems.length) {
        const { item } = focusableItems[focusedIndex];
        item.onClick?.();
        close();
      }
      e.preventDefault();
    } else if (e.key === "Tab") {
      close();
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={cn("relative inline-flex", className)}
    >
      <div
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-1.5 z-40 bg-surface rounded-lg border border-border shadow-lg py-1 animate-scale-in focus:outline-none backdrop-blur-md bg-surface/95",
            width,
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
          role="menu"
        >
          {items.map((item, i) => {
            if (item.divider) return <div key={i} className="my-1 border-t border-border" role="separator" />;

            const focusableIdx = focusableItems.findIndex(x => x.originalIndex === i);
            const isFocused = focusableIdx === focusedIndex;
            const isSelected = item.active;

            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  close();
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-sm text-left cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                  isFocused ? "bg-surface-hover text-text scale-[0.98]" : "text-text",
                  item.danger
                    ? "text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/20"
                    : isFocused
                      ? ""
                      : "hover:bg-surface-hover hover:text-text",
                  isSelected && "font-medium text-primary-500"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.icon && (
                    <span className={cn(
                      "shrink-0 [&>svg]:h-4 [&>svg]:w-4",
                      isFocused ? "text-text" : "text-text-muted",
                      item.danger && "text-danger-500"
                    )}>
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
                {isSelected && (
                  <svg className="h-4 w-4 text-primary-500 shrink-0 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

