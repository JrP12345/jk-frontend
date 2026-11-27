export const HAPTICS_STORAGE_KEY = "ekavyu_haptics";
export type HapticKind = "selection" | "success" | "warning" | "error" | "alert";

const HAPTIC_COOLDOWN_MS = 150;
const HAPTIC_PRIORITY: Record<HapticKind, number> = {
  selection: 1,
  success: 2,
  warning: 2,
  error: 3,
  alert: 4,
};
const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 16,
  success: [24, 45, 32],
  warning: [30, 50, 30],
  error: [45, 50, 65],
  alert: [250, 100, 250, 100, 400],
};

let lastVibration = 0;
let lastPriority = 0;
let feedbackSequence = 0;

/** Returns whether this browser exposes the Web Vibration API. */
export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Returns whether reduced motion is requested, pausing non-essential haptics. */
export function isReducedMotionPreferred(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

/** Reads the user's haptic preference, defaulting to enabled. */
export function isHapticsEnabled(): boolean {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(HAPTICS_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Persists the user's haptic preference to localStorage. */
export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "on" : "off");
  } catch { /* Ignore storage restrictions in private modes. */ }
}

/** Skips desktop mouse clicks while allowing touch, pen, and synthetic click events. */
export function isTouchClickEvent(event?: { nativeEvent?: Event }): boolean {
  const native = event?.nativeEvent as { pointerType?: unknown } | undefined;
  return !(native && typeof native.pointerType === "string" && native.pointerType === "mouse");
}

/** Runs an interaction callback and triggers a light selection pulse unless a higher-priority haptic already fired. */
export function runWithTouchSelectionHaptic<T>(event: { nativeEvent?: Event } | undefined, callback: () => T): T {
  const hapticBefore = feedbackSequence;
  const result = callback();
  if (feedbackSequence === hapticBefore && isTouchClickEvent(event)) {
    vibrateFeedback("selection");
  }
  return result;
}

/** Triggers tactile feedback with priority cooldown so taps never silence outcomes. */
export function vibrateFeedback(kind: HapticKind = "selection"): boolean {
  if (!isHapticsSupported()) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  try {
    if (!isHapticsEnabled()) return false;
    if (isReducedMotionPreferred()) return false;
    const now = Date.now();
    const priority = HAPTIC_PRIORITY[kind];
    if (now - lastVibration < HAPTIC_COOLDOWN_MS && priority <= lastPriority) return false;
    const accepted = navigator.vibrate(HAPTIC_PATTERNS[kind]);
    if (accepted === false) return false;
    lastVibration = now;
    lastPriority = priority;
    feedbackSequence += 1;
    return true;
  } catch {
    /* Haptics are optional on unsupported devices. */
    return false;
  }
}
