/** Extract Google's shared embed URL; pasted HTML is never rendered. */
export function normalizeGoogleMapsEmbed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let input = value.trim();
  if (!input) return "";
  if (input.length > 16000) return null;
  if (input.startsWith("<")) {
    const iframe = input.match(/^<iframe\b[^>]*\ssrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/iframe>$/i);
    if (!iframe) return null;
    input = iframe[2].replace(/&amp;/g, "&");
  }
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "www.google.com" || url.port || url.username || url.password || url.hash || url.pathname !== "/maps/embed" || !url.searchParams.get("pb") || url.href.length > 12000) return null;
    if ([...url.searchParams.keys()].some(key => key !== "pb" && key !== "hl")) return null;
    return url.href;
  } catch { return null; }
}
