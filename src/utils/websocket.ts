/**
 * Utility to resolve the correct WebSocket endpoint across Development and Production.
 *
 * In production (e.g., Vercel + Render):
 * - Vercel serverless does NOT support persistent WebSockets.
 * - WebSockets must connect directly to the Render backend service.
 * - Prioritizes NEXT_PUBLIC_WS_URL, then translates NEXT_PUBLIC_BACKEND_URL to ws:// or wss://,
 *   and finally falls back to window.location or localhost.
 */
export function getWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Explicit WebSocket URL (e.g. wss://project-jk-backend.onrender.com)
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const base = process.env.NEXT_PUBLIC_WS_URL.replace(/\/+$/, "");
    return `${base}${normalizedPath}`;
  }

  // 2. Derive from Backend HTTP(S) URL
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl && /^https?:\/\//i.test(backendUrl)) {
    const wsProto = backendUrl.startsWith("https") ? "wss:" : "ws:";
    const host = backendUrl.replace(/^https?:\/\//i, "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${wsProto}//${host}${normalizedPath}`;
  }

  // 3. Browser environment fallback
  if (typeof window !== "undefined") {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // If NEXT_PUBLIC_API_URL is an absolute URL (e.g. http://localhost:5000/api)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    if (/^https?:\/\//i.test(apiUrl)) {
      let host = apiUrl.replace(/^https?:\/\//i, "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        host = host.replace("localhost", window.location.hostname).replace("127.0.0.1", window.location.hostname);
      }
      return `${wsProto}//${host}${normalizedPath}`;
    }
    // Localhost or same-host fallback
    return `${wsProto}//${window.location.host}${normalizedPath}`;
  }

  return `ws://localhost:5000${normalizedPath}`;
}

export type ReconnectingSocket = Pick<WebSocket, "onopen" | "onclose" | "onerror" | "onmessage" | "close">;

/** Reconnect and reconcile snapshots after transport loss or tab suspension. */
export function createReconnectingSocket(path: string, reconcile: () => void, authenticated = false): ReconnectingSocket {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempts = 0;
  let refreshed = false;
  const connection: ReconnectingSocket = {
    onopen: null, onclose: null, onerror: null, onmessage: null,
    close(code, reason) {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
      socket?.close(code, reason);
    },
  };
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(getWebSocketUrl(path));
    socket.onopen = event => { attempts = 0; connection.onopen?.call(socket!, event); reconcile(); };
    socket.onmessage = event => connection.onmessage?.call(socket!, event);
    socket.onerror = event => connection.onerror?.call(socket!, event);
    socket.onclose = async event => {
      connection.onclose?.call(socket!, event);
      if (stopped || [1008, 4003, 4004].includes(event.code)) return;
      if (event.code === 4001) {
        if (!authenticated || refreshed) return;
        refreshed = true;
        try { const { default: api } = await import("@/lib/api"); await api.post("/auth/refresh"); }
        catch { return; }
      }
      if (stopped) return;
      const delay = event.code === 4029 ? 60_000 : Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5));
      timer = setTimeout(connect, delay + Math.floor(Math.random() * delay * 0.2));
    };
  };
  const visible = () => { if (!stopped && document.visibilityState === "visible") reconcile(); };
  document.addEventListener("visibilitychange", visible);
  connect();
  return connection;
}
