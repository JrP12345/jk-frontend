import { cache } from "react";

export function publicBackendUrl() {
  return (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000")
    .replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

// Only absence is a 404. Timeouts and upstream failures must not remove profiles from search.
export const getPublicProfile = cache(async (path: string) => {
  const response = await fetch(`${publicBackendUrl()}/api/public/${path}`, {
    cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public profile service is temporarily unavailable");
  const result = await response.json();
  if (!result.data) throw new Error("Public profile service returned an invalid response");
  return result.data;
});
