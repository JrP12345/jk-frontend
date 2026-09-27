"use client";

import { type ReactNode, useState, useRef, useEffect, useCallback, useId, cloneElement, isValidElement, type ReactElement, memo } from "react";
import { createPortal } from "react-dom";
import { popoverPosition } from "@/lib/popoverPosition";
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
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [owner, setOwner] = useState<string>();
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [coords, setCoords] = useState<ReturnType<typeof popoverPosition> | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus) containerRef.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
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
      setOwner(containerRef.current.closest('[role="dialog"]')?.id || undefined);
      setCoords(popoverPosition(rect, menuRef.current?.getBoundingClientRect().width || 192, 220, align));
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
        const portalEl = menuRef.current;
        if (portalEl && portalEl.contains(e.target as Node)) return;
        close(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close(); }
    };
    const onScrollOrResize = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close(false);
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

  useEffect(() => {
    if (!open || !render) return;
    const timer = window.setTimeout(() => {
      updateCoords();
      const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      buttons?.[Math.max(0, focusedIndex)]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, render, focusedIndex, updateCoords]);

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
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault(); setFocusedIndex(e.key === "Home" ? 0 : focusableItems.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault(); close();
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
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg touch-manipulation active:scale-[0.98] transition-transform duration-100"
      >
        {isValidElement(trigger) ? cloneElement(trigger as ReactElement<Record<string, unknown>>, { "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? id : undefined }) : trigger}
      </div>

      {render &&
        mounted &&
        coords &&
        createPortal(
          <div
            id={id}
            ref={menuRef}
            data-overlay-owner={owner}
            data-exiting={isExiting}
            aria-label="Actions"
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: coords.maxHeight,
              zIndex: 99999,
            }}
            className={cn(
              "bg-surface rounded-2xl border border-border/80 shadow-xl p-1.5 focus:outline-none  ring-1 ring-border/50 transform-gpu select-none overflow-y-auto",
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
                  tabIndex={isFocused || (focusedIndex < 0 && focusableIdx === 0) ? 0 : -1}
                  onFocus={() => setFocusedIndex(focusableIdx)}
                  onClick={() => {
                    item.onClick?.();
                    close();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-left cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring min-h-[44px] md:min-h-0",
                    item.danger || item.variant === "danger"
                      ? "text-danger-text hover:bg-danger-500/10 dark:hover:bg-danger-500/20 font-semibold"
                      : item.variant === "warning"
                      ? "text-warning-text dark:text-warning-text hover:bg-warning-500/10"
                      : item.variant === "primary"
                      ? "text-accent dark:text-accent hover:bg-primary-500/10"
                      : "text-text hover:bg-surface-hover hover:text-text",
                    isFocused && !(item.danger || item.variant === "danger") && "bg-surface-hover text-text",
                    isSelected && "font-semibold text-accent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.icon && (
                      <span
                        className={cn(
                          "shrink-0 [&>svg]:h-4 [&>svg]:w-4 transition-colors",
                          item.danger || item.variant === "danger"
                            ? "text-danger-text"
                            : "text-text-muted group-hover:text-text"
                        )}
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isSelected && (
                    <svg className="h-3.5 w-3.5 text-accent shrink-0 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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


