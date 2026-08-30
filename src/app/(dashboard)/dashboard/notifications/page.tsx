"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Checkbox from "@/components/ui/Checkbox";
import {
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Card,
  Spinner,
  Table,
  Pagination,
  Dropdown,
  type Column,
  type TableBulkAction,
} from "@/components/ui";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import {
  Bell,
  BellOff,
  Sparkles,
  CheckCheck,
  Send,
  Plus,
  Search,
  Pin,
  PinOff,
  Check,
  Eye,
  Trash2,
  MoreHorizontal,
  Clock,
  ExternalLink,
  Mail,
  Smartphone,
  Stethoscope,
  ShieldAlert,
  Receipt,
  Settings,
  CheckSquare,
  Users,
  Building2,
  ArrowRight,
  CheckCircle2,
  Filter,
} from "lucide-react";

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

  const { data, isLoading, refetch } = useQuery({
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
        title: "Infrastructure Real-Time Event Test",
        message: "Live event ingested via EventBus → Persisted in DB → Broadcast via SSE!",
        severity: "info",
      });
      toast({
        title: "Test Event Dispatched",
        description: "Real-time notification emitted successfully.",
        variant: "success",
      });
      await new Promise((r) => setTimeout(r, 150));
      await refetch();
    } catch (err) {
      console.error(err);
      toast({
        title: "Trigger Failed",
        description: "Could not emit test notification.",
        variant: "error",
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formMessage.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both a title and a message.",
        variant: "error",
      });
      return;
    }

    try {
      setIsSending(true);
      const res = await notificationService.sendNotification({
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
        title: "Notification Sent",
        description: res.message || "Notification dispatched successfully across selected channels.",
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
        title: "Dispatch Failed",
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
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-500 shadow-xs shadow-primary-500/50" />
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-border/80" title="Read" />
          )}
        </div>
      ),
    },
    {
      header: "Category & Priority",
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
              <span>{row.category}</span>
            </Badge>
            {row.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                <Pin className="w-2.5 h-2.5 fill-current" />
                Pinned
              </span>
            )}
          </div>
          {row.priority === "urgent" || row.priority === "high" ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse" />
              <span className="text-[10px] font-bold text-danger-500 uppercase tracking-wider">
                {row.priority} Priority
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Notification Detail",
      key: "detail",
      render: (row) => (
        <div className="space-y-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-xs sm:text-sm text-text cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors ${
                !row.readAt ? "font-bold text-text" : "font-medium text-text-secondary"
              }`}
              onClick={() => handleViewDetail(row)}
            >
              {row.title}
            </p>
            {row.actionUrl && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20">
                <ExternalLink className="w-2.5 h-2.5" />
                Action Link
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{row.message}</p>
        </div>
      ),
    },
    {
      header: "Received Time",
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
                className="h-7 px-2 text-xs font-semibold rounded-lg text-text-secondary hover:text-text"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            }
            items={[
              {
                label: row.pinned ? "Unpin Alert" : "Pin Alert",
                icon: row.pinned ? <PinOff className="w-4 h-4 text-text-muted" /> : <Pin className="w-4 h-4 text-amber-500" />,
                onClick: () => togglePinNotification(row.id),
              },
              ...(!row.readAt
                ? [
                    {
                      label: "Mark as Read",
                      icon: <Check className="w-4 h-4 text-primary-500" />,
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
                label: "Delete Alert",
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
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
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
              Real-time communication hub, multi-channel dispatch, and automated alerts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTrigger}
              disabled={isTestLoading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              {isTestLoading ? (
                <Spinner size="xs" className="mr-1.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              )}
              Trigger Test Event
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead()}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
                Mark All Read
              </Button>
            )}

            {canSendNotifications && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSendModalOpen(true)}
                className="rounded-xl text-xs font-semibold shadow-xs"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Compose Alert
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
              placeholder="Search notifications by title, keywords, or message content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-border/80 rounded-xl text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
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
                { value: "", label: "All Categories & Statuses" },
                { value: "unread", label: `Unread Only (${unreadCount})` },
                { value: "patient", label: "Healthcare / Patient" },
                { value: "task", label: "Tasks & Workflows" },
                { value: "security", label: "Security & Access" },
                { value: "system", label: "System Maintenance" },
                { value: "billing", label: "Billing & Financial" },
                { value: "team", label: "Team & Staff" },
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
          columns={columns}
          data={notifications}
          keyField="id"
          selectable
          loading={isLoading}
          bulkActions={bulkActions}
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
        title="Compose Multi-Channel Alert"
        description="Dispatch formatted notification across In-App Inbox and Email delivery channels."
        size="lg"
      >
        <form onSubmit={handleSendNotification} className="space-y-4 pt-1">
          {/* Delivery Channels Selector */}
          <div className="bg-surface-alt p-3.5 rounded-2xl border border-border/80 space-y-2">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Delivery Channels
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
                      sendInApp ? "bg-primary-500/20 text-primary-600 dark:text-primary-400" : "bg-surface-alt text-text-muted"
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text">In-App Inbox</p>
                    <p className="text-[10px] text-text-muted">Real-time web notification & bell badge</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
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
                      sendEmail ? "bg-primary-500/20 text-primary-600 dark:text-primary-400" : "bg-surface-alt text-text-muted"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text">Email Dispatch</p>
                    <p className="text-[10px] text-text-muted">Direct email alert to recipient inbox</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Row 1: Recipient Audience & User / Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Recipient Scope *</label>
              <Select
                value={recipientScope}
                onChange={(e) => setRecipientScope(e.target.value)}
                options={[
                  { value: "all", label: "Broadcast to All Members" },
                  { value: "user", label: "Specific User / Staff" },
                  { value: "admin", label: "Admins Only" },
                  { value: "doctor", label: "Doctors Only" },
                  { value: "staff", label: "Receptionists & Staff Only" },
                ]}
              />
            </div>

            {recipientScope === "user" ? (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Select User *</label>
                <Select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  options={[
                    { value: "", label: "-- Choose Recipient Profile --" },
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
                    { value: "system", label: "System Maintenance" },
                    { value: "patient", label: "Patient / Clinical Care" },
                    { value: "task", label: "Task / Workflow Assignment" },
                    { value: "security", label: "Security & Access Event" },
                    { value: "billing", label: "Billing & Financial Invoicing" },
                    { value: "team", label: "Team & Staff Announcement" },
                    { value: "organization", label: "Organization Policy" },
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
                    { value: "system", label: "System Maintenance" },
                    { value: "patient", label: "Patient / Clinical Care" },
                    { value: "task", label: "Task / Workflow Assignment" },
                    { value: "security", label: "Security & Access Event" },
                    { value: "billing", label: "Billing & Financial Invoicing" },
                    { value: "team", label: "Team & Staff Announcement" },
                    { value: "organization", label: "Organization Policy" },
                  ]}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Severity Level</label>
              <Select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value)}
                options={[
                  { value: "info", label: "Info (Informational)" },
                  { value: "success", label: "Success (Positive confirmation)" },
                  { value: "warning", label: "Warning (Requires attention)" },
                  { value: "error", label: "Error / Critical (Immediate action)" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Priority Level</label>
              <Select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                options={[
                  { value: "low", label: "Low Priority" },
                  { value: "medium", label: "Medium (Standard)" },
                  { value: "high", label: "High Priority" },
                  { value: "urgent", label: "Urgent (Priority Dispatch)" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Notification Title *</label>
            <Input
              placeholder="e.g. Daily Patient Roster Ready / System Maintenance Window"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Notification Message *</label>
            <Textarea
              placeholder="Enter comprehensive message details, instructions, or action summary..."
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Action Link Destination (Optional)
            </label>
            <Input
              placeholder="e.g. /dashboard/appointments or /dashboard/queue"
              value={formActionUrl}
              onChange={(e) => setFormActionUrl(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSendModalOpen(false)}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSending}
              className="font-semibold rounded-xl shadow-xs"
            >
              {isSending ? (
                <Spinner size="xs" className="mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              Dispatch Notification
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
        title="Notification Overview"
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
                  {viewingNotification.category}
                </Badge>
                <Badge variant="outline" size="sm" className="uppercase font-semibold text-[9px]">
                  {viewingNotification.severity}
                </Badge>
                {viewingNotification.priority && (
                  <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
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

            {/* Delivery & Read Status */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-text-muted border-t border-border/60">
              <span className="font-medium">
                Delivery Channels: <strong className="text-text">In-App &bull; Email</strong>
              </span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-text-secondary font-medium">Delivered & Marked as Read</span>
              </div>
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
                  className="font-semibold rounded-xl shadow-xs"
                >
                  Open Destination Link
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
