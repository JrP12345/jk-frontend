import { create } from "zustand";

const recoveryKey = "ekavyu-recent-tracker";
const memoryCapabilities = new Map<string, string>();
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
interface RecentTracker { appointmentId: string; ownerId: string | null; expiresAt: number; token?: string; }
interface TrackerState { recent: RecentTracker | null; hydrate: () => void; }

/** Capabilities stay in session storage, matching the existing private tracker. */
export const useTrackerStore = create<TrackerState>((set) => ({
  recent: null,
  hydrate: () => {
    try {
      const stored = sessionStorage.getItem(recoveryKey);
      if (!stored) { set({ recent: null }); return; }
      const value = JSON.parse(stored) as RecentTracker;
      if (!validId(value.appointmentId) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || !(value.ownerId === null || typeof value.ownerId === "string")) {
        sessionStorage.removeItem(recoveryKey); set({ recent: null }); return;
      }
      const token = sessionStorage.getItem(`tracker-capability:${value.appointmentId}`);
      set({ recent: token ? { appointmentId: value.appointmentId, ownerId: value.ownerId, expiresAt: value.expiresAt, token } : null });
    } catch { /* Retain a usable in-memory link when browser storage is unavailable. */ }
  },
}));

export function getStoredTrackerToken(appointmentId: string): string | null {
  try { const token = sessionStorage.getItem(`tracker-capability:${appointmentId}`); if (token) return token; } catch { /* Fall back to this tab's memory. */ }
  const recent = useTrackerStore.getState().recent;
  return memoryCapabilities.get(appointmentId) || (recent?.appointmentId === appointmentId ? recent.token || null : null);
}

export function rememberTracker(appointmentId: string, token: string | undefined | null, ownerId: string | null, appointmentTime?: string) {
  if (!validId(appointmentId) || !token || typeof token !== "string") return;
  const now = Date.now();
  const visitTime = appointmentTime ? Date.parse(appointmentTime) : now;
  const expiresAt = Math.min(now + 90 * 86400000, Math.max(now + 86400000, (Number.isFinite(visitTime) ? visitTime : now) + 86400000));
  const metadata = { appointmentId, ownerId, expiresAt };
  memoryCapabilities.set(appointmentId, token);
  useTrackerStore.setState({ recent: { ...metadata, token } });
  try {
    sessionStorage.setItem(`tracker-capability:${appointmentId}`, token);
    sessionStorage.setItem(recoveryKey, JSON.stringify(metadata));
  } catch { /* The current tab still has its recovery link. */ }
}

export function rememberTrackerLink(link: string, ownerId: string | null, appointmentTime?: string) {
  try {
    const url = new URL(link, window.location.origin);
    const match = url.pathname.match(/^\/track\/([a-zA-Z0-9_-]{1,128})\/?$/);
    if (url.origin !== window.location.origin || !match) return;
    rememberTracker(match[1], url.searchParams.get("t") || getStoredTrackerToken(match[1]), ownerId, appointmentTime);
  } catch { /* A malformed link never becomes a navigation destination. */ }
}

export function clearRecentTracker(appointmentId?: string) {
  const recent = useTrackerStore.getState().recent;
  if (appointmentId && recent?.appointmentId !== appointmentId) return;
  useTrackerStore.setState({ recent: null });
  try {
    sessionStorage.removeItem(recoveryKey);
  } catch { /* Memory was cleared even if storage is blocked. */ }
  if (!appointmentId) memoryCapabilities.clear();
}
