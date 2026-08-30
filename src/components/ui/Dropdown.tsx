"use client";

import { type ReactNode, useState, useRef, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

/* ────────────────────────────────────────────────
   Dropdown — Click-triggered menu with portal rendering
   ──────────────────────────────────────────────── */

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "warning" | "danger";
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  active?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  width?: string;
  className?: string;
}

const Dropdown = memo(function Dropdown({ trigger, items, align = "left", width = "w-48", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
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

  useEffect(() => {
    if (open) {
      setRender(true);
      setIsExiting(false);
    } else if (render) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setRender(false);
        setIsExiting(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, render]);

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
      setOpen(true);
    } else {
      close();
    }
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
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScrollOrResize = () => {
      close();
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
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
      setFocusedIndex((prev) => (focusableItems.length > 0 ? (prev + 1) % focusableItems.length : -1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setFocusedIndex((prev) =>
        focusableItems.length > 0 ? (prev - 1 + focusableItems.length) % focusableItems.length : -1
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
    <div ref={containerRef} onKeyDown={handleKeyDown} className={cn("relative inline-flex", className)}>
      <div
        onClick={handleToggle}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg touch-manipulation active:scale-[0.98] transition-transform duration-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {render &&
        mounted &&
        coords &&
        createPortal(
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
              "bg-surface/98 rounded-2xl border border-border/80 shadow-xl p-1.5 focus:outline-none backdrop-blur-2xl ring-1 ring-border/50 transform-gpu select-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent overflow-hidden",
              isExiting ? "animate-dropdown-out" : "animate-dropdown-in",
              width
            )}
            role="menu"
          >
            {items.map((item, i) => {
              if (item.divider) return <div key={i} className="my-1 border-t border-border/60" role="separator" />;

              const focusableIdx = focusableItems.findIndex((x) => x.originalIndex === i);
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
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-left cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 min-h-[36px] sm:min-h-0",
                    item.danger || item.variant === "danger"
                      ? "text-danger-500 hover:bg-danger-500/10 dark:hover:bg-danger-500/20 font-semibold"
                      : item.variant === "warning"
                      ? "text-warning-600 dark:text-warning-400 hover:bg-warning-500/10"
                      : item.variant === "primary"
                      ? "text-primary-600 dark:text-primary-400 hover:bg-primary-500/10"
                      : "text-text hover:bg-surface-hover hover:text-text",
                    isFocused && !(item.danger || item.variant === "danger") && "bg-surface-hover text-text",
                    isSelected && "font-semibold text-primary-500"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.icon && (
                      <span
                        className={cn(
                          "shrink-0 [&>svg]:h-4 [&>svg]:w-4 transition-colors",
                          item.danger || item.variant === "danger"
                            ? "text-danger-500"
                            : "text-text-muted group-hover:text-text"
                        )}
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isSelected && (
                    <svg className="h-3.5 w-3.5 text-primary-500 shrink-0 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
});

export default Dropdown;


