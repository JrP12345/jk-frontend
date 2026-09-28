"use client";

import { useState, useId } from "react";
import Modal from "@/components/ui/Modal";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";
import { useToastPosition } from "@/hooks/useToastPosition";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const id = useId();
  const position = useToastPosition(isOpen);

  return (
    <div className="relative">
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

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications"
        size="sm"
        placement="top"
        className="notification-dialog"
        viewportClassName="notification-dialog-viewport"
        viewportStyle={position}
        headerClassName="!bg-surface !py-4"
        bodyClassName="!p-0 !overflow-hidden flex flex-col"
        contentClassName="flex flex-col flex-auto min-h-0"
      >
        <div id={id} className="flex flex-col flex-auto min-h-0"><NotificationDropdown onClose={() => setIsOpen(false)} /></div>
      </Modal>
    </div>
  );
}
