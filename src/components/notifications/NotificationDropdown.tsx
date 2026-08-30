"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { markAsRead, markAllAsRead, archiveNotification, snoozeNotification, togglePinNotification } = useNotifications();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "dropdown", filter],
    queryFn: () =>
      notificationService.getNotifications({
        limit: 10,
        unreadOnly: filter === "unread",
      }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Group by relative time
  const groupNotificationsByTime = (items: NotificationItem[]) => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    items.forEach((item) => {
      const itemTime = new Date(item.createdAt).getTime();
      if (itemTime >= todayStart) {
        today.push(item);
      } else if (itemTime >= yesterdayStart) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, yesterday, earlier };
  };

  const grouped = groupNotificationsByTime(notifications);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getSeverityBadgeVariant = (severity: string): "danger" | "warning" | "success" | "primary" => {
    switch (severity) {
      case "error":
        return "danger";
      case "warning":
        return "warning";
      case "success":
        return "success";
      default:
        return "primary";
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await markAsRead(item.id);
    }
    onClose();
    if (item.actionUrl) {
      router.push(item.actionUrl);
    }
  };

  return (
    <div className="w-80 sm:w-96 bg-surface/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden flex flex-col max-h-[85vh] z-[999] animate-popover-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface-alt">
        <div className="flex items-center gap-2.5">
          <h3 className="font-bold text-text text-base tracking-wide">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-primary-500 text-white rounded-full shadow-xs">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-xs font-semibold text-primary-500 hover:underline cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border bg-surface px-4 py-2 gap-2 text-xs font-medium">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            filter === "all"
              ? "bg-primary-500/10 text-primary-500 font-bold border border-primary-500/20"
              : "text-text-muted hover:text-text hover:bg-surface-hover"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            filter === "unread"
              ? "bg-primary-500/10 text-primary-500 font-bold border border-primary-500/20"
              : "text-text-muted hover:text-text hover:bg-surface-hover"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 bg-surface">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted animate-pulse">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="w-10 h-10 mx-auto text-text-muted mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm font-semibold text-text">No notifications</p>
            <p className="text-xs text-text-muted mt-1">You are all caught up!</p>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-surface-alt text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border/40">
                  Today
                </div>
                {grouped.today.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    formatTime={formatRelativeTime}
                    getSeverityBadgeVariant={getSeverityBadgeVariant}
                    onClick={() => handleItemClick(item)}
                    onMarkRead={() => markAsRead(item.id)}
                    onSnooze={() => snoozeNotification(item.id, 60)}
                    onTogglePin={() => togglePinNotification(item.id)}
                  />
                ))}
              </div>
            )}

            {grouped.yesterday.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-surface-alt text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border/40">
                  Yesterday
                </div>
                {grouped.yesterday.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    formatTime={formatRelativeTime}
                    getSeverityBadgeVariant={getSeverityBadgeVariant}
                    onClick={() => handleItemClick(item)}
                    onMarkRead={() => markAsRead(item.id)}
                    onSnooze={() => snoozeNotification(item.id, 60)}
                    onTogglePin={() => togglePinNotification(item.id)}
                  />
                ))}
              </div>
            )}

            {grouped.earlier.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-surface-alt text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border/40">
                  Earlier
                </div>
                {grouped.earlier.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    formatTime={formatRelativeTime}
                    getSeverityBadgeVariant={getSeverityBadgeVariant}
                    onClick={() => handleItemClick(item)}
                    onMarkRead={() => markAsRead(item.id)}
                    onSnooze={() => snoozeNotification(item.id, 60)}
                    onTogglePin={() => togglePinNotification(item.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-surface-alt text-center">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="text-xs font-bold text-primary-500 hover:underline block tracking-wide"
        >
          View all in Inbox →
        </Link>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  formatTime,
  getSeverityBadgeVariant,
  onClick,
  onMarkRead,
  onSnooze,
  onTogglePin,
}: {
  item: NotificationItem;
  formatTime: (d: string) => string;
  getSeverityBadgeVariant: (s: string) => "danger" | "warning" | "success" | "primary";
  onClick: () => void;
  onMarkRead: () => void;
  onSnooze: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-3.5 flex items-start gap-3 hover:bg-surface-hover transition-colors cursor-pointer group relative overflow-hidden ${
        item.pinned ? "bg-amber-500/5 dark:bg-amber-500/10 border-l-2 border-l-amber-500" : !item.readAt ? "bg-primary-500/5 dark:bg-primary-500/10" : ""
      }`}
    >
      {!item.readAt && (
        <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5 shadow-xs shadow-primary-500/50" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant={getSeverityBadgeVariant(item.severity)} size="sm">
              {item.category}
            </Badge>
            {item.pinned && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                📌 Pinned
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-text-muted shrink-0 group-hover:opacity-0 transition-opacity">
            {formatTime(item.createdAt)}
          </span>
        </div>
        <p className={`text-xs text-text mt-1.5 leading-snug ${!item.readAt ? "font-bold" : "font-medium"}`}>
          {item.title}
        </p>
        <p className="text-[11px] text-text-muted mt-1 line-clamp-2 leading-relaxed">
          {item.message}
        </p>
      </div>

      {/* Hover Action Bar (Overlays timestamp cleanly without shifting container width) */}
      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1 bg-surface px-1.5 py-0.5 rounded-lg border border-border/60 shadow-sm z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          title={item.pinned ? "Unpin notification" : "Pin notification"}
          className={`p-1 rounded cursor-pointer transition-colors text-xs ${
            item.pinned ? "text-amber-500 font-bold" : "text-text-muted hover:text-amber-500"
          }`}
        >
          📌
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze();
          }}
          title="Snooze for 1 hour"
          className="p-1 text-text-muted hover:text-primary-500 rounded text-xs cursor-pointer transition-colors"
        >
          ⏰
        </button>
        {!item.readAt && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            title="Mark as read"
            className="p-1 text-text-muted hover:text-primary-500 rounded cursor-pointer transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
