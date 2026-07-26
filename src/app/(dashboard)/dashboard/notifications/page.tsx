"use client";

import { useState, useEffect } from "react";
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

export default function NotificationsInboxPage() {
  const router = useRouter();
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
      toast({ title: "Test Event Dispatched", description: "Real-time notification emitted successfully.", variant: "success" });
      await new Promise((r) => setTimeout(r, 150));
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: "Trigger Failed", description: "Could not emit test notification.", variant: "error" });
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formMessage.trim()) {
      toast({ title: "Validation Error", description: "Please enter both a title and a message.", variant: "error" });
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
      width: "55px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center">
          {!row.readAt ? (
            <span
              className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-xs shadow-primary-500/50 animate-pulse"
              title="Unread notification"
            />
          ) : (
            <span className="w-2 h-2 rounded-full bg-border" title="Read notification" />
          )}
        </div>
      ),
    },
    {
      header: "Category & Priority",
      key: "category",
      width: "160px",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={getSeverityBadgeVariant(row.severity)} size="sm" className="uppercase font-extrabold text-[9px] tracking-wider">
              {row.category}
            </Badge>
            {row.pinned && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                Pinned
              </span>
            )}
          </div>
          {row.priority === "urgent" || row.priority === "high" ? (
            <span className="text-[10px] font-extrabold text-danger-500 uppercase tracking-wider">
              {row.priority}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Notification Detail",
      key: "detail",
      render: (row) => (
        <div className="space-y-0.5 min-w-[240px]">
          <p
            className={`text-xs sm:text-sm text-text cursor-pointer hover:text-primary-600 transition-colors ${
              !row.readAt ? "font-bold" : "font-medium"
            }`}
            onClick={() => handleViewDetail(row)}
          >
            {row.title}
          </p>
          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{row.message}</p>
        </div>
      ),
    },
    {
      header: "Received Time",
      key: "time",
      width: "140px",
      render: (row) => (
        <span className="text-xs text-text-muted font-medium whitespace-nowrap">
          {formatTimestamp(row.createdAt)}
        </span>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "110px",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                title="Actions"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            }
            items={[
              {
                label: row.pinned ? "Unpin Notification" : "Pin Notification",
                onClick: () => togglePinNotification(row.id),
              },
              ...(!row.readAt
                ? [
                    {
                      label: "Mark as Read",
                      onClick: () => markAsRead(row.id),
                    },
                  ]
                : []),
              {
                label: "View Details",
                onClick: () => handleViewDetail(row),
              },
              {
                label: "Delete Notification",
                variant: "danger",
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
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Notifications</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage workspace notifications and compose multi-channel alerts for team members.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestTrigger}
            disabled={isTestLoading}
            className="rounded-xl text-xs font-semibold cursor-pointer"
          >
            {isTestLoading ? <Spinner size="sm" /> : "Trigger Test Event"}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Mark All Read ({unreadCount})
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSendModalOpen(true)}
            className="rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            + Send Notification
          </Button>
        </div>
      </div>

      {/* Clean Filters Bar */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <Input
            placeholder="Search notification titles or messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />

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
            className="text-xs"
            options={[
              { value: "", label: "All Notifications" },
              { value: "unread", label: `Unread Notifications Only (${unreadCount})` },
              { value: "patient", label: "Healthcare / Patient" },
              { value: "task", label: "Tasks & Workflows" },
              { value: "security", label: "Security Alerts" },
              { value: "system", label: "System Maintenance" },
              { value: "billing", label: "Billing & Invoices" },
              { value: "team", label: "Team Activity" },
              { value: "organization", label: "Organization" },
              { value: "auth", label: "Authentication" },
            ]}
          />
        </div>
      </Card>

      {/* Main Notification Data Table */}
      <Card className="rounded-2xl border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Spinner size="lg" label="Loading notifications..." />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={notifications}
              keyField="id"
              selectable
              bulkActions={bulkActions}
              emptyMessage="No notifications found. Click '+ Send Notification' to compose a message."
            />

            {pagination.totalPages > 1 && (
              <div className="p-3.5 border-t border-border flex justify-center">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Send Notification Composer Modal ─────────────────────────── */}
      <Modal
        open={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="Send Multi-Channel Notification"
        description="Dispatch a notification across In-App and Email channels."
        size="lg"
      >
        <form onSubmit={handleSendNotification} className="space-y-3.5 pt-1">
          {/* Delivery Channels Bar */}
          <div className="bg-surface-alt p-3 rounded-xl border border-border space-y-1.5">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Delivery Channels
            </label>
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <Checkbox
                checked={sendInApp}
                onChange={(e) => setSendInApp(e.target.checked)}
                label="In-App Inbox"
              />
              <Checkbox
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                label="Email Alert"
              />
            </div>
          </div>

          {/* Row 1: Recipient Audience & Category / Specific User */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Recipient Audience</label>
              <Select
                value={recipientScope}
                onChange={(e) => setRecipientScope(e.target.value)}
                options={[
                  { value: "all", label: "Broadcast to All Members" },
                  { value: "user", label: "Specific User" },
                  { value: "admin", label: "Admins Only" },
                  { value: "doctor", label: "Doctors Only" },
                  { value: "staff", label: "Staff Only" },
                ]}
              />
            </div>

            {recipientScope === "user" ? (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Select User</label>
                <Select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  options={[
                    { value: "", label: "-- Choose Recipient --" },
                    ...orgUsers.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email})`,
                    })),
                  ]}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Category</label>
                <Select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  options={[
                    { value: "system", label: "System Alert" },
                    { value: "patient", label: "Patient / Clinical" },
                    { value: "task", label: "Task / Workflow" },
                    { value: "security", label: "Security Event" },
                    { value: "billing", label: "Billing & Invoices" },
                    { value: "team", label: "Team Activity" },
                    { value: "organization", label: "Organization" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Row 2: Severity Level & Priority Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recipientScope === "user" && (
              <div>
                <label className="block text-xs font-semibold text-text mb-1">Category</label>
                <Select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  options={[
                    { value: "system", label: "System Alert" },
                    { value: "patient", label: "Patient / Clinical" },
                    { value: "task", label: "Task / Workflow" },
                    { value: "security", label: "Security Event" },
                    { value: "billing", label: "Billing & Invoices" },
                    { value: "team", label: "Team Activity" },
                    { value: "organization", label: "Organization" },
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
                  { value: "info", label: "Info" },
                  { value: "success", label: "Success" },
                  { value: "warning", label: "Warning" },
                  { value: "error", label: "Error" },
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
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Notification Title *</label>
            <Input
              placeholder="e.g. Patient Chart Updated / Critical System Alert"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Notification Message *</label>
            <Textarea
              placeholder="Enter full notification details or action instructions..."
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Action Link URL (Optional)</label>
            <Input
              placeholder="e.g. /dashboard/appointments or /dashboard/queue"
              value={formActionUrl}
              onChange={(e) => setFormActionUrl(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSendModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSending} className="font-bold rounded-xl">
              {isSending ? <Spinner size="sm" /> : "Dispatch Notification"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Notification Detail View Modal (Rich Enterprise Card) ──────── */}
      <Modal
        open={!!viewingNotification}
        onClose={() => setViewingNotification(null)}
        title={viewingNotification?.title || "Notification Details"}
        size="md"
      >
        {viewingNotification && (
          <div className="space-y-4 text-xs font-sans">
            {/* Metadata Pills Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={getSeverityBadgeVariant(viewingNotification.severity)} size="sm" className="uppercase font-extrabold text-[9px] tracking-wider">
                  {viewingNotification.category}
                </Badge>
                <Badge variant="outline" size="sm" className="uppercase font-bold text-[9px]">
                  {viewingNotification.severity}
                </Badge>
                {viewingNotification.priority && (
                  <span className="text-[10px] font-extrabold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {viewingNotification.priority} Priority
                  </span>
                )}
              </div>
              <span className="text-[11px] text-text-muted font-medium">
                {formatTimestamp(viewingNotification.createdAt)}
              </span>
            </div>

            {/* Rich Formatted Message Card */}
            <div className="bg-surface-alt p-4 rounded-2xl border border-border/80 shadow-xs space-y-2">
              <h4 className="text-sm font-bold text-text">{viewingNotification.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {viewingNotification.message}
              </p>
            </div>

            {/* Delivery Channels Context */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-text-muted border-t border-border/40">
              <span className="font-medium">Delivery Channels: In-App Inbox &bull; Email Dispatch</span>
              {viewingNotification.readAt ? (
                <span className="text-emerald-500 font-semibold">Read</span>
              ) : (
                <span className="text-primary-500 font-semibold">Unread</span>
              )}
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
                  className="font-bold rounded-xl cursor-pointer"
                >
                  Open Link Destination →
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
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
