/** Sanitize presentation only; transport errors retain codes used by callers. */
export function userFacingError(message: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof message !== "string") return fallback;
  const text = message.trim();
  if (/organization context (?:is )?required/i.test(text)) return "Select a healthcare organization to continue. If one is already selected, sign in again.";
  if (/cross-tenant|tenant scope|organization mismatch/i.test(text)) return "This action is unavailable for your selected organization. Choose the correct organization and try again.";
  const technical = /E11000|Mongo(?:Server|BulkWrite|Network)Error|CastError|TypeError|ReferenceError|SyntaxError|AxiosError|Prisma\w*Error|SQLSTATE|ObjectId|ECONN\w+|ETIMEDOUT|node_modules|\/opt\/|[a-z]:\\|\bat\s+\S+\s*\([^)]*:\d+|<\/?[a-z][^>]*>|"(?:stack|code|message)"\s*:|\b(?:internal server error|bad gateway|network error|failed to fetch|request failed with status code \d+|timeout of \d+ms exceeded|jwt expired)\b|\b[a-z]+(?:_[a-z0-9]+)+\b/i;
  if (!text || text.length > 300 || /^[\[{]/.test(text) || technical.test(text) || /\b[a-z]+[A-Z][a-zA-Z]*\b/.test(text)) return fallback;
  return text;
}
