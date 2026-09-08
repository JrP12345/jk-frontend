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
      const host = apiUrl.replace(/^https?:\/\//i, "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
      return `${wsProto}//${host}${normalizedPath}`;
    }
    // Localhost or same-host fallback
    return `${wsProto}//${window.location.host}${normalizedPath}`;
  }

  return `ws://localhost:5000${normalizedPath}`;
}
