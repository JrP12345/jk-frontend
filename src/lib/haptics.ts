let lastVibration = 0;

export function vibrateFeedback(kind: "selection" | "success" | "error" = "selection") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    if (localStorage.getItem("ananta_haptics") === "off") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (Date.now() - lastVibration < 150) return;
    navigator.vibrate(kind === "success" ? [20, 40, 20] : kind === "error" ? [35, 40, 35] : 10);
    lastVibration = Date.now();
  } catch { /* Haptics are optional on unsupported devices. */ }
}
