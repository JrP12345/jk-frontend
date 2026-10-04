import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationRealtime } from "@/components/NotificationRealtime";
import { useAuthStore } from "@/store/authStore";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/api", () => ({ default: {}, getApiUrl: () => "http://localhost:5000/api" }));
vi.mock("@/utils/websocket", () => ({ getWebSocketUrl: () => "ws://localhost:5000/api/ws" }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("ignores queued events from a previous scope before React disconnects the old socket", () => {
  const connections: Array<{ onmessage?: (event: { data: string }) => void; close: () => void }> = [];
  vi.stubGlobal("WebSocket", class { onmessage?: (event: { data: string }) => void; close = vi.fn(); constructor() { connections.push(this); } });
  const initial = { id: "staff", role: "admin" as const, organization_id: "org-a", name: "Staff", email: "staff@test", permissions: ["VIEW_APPOINTMENTS"] };
  useAuthStore.getState().login(initial);
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><NotificationRealtime /></QueryClientProvider>);
  const emit = (index: number, count: number) => connections[index].onmessage?.({ data: JSON.stringify({ type: "NOTIFICATION_RECEIVED", data: { unreadCount: count, notification: { id: `notice-${count}`, title: "Queue update", message: "Private", severity: "info" } } }) });
  act(() => emit(0, 1));
  expect(toast).toHaveBeenCalledOnce();
  act(() => {
    useAuthStore.getState().login({ ...initial, organization_id: "org-b" });
    client.clear();
    emit(0, 2);
  });
  expect(client.getQueryData(["notifications", "unread-count"])).toBeUndefined();
  expect(toast).toHaveBeenCalledOnce();
  expect(connections[0].close).toHaveBeenCalled();
  act(() => emit(1, 3));
  expect(client.getQueryData(["notifications", "unread-count"])).toBe(3);
  act(() => {
    useAuthStore.getState().login({ ...initial, organization_id: "org-b", permissions: [] });
    client.clear(); emit(1, 4);
  });
  expect(client.getQueryData(["notifications", "unread-count"])).toBeUndefined();
  expect(toast).toHaveBeenCalledTimes(2);
  client.clear();
});
