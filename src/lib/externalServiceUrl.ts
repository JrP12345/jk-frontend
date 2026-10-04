/** Only open configured absolute web links; relative workspace URLs are not meetings. */
export function externalServiceUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
