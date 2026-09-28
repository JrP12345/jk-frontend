import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { notificationService } from "@/services/notificationService";
import { forceResetScrollLock } from "@/lib/scrollLock";

const mocks = vi.hoisted(() => ({ read: vi.fn(), all: vi.fn(), snooze: vi.fn(), pin: vi.fn(), toast: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({ unreadCount: 1, markAsRead: mocks.read, markAllAsRead: mocks.all, snoozeNotification: mocks.snooze, togglePinNotification: mocks.pin }) }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), useToast: () => ({ toast: mocks.toast }) }));
const notification = { id: "notice", category: "auth", title: "New account login", message: "Review your recent sign-in activity.", createdAt: "2026-09-27T08:00:00Z", readAt: null, pinned: false, severity: "info" };
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(notificationService, "getNotifications").mockResolvedValue({ notifications: [notification], unreadCount: 1 } as never);
});
afterEach(() => { client.clear(); forceResetScrollLock(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function openPreview() {
  render(<QueryClientProvider client={client}><NotificationBell /></QueryClientProvider>);
  const trigger = screen.getByRole("button", { name: "Open Notifications" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Notifications" });
  await within(dialog).findByText(notification.title);
  expect(within(dialog).getByText("Account activity")).toBeInTheDocument();
  return { trigger, dialog };
}

it("closes the notification action menu before its parent dialog and restores focus", async () => {
  const { trigger, dialog } = await openPreview();
  fireEvent.click(within(dialog).getByRole("button", { name: `Actions for ${notification.title}` }));
  await screen.findByRole("menu");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(dialog).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it("places the compact preview below navigation on a shared blurred backdrop", async () => {
  const header = document.createElement("header");
  header.dataset.appHeader = "";
  header.getBoundingClientRect = () => ({ top: 0, bottom: 72, height: 72 } as DOMRect);
  document.body.append(header);
  try {
    const { dialog } = await openPreview();
    const viewport = dialog.parentElement!;
    expect(viewport).toHaveClass("notification-dialog-viewport");
    await waitFor(() => expect(viewport).toHaveStyle({ "--toast-header-offset": "84px" }));
    expect(dialog.previousElementSibling).toHaveClass("overlay-backdrop");
  } finally {
    header.remove();
  }
});

it("prevents duplicate notification mutations and shows one loading indicator", async () => {
  let complete!: () => void;
  mocks.pin.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const { dialog } = await openPreview();
  const actions = within(dialog).getByRole("button", { name: `Actions for ${notification.title}` });
  fireEvent.click(actions);
  const pin = await screen.findByRole("menuitem", { name: "Pin notification" });
  fireEvent.click(pin); fireEvent.click(pin);
  expect(mocks.pin).toHaveBeenCalledOnce();
  expect(actions).toBeDisabled();
  expect(within(dialog).getAllByRole("status")).toHaveLength(1);
  await act(async () => complete());
  expect(actions).toBeEnabled();
});

it("keeps notification failures local and allows the action to be retried", async () => {
  mocks.all.mockRejectedValueOnce(new Error("Offline"));
  const { dialog } = await openPreview();
  const markAll = within(dialog).getByRole("button", { name: "Mark all read" });
  fireEvent.click(markAll);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Notification could not be updated" })));
  expect(markAll).toBeEnabled();
  expect(dialog).toBeInTheDocument();
});
