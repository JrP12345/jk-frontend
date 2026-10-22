import { userFacingError } from "./userFacingError";

type ApiFailure = { code?: string; isAxiosError?: boolean; response?: { status?: number; data?: { message?: unknown } } };

export function apiErrorKind(error: unknown) {
  const failure = error as ApiFailure | null;
  const status = failure?.response?.status;
  if (failure?.code === "ERR_CANCELED") return "cancelled";
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status && status >= 500) return "server";
  if (status && status >= 400) return "validation";
  if (["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(failure?.code || "") || failure?.isAxiosError && !failure.response) return "unavailable";
  return "unknown";
}

/** Presentation only: callers retain the original error and never retry writes here. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  switch (apiErrorKind(error)) {
    case "unavailable": return "The service is temporarily unavailable. Check your connection and try again shortly.";
    case "server": return "The service could not complete this request. Please try again shortly.";
    case "rate_limited": return "Too many requests. Please wait before trying again.";
    case "cancelled": return "The request was cancelled.";
    default: return userFacingError((error as ApiFailure | null)?.response?.data?.message ?? (error instanceof Error ? error.message : undefined), fallback);
  }
}

export const SESSION_UNAVAILABLE_MESSAGE = "We couldn't verify your session. Check your connection and try again.";
