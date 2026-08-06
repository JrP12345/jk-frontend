"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [realtimeNotifications, setRealtimeNotifications] = useState<NotificationItem[]>([]);

  // ─── Query Unread Count (100% SSE Event Driven — Zero Polling) ────
  const { data: unreadCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: !!user,
    refetchInterval: false, // Zero polling — 100% pure SSE real-time push streaming
  });

  // ─── Realtime SSE EventSource Stream Subscription ────────────────
  useEffect(() => {
    if (!user || typeof window === "undefined" || typeof EventSource === "undefined") return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    // EventSource sends the httpOnly access cookie when credentials are enabled;
    // do not expose a bearer token in the URL or a script-readable cookie.
    const streamUrl = `${apiUrl}/notifications/stream`;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(streamUrl, { withCredentials: true });

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "NOTIFICATION_RECEIVED") {
            const newNotif: NotificationItem = payload.data.notification;

            // 1. Instantly update unread count badge in cache
            if (payload.data.unreadCount !== undefined) {
              queryClient.setQueryData(["notifications", "unread-count"], payload.data.unreadCount);
            } else {
              queryClient.setQueryData(["notifications", "unread-count"], (old: number | undefined) => (old ?? 0) + 1);
            }

            // 2. Instantly update active notification list queries in cache so tables & dropdowns update in 0ms
            queryClient.setQueriesData({ queryKey: ["notifications"] }, (oldData: any) => {
              if (!oldData || !Array.isArray(oldData.notifications)) return oldData;
              if (oldData.notifications.some((n: any) => n.id === newNotif.id)) return oldData;
              return {
                ...oldData,
                notifications: [newNotif, ...oldData.notifications],
                unreadCount: (oldData.unreadCount || 0) + 1,
                pagination: {
                  ...oldData.pagination,
                  total: (oldData.pagination?.total || 0) + 1,
                },
              };
            });

            // 3. Invalidate React Query cache for sync
            queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "all" });

            setRealtimeNotifications((prev) => [newNotif, ...prev]);

            // Fire floating SaaS Toast Notification (suppress duplicate audit toasts already handled by page UI)
            const titleLower = newNotif.title.toLowerCase();
            const isDuplicateAuditToast =
              titleLower.includes("account login") ||
              titleLower.includes("login successful") ||
              titleLower.includes("organization onboarding") ||
              titleLower.includes("organization created");

            if (!isDuplicateAuditToast) {
              toast({
                title: newNotif.title,
                description: newNotif.message,
                variant:
                  newNotif.severity === "error"
                    ? "error"
                    : newNotif.severity === "warning"
                    ? "warning"
                    : newNotif.severity === "success"
                    ? "success"
                    : "default",
                duration: 5000,
              });
            }
          } else if (payload.type === "UNREAD_COUNT_UPDATED") {
            if (payload.data?.unreadCount !== undefined) {
              queryClient.setQueryData(["notifications", "unread-count"], payload.data.unreadCount);
            }
            queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
          }
        } catch (err) {
          console.error("[SSE Parse Error]", err);
        }
      };

      eventSource.onerror = (err) => {
        // SSE reconnect handles automatically
      };
    } catch (err) {
      console.warn("[SSE Connection Warning]", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [user, queryClient, toast]);

  // ─── Mutations with Optimistic UI Updates ───────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count"] });

      const previousUnread = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      if (previousUnread !== undefined && previousUnread > 0) {
        queryClient.setQueryData(["notifications", "unread-count"], previousUnread - 1);
      }
      return { previousUnread };
    },
    onError: (_err, _id, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(["notifications", "unread-count"], context.previousUnread);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count"] });

      const previousUnread = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      queryClient.setQueryData(["notifications", "unread-count"], 0);
      return { previousUnread };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(["notifications", "unread-count"], context.previousUnread);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => notificationService.archiveNotification(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count"] });

      const previousUnread = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      return { previousUnread };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count"] });

      const previousUnread = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      return { previousUnread };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, durationMinutes }: { id: string; durationMinutes?: number }) =>
      notificationService.snoozeNotification(id, durationMinutes),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: (id: string) => notificationService.togglePinNotification(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    unreadCount,
    realtimeNotifications,
    markAsRead: markReadMutation.mutateAsync,
    markAllAsRead: markAllReadMutation.mutateAsync,
    archiveNotification: archiveMutation.mutateAsync,
    deleteNotification: deleteMutation.mutateAsync,
    snoozeNotification: (id: string, durationMinutes = 60) => snoozeMutation.mutateAsync({ id, durationMinutes }),
    togglePinNotification: togglePinMutation.mutateAsync,
    refetchCount,
  };
}
