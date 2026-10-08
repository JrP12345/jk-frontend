/** Use the configured frontend origin, never a request Host or the API origin. */
export function getSiteUrl(): URL | undefined {
  const value = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "[::]" || hostname === "0.0.0.0" || hostname.startsWith("127."))) return undefined;
    return new URL(url.origin);
  } catch { return undefined; }
}

export function absolutePublicUrl(path: string): string | undefined {
  const origin = getSiteUrl();
  return origin ? new URL(path, origin).href : undefined;
}
