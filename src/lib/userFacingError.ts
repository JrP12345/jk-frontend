/** Sanitize presentation only; transport errors retain codes used by callers. */
export function userFacingError(message: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof message !== "string") return fallback;
  const text = message.trim();
  const technical = /E11000|Mongo(?:Server|BulkWrite|Network)Error|CastError|TypeError|ReferenceError|SyntaxError|ECONN\w+|ETIMEDOUT|node_modules|\/opt\/|[a-z]:\\|\bat\s+\S+\s*\([^)]*:\d+|<\/?[a-z][^>]*>|"(?:stack|code|message)"\s*:/i;
  if (!text || text.length > 300 || /^[\[{]/.test(text) || technical.test(text)) return fallback;
  return text;
}
