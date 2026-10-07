"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import { Button, Input, Select, Textarea, Badge, Card, Table, Pagination, Dropdown, cn, type Column, type TableBulkAction } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { notificationCategoryLabel } from "@/lib/notificationPresentation";
import { Bell, Sparkles, CheckCheck, Send, Search, Pin, PinOff, Check, Eye, Trash2, MoreHorizontal, Clock, ExternalLink, Mail, Stethoscope, ShieldAlert, Receipt, Settings, CheckSquare, Users, Building2, ArrowRight } from "lucide-react";

export default function NotificationsInboxPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canSendNotifications = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);

  // Modals & Dialogs State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [viewingNotification, setViewingNotification] = useState<NotificationItem | null>(null);
  const [orgUsers, setOrgUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Form State
  const [recipientScope, setRecipientScope] = useState<string>("all");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("system");
  const [formSeverity, setFormSeverity] = useState<string>("info");
  const [formPriority, setFormPriority] = useState<string>("medium");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formActionUrl, setFormActionUrl] = useState("");

  // Channel Selection Checkboxes
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  const { markAsRead, markAllAsRead, deleteNotification, togglePinNotification } = useNotifications();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", "inbox", page, category, unreadOnly, search],
    queryFn: () =>
      notificationService.getNotifications({
        page,
        limit: 15,
        category: category || undefined,
        unreadOnly,
        search: search || undefined,
      }),
  });

  const notifications = data?.notifications || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };
  const unreadCount = data?.unreadCount || 0;

  // Fetch organization users for recipient selection when modal opens
  useEffect(() => {
    if (isSendModalOpen && orgUsers.length === 0) {
      notificationService
        .getOrganizationUsers()
        .then((users) => setOrgUsers(users))
        .catch((err) => console.error(err));
    }
  }, [isSendModalOpen, orgUsers.length]);

  const handleTestTrigger = async () => {
    try {
      setIsTestLoading(true);
      await notificationService.triggerTestNotification({
        category: category || "system",
        title: "Test notification",
        message: "This is a test of your notification delivery settings.",
        severity: "info",
      });
      toast({
        title: "Test notification sent",
        description: "Check your inbox for the test notification.",
        variant: "success",
      });
      await new Promise((r) => setTimeout(r, 150));
      await refetch();
    } catch (err) {
      console.error(err);
      toast({
        title: "Test notification could not be sent",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendInApp && !sendEmail) {
      toast({ title: "Choose a delivery method", description: "Select in-app notification, email, or both.", variant: "error" });
      return;
    }
    if (recipientScope === "user" && !targetUserId) {
      toast({ title: "Choose a recipient", description: "Select the person who should receive this notification.", variant: "error" });
      return;
    }
    if (!formTitle.trim() || !formMessage.trim()) {
      toast({
        title: "Title and message required",
        description: "Please enter both a title and a message.",
        variant: "error",
      });
      return;
    }

    try {
      setIsSending(true);
      await notificationService.sendNotification({
        recipientScope,
        targetUserId: recipientScope === "user" ? targetUserId : undefined,
        category: formCategory,
        severity: formSeverity,
        priority: formPriority,
        title: formTitle,
        message: formMessage,
        actionUrl: formActionUrl.trim() || undefined,
        channels: {
          inApp: sendInApp,
          email: sendEmail,
        },
      });

      toast({
        title: "Notification sent",
        description: "The notification was sent through the selected channels.",
        variant: "success",
      });

      // Reset form
      setFormTitle("");
      setFormMessage("");
      setFormActionUrl("");
      setIsSendModalOpen(false);
      await new Promise((r) => setTimeout(r, 150));
      await refetch();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Notification could not be sent",
        description: err?.response?.data?.message || "Failed to send notification.",
        variant: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleViewDetail = (item: NotificationItem) => {
    if (!item.readAt) {
      markAsRead(item.id);
    }
    if (item.actionUrl) {
      router.push(item.actionUrl);
    } else {
      setViewingNotification(item);
    }
  };

  const getSeverityBadgeVariant = (severity: string): "danger" | "warning" | "success" | "primary" | "info" => {
    switch (severity) {
      case "error":
        return "danger";
      case "warning":
        return "warning";
      case "success":
        return "success";
      case "info":
        return "info";
      default:
        return "primary";
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "patient":
      case "clinical":
        return <Stethoscope className="w-3.5 h-3.5" />;
      case "security":
      case "auth":
        return <ShieldAlert className="w-3.5 h-3.5" />;
      case "billing":
        return <Receipt className="w-3.5 h-3.5" />;
      case "task":
        return <CheckSquare className="w-3.5 h-3.5" />;
      case "team":
        return <Users className="w-3.5 h-3.5" />;
      case "organization":
        return <Building2 className="w-3.5 h-3.5" />;
      default:
        return <Settings className="w-3.5 h-3.5" />;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // ── Table Column Definitions ─────────────────────────────────────
  const columns: Column<NotificationItem>[] = [
    {
      header: "Status",
      key: "status",
      width: "50px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center">
          {!row.readAt ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-500 shadow-xs " />
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-border/80" title="Read" />
          )}
        </div>
      ),
    },
    {
      header: "Category & priority",
      key: "category",
      width: "170px",
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant={getSeverityBadgeVariant(row.severity)}
              size="sm"
              className="uppercase font-bold text-[10px] tracking-wide inline-flex items-center gap-1"
            >
              {getCategoryIcon(row.category)}
              <span>{notificationCategoryLabel(row.category)}</span>
            </Badge>
            {row.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-warning-text dark:text-warning-text bg-warning/15 border border-warning/30 px-1.5 py-0.5 rounded-md">
                <Pin className="w-2.5 h-2.5 fill-current" />
                Pinned
              </span>
            )}
          </div>
          {row.priority === "urgent" || row.priority === "high" ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] font-bold text-danger-text uppercase tracking-wider">
                {row.priority} Priority
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Notification",
      key: "detail",
      render: (row) => (
        <div className="space-y-1 min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-xs sm:text-sm text-text cursor-pointer hover:text-accent dark:hover:text-accent transition-colors ${
                !row.readAt ? "font-bold text-text" : "font-medium text-text-secondary"
              }`}
              onClick={() => handleViewDetail(row)}
            >
              {row.title}
            </p>
            {row.actionUrl && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent dark:text-accent bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20">
                <ExternalLink className="w-2.5 h-2.5" />
                Open related page
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{row.message}</p>
        </div>
      ),
    },
    {
      header: "Received",
      key: "time",
      width: "140px",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>{formatTimestamp(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "90px",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <Dropdown
            align="right"
            width="w-44"
            trigger={
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-8 px-2.5 text-xs font-semibold rounded-lg text-text-secondary hover:text-text min-h-[36px]"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            }
            items={[
              {
                label: row.pinned ? "Unpin notification" : "Pin notification",
                icon: row.pinned ? <PinOff className="w-4 h-4 text-text-muted" /> : <Pin className="w-4 h-4 text-warning-text" />,
                onClick: () => togglePinNotification(row.id),
              },
              ...(!row.readAt
                ? [
                    {
                      label: "Mark as Read",
                      icon: <Check className="w-4 h-4 text-accent" />,
                      onClick: () => markAsRead(row.id),
                    },
                  ]
                : []),
              {
                label: "View Details",
                icon: <Eye className="w-4 h-4 text-text-muted" />,
                onClick: () => handleViewDetail(row),
              },
              { divider: true, label: "" },
              {
                label: "Delete notification",
                icon: <Trash2 className="w-4 h-4 text-danger" />,
                danger: true,
                onClick: () => setDeletingIds([row.id]),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  // ── Table Bulk Actions ───────────────────────────────────────────
  const bulkActions: TableBulkAction<NotificationItem>[] = [
    {
      label: "Mark Selected as Read",
      variant: "primary",
      onClick: (selectedRows) => {
        selectedRows.forEach((row) => {
          if (!row.readAt) markAsRead(row.id);
        });
      },
    },
    {
      label: "Delete Selected",
      variant: "danger",
      onClick: (selectedRows) => {
        if (selectedRows.length > 0) {
          setDeletingIds(selectedRows.map((r) => r.id));
        }
      },
    },
  ];

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Notifications & Broadcasts
              </h1>
              {unreadCount > 0 ? (
                <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                  {unreadCount} Unread
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm" className="font-semibold">
                  All Caught Up
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Review updates and send notifications to your team.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto">
            {canSendNotifications && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestTrigger}
                loading={isTestLoading}
                icon={<Sparkles className="h-3.5 w-3.5 text-text-secondary" />}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
              >
                Send test notification
              </Button>
            )}

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead()}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
                Mark all read
              </Button>
            )}

            {canSendNotifications && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSendModalOpen(true)}
                className="rounded-xl text-xs font-semibold shadow-xs flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] justify-center"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                New notification
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. FILTERS & SEARCH BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="relative sm:col-span-7 lg:col-span-8">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search notifications"
              aria-label="Search notifications"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-border/80 rounded-xl text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-primary-500 transition-all"
            />
          </div>

          <div className="sm:col-span-5 lg:col-span-4">
            <Select
              value={unreadOnly ? "unread" : category}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unread") {
                  setUnreadOnly(true);
                  setCategory("");
                } else {
                  setUnreadOnly(false);
                  setCategory(val);
                }
              }}
              options={[
                { value: "", label: "All notifications" },
                { value: "unread", label: `Unread (${unreadCount})` },
                { value: "auth", label: "Account activity" },
                { value: "patient", label: "Patient care" },
                { value: "task", label: "Tasks" },
                { value: "security", label: "Security" },
                { value: "system", label: "System" },
                { value: "billing", label: "Billing" },
                { value: "team", label: "Team" },
                { value: "organization", label: "Organization" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. MAIN NOTIFICATION DATA TABLE
         ────────────────────────────────────────────────────────────────────────── */}
      <div>
        <Table
            error={isError ? "Notifications could not be loaded. Please try again." : null}
            onRetry={() => refetch()}
          columns={columns}
          data={notifications}
          keyField="id"
          selectable
          loading={isLoading}
          bulkActions={bulkActions}
          mobileCardView={true}
          renderMobileCard={(row: NotificationItem) => {
            const isUnread = !row.readAt;
            return (
              <div
                key={row.id}
                className={cn(
                  "p-4 rounded-2xl border shadow-xs space-y-2.5 relative overflow-hidden transition-all",
                  isUnread
                    ? "bg-primary-500/[0.03] dark:bg-primary-500/[0.06] border-primary-500/30"
                    : "bg-surface border-border/80 hover:border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isUnread && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
                      </span>
                    )}
                    <Badge
                      variant={getSeverityBadgeVariant(row.severity)}
                      size="sm"
                      className="uppercase font-bold text-[10px] tracking-wide inline-flex items-center gap-1"
                    >
                      {getCategoryIcon(row.category)}
                      <span>{notificationCategoryLabel(row.category)}</span>
                    </Badge>
                    {row.pinned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-warning-text dark:text-warning-text bg-warning/15 border border-warning/30 px-1.5 py-0.2 rounded-md">
                        <Pin className="w-2.5 h-2.5 fill-current" />
                        Pinned
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-text-muted flex items-center gap-1 shrink-0 font-medium">
                    <Clock className="w-3 h-3 text-text-muted" />
                    {formatTimestamp(row.createdAt)}
                  </span>
                </div>

                <div
                  className="cursor-pointer space-y-1 pt-0.5"
                  onClick={() => handleViewDetail(row)}
                >
                  <h4 className={cn("text-sm transition-colors", isUnread ? "font-bold text-text" : "font-medium text-text-secondary")}>
                    {row.title}
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{row.message}</p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleViewDetail(row)}
                    className="flex-1 font-semibold text-xs rounded-xl min-h-[36px] justify-center"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-text-muted" />
                    View notification
                  </Button>

                  {isUnread && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => markAsRead(row.id)}
                      className="font-semibold text-xs rounded-xl min-h-[36px] px-3 text-accent dark:text-accent hover:bg-primary-500/10"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Mark Read
                    </Button>
                  )}

                  <Dropdown
                    align="right"
                    width="w-44"
                    trigger={
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-[36px] w-[36px] min-h-[36px] min-w-[36px] p-0 flex items-center justify-center rounded-xl text-text-secondary hover:text-text cursor-pointer shrink-0"
                        aria-label="More notification options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    }
                    items={[
                      {
                        label: row.pinned ? "Unpin notification" : "Pin notification",
                        icon: row.pinned ? <PinOff className="w-4 h-4 text-text-muted" /> : <Pin className="w-4 h-4 text-warning-text" />,
                        onClick: () => togglePinNotification(row.id),
                      },
                      { divider: true, label: "" },
                      {
                        label: "Delete notification",
                        icon: <Trash2 className="w-4 h-4 text-danger" />,
                        danger: true,
                        onClick: () => setDeletingIds([row.id]),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          }}
          emptyMessage="Your inbox is clear. Important clinical and system alerts will appear here."
        />

        {pagination.totalPages > 1 && !isLoading && (
          <div className="p-3.5 border border-border/80 border-t-0 rounded-b-2xl flex justify-center bg-surface-alt/40">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. SEND NOTIFICATION COMPOSER MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="New notification"
        description="Choose who should receive it and how to send it."
        size="lg"
      >
        <form onSubmit={handleSendNotification} className="space-y-4 pt-1">
          {/* Delivery Channels Selector */}
          <div className="bg-surface-alt p-3.5 rounded-2xl border border-border/80 space-y-2">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Send by
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  sendInApp
                    ? "bg-primary-500/10 border-primary-500/40 text-text"
                    : "bg-surface border-border/80 text-text-muted"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      sendInApp ? "bg-primary-500/20 text-accent dark:text-accent" : "bg-surface-alt text-text-muted"
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text">In-app notification</p>
                    <p className="text-[10px] text-text-muted">Appears in the recipient’s inbox</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="rounded text-accent focus:ring-focus-ring h-4 w-4"
                />
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  sendEmail
                    ? "bg-primary-500/10 border-primary-500/40 text-text"
                    : "bg-surface border-border/80 text-text-muted"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      sendEmail ? "bg-primary-500/20 text-accent dark:text-accent" : "bg-surface-alt text-text-muted"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text">Email</p>
                    <p className="text-[10px] text-text-muted">Sent to the recipient’s email address</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded text-accent focus:ring-focus-ring h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Row 1: Recipient Audience & User / Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
                <label className="block text-xs font-semibold text-text mb-1">Recipients *</label>
              <Select
                value={recipientScope}
                onChange={(e) => setRecipientScope(e.target.value)}
                options={[
                  { value: "all", label: "All members" },
                  { value: "user", label: "One person" },
                  { value: "admin", label: "Administrators" },
                  { value: "doctor", label: "Doctors" },
                  { value: "staff", label: "Receptionists and staff" },
                ]}
              />
            </div>

            {recipientScope === "user" ? (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Person *</label>
                <Select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  options={[
                    { value: "", label: "Choose a person" },
                    ...orgUsers.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email}) — ${u.role}`,
                    })),
                  ]}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Category *</label>
                <Select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  options={[
                  { value: "system", label: "System" },
                  { value: "patient", label: "Patient care" },
                  { value: "task", label: "Tasks" },
                  { value: "security", label: "Security" },
                  { value: "billing", label: "Billing" },
                  { value: "team", label: "Team" },
                  { value: "organization", label: "Organization" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Row 2: Severity Level & Priority Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {recipientScope === "user" && (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Category *</label>
                <Select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  options={[
                    { value: "system", label: "System" },
                    { value: "patient", label: "Patient care" },
                    { value: "task", label: "Tasks" },
                    { value: "security", label: "Security" },
                    { value: "billing", label: "Billing" },
                    { value: "team", label: "Team" },
                    { value: "organization", label: "Organization" },
                  ]}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Notice type</label>
              <Select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value)}
                options={[
                  { value: "info", label: "Information" },
                  { value: "success", label: "Confirmation" },
                  { value: "warning", label: "Needs attention" },
                  { value: "error", label: "Urgent issue" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Priority</label>
              <Select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Standard" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Title *</label>
            <Input
              placeholder="What is this notification about?"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Message *</label>
            <Textarea
              placeholder="Write a clear message for recipients"
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Related page (optional)
            </label>
            <Input
              placeholder="e.g. /dashboard/appointments"
              value={formActionUrl}
              onChange={(e) => setFormActionUrl(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-border/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSendModalOpen(false)}
              className="rounded-xl font-semibold w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSending}
              icon={<Send className="w-3.5 h-3.5" />}
              className="font-semibold rounded-xl shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
            >
              Send notification
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. NOTIFICATION DETAIL VIEW MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!viewingNotification}
        onClose={() => setViewingNotification(null)}
        title="Notification details"
        size="md"
      >
        {viewingNotification && (
          <div className="space-y-4 text-xs font-sans">
            {/* Metadata Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={getSeverityBadgeVariant(viewingNotification.severity)}
                  size="sm"
                  className="uppercase font-bold text-[10px] tracking-wide inline-flex items-center gap-1"
                >
                  {getCategoryIcon(viewingNotification.category)}
                  {notificationCategoryLabel(viewingNotification.category)}
                </Badge>
                <Badge variant="outline" size="sm" className="uppercase font-semibold text-[9px]">
                  {viewingNotification.severity}
                </Badge>
                {viewingNotification.priority && (
                  <span className="text-[10px] font-bold text-accent dark:text-accent bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {viewingNotification.priority} Priority
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted font-medium">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span>{formatTimestamp(viewingNotification.createdAt)}</span>
              </div>
            </div>

            {/* Rich Message Container */}
            <div className="bg-surface-alt p-4 rounded-2xl border border-border/80 shadow-xs space-y-2">
              <h4 className="text-sm font-bold text-text">{viewingNotification.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {viewingNotification.message}
              </p>
            </div>

            {viewingNotification.actionUrl && (
              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const url = viewingNotification.actionUrl!;
                    setViewingNotification(null);
                    router.push(url);
                  }}
                  className="font-semibold rounded-xl shadow-xs w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
                >
                  Open related page
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. DELETE CONFIRMATION DIALOG
         ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deletingIds.length > 0}
        onClose={() => setDeletingIds([])}
        onConfirm={async () => {
          if (deletingIds.length > 0) {
            const count = deletingIds.length;
            await Promise.all(deletingIds.map((id) => deleteNotification(id)));
            setDeletingIds([]);
            toast({
              title: count > 1 ? "Notifications Deleted" : "Notification Deleted",
              description: `${count} notification(s) removed successfully.`,
              variant: "warning",
            });
            refetch();
          }
        }}
        title={deletingIds.length > 1 ? `Delete ${deletingIds.length} Notifications` : "Delete Notification"}
        description={
          deletingIds.length > 1
            ? `Are you sure you want to delete these ${deletingIds.length} selected notifications? This action cannot be undone.`
            : "Are you sure you want to delete this notification? This action cannot be undone."
        }
        variant="danger"
        confirmLabel={deletingIds.length > 1 ? `Delete (${deletingIds.length})` : "Delete"}
      />
    </div>
  );
}
