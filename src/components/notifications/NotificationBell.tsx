"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { runWithTouchSelectionHaptic } from "@/lib/haptics";
import { popoverPosition } from "@/lib/popoverPosition";
import { cn } from "@/components/ui/utils";

const NotificationDropdown = dynamic(() => import("./NotificationDropdown").then(module => module.NotificationDropdown), {
  ssr: false,
  loading: () => <div role="status" className="min-h-32 grid place-items-center text-sm text-text-secondary">Loading notifications...</div>,
});

const DROPDOWN_WIDTH = 384;
const DROPDOWN_MAX_HEIGHT = 448;
const emptySubscribe = () => () => {};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [coords, setCoords] = useState<ReturnType<typeof popoverPosition> | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<number | undefined>(undefined);
  const { unreadCount } = useNotifications();
  const id = useId();

  useEffect(() => () => window.clearTimeout(exitTimerRef.current), []);

  const close = useCallback((restoreFocus = false) => {
    window.clearTimeout(exitTimerRef.current);
    setIsOpen(false);
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setRender(false);
      setIsExiting(false);
    }, 150);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords(popoverPosition(rect, DROPDOWN_WIDTH, DROPDOWN_MAX_HEIGHT, "right"));
  }, []);

  const previewGesture = useSwipeGesture({
    axis: "x",
    direction: "left",
    enabled: isOpen,
    threshold: 64,
    allowButtonTargets: true,
    onSwipe: () => close(false),
  });

  useLayoutEffect(() => {
    if (isOpen && render) updateCoords();
  }, [isOpen, render, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    }, 0);

    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[data-overlay-owner="${id}"]`)) return;
      close(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Let any nested row action dropdown handle Escape before closing this panel.
      if (document.querySelector(`[data-overlay-owner="${id}"]:not([data-exiting="true"])`)) return;
      event.preventDefault();
      close(true);
    };

    const onViewportChange = (event: Event) => {
      if (event.target instanceof Node) {
        if (panelRef.current?.contains(event.target)) return;
        if (event.target instanceof Element && event.target.closest(`[data-overlay-owner="${id}"]`)) return;
      }
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        close(false);
        return;
      }
      updateCoords();
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onViewportChange, { capture: true, passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onViewportChange, { capture: true });
      window.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [isOpen, id, close, updateCoords]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    runWithTouchSelectionHaptic(event, () => {
      if (isOpen) {
        close(false);
      } else {
        window.clearTimeout(exitTimerRef.current);
        updateCoords();
        setRender(true);
        setIsExiting(false);
        setIsOpen(true);
      }
    });
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-material-control
        onClick={handleToggle}
        className="touch-target relative p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
        aria-label={`Open Notifications${unreadCount > 0 ? `: ${unreadCount > 9 ? "9+" : unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-black text-background shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {render && mounted && coords && createPortal(
        <div
          id={id}
          ref={panelRef}
          role="region"
          aria-label="Notifications"
          tabIndex={-1}
          data-popover-root=""
          data-exiting={isExiting}
          style={{
            position: "fixed",
            top: coords.top,
            bottom: coords.bottom,
            left: coords.left,
            width: coords.width,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, coords.maxHeight || DROPDOWN_MAX_HEIGHT),
            zIndex: "var(--layer-popover)",
            pointerEvents: isExiting ? "none" : undefined,
          }}
          className={cn(
            "material-glass-elevated flex flex-col rounded-container border border-border/80 bg-surface shadow-xl overflow-hidden focus:outline-none",
            coords.upward ? "origin-bottom-right" : "origin-top-right",
            isExiting ? "animate-dropdown-out" : "animate-dropdown-in",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-surface shrink-0">
            <h2 className="text-sm font-semibold text-text">Notifications</h2>
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Close notifications"
              className="touch-target rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div
            {...previewGesture.handlers}
            style={{
              translate: previewGesture.offset ? `${previewGesture.offset}px 0` : undefined,
              transition: previewGesture.dragging ? "none" : "translate 180ms ease",
            }}
            className="flex flex-col flex-auto min-h-0 [touch-action:pan-y_pinch-zoom]"
          >
            <NotificationDropdown onClose={() => close(false)} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
