import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Inbox from "@/app/(dashboard)/dashboard/notifications/page";
import { ToastProvider } from "@/components/ui";
import { notificationService, type NotificationItem } from "@/services/notificationService";
import { useAuthStore } from "@/store/authStore";
import { forceResetScrollLock } from "@/lib/scrollLock";

const actions = vi.hoisted(() => ({ read: vi.fn(), all: vi.fn(), pin: vi.fn(), remove: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({ markAsRead: actions.read, markAllAsRead: actions.all, togglePinNotification: actions.pin, deleteNotification: actions.remove }) }));
const notice: NotificationItem = { id: "notice-a", targetUser: "root", category: "auth", type: "LOGIN", title: "New device signed in", message: "Review your recent sign-in activity.", priority: "high", severity: "warning", createdAt: "2026-10-17T10:00:00Z", readAt: null, pinned: true };
const response = (notifications = [notice], page = 1, total = notifications.length) => ({ notifications, unreadCount: 1, pagination: { page, limit: 15, total, totalPages: Math.max(1, Math.ceil(total / 15)) } });
let client: QueryClient;
const mount = () => render(<QueryClientProvider client={client}><ToastProvider><Inbox /></ToastProvider></QueryClientProvider>);
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useAuthStore.setState({ user: { id: "root", name: "Root", email: "root@example.test", role: "root" }, isAuthenticated: true, isLoading: false });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.values(actions).forEach(mock => mock.mockReset().mockResolvedValue(undefined));
  vi.spyOn(notificationService, "getNotifications").mockResolvedValue(response());
  vi.spyOn(notificationService, "getOrganizationUsers").mockResolvedValue([{ id: "doctor-a", name: "Dr. Mehta", email: "doctor@example.test", role: "doctor" }]);
  vi.spyOn(notificationService, "sendNotification").mockResolvedValue({ success: true });
  vi.spyOn(notificationService, "triggerTestNotification").mockResolvedValue({ success: true });
});
afterEach(() => { cleanup(); client.clear(); forceResetScrollLock(); vi.restoreAllMocks(); });

it("uses one server pager, displays all 15 results, and resets page when filters change", async () => {
  const notices = Array.from({ length: 15 }, (_, index) => ({ ...notice, id: `notice-${index}`, title: `Notification ${index + 1}` }));
  vi.mocked(notificationService.getNotifications).mockImplementation(async params => response(notices, params?.page || 1, 30));
  mount();
  expect(await screen.findAllByRole("article")).toHaveLength(15);
  expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  expect(screen.getAllByRole("navigation", { name: "Pagination Navigation" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
  await waitFor(() => expect(notificationService.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 15 })));
  fireEvent.click(screen.getByRole("combobox", { name: "Notification category" }));
  fireEvent.click(screen.getByRole("option", { name: "Security" }));
  await waitFor(() => expect(notificationService.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, category: "security" })));
  fireEvent.click(screen.getByRole("tab", { name: "Unread" }));
  await waitFor(() => expect(notificationService.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, unreadOnly: true, category: "security" })));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notifications" }), { target: { value: "clinic" } });
  await waitFor(() => expect(notificationService.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "clinic" })));
});

it("opens full details with a native title button and marks an unread notification once", async () => {
  mount();
  const row = await screen.findByRole("article", { name: notice.title });
  fireEvent.click(within(row).getByRole("button", { name: notice.title }));
  const dialog = screen.getByRole("dialog", { name: "Notification details" });
  expect(within(dialog).getByRole("heading", { name: notice.title })).toBeInTheDocument();
  expect(within(dialog).getByText(notice.message)).toBeInTheDocument();
  expect(actions.read).toHaveBeenCalledExactlyOnceWith(notice.id);
  expect(actions.push).not.toHaveBeenCalled();
});

it("opens the related page for a linked notification and does not mark an already read item again", async () => {
  vi.mocked(notificationService.getNotifications).mockResolvedValue(response([{ ...notice, readAt: "2026-10-17T11:00:00Z", actionUrl: "/dashboard/appointments" }]));
  mount();
  const row = await screen.findByRole("article", { name: notice.title });
  fireEvent.click(within(row).getByRole("button", { name: notice.title }));
  expect(actions.push).toHaveBeenCalledWith("/dashboard/appointments");
  expect(actions.read).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps pin, mark read, and mark all actions available without opening the notification", async () => {
  mount();
  const row = await screen.findByRole("article", { name: notice.title });
  fireEvent.click(within(row).getByRole("button", { name: `Options for ${notice.title}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Unpin notification" }));
  await waitFor(() => expect(actions.pin).toHaveBeenCalledWith(notice.id));
  fireEvent.click(within(row).getByRole("button", { name: `Mark ${notice.title} as read` }));
  await waitFor(() => expect(actions.read).toHaveBeenCalledWith(notice.id));
  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
  await waitFor(() => expect(actions.all).toHaveBeenCalledOnce());
  expect(actions.push).not.toHaveBeenCalled();
});

it("limits bulk actions to selected notifications and clears selection when changing filters", async () => {
  vi.mocked(notificationService.getNotifications).mockResolvedValue(response([notice, { ...notice, id: "notice-read", title: "Read update", readAt: "2026-10-17T11:00:00Z" }]));
  mount();
  await screen.findByRole("article", { name: notice.title });
  fireEvent.click(screen.getAllByRole("checkbox", { name: `Select row ${notice.id}` })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Mark Selected as Read" }));
  await waitFor(() => expect(actions.read).toHaveBeenCalledExactlyOnceWith(notice.id));
  fireEvent.click(screen.getByRole("tab", { name: "Unread" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Delete Selected" })).not.toBeInTheDocument());
  expect(actions.remove).not.toHaveBeenCalled();
});

it("requires delete confirmation and keeps recovery available after failure", async () => {
  actions.remove.mockRejectedValueOnce(new Error("Offline"));
  mount();
  const row = await screen.findByRole("article", { name: notice.title });
  fireEvent.click(within(row).getByRole("button", { name: `Options for ${notice.title}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete notification" }));
  const dialog = screen.getByRole("dialog", { name: "Delete Notification" });
  expect(actions.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  expect(await screen.findByText("Notifications could not be deleted")).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(actions.remove).toHaveBeenCalledTimes(2);
});

it("sends only on form submission with the selected recipient and channels", async () => {
  mount();
  await screen.findByRole("article", { name: notice.title });
  fireEvent.click(screen.getByRole("button", { name: "New notification" }));
  const dialog = screen.getByRole("dialog", { name: "New notification" });
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Recipients" }));
  fireEvent.click(screen.getByRole("option", { name: "One person" }));
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Person" }));
  fireEvent.click(await screen.findByRole("option", { name: /Dr. Mehta/ }));
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Email" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), { target: { value: "Clinic update" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Message" }), { target: { value: "Please review today's schedule." } });
  expect(notificationService.sendNotification).not.toHaveBeenCalled();
  fireEvent.submit(document.getElementById("notification-composer")!);
  await waitFor(() => expect(notificationService.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientScope: "user", targetUserId: "doctor-a", title: "Clinic update", channels: { inApp: true, email: false } })));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("requires a delivery channel and preserves the composer after send failure", async () => {
  vi.mocked(notificationService.sendNotification).mockRejectedValueOnce(new Error("Offline"));
  mount();
  await screen.findByRole("article", { name: notice.title });
  fireEvent.click(screen.getByRole("button", { name: "New notification" }));
  const dialog = screen.getByRole("dialog", { name: "New notification" });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "In-app notification" }));
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Email" }));
  fireEvent.submit(document.getElementById("notification-composer")!);
  expect(screen.getByText("Choose a delivery method")).toBeInTheDocument();
  expect(notificationService.sendNotification).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Email" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), { target: { value: "Saved draft" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Message" }), { target: { value: "Draft message" } });
  fireEvent.submit(document.getElementById("notification-composer")!);
  expect(await screen.findByText("Notification could not be sent")).toBeInTheDocument();
  expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Saved draft");
});

it("offers inbox retry without presenting a failed read as an empty inbox", async () => {
  vi.mocked(notificationService.getNotifications).mockRejectedValueOnce(new Error("Offline"));
  mount();
  await screen.findByText("Notifications could not be loaded. Please try again.");
  expect(screen.queryByText("You are all caught up.")).not.toBeInTheDocument();
  expect(screen.queryByText("Your inbox is clear. New updates will appear here.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("article", { name: notice.title })).toBeInTheDocument();
});

it("hides composer and test delivery from staff without management permission", async () => {
  useAuthStore.setState({ user: { id: "staff", name: "Staff", email: "staff@example.test", role: "doctor", permissions: [] } });
  mount();
  await screen.findByRole("article", { name: notice.title });
  expect(screen.queryByRole("button", { name: "New notification" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Inbox options" }));
  expect(await screen.findByRole("menuitem", { name: "Refresh inbox" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Send test notification" })).not.toBeInTheDocument();
  expect(notificationService.getOrganizationUsers).not.toHaveBeenCalled();
  expect(notificationService.sendNotification).not.toHaveBeenCalled();
});
