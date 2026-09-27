"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notificationService";
import { useAuthStore } from "@/store/authStore";

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // ─── Query Unread Count (100% SSE Event Driven — Zero Polling) ────
  const { data: unreadCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: !!user,
    refetchInterval: false, // Zero polling — 100% pure SSE real-time push streaming
  });

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
    markAsRead: markReadMutation.mutateAsync,
    markAllAsRead: markAllReadMutation.mutateAsync,
    archiveNotification: archiveMutation.mutateAsync,
    deleteNotification: deleteMutation.mutateAsync,
    snoozeNotification: (id: string, durationMinutes = 60) => snoozeMutation.mutateAsync({ id, durationMinutes }),
    togglePinNotification: togglePinMutation.mutateAsync,
    refetchCount,
  };
}
