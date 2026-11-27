import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { notificationService } from "@/services/notificationService";
import { forceResetScrollLock } from "@/lib/scrollLock";

const mocks = vi.hoisted(() => ({ read: vi.fn(), all: vi.fn(), snooze: vi.fn(), pin: vi.fn(), toast: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({ unreadCount: 1, markAsRead: mocks.read, markAllAsRead: mocks.all, snoozeNotification: mocks.snooze, togglePinNotification: mocks.pin }) }));
vi.mock("@/components/ui/Toast", async original => ({ ...await original<typeof import("@/components/ui/Toast")>(), useToast: () => ({ toast: mocks.toast }) }));
const notification = { id: "notice", category: "auth", title: "New account login", message: "Review your recent sign-in activity.", createdAt: "2026-09-27T08:00:00Z", readAt: null, pinned: false, severity: "info" };
class TouchPointer extends MouseEvent {
  pointerId: number; pointerType: string; isPrimary: boolean;
  constructor(type: string, options: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? "touch";
    this.isPrimary = options.isPrimary ?? true;
  }
}
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("PointerEvent", TouchPointer);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(notificationService, "getNotifications").mockResolvedValue({ notifications: [notification], unreadCount: 1 } as never);
});
afterEach(() => { client.clear(); forceResetScrollLock(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openPreview() {
  render(<QueryClientProvider client={client}><NotificationBell /></QueryClientProvider>);
  const trigger = screen.getByRole("button", { name: /^Open Notifications/ });
  trigger.focus();
  fireEvent.click(trigger);
  const dropdown = await screen.findByRole("region", { name: "Notifications" });
  await within(dropdown).findByText(notification.title);
  expect(within(dropdown).getByText("Account activity")).toBeInTheDocument();
  return { trigger, dropdown };
}

it("closes on a horizontal swipe over a notification without hijacking vertical scroll", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  const { dropdown } = await openPreview();
  const item = within(dropdown).getByText(notification.title);
  const start = { pointerType: "touch", pointerId: 1, isPrimary: true, clientX: 180, clientY: 160 };

  fireEvent.pointerDown(item, start);
  fireEvent.pointerMove(item, { ...start, clientX: 174, clientY: 245 });
  fireEvent.pointerUp(item, { ...start, clientX: 174, clientY: 245 });
  expect(dropdown).toBeInTheDocument();

  fireEvent.pointerDown(item, start);
  fireEvent.pointerMove(item, { ...start, clientX: 90, clientY: 163 });
  fireEvent.pointerUp(item, { ...start, clientX: 90, clientY: 163 });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument());
  expect(mocks.read).not.toHaveBeenCalled();
});

it("closes the notification action menu before its parent dropdown and restores focus", async () => {
  const { trigger, dropdown } = await openPreview();
  fireEvent.click(within(dropdown).getByRole("button", { name: `Actions for ${notification.title}` }));
  await screen.findByRole("menu");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(dropdown).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("renders as an anchored header dropdown instead of a modal dialog or blurred backdrop", async () => {
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 800);
  render(
    <QueryClientProvider client={client}>
      <div>
        <NotificationBell />
        <button type="button">Outside control</button>
      </div>
    </QueryClientProvider>,
  );
  const trigger = screen.getByRole("button", { name: /^Open Notifications/ });
  trigger.getBoundingClientRect = () => ({ left: 1120, right: 1164, top: 14, bottom: 58, width: 44, height: 44 } as DOMRect);
  fireEvent.click(trigger);

  const dropdown = await screen.findByRole("region", { name: "Notifications" });
  await within(dropdown).findByText(notification.title);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.querySelector(".overlay-backdrop")).not.toBeInTheDocument();
  expect(document.body.style.position).not.toBe("fixed");
  expect(dropdown.style.top).toBe("66px");
  expect(dropdown.style.left).toBe("780px");
  expect(dropdown.style.width).toBe("384px");

  fireEvent.mouseDown(screen.getByRole("button", { name: "Outside control" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument());
});

it("prevents duplicate notification mutations and shows one loading indicator", async () => {
  let complete!: () => void;
  mocks.pin.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const { dropdown } = await openPreview();
  const actions = within(dropdown).getByRole("button", { name: `Actions for ${notification.title}` });
  fireEvent.click(actions);
  const pin = await screen.findByRole("menuitem", { name: "Pin notification" });
  fireEvent.click(pin); fireEvent.click(pin);
  expect(mocks.pin).toHaveBeenCalledOnce();
  expect(actions).toBeDisabled();
  expect(within(dropdown).getAllByRole("status")).toHaveLength(1);
  await act(async () => complete());
  expect(actions).toBeEnabled();
});

it("keeps notification failures local and allows the action to be retried", async () => {
  mocks.all.mockRejectedValueOnce(new Error("Offline"));
  const { dropdown } = await openPreview();
  const markAll = within(dropdown).getByRole("button", { name: "Mark all read" });
  fireEvent.click(markAll);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Notification could not be updated" })));
  expect(markAll).toBeEnabled();
  expect(dropdown).toBeInTheDocument();
});
