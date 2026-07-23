"use client";

import { type ReactNode, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Dropdown — Click-triggered menu with portal rendering
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
  const [openUpward, setOpenUpward] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isUpward = spaceBelow < 220;

      setOpenUpward(isUpward);
      setCoords({
        top: isUpward ? rect.top : rect.bottom,
        left: align === "right" ? rect.right : rect.left,
      });
    }
  }, [align]);

  const handleToggle = () => {
    if (!open) {
      updateCoords();
    }
    setOpen(!open);
  };

  const focusableItems = items
    .map((item, idx) => ({ item, originalIndex: idx }))
    .filter(({ item }) => !item.divider && !item.disabled);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const portalEl = document.getElementById("dropdown-portal-root");
        if (portalEl && portalEl.contains(e.target as Node)) return;
        close();
      }
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = () => { close(); };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;

    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        updateCoords();
        setOpen(true);
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
        onClick={handleToggle}
        className="cursor-pointer"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && mounted && coords && createPortal(
        <div
          id="dropdown-portal-root"
          style={{
            position: "fixed",
            top: openUpward ? undefined : coords.top + 6,
            bottom: openUpward ? window.innerHeight - coords.top + 6 : undefined,
            left: align === "right" ? undefined : coords.left,
            right: align === "right" ? window.innerWidth - coords.left : undefined,
            zIndex: 99999,
          }}
          className={cn(
            "bg-surface rounded-xl border border-border shadow-2xl py-1.5 focus:outline-none backdrop-blur-xl bg-surface/95 animate-in fade-in zoom-in-95 duration-150",
            width
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
                  "w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs font-medium text-left cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
                  isFocused ? "bg-surface-hover text-text" : "text-text",
                  item.danger
                    ? "text-danger-500 hover:bg-danger-500/10"
                    : "hover:bg-surface-hover hover:text-text",
                  isSelected && "font-bold text-primary-500"
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
                  <svg className="h-3.5 w-3.5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
