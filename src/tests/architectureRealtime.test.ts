import { afterEach, describe, expect, it, vi } from "vitest";
import { createReconnectingSocket } from "@/utils/websocket";

class FakeSocket {
  static sockets: FakeSocket[] = [];
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { FakeSocket.sockets.push(this); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); FakeSocket.sockets = []; });
describe("queue reconnect lifecycle", () => {
  it("reconciles on reconnect, preserves handlers and cancels pending reconnect on cleanup", async () => {
    vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
    const reconcile = vi.fn(), message = vi.fn();
    const connection = createReconnectingSocket("/api/queue/ws?clinicId=fixture", reconcile);
    connection.onmessage = message;
    FakeSocket.sockets[0].onopen?.(new Event("open"));
    FakeSocket.sockets[0].onclose?.({ code: 1006 } as CloseEvent);
    await vi.advanceTimersByTimeAsync(1300);
    expect(FakeSocket.sockets).toHaveLength(2);
    FakeSocket.sockets[1].onopen?.(new Event("open"));
    FakeSocket.sockets[1].onmessage?.(new MessageEvent("message", { data: "update" }));
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(message).toHaveBeenCalledTimes(1);
    FakeSocket.sockets[1].onclose?.({ code: 1006 } as CloseEvent);
    connection.close(); await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.sockets).toHaveLength(2);
  });
  it("does not reconnect permission-denied connections", async () => {
    vi.useFakeTimers(); vi.stubGlobal("WebSocket", FakeSocket);
    const connection = createReconnectingSocket("/api/queue/ws", vi.fn());
    FakeSocket.sockets[0].onclose?.({ code: 1008 } as CloseEvent);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.sockets).toHaveLength(1);
    connection.close();
  });
});
