"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import { Button, Input, Select, Textarea, Badge, Table, Pagination, Dropdown, Checkbox, Tabs, type Column, type TableBulkAction } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { notificationCategoryLabel } from "@/lib/notificationPresentation";
import { Sparkles, CheckCheck, Send, Search, Pin, PinOff, Check, Eye, Trash2, MoreHorizontal, ExternalLink, Stethoscope, ShieldAlert, Receipt, Settings, CheckSquare, Users, Building2, RotateCw, Filter } from "lucide-react";

import styles from "./Notifications.module.css";

const CATEGORIES = ["auth", "patient", "task", "security", "system", "billing", "team", "organization"].map(value => ({ value, label: notificationCategoryLabel(value) }));

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
  const [isDeleting, setIsDeleting] = useState(false);
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
        .catch(() => console.error("Client operation failed"));
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
    } catch {
      console.error("Client operation failed");
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
    if (isSending || !canSendNotifications) return;
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
      console.error("Client operation failed");
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
      void markAsRead(item.id).catch(() => toast({ title: "Notification could not be marked as read", variant: "error" }));
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

  const performAction = async (action: () => Promise<unknown>) => {
    try { await action(); } catch { toast({ title: "Notification could not be updated", description: "Please try again.", variant: "error" }); }
  };
  const renderBadges = (row: NotificationItem, showUnread = true) => <div className={styles.badges}>
    <Badge variant={getSeverityBadgeVariant(row.severity)} className={styles.categoryBadge}>{getCategoryIcon(row.category)}{notificationCategoryLabel(row.category)}</Badge>
    {showUnread && !row.readAt && <span className={styles.unreadLabel}>Unread</span>}
    {row.pinned && <span className={styles.pinned}><Pin className="h-3 w-3" aria-hidden="true" />Pinned</span>}
    {(row.priority === "urgent" || row.priority === "high") && <span className={styles.priority}>{row.priority} priority</span>}
  </div>;
  const renderContent = (row: NotificationItem) => <div className={styles.notificationContent}>
    <button type="button" className={row.readAt ? styles.readTitle : styles.titleButton} onClick={() => handleViewDetail(row)}>{row.title}{row.actionUrl && <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}</button>
    <p className={styles.messagePreview}>{row.message}</p>
  </div>;
  const renderActions = (row: NotificationItem) => <Dropdown align="right" width="w-52" trigger={<Button size="sm" variant="outline" className={styles.iconAction} aria-label={`Options for ${row.title}`}><MoreHorizontal className="h-4 w-4" /></Button>} items={[
    { label: row.pinned ? "Unpin notification" : "Pin notification", icon: row.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />, onClick: () => { void performAction(() => togglePinNotification(row.id)); } },
    ...(!row.readAt ? [{ label: "Mark as read", icon: <Check className="h-4 w-4" />, onClick: () => { void performAction(() => markAsRead(row.id)); } }] : []),
    { label: row.actionUrl ? "Open related page" : "View details", icon: <Eye className="h-4 w-4" />, onClick: () => handleViewDetail(row) },
    { divider: true, label: "" },
    { label: "Delete notification", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => setDeletingIds([row.id]) },
  ]} />;
  const columns: Column<NotificationItem>[] = [
    { header: "Notification", key: "detail", width: "68%", render: row => <div className={styles.notificationCell}>{renderBadges(row)}{renderContent(row)}</div> },
    { header: "Received", key: "time", width: "23%", render: row => <div className={styles.received}><time dateTime={row.createdAt}>{formatTimestamp(row.createdAt)}</time><span>{row.readAt ? "Read" : "Unread"}</span></div> },
    { header: "Actions", key: "actions", align: "right", width: "9%", render: renderActions },
  ];
  const bulkActions: TableBulkAction<NotificationItem>[] = [
    { label: "Mark Selected as Read", variant: "primary", onClick: rows => { void performAction(() => Promise.all(rows.filter(row => !row.readAt).map(row => markAsRead(row.id)))); } },
    { label: "Delete Selected", variant: "danger", onClick: rows => { if (rows.length) setDeletingIds(rows.map(row => row.id)); } },
  ];
  const inbox = <section className={styles.panel} aria-label="Notification inbox">
    <div className={styles.toolbar}>
      <Input type="search" aria-label="Search notifications" placeholder="Search notifications" icon={<Search className="h-4 w-4" />} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} onClear={() => { setSearch(""); setPage(1); }} containerClassName={styles.search} />
      <Select aria-label="Notification category" compactOnMobile fullWidth={false} containerClassName={styles.categoryFilter} icon={<Filter className="h-4 w-4" />} value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} options={[{ value: "", label: "All categories" }, ...CATEGORIES]} />
    </div>
    <Table key={`${page}:${category}:${unreadOnly}:${search}`} className={styles.responsiveTable} columns={columns} data={notifications} keyField="id" caption="Notification inbox" variant="flat" fitContent selectable bulkActions={bulkActions} loading={isLoading} searchable={false} showColumnVisibility={false} pagination={false}
      error={isError ? "Notifications could not be loaded. Please try again." : null} onRetry={() => refetch()}
      emptyMessage={category || search || unreadOnly ? "No notifications match your filters." : "Your inbox is clear. New updates will appear here."}
      renderMobileCard={row => <article className={row.readAt ? styles.notificationCard : styles.unreadCard} aria-label={row.title}>
        <div className={styles.cardHeading}>{renderBadges(row)}{renderActions(row)}</div>
        {renderContent(row)}
        <div className={styles.cardFooter}><time dateTime={row.createdAt}>{formatTimestamp(row.createdAt)}</time>{!row.readAt ? <Button variant="ghost" size="sm" className={styles.readAction} aria-label={`Mark ${row.title} as read`} onClick={() => performAction(() => markAsRead(row.id))}><Check className="h-4 w-4" /><span>Mark read</span></Button> : <span>Read</span>}</div>
      </article>}
    />
    {!isLoading && !isError && <footer className={styles.pagination}><p>{notifications.length ? `${(pagination.page - 1) * pagination.limit + 1}\u2013${(pagination.page - 1) * pagination.limit + notifications.length} of ${pagination.total}` : "0 notifications"}</p><Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} /></footer>}
  </section>;

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>Notifications</h1><p>{isLoading ? "Loading your inbox..." : isError ? "Your updates and team announcements." : unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}` : "You are all caught up."}</p></div>
      <div className={styles.headerActions}>
        {canSendNotifications && <Button size="sm" onClick={() => setIsSendModalOpen(true)} aria-label="New notification" className={styles.composeButton}><Send className="h-4 w-4" /><span className={styles.composeLabel}>New notification</span><span className={styles.shortComposeLabel}>New</span></Button>}
        <Dropdown align="right" width="w-60" trigger={<Button size="sm" variant="outline" aria-label="Inbox options" className={styles.iconAction}><MoreHorizontal className="h-4 w-4" /></Button>} items={[
          { label: "Refresh inbox", icon: <RotateCw className="h-4 w-4" />, disabled: isLoading, onClick: () => { void refetch(); } },
          ...(canSendNotifications ? [{ label: "Send test notification", icon: <Sparkles className="h-4 w-4" />, disabled: isTestLoading, onClick: () => { void handleTestTrigger(); } }] : []),
        ]} />
      </div>
    </header>
    <div className={styles.inboxHeader}>
      <Tabs className={styles.tabs} variant="underline" scrollActiveIntoView={false} activeTab={unreadOnly ? "unread" : "all"} onChange={id => { setUnreadOnly(id === "unread"); setPage(1); }} tabs={[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }]} />
      {!isLoading && !isError && unreadCount > 0 && <Button variant="ghost" size="sm" className={styles.markAll} onClick={() => performAction(() => markAllAsRead())}><CheckCheck className="h-4 w-4" />Mark all read</Button>}
    </div>
    {inbox}

    <Modal open={isSendModalOpen && canSendNotifications} onClose={() => { if (!isSending) setIsSendModalOpen(false); }} busy={isSending} title="New notification" description="Choose recipients and delivery channels." size="lg" bodyClassName={styles.composerBody} footerClassName={styles.modalFooter} footer={<><Button variant="outline" onClick={() => setIsSendModalOpen(false)} disabled={isSending}>Cancel</Button><Button type="submit" form="notification-composer" loading={isSending} icon={<Send className="h-4 w-4" />}>Send notification</Button></>}>
      <form id="notification-composer" onSubmit={handleSendNotification} className={styles.composer}>
        <fieldset className={styles.channels}><legend>Send by</legend><div><Checkbox aria-label="In-app notification" label="In-app notification" description="Delivered to their inbox" checked={sendInApp} onChange={event => setSendInApp(event.target.checked)} /><Checkbox aria-label="Email" label="Email" description="Delivered to their email address" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} /></div></fieldset>
        <div className={styles.formGrid}>
          <Select label="Recipients" value={recipientScope} onChange={event => setRecipientScope(event.target.value)} options={[{ value: "all", label: "All members" }, { value: "user", label: "One person" }, { value: "admin", label: "Administrators" }, { value: "doctor", label: "Doctors" }, { value: "staff", label: "Receptionists and staff" }]} />
          {recipientScope === "user" && <Select label="Person" value={targetUserId} onChange={event => setTargetUserId(event.target.value)} options={[{ value: "", label: "Choose a person" }, ...orgUsers.map(person => ({ value: person.id, label: `${person.name} (${person.email}) \u00b7 ${person.role}` }))]} />}
          <Select label="Category" value={formCategory} onChange={event => setFormCategory(event.target.value)} options={CATEGORIES.filter(option => option.value !== "auth")} />
          <Select label="Notice type" value={formSeverity} onChange={event => setFormSeverity(event.target.value)} options={[{ value: "info", label: "Information" }, { value: "success", label: "Confirmation" }, { value: "warning", label: "Needs attention" }, { value: "error", label: "Urgent issue" }]} />
          <Select label="Priority" value={formPriority} onChange={event => setFormPriority(event.target.value)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Standard" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
        </div>
        <Input label="Title" placeholder="What is this notification about?" value={formTitle} onChange={event => setFormTitle(event.target.value)} required />
        <Textarea label="Message" placeholder="Write a clear message for recipients" rows={4} value={formMessage} onChange={event => setFormMessage(event.target.value)} required />
        <Input label="Related page (optional)" placeholder="e.g. /dashboard/appointments" value={formActionUrl} onChange={event => setFormActionUrl(event.target.value)} />
      </form>
    </Modal>

    <Modal open={!!viewingNotification} onClose={() => setViewingNotification(null)} title="Notification details" size="md" bodyClassName={styles.detailBody} footerClassName={styles.modalFooter} footer={<Button variant="outline" onClick={() => setViewingNotification(null)}>Close</Button>}>
      {viewingNotification && <div className={styles.details}>
        {renderBadges(viewingNotification, false)}
        <time dateTime={viewingNotification.createdAt}>{formatTimestamp(viewingNotification.createdAt)}</time>
        <h2>{viewingNotification.title}</h2><p>{viewingNotification.message}</p>
      </div>}
    </Modal>
    <ConfirmDialog open={deletingIds.length > 0} onClose={() => { if (!isDeleting) setDeletingIds([]); }} loading={isDeleting} title={deletingIds.length > 1 ? `Delete ${deletingIds.length} Notifications` : "Delete Notification"} description={deletingIds.length > 1 ? `Delete these ${deletingIds.length} selected notifications? This cannot be undone.` : "Delete this notification? This cannot be undone."} variant="danger" confirmLabel={deletingIds.length > 1 ? `Delete (${deletingIds.length})` : "Delete"} onConfirm={async () => {
      if (!deletingIds.length || isDeleting) return;
      setIsDeleting(true);
      try {
        const count = deletingIds.length;
        await Promise.all(deletingIds.map(id => deleteNotification(id)));
        setDeletingIds([]);
        toast({ title: count > 1 ? "Notifications Deleted" : "Notification Deleted", description: `${count} notification(s) removed successfully.`, variant: "warning" });
        void refetch();
      } catch { toast({ title: "Notifications could not be deleted", description: "Please try again.", variant: "error" }); }
      finally { setIsDeleting(false); }
    }} />
  </div>;
}
