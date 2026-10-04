import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NotificationRealtime } from "@/components/NotificationRealtime";
import { useNotifications } from "@/hooks/useNotifications";
const mocks = vi.hoisted(() => ({ toast: vi.fn(), user: { id: "u1", organization_id: "org1" } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: Object.assign(
  (selector?: any) => selector ? selector({ user: mocks.user }) : { user: mocks.user },
  { getState: () => ({ user: mocks.user }) },
) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/api", () => ({ getApiUrl: () => "https://example.test/api" }));
vi.mock("@/utils/websocket", () => ({ getWebSocketUrl: () => "wss://example.test/api/ws" }));
vi.mock("@/services/notificationService", () => ({ notificationService: { getUnreadCount: async () => 0 } }));
class Socket {
  static instances: Socket[] = [];
  onclose?: () => void; onerror?: () => void; onmessage?: (event: { data: string }) => void;
  constructor() { Socket.instances.push(this); }
  close = vi.fn(() => this.onclose?.());
}
class Stream {
  static instances: Stream[] = [];
  onmessage?: (event: { data: string }) => void;
  constructor() { Stream.instances.push(this); }
  close = vi.fn();
}
function Consumer() { useNotifications(); return null; }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><NotificationRealtime /><Consumer /><Consumer /></QueryClientProvider>);
  return { ...view, client };
}
describe("notification connection ownership", () => {
  beforeEach(() => { Socket.instances = []; Stream.instances = []; mocks.toast.mockClear(); vi.stubGlobal("WebSocket", Socket); vi.stubGlobal("EventSource", Stream); });
  afterEach(() => vi.unstubAllGlobals());
  it("uses one connection for multiple consumers and deduplicates delivery", () => {
    const { unmount, client } = mount();
    expect(Socket.instances).toHaveLength(1);
    const event = { data: JSON.stringify({ type: "NOTIFICATION_RECEIVED", data: { notification: { id: "n1", title: "Result ready", message: "Review", severity: "info" }, unreadCount: 1 } }) };
    act(() => { Socket.instances[0].onmessage?.(event); Socket.instances[0].onmessage?.(event); });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    unmount(); client.clear();
    expect(Socket.instances[0].close).toHaveBeenCalledTimes(1);
    expect(Stream.instances).toHaveLength(0);
  });
  it("starts one fallback stream and closes it without reconnecting on unmount", () => {
    const { unmount, client } = mount();
    act(() => { Socket.instances[0].onerror?.(); Socket.instances[0].onclose?.(); });
    expect(Stream.instances).toHaveLength(1);
    unmount(); client.clear();
    expect(Stream.instances[0].close).toHaveBeenCalledTimes(1);
    expect(Stream.instances).toHaveLength(1);
  });
});
