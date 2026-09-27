"use client";

import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { popoverPosition } from "@/lib/popoverPosition";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [coords, setCoords] = useState<ReturnType<typeof popoverPosition> | null>(null);
  useOverlayFocus(isOpen && !!coords, panelRef, () => setIsOpen(false), false);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => { if (dropdownRef.current) setCoords(popoverPosition(dropdownRef.current.getBoundingClientRect(), 384, 520, "right")); };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => { window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-[999]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="touch-target relative p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
        aria-label="Open Notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-black text-background shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && coords && createPortal(
        <div ref={panelRef} id={id} role="dialog" aria-label="Notifications" tabIndex={-1} style={{ position: "fixed", top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, maxHeight: coords.maxHeight, zIndex: 99999 }} className="flex flex-col">
          <NotificationDropdown onClose={() => setIsOpen(false)} />
        </div>, document.body
      )}
    </div>
  );
}
