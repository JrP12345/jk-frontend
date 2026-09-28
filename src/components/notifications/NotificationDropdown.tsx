"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Clock, MoreHorizontal, Pin, ArrowRight } from "lucide-react";
import { Alert, Button, Dropdown, useToast } from "@/components/ui";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationCategoryLabel } from "@/lib/notificationPresentation";

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { markAsRead, markAllAsRead, snoozeNotification, togglePinNotification } = useNotifications();
  const { toast } = useToast();
  const notifyAction = async (action: () => Promise<unknown>) => {
    try { await action(); }
    catch { toast({ title: "Notification could not be updated", description: "Please try again.", variant: "error" }); }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", "dropdown", filter],
    queryFn: () => notificationService.getNotifications({ limit: 10, unreadOnly: filter === "unread" }),
  });
  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
  const groups = [
    { label: "Today", items: notifications.filter(item => new Date(item.createdAt).getTime() >= todayStart) },
    { label: "Yesterday", items: notifications.filter(item => { const time = new Date(item.createdAt).getTime(); return time >= yesterdayStart && time < todayStart; }) },
    { label: "Earlier", items: notifications.filter(item => !(new Date(item.createdAt).getTime() >= yesterdayStart)) },
  ];

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) await notifyAction(() => markAsRead(item.id));
    onClose();
    if (item.actionUrl) router.push(item.actionUrl);
  };

  return (
    <div className="flex flex-col flex-auto min-h-0 bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 py-1 border-b border-border shrink-0">
        <div role="group" aria-label="Filter notifications" className="flex items-center gap-1">
          {(["all", "unread"] as const).map(value => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
              className={`min-h-11 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${filter === value ? "text-accent bg-primary-500/10" : "text-text-secondary hover:bg-surface-hover"}`}>
              {value === "all" ? "All" : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && <Button variant="ghost" size="xs" onClick={() => notifyAction(() => markAllAsRead())} className="text-accent">Mark all read</Button>}
      </div>

      <div className="notification-preview-list flex-auto min-h-0 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div role="status" aria-label="Loading notifications" className="divide-y divide-border">
            {Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="px-4 py-4 space-y-2 animate-pulse motion-reduce:animate-none"><div className="h-3 w-1/3 rounded bg-surface-alt" /><div className="h-4 w-3/4 rounded bg-surface-alt" /><div className="h-3 w-full rounded bg-surface-alt" /></div>)}
          </div>
        ) : isError ? (
          <Alert variant="error" title="Notifications could not be loaded" className="m-3" action={<Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>}>Check your connection and try again.</Alert>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-7 h-7 mx-auto text-text-muted mb-3" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
            <p className="text-xs text-text-secondary mt-1">You are all caught up.</p>
          </div>
        ) : groups.filter(group => group.items.length).map(group => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="px-4 pt-3 pb-1 text-[11px] font-medium text-text-muted">{group.label}</h3>
            <div className="divide-y divide-border/60">
              {group.items.map(item => <NotificationRow key={item.id} item={item}
                onClick={() => handleItemClick(item)}
                onMarkRead={() => notifyAction(() => markAsRead(item.id))}
                onSnooze={() => notifyAction(() => snoozeNotification(item.id, 60))}
                onTogglePin={() => notifyAction(() => togglePinNotification(item.id))} />)}
            </div>
          </section>
        ))}
      </div>

      <Link href="/dashboard/notifications" onClick={onClose} className="flex items-center justify-center gap-2 min-h-12 px-4 text-sm font-medium text-accent border-t border-border shrink-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring">
        View inbox <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function formatRelativeTime(date: string) {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationRow({ item, onClick, onMarkRead, onSnooze, onTogglePin }: {
  item: NotificationItem;
  onClick: () => Promise<unknown>;
  onMarkRead: () => Promise<unknown>;
  onSnooze: () => Promise<unknown>;
  onTogglePin: () => Promise<unknown>;
}) {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await action(); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return (
    <div className={`flex items-start gap-1 pl-4 pr-2 py-2 ${!item.readAt ? "bg-primary-500/5" : ""}`}>
      <button type="button" disabled={busy} onClick={() => run(onClick)} className="flex-1 min-w-0 py-1.5 text-left rounded-lg cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-wait">
        <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
          <span className="truncate">{notificationCategoryLabel(item.category)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.createdAt} className="shrink-0">{formatRelativeTime(item.createdAt)}</time>
          {item.pinned && <Pin aria-label="Pinned" className="w-3 h-3 text-accent shrink-0" />}
        </div>
        <p className={`text-sm leading-snug flex items-start gap-2 ${!item.readAt ? "font-semibold text-text" : "font-medium text-text-secondary"}`}>
          <span className="min-w-0 flex-1">{item.title}</span>
          {!item.readAt && <span aria-label="Unread" className="w-1.5 h-1.5 mt-1.5 rounded-full bg-primary shrink-0" />}
        </p>
        <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed break-words">{item.message}</p>
      </button>
      <Dropdown width="w-52" trigger={<Button variant="ghost" size="xs" loading={busy} className="w-11 shrink-0 !px-0" icon={<MoreHorizontal className="w-4 h-4" />} aria-label={`Actions for ${item.title}`} />} items={[
        { label: item.pinned ? "Unpin notification" : "Pin notification", icon: <Pin className="w-4 h-4" />, disabled: busy, onClick: () => { void run(onTogglePin); } },
        { label: "Snooze for 1 hour", icon: <Clock className="w-4 h-4" />, disabled: busy, onClick: () => { void run(onSnooze); } },
        ...(!item.readAt ? [{ label: "Mark as read", icon: <Check className="w-4 h-4" />, disabled: busy, onClick: () => { void run(onMarkRead); } }] : []),
      ]} />
    </div>
  );
}
