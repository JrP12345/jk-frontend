import api from "@/lib/api";

export interface NotificationItem {
  id: string;
  organizationId?: string;
  targetUser: string;
  category: "auth" | "organization" | "team" | "task" | "patient" | "billing" | "security" | "system";
  type: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  severity: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  icon?: string;
  metadata?: Record<string, any>;
  snoozedUntil?: string | null;
  pinned?: boolean;
  entityType?: string;
  entityId?: string;
  readAt?: string | null;
  archived?: boolean;
  createdAt: string;
}

export interface NotificationResponse {
  notifications: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export interface NotificationPreferences {
  userId: string;
  organizationId?: string;
  channels: {
    email: boolean;
    inApp: boolean;
  };
  categories: {
    auth: boolean;
    organization: boolean;
    team: boolean;
    task: boolean;
    patient: boolean;
    billing: boolean;
    security: boolean;
    system: boolean;
  };
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  passIsSet?: boolean;
  fromEmail: string;
  fromName: string;
}

export const notificationService = {
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    unreadOnly?: boolean;
    archived?: boolean;
    search?: string;
    entityType?: string;
    entityId?: string;
    includeSnoozed?: boolean;
  }): Promise<NotificationResponse> => {
    const res = await api.get("/notifications", { params });
    return res.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await api.get("/notifications/unread-count");
    return res.data.data.unreadCount;
  },

  markAsRead: async (id: string) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.data;
  },

  markAllAsRead: async () => {
    const res = await api.patch("/notifications/read-all");
    return res.data.data;
  },

  archiveNotification: async (id: string) => {
    const res = await api.patch(`/notifications/${id}/archive`);
    return res.data.data;
  },

  deleteNotification: async (id: string) => {
    const res = await api.delete(`/notifications/${id}`);
    return res.data.data;
  },

  snoozeNotification: async (id: string, durationMinutes = 60) => {
    const res = await api.patch(`/notifications/${id}/snooze`, { durationMinutes });
    return res.data.data;
  },

  togglePinNotification: async (id: string) => {
    const res = await api.patch(`/notifications/${id}/pin`);
    return res.data.data;
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await api.get("/notification-preferences");
    return res.data.data;
  },

  updatePreferences: async (data: { channels?: any; categories?: any }): Promise<NotificationPreferences> => {
    const res = await api.patch("/notification-preferences", data);
    return res.data.data;
  },

  triggerTestNotification: async (data?: { category?: string; title?: string; message?: string; severity?: string }) => {
    const res = await api.post("/notifications/test-trigger", data || {});
    return res.data;
  },

  getOrganizationUsers: async (): Promise<Array<{ id: string; name: string; email: string; role: string }>> => {
    const res = await api.get("/notifications/users");
    return res.data.data;
  },

  sendNotification: async (data: {
    recipientScope?: string;
    targetUserId?: string;
    category?: string;
    title: string;
    message: string;
    severity?: string;
    priority?: string;
    actionUrl?: string;
    channels?: {
      inApp?: boolean;
      email?: boolean;
    };
  }) => {
    const res = await api.post("/notifications/send", data);
    return res.data;
  },

  sendTestEmail: async (targetEmail?: string) => {
    const res = await api.post("/notifications/test-email", { targetEmail });
    return res.data;
  },

  // ─── SMTP / Email Gateway Config ───────────────────────────────
  getSmtpConfig: async (): Promise<SmtpConfig> => {
    const res = await api.get("/onboarding/organization/me/smtp");
    return res.data.data;
  },

  updateSmtpConfig: async (data: Partial<SmtpConfig>): Promise<SmtpConfig> => {
    const res = await api.put("/onboarding/organization/me/smtp", data);
    return res.data.data;
  },
};


