"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "@/services/notificationService";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import { getWebSocketUrl } from "@/utils/websocket";
import { getApiUrl } from "@/lib/api";

/** Own the notification connection once, underneath the application providers. */
export function NotificationRealtime() {
  const userId = useAuthStore(state => state.user?.id);
  const organizationId = useAuthStore(state => state.user?.organization_id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const apiUrl = getApiUrl();
    let ws: WebSocket | null = null;
    let eventSource: EventSource | null = null;
    let fallbackToSse = false;
    let disposed = false;
    const receivedIds = new Set<string>();

    const handlePayload = (payload: any) => {
      if (disposed) return;
      if (payload.type === "NOTIFICATION_RECEIVED") {
        const newNotif: NotificationItem = payload.data?.notification || payload.data;
        if (!newNotif || !newNotif.id || receivedIds.has(newNotif.id)) return;
        receivedIds.add(newNotif.id);
        if (receivedIds.size > 512) receivedIds.delete(receivedIds.values().next().value!);

        // 1. Instantly update unread count badge in cache
        if (payload.data?.unreadCount !== undefined) {
          queryClient.setQueryData(["notifications", "unread-count"], payload.data.unreadCount);
        } else {
          queryClient.setQueryData(["notifications", "unread-count"], (old: number | undefined) => (old ?? 0) + 1);
        }

        // 2. Instantly update active notification list queries in cache
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



        // Fire floating SaaS Toast Notification
        const titleLower = (newNotif.title || "").toLowerCase();
        const isDuplicateAuditToast =
          titleLower.includes("account login") ||
          titleLower.includes("login successful") ||
          titleLower.includes("organization onboarding") ||
          titleLower.includes("organization created") ||
          titleLower.includes("impersonation");

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
    };

    const startSseFallback = () => {
      if (disposed || eventSource || typeof EventSource === "undefined") return;
      const streamUrl = `${apiUrl}/notifications/stream`;
      try {
        eventSource = new EventSource(streamUrl, { withCredentials: true });
        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handlePayload(payload);
          } catch (err) {
            console.error("[SSE Parse Error]", err);
          }
        };
      } catch (err) {
        console.warn("[SSE Connection Error]", err);
      }
    };

    // Try WebSocket first
    if (typeof WebSocket !== "undefined") {
      try {
        const wsUrl = getWebSocketUrl("/api/ws");
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Connection active
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handlePayload(payload);
          } catch (err) {
            console.error("[WebSocket Parse Error]", err);
          }
        };

        ws.onerror = () => {
          if (!fallbackToSse) {
            fallbackToSse = true;
            startSseFallback();
          }
        };

        ws.onclose = () => {
          if (!fallbackToSse) {
            fallbackToSse = true;
            startSseFallback();
          }
        };
      } catch (err) {
        startSseFallback();
      }
    } else {
      startSseFallback();
    }

    return () => {
      disposed = true;
      if (ws) {
        ws.close();
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [userId, organizationId, queryClient, toast]);
  return null;
}
